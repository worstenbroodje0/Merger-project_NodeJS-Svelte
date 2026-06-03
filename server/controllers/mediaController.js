const catchAsync = require('../utils/catchAsync');
const { getMediaData, getMediaById, insertMedia, newId, getMergedMediaData, getMergedMediaById, insertMergedMedia, updateMediaById, deleteMediaById, updateMergedMediaById, deleteMergedMediaById, getMediaDataSafe, getMergedMediaDataSafe } = require('../db');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// ── FFmpeg paths ──────────────────────────────────────────────────────────────
const FFMPEG = 'C:\\ffmpeg-2026-02-15-git-33b215d155-essentials_build\\bin\\ffmpeg.exe';
const FFPROBE = 'C:\\ffmpeg-2026-02-15-git-33b215d155-essentials_build\\bin\\ffprobe.exe';

// ── Directory setup ───────────────────────────────────────────────────────────
fs.mkdirSync('uploads', { recursive: true });
fs.mkdirSync('outputs', { recursive: true });
fs.mkdirSync('temp', { recursive: true });
fs.mkdirSync('thumbnails', { recursive: true });

// ── FFmpeg helpers ────────────────────────────────────────────────────────────
function runFFmpeg(args) {
    return new Promise((resolve, reject) => {
        console.log('[FFmpeg]', args.join(' '));
        const ff = spawn(FFMPEG, args);
        let errOut = '';
        ff.stderr.on('data', d => (errOut += d));
        ff.on('close', code => {
            if (code !== 0) return reject(new Error(`FFmpeg exited ${code}: ${errOut.slice(-500)}`));
            resolve();
        });
        ff.on('error', err => reject(err));
    });
}

function getVideoDuration(filePath) {
    return new Promise((resolve, reject) => {
        console.log('[FFprobe] Getting duration for:', filePath);
        console.log('[FFprobe] FFprobe path:', FFPROBE);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return reject(new Error(`File does not exist: ${filePath}`));
        }

        const ff = spawn(FFPROBE, ['-v', 'quiet', '-print_format', 'json', '-show_format', filePath]);
        let out = '';
        let errOut = '';

        ff.stdout.on('data', d => (out += d));
        ff.stderr.on('data', d => (errOut += d));

        ff.on('close', code => {
            console.log('[FFprobe] Exit code:', code);
            console.log('[FFprobe] Stdout:', out);
            console.log('[FFprobe] Stderr:', errOut);

            if (code !== 0) return reject(new Error(`FFprobe exited ${code}: ${errOut}`));
            try {
                const parsed = JSON.parse(out);
                const duration = Math.round(parseFloat(parsed.format.duration) || 0);
                console.log('[FFprobe] Duration:', duration);
                resolve(duration);
            }
            catch (e) {
                console.log('[FFprobe] Parse error:', e);
                reject(new Error(`FFprobe parse error: ${e.message}`));
            }
        });
        ff.on('error', err => {
            console.log('[FFprobe] Process error:', err);
            reject(err);
        });
    });
}

function getVideoDimensions(filePath) {
    return new Promise((resolve, reject) => {
        const ff = spawn(FFPROBE, ['-v', 'quiet', '-print_format', 'json', '-show_streams', filePath]);
        let out = '';
        ff.stdout.on('data', d => (out += d));
        ff.on('close', code => {
            if (code !== 0) return reject(new Error('FFprobe exited non-zero'));
            try {
                const vs = JSON.parse(out).streams.find(s => s.codec_type === 'video');
                resolve({ width: vs?.width || 1920, height: vs?.height || 1080 });
            } catch { reject(new Error('FFprobe parse error')); }
        });
        ff.on('error', err => reject(err));
    });
}

function generateThumbnail(videoPath, thumbPath) {
    return new Promise(resolve => {
        // Check if video file exists and is accessible
        if (!fs.existsSync(videoPath)) {
            console.warn('[thumbnail] Video file does not exist:', videoPath);
            return resolve(null);
        }

        fs.mkdirSync(path.dirname(thumbPath), { recursive: true });
        const ff = spawn(FFMPEG, [
            '-y',
            '-i', videoPath,
            '-ss', '1',
            '-vframes', '1',
            '-vf', 'scale=1280:-2',
            '-f', 'image2',
            thumbPath
        ]);
        let errOut = '';
        ff.stderr.on('data', d => (errOut += d));
        ff.on('close', code => {
            if (code !== 0) {
                console.warn('[thumbnail] FFmpeg failed:', errOut.slice(-300));
                // Clean up any partial file
                try { if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath); } catch (_) { }
            }
            resolve(code === 0 ? thumbPath : null);
        });
        ff.on('error', (err) => {
            console.warn('[thumbnail] FFmpeg error:', err.message);
            resolve(null);
        });
    });
}

function cleanupFiles(files) {
    for (const f of files) {
        try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch (_) { }
    }
}

function resolveVideoPath(video) {
    if (video.path && fs.existsSync(video.path)) return video.path;
    const candidates = [
        path.join('outputs', video.name),
        path.join('uploads', video.name),
    ];
    return candidates.find(p => fs.existsSync(p)) || null;
}

// ── Slate builder (intro/outro) ───────────────────────────────────────────────
async function buildSlate(slate, tmpFiles, videoWidth = 1920, videoHeight = 1080) {
    const duration = parseFloat(slate.duration) || 3;
    const rawColor = slate.color || slate.bgColor || slate.backgroundColor || '#000000';
    const bgColor = rawColor.startsWith('#') ? rawColor.replace('#', '0x') : rawColor;
    const outPath = path.join('temp', `_slate_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`);
    tmpFiles.push(outPath);

    console.log('[buildSlate] Building slate:', { duration, bgColor, logo: slate.logo ? 'present' : 'none' });

    let imagePath = null;

    if (slate.logo) {
        if (slate.logo.startsWith('data:')) {
            const base64Data = slate.logo.replace(/^data:image\/\w+;base64,/, '');
            const ext = slate.logo.match(/^data:(image\/\w+);/)?.[1]?.split('/')[1] || 'png';
            const tmpImg = path.join('temp', `_slate_logo_${Date.now()}.${ext}`);
            tmpFiles.push(tmpImg);
            fs.writeFileSync(tmpImg, Buffer.from(base64Data, 'base64'));
            imagePath = tmpImg;
        } else if (fs.existsSync(slate.logo)) {
            imagePath = slate.logo;
        }
    } else if (slate.imageSrc) {
        const candidates = [
            slate.imageSrc,
            path.join('uploads', path.basename(slate.imageSrc)),
        ];
        imagePath = candidates.find(p => fs.existsSync(p)) || null;
    }

    if (imagePath) {
        const pngPath = path.join('temp', `_slate_img_${Date.now()}.png`);
        tmpFiles.push(pngPath);
        await runFFmpeg(['-y', '-i', imagePath, pngPath]);

        const scaleW = Math.round(videoWidth * (parseFloat(slate.imageScale ?? 70) / 100));
        const xPct = parseFloat(slate.imageX ?? 50) / 100;
        const yPct = parseFloat(slate.imageY ?? 50) / 100;

        await runFFmpeg([
            '-y',
            '-f', 'lavfi', '-i', `color=c=${bgColor}:size=${videoWidth}x${videoHeight}:rate=30:duration=${duration}`,
            '-loop', '1', '-i', pngPath,
            '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-filter_complex', `[1:v]scale=${scaleW}:-1[img];[0:v][img]overlay=x=(W-w)*${xPct}:y=(H-h)*${yPct}:shortest=1[v]`,
            '-map', '[v]', '-map', '2:a',
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
            '-c:a', 'aac', '-ar', '44100', '-ac', '2',
            '-t', String(duration), '-r', '30', '-fps_mode', 'cfr', '-movflags', '+faststart',
            outPath,
        ]);
    } else {
        await runFFmpeg([
            '-y',
            '-f', 'lavfi', '-i', `color=c=${bgColor}:size=${videoWidth}x${videoHeight}:rate=30:duration=${duration}`,
            '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-shortest',
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
            '-c:a', 'aac', '-ar', '44100', '-ac', '2',
            '-t', String(duration), '-r', '30', '-fps_mode', 'cfr', '-movflags', '+faststart',
            outPath,
        ]);
    }

    return outPath;
}

// ── Overlay filter builder ────────────────────────────────────────────────────
function buildOverlayFilters(overlays, uploadedImages, videoWidth, videoHeight) {
    const filterParts = [];
    const extraInputs = [];
    let lastVideo = '[0:v]';
    let imgIdx = 1;

    for (let i = 0; i < overlays.length; i++) {
        const ov = overlays[i];
        const outLabel = `[v${i}]`;

        if (ov.type === 'text') {
            const fontSize = Math.round((ov.fontSize || 48) * (videoHeight / 720));
            const text = (ov.text || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:');
            const color = (ov.color || '#ffffff').replace('#', '');
            const x = `w*${((ov.xPct || 0) / 100).toFixed(6)}`;
            const y = `h*${((ov.yPct || 0) / 100).toFixed(6)}`;

            let timeEnable = '';
            if (ov.startTime != null && ov.endTime != null)
                timeEnable = `:enable='between(t,${ov.startTime},${ov.endTime})'`;

            let filter = `${lastVideo}drawtext=text='${text}':fontsize=${fontSize}:fontcolor=0x${color}:x=${x}:y=${y}`;
            if (ov.bgOpacity > 0) filter += `:box=1:boxcolor=black@${(ov.bgOpacity / 100).toFixed(2)}:boxborderw=4`;
            filter += `${timeEnable}${outLabel}`;
            filterParts.push(filter);

        } else if (ov.type === 'image') {
            const imgPath = uploadedImages[ov.fileName];
            if (!imgPath || !fs.existsSync(imgPath)) continue;
            extraInputs.push('-i', imgPath);

            const scaleW = String(Math.round((ov.widthPct || 25) / 100 * videoWidth));
            const xPos = String(Math.round((ov.xPct || 0) / 100 * videoWidth));
            const yPos = String(Math.round((ov.yPct || 0) / 100 * videoHeight));

            let timeEnable = '';
            if (ov.startTime != null && ov.endTime != null)
                timeEnable = `:enable='between(t,${ov.startTime},${ov.endTime})'`;

            filterParts.push(`[${imgIdx}:v]scale=${scaleW}:-1[img${i}]`);
            filterParts.push(`${lastVideo}[img${i}]overlay=x=${xPos}:y=${yPos}${timeEnable}${outLabel}`);
            imgIdx++;
        }

        lastVideo = outLabel;
    }

    return { filterParts, extraInputs, lastVideo };
}

// ═══════════════════════════════════════════════════════════════════ EXPORTS ══

// ── GET all media ─────────────────────────────────────────────────────────────



exports.getAllMedia = catchAsync(async (req, res) => {
    const [regularMedia, mergedMedia] = await Promise.all([
        getMediaDataSafe(),
        getMergedMediaDataSafe()
    ]);
    const all = [...regularMedia, ...mergedMedia];
    res.json({ status: 'success', results: all.length, data: all });
});

exports.getRegularMedia = catchAsync(async (req, res) => {
    const regularMedia = await getMediaDataSafe();
    const processedMedia = regularMedia.map(media => ({
        ...media,
        path: media.path ? media.path.replace(/\\/g, '/') : null,
        url: media.path ? `/uploads/${media.path.split('\\').pop()}` : null
    }));
    res.json({ status: 'success', results: processedMedia.length, data: processedMedia });
});

// ── GET single media ──────────────────────────────────────────────────────────
exports.getMedia = catchAsync(async (req, res) => {
    const entry = await getMediaById(parseInt(req.params.id, 10));
    if (!entry) return res.status(404).json({ error: 'Media not found' });
    res.json({ status: 'success', data: entry });
});

// ── Upload video ──────────────────────────────────────────────────────────────
exports.uploadVideo = catchAsync(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });

    const { originalname, path: tempPath } = req.file;
    const uniqueFilename = `${Date.now()}_${originalname}`;
    const finalPath = path.join('uploads', uniqueFilename);

    console.log('[uploadVideo] Processing file:', originalname, '->', finalPath);

    try {
        fs.renameSync(tempPath, finalPath);
        console.log('[uploadVideo] File moved successfully');
    } catch (err) {
        console.error('[uploadVideo] Failed to move file:', err);
        return res.status(500).json({ error: 'Failed to save uploaded file' });
    }

    let duration = 0;
    try {
        console.log('[uploadVideo] Getting video duration...');
        duration = await getVideoDuration(finalPath);
        console.log('[uploadVideo] Duration retrieved:', duration);
    } catch (err) {
        console.warn('[uploadVideo] Failed to get duration (continuing with 0):', err.message);
        duration = 0;
    }

    try {
        const entry = await insertMedia({
            name: uniqueFilename,
            path: finalPath,
            duration,
            format: path.extname(originalname).slice(1).toLowerCase(),
            size: fs.statSync(finalPath).size,
            tags: [],
            uploadedAt: new Date().toISOString(),
            user_id: req.user?.id ?? null,
        });
        console.log('[uploadVideo] Database entry created:', entry.id);

        // Generate thumbnail in background, don't wait for it
        generateThumbnail(path.resolve(finalPath), path.join('thumbnails', uniqueFilename.replace(/\.[^/.]+$/, '') + '.jpg'))
            .then(thumbPath => {
                if (thumbPath) {
                    console.log('[uploadVideo] Thumbnail generated:', thumbPath);
                } else {
                    console.warn('[uploadVideo] Thumbnail generation failed');
                }
            })
            .catch(err => {
                console.warn('[uploadVideo] Thumbnail generation error:', err.message);
            });

        res.status(201).json({ status: 'success', data: entry });
    } catch (err) {
        console.error('[uploadVideo] Failed to create database entry:', err);
        // Clean up uploaded file if database insert fails
        try { fs.unlinkSync(finalPath); } catch (_) { }
        res.status(500).json({ error: 'Failed to save video to database' });
    }
});

// ── Merge videos by IDs ───────────────────────────────────────────────────────
exports.mergeByIds = catchAsync(async (req, res) => {
    console.log('[mergeByIds] body:', req.body, '| url:', req.url);
    console.log('[mergeByIds] files:', req.files ? Object.keys(req.files) : 'none');
    let videoIds = req.body.videoIds;
    if (!videoIds) return res.status(400).json({ error: 'No videoIds provided' });

    // Handle FormData case where videoIds comes as JSON string
    if (typeof videoIds === 'string') {
        try {
            videoIds = JSON.parse(videoIds);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid videoIds format' });
        }
    }

    if (!Array.isArray(videoIds)) videoIds = [videoIds];
    if (videoIds.length < 2) return res.status(400).json({ error: 'Need at least 2 videos to merge' });

    videoIds = videoIds.map(id => parseInt(id, 10));
    if (videoIds.some(isNaN)) return res.status(400).json({ error: 'Invalid video ID provided' });

    const outputName = (req.body.outputName || `merge_${Date.now()}`).trim();
    let intro = null, outro = null;

    // Handle intro data
    if (req.body.intro) {
        let introData = req.body.intro;
        // Handle FormData case where intro comes as JSON string
        if (typeof introData === 'string') {
            try {
                introData = JSON.parse(introData);
            } catch (e) {
                return res.status(400).json({ error: 'Invalid intro format' });
            }
        }

        intro = {
            duration: introData.duration || 3,
            backgroundColor: introData.backgroundColor || '#000000'
        };
        // Handle intro image if provided
        if (req.files?.introImage?.[0]) {
            const introImagePath = req.files.introImage[0].path;
            console.log('[mergeByIds] Processing introImage:', introImagePath);

            // Validate the image file exists and is accessible
            if (!fs.existsSync(introImagePath)) {
                console.error('[mergeByIds] Intro image file does not exist:', introImagePath);
                return res.status(400).json({ error: 'Intro image file not found' });
            }

            // Check file size
            const stats = fs.statSync(introImagePath);
            if (stats.size === 0) {
                console.error('[mergeByIds] Intro image file is empty:', introImagePath);
                return res.status(400).json({ error: 'Intro image file is empty' });
            }

            console.log('[mergeByIds] Intro image validated, size:', stats.size, 'bytes');
            intro.logo = introImagePath;
        }
    }

    // Handle outro data
    if (req.body.outro) {
        let outroData = req.body.outro;
        // Handle FormData case where outro comes as JSON string
        if (typeof outroData === 'string') {
            try {
                outroData = JSON.parse(outroData);
            } catch (e) {
                return res.status(400).json({ error: 'Invalid outro format' });
            }
        }

        outro = {
            duration: outroData.duration || 3,
            backgroundColor: outroData.backgroundColor || '#000000'
        };
        // Handle outro image if provided
        if (req.files?.outroImage?.[0]) {
            const outroImagePath = req.files.outroImage[0].path;
            console.log('[mergeByIds] Processing outroImage:', outroImagePath);

            // Validate the image file exists and is accessible
            if (!fs.existsSync(outroImagePath)) {
                console.error('[mergeByIds] Outro image file does not exist:', outroImagePath);
                return res.status(400).json({ error: 'Outro image file not found' });
            }

            // Check file size
            const stats = fs.statSync(outroImagePath);
            if (stats.size === 0) {
                console.error('[mergeByIds] Outro image file is empty:', outroImagePath);
                return res.status(400).json({ error: 'Outro image file is empty' });
            }

            console.log('[mergeByIds] Outro image validated, size:', stats.size, 'bytes');
            outro.logo = outroImagePath;
        }
    }

    const tmpFiles = [];

    if (req.files?.introLogo?.[0]) {
        if (intro) intro.logo = req.files.introLogo[0].path;
        tmpFiles.push(req.files.introLogo[0].path);
    }
    if (req.files?.outroLogo?.[0]) {
        if (outro) outro.logo = req.files.outroLogo[0].path;
        tmpFiles.push(req.files.outroLogo[0].path);
    }

    const allMedia = await getMediaData();
    const mediaMap = new Map(allMedia.map(m => [m.id, m]));
    const videos = videoIds.map(id => mediaMap.get(id)).filter(Boolean);

    if (videos.length !== videoIds.length) {
        const missing = videoIds.filter(id => !mediaMap.has(id));
        return res.status(400).json({ error: `Videos not found: ${missing.join(', ')}` });
    }

    const filePaths = videos.map(v => ({ video: v, filePath: resolveVideoPath(v) }));
    const notFound = filePaths.filter(f => !f.filePath);
    if (notFound.length)
        return res.status(400).json({ error: `Files missing: ${notFound.map(f => f.video.name).join(', ')}` });

    try {
        // Step 1: Normalize each video
        const normalised = [];
        for (const { filePath } of filePaths) {
            const tmp = path.join('temp', `_norm_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`);
            tmpFiles.push(tmp);
            await runFFmpeg(['-y', '-i', filePath, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-r', '30', '-fps_mode', 'cfr', '-avoid_negative_ts', 'make_zero', '-movflags', '+faststart', tmp]);
            normalised.push(tmp);
        }

        // Step 2: Concat
        const listPath = path.join('temp', `_list_${Date.now()}.txt`);
        tmpFiles.push(listPath);
        fs.writeFileSync(listPath, normalised.map(p => `file '${path.resolve(p)}'`).join('\n'));

        let currentFile = path.join('temp', `_concat_${Date.now()}.mp4`);
        tmpFiles.push(currentFile);
        await runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', currentFile]);

        // Step 3: Intro / Outro slates
        if (intro || outro) {
            const { width: vw, height: vh } = await getVideoDimensions(currentFile);
            if (intro) {
                const introFile = await buildSlate(intro, tmpFiles, vw, vh);
                const withIntro = path.join('temp', `_intro_${Date.now()}.mp4`);
                tmpFiles.push(withIntro);
                const iList = path.join('temp', `_ilist_${Date.now()}.txt`);
                tmpFiles.push(iList);
                fs.writeFileSync(iList, `file '${path.resolve(introFile)}'\nfile '${path.resolve(currentFile)}'`);
                await runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', iList, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-movflags', '+faststart', withIntro]);
                currentFile = withIntro;
            }
            if (outro) {
                const outroFile = await buildSlate(outro, tmpFiles, vw, vh);
                const withOutro = path.join('temp', `_outro_${Date.now()}.mp4`);
                tmpFiles.push(withOutro);
                const oList = path.join('temp', `_olist_${Date.now()}.txt`);
                tmpFiles.push(oList);
                fs.writeFileSync(oList, `file '${path.resolve(currentFile)}'\nfile '${path.resolve(outroFile)}'`);
                await runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', oList, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-movflags', '+faststart', withOutro]);
                currentFile = withOutro;
            }
        }

        // Step 4: Final output
        const fileName = `${outputName.replace(/\.mp4$/i, '')}_${Date.now()}.mp4`;
        const outputPath = path.join('outputs', fileName);
        fs.copyFileSync(currentFile, outputPath);

        let duration = 0;
        try { duration = await getVideoDuration(outputPath); } catch (_) { }

        const newMedia = await insertMergedMedia({
            name: fileName,
            path: outputPath,
            duration,
            format: 'mp4',
            size: fs.statSync(outputPath).size,
            tags: [],
            uploadedAt: new Date().toISOString(),
            user_id: req.user?.id ?? req.body.user_id ?? null,
        });

        // Add a small delay before thumbnail generation to ensure file is ready
        setTimeout(() => {
            generateThumbnail(outputPath, path.join('thumbnails', fileName.replace(/\.[^/.]+$/, '') + '.jpg')).catch((err) => {
                console.warn('[mergeByIds] Thumbnail generation failed:', err?.message || err);
            });
        }, 1000);
        res.status(201).json({ status: 'success', data: newMedia });

    } finally {
        cleanupFiles(tmpFiles);
    }
});

exports.DeleteVideo = catchAsync(async (req, res) => {
    const { id } = req.params;
    const videoId = Number(id);

    // Check if video exists and get its info for thumbnail deletion
    let currentVideo = await getMediaById(videoId);
    let isMerged = false;

    if (!currentVideo) {
        currentVideo = await getMergedMediaById(videoId);
        isMerged = true;
    }

    if (!currentVideo) {
        return res.status(404).json({ error: 'Video not found' });
    }

    // Delete thumbnail if it exists
    const thumbnailPath = path.join('thumbnails', currentVideo.name.replace(/\.[^/.]+$/, '') + '.jpg');
    try {
        fs.unlinkSync(thumbnailPath);
    } catch (error) {
        // Thumbnail might not exist, that's ok
    }

    // Delete the video from the appropriate table
    if (isMerged) {
        await deleteMergedMediaById(videoId);
    } else {
        await deleteMediaById(videoId);
    }

    return res.status(200).json({ status: 'success', message: 'Video deleted successfully' });
});

exports.EditVideo = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, tags } = req.body;

    console.log('[EditVideo] id:', id, 'user:', req.user ? { id: req.user.id, email: req.user.email } : null, 'body:', { name, tags });

    // Get current video to check if name is changing
    let currentVideo = await getMediaById(Number(id));
    if (!currentVideo) {
        currentVideo = await getMergedMediaById(Number(id));
    }

    if (!currentVideo) {
        return res.status(404).json({ error: 'Video not found' });
    }

    // Delete old thumbnail if name is changing
    if (currentVideo.name !== name) {
        const oldThumbnailPath = path.join('thumbnails', currentVideo.name.replace(/\.[^/.]+$/, '') + '.jpg');
        try {
            fs.unlinkSync(oldThumbnailPath);
        } catch (error) {
            // Thumbnail might not exist, that's ok
        }
    }

    const updateFields = { name, tags };
    if (!currentVideo.user_id && req.user?.id) {
        updateFields.user_id = req.user.id;
    }

    let updatedVideo = await updateMediaById(Number(id), updateFields);
    console.log('[EditVideo] updateMediaById result:', updatedVideo);
    if (!updatedVideo) {
        updatedVideo = await updateMergedMediaById(Number(id), updateFields);
        console.log('[EditVideo] updateMergedMediaById result:', updatedVideo);
    }

    if (!updatedVideo) {
        return res.status(404).json({ error: 'Video not found' });
    }

    // Generate new thumbnail if name changed
    if (currentVideo.name !== name) {
        const videoPath = resolveVideoPath(updatedVideo);
        if (videoPath) {
            const newThumbnailPath = path.join('thumbnails', name.replace(/\.[^/.]+$/, '') + '.jpg');
            generateThumbnail(path.resolve(videoPath), newThumbnailPath).catch(() => {
                // Thumbnail generation failed, but that's ok
            });
        }
    }

    res.status(200).json({ status: 'success', data: updatedVideo });
});

// Apply overlays
exports.applyOverlay = catchAsync(async (req, res) => {
    const video = await getMediaById(parseInt(req.params.id, 10));
    // ... (rest of the code remains the same)
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const inputPath = resolveVideoPath(video);
    if (!inputPath) return res.status(404).json({ error: 'Video file not found on disk' });

    const overlays = JSON.parse(req.body.overlays || '[]');
    if (!overlays.length) return res.status(400).json({ error: 'No overlays provided' });

    const uploadedImages = {};
    if (req.files) req.files.forEach(f => { uploadedImages[f.originalname] = f.path; });

    const { width: vidWidth, height: vidHeight } = await getVideoDimensions(inputPath);
    const { filterParts, extraInputs, lastVideo } = buildOverlayFilters(overlays, uploadedImages, vidWidth, vidHeight);

    if (!filterParts.length) {
        cleanupFiles(Object.values(uploadedImages));
        return res.status(400).json({ error: 'No valid overlays to apply' });
    }

    const ts = Date.now();
    const ext = path.extname(inputPath) || '.mp4';
    const outputName = `${path.basename(inputPath, ext)}_overlay_${ts}${ext}`;
    const outputPath = path.join('outputs', outputName);

    try {
        await runFFmpeg([
            '-y', '-i', inputPath, ...extraInputs,
            '-filter_complex', filterParts.join(';'),
            '-map', lastVideo, '-map', '0:a?',
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
            '-c:a', 'aac', '-ar', '44100', '-ac', '2',
            '-movflags', '+faststart', outputPath,
        ]);
    } finally {
        cleanupFiles(Object.values(uploadedImages));
    }

    let duration = 0;
    try { duration = await getVideoDuration(outputPath); } catch (_) { }

    const newEntry = await insertMergedMedia({
        name: outputName,
        path: outputPath,
        duration,
        format: ext.slice(1).toLowerCase(),
        size: fs.statSync(outputPath).size,
        tags: [],
        uploadedAt: new Date().toISOString(),
        user_id: req.user?.id ?? null,
    });

    generateThumbnail(outputPath, path.join('thumbnails', outputName.replace(/\.[^/.]+$/, '') + '.jpg')).catch(() => { });
    res.status(201).json({ status: 'success', data: newEntry });
});

// Apply intro / outro slates
exports.applySlates = catchAsync(async (req, res) => {
    const video = await getMediaById(parseInt(req.params.id, 10));
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const inputPath = resolveVideoPath(video);
    if (!inputPath) return res.status(404).json({ error: 'Video file not found on disk' });

    let intro = null, outro = null;
    try {
        if (req.body.intro) intro = typeof req.body.intro === 'string' ? JSON.parse(req.body.intro) : req.body.intro;
        if (req.body.outro) outro = typeof req.body.outro === 'string' ? JSON.parse(req.body.outro) : req.body.outro;
        // Handle images if present (for applySlates, images come as introLogo/outroLogo)
        if (req.files?.introLogo?.[0] && intro) intro.logo = req.files.introLogo[0].path;
        if (req.files?.outroLogo?.[0] && outro) outro.logo = req.files.outroLogo[0].path;
    } catch (e) {
        return res.status(400).json({ error: 'Invalid intro/outro JSON: ' + e.message });
    }

    if (!intro && !outro) return res.status(400).json({ error: 'Provide at least intro or outro' });

    const { width: vw, height: vh } = await getVideoDimensions(inputPath);
    const ext = path.extname(inputPath) || '.mp4';
    const ts = Date.now();
    const tmpFiles = [];

    const normPath = path.join('temp', `_norm_${ts}${ext}`);
    tmpFiles.push(normPath);
    await runFFmpeg(['-y', '-i', inputPath, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-r', '30', '-fps_mode', 'cfr', '-movflags', '+faststart', normPath]);

    try {
        const parts = [];
        if (intro) { const p = await buildSlate(intro, tmpFiles, vw, vh); parts.push(p); }
        parts.push(normPath);
        if (outro) { const p = await buildSlate(outro, tmpFiles, vw, vh); parts.push(p); }

        const listFile = path.join('temp', `_list_slates_${ts}.txt`);
        tmpFiles.push(listFile);
        fs.writeFileSync(listFile, parts.map(f => `file '${path.resolve(f)}'`).join('\n'));

        const outputName = `${path.basename(inputPath, ext)}_slated_${ts}${ext}`;
        const outputPath = path.join('outputs', outputName);

        await runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-movflags', '+faststart', outputPath]);

        let duration = 0;
        try { duration = await getVideoDuration(outputPath); } catch (_) { }

        const newEntry = await insertMergedMedia({
            name: outputName,
            path: outputPath,
            duration,
            format: ext.slice(1).toLowerCase(),
            size: fs.statSync(outputPath).size,
            tags: [],
            uploadedAt: new Date().toISOString(),
            user_id: req.user?.id ?? null,
        });

        generateThumbnail(outputPath, path.join('thumbnails', outputName.replace(/\.[^/.]+$/, '') + '.jpg')).catch(() => { });
        res.status(201).json({ status: 'success', data: newEntry });

    } finally {
        cleanupFiles(tmpFiles);
    }
});

// Merge uploaded videos
exports.mergeUploadedVideos = catchAsync(async (req, res) => {
    const videoFiles = req.files?.videos || [];
    const introImageFile = req.files?.introImage?.[0];
    const outroImageFile = req.files?.outroImage?.[0];

    // Only attach user_id when genuinely logged in to satisfy the FK constraint
    const userId = req.user?.id
        ? req.user.id
        : req.body.user_id && req.body.user_id !== 'null'
            ? parseInt(req.body.user_id, 10)
            : null;

    if (!videoFiles || videoFiles.length < 2) {
        return res.status(400).json({ error: 'At least 2 video files are required' });
    }

    // Every file created during processing lives here and is wiped in finally
    const tmpFiles = [];

    try {
        // Step 1: Move multer temp files into temp/ (never uploads/)
        //         so they are invisible to the library and cleaned up below.
        const sourcePaths = [];
        for (const file of videoFiles) {
            const dest = path.join(
                'temp',
                `_upload_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`
            );
            fs.renameSync(file.path, dest);
            tmpFiles.push(dest);
            sourcePaths.push(dest);
        }

        // Step 2: Normalize each clip (uniform codec / fps / sample-rate)
        const normalised = [];
        for (const src of sourcePaths) {
            const norm = path.join('temp', `_norm_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`);
            tmpFiles.push(norm);
            await runFFmpeg([
                '-y', '-i', src,
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                '-c:a', 'aac', '-ar', '44100', '-ac', '2',
                '-r', '30', '-fps_mode', 'cfr',
                '-avoid_negative_ts', 'make_zero',
                '-movflags', '+faststart',
                norm,
            ]);
            normalised.push(norm);
        }

        // Step 3: Concat normalised clips
        const listPath = path.join('temp', `_upload_list_${Date.now()}.txt`);
        tmpFiles.push(listPath);
        fs.writeFileSync(listPath, normalised.map(p => `file '${path.resolve(p)}'`).join('\n'));

        const concatPath = path.join('temp', `_upload_concat_${Date.now()}.mp4`);
        tmpFiles.push(concatPath);
        await runFFmpeg([
            '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
            '-c', 'copy',
            concatPath,
        ]);

        // Step 4: Handle intro/outro overlays if provided
        let currentFile = concatPath;
        let intro = null, outro = null;

        // Handle intro data
        if (req.body.intro) {
            let introData = req.body.intro;
            if (typeof introData === 'string') {
                try {
                    introData = JSON.parse(introData);
                } catch (e) {
                    return res.status(400).json({ error: 'Invalid intro format' });
                }
            }

            intro = {
                duration: introData.duration || 3,
                backgroundColor: introData.backgroundColor || '#000000'
            };

            // Handle intro image if provided
            if (req.files?.introImage?.[0]) {
                const introImagePath = req.files.introImage[0].path;
                console.log('[mergeUploadedVideos] Processing introImage:', introImagePath);

                // Validate the image file exists and is accessible
                if (!fs.existsSync(introImagePath)) {
                    console.error('[mergeUploadedVideos] Intro image file does not exist:', introImagePath);
                    return res.status(400).json({ error: 'Intro image file not found' });
                }

                // Check file size
                const stats = fs.statSync(introImagePath);
                if (stats.size === 0) {
                    console.error('[mergeUploadedVideos] Intro image file is empty:', introImagePath);
                    return res.status(400).json({ error: 'Intro image file is empty' });
                }

                console.log('[mergeUploadedVideos] Intro image validated, size:', stats.size, 'bytes');
                intro.logo = introImagePath;
            }
        }

        // Handle outro data
        if (req.body.outro) {
            let outroData = req.body.outro;
            if (typeof outroData === 'string') {
                try {
                    outroData = JSON.parse(outroData);
                } catch (e) {
                    return res.status(400).json({ error: 'Invalid outro format' });
                }
            }

            outro = {
                duration: outroData.duration || 3,
                backgroundColor: outroData.backgroundColor || '#000000'
            };

            // Handle outro image if provided
            if (req.files?.outroImage?.[0]) {
                const outroImagePath = req.files.outroImage[0].path;
                console.log('[mergeUploadedVideos] Processing outroImage:', outroImagePath);

                // Validate the image file exists and is accessible
                if (!fs.existsSync(outroImagePath)) {
                    console.error('[mergeUploadedVideos] Outro image file does not exist:', outroImagePath);
                    return res.status(400).json({ error: 'Outro image file not found' });
                }

                // Check file size
                const stats = fs.statSync(outroImagePath);
                if (stats.size === 0) {
                    console.error('[mergeUploadedVideos] Outro image file is empty:', outroImagePath);
                    return res.status(400).json({ error: 'Outro image file is empty' });
                }

                console.log('[mergeUploadedVideos] Outro image validated, size:', stats.size, 'bytes');
                outro.logo = outroImagePath;
            }
        }

        // Step 5: Apply intro/outro slates if configured
        if (intro || outro) {
            const { width: vw, height: vh } = await getVideoDimensions(currentFile);
            if (intro) {
                const introFile = await buildSlate(intro, tmpFiles, vw, vh);
                const withIntro = path.join('temp', `_upload_intro_${Date.now()}.mp4`);
                tmpFiles.push(withIntro);
                const iList = path.join('temp', `_upload_ilist_${Date.now()}.txt`);
                tmpFiles.push(iList);
                fs.writeFileSync(iList, `file '${path.resolve(introFile)}'\nfile '${path.resolve(currentFile)}'`);
                await runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', iList, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-movflags', '+faststart', withIntro]);
                currentFile = withIntro;
            }
            if (outro) {
                const outroFile = await buildSlate(outro, tmpFiles, vw, vh);
                const withOutro = path.join('temp', `_upload_outro_${Date.now()}.mp4`);
                tmpFiles.push(withOutro);
                const oList = path.join('temp', `_upload_olist_${Date.now()}.txt`);
                tmpFiles.push(oList);
                fs.writeFileSync(oList, `file '${path.resolve(currentFile)}'\nfile '${path.resolve(outroFile)}'`);
                await runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', oList, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-movflags', '+faststart', withOutro]);
                currentFile = withOutro;
            }
        }

        // Step 6: Write final file to outputs/
        const outputName = `merge_${Date.now()}.mp4`;
        const outputPath = path.join('outputs', outputName);
        fs.copyFileSync(currentFile, outputPath);

        let duration = 0;
        try { duration = await getVideoDuration(outputPath); } catch (_) { }

        // Step 7: Save ONLY the merged result - no insertMedia calls for source clips
        const mergedEntry = await insertMergedMedia({
            name: outputName,
            path: outputPath,
            duration,
            format: 'mp4',
            size: fs.statSync(outputPath).size,
            tags: [],
            uploadedAt: new Date().toISOString(),
            user_id: userId,
        });

        generateThumbnail(
            outputPath,
            path.join('thumbnails', outputName.replace(/\.[^/.]+$/, '') + '.jpg'),
        ).catch(() => { });

        res.status(201).json({
            status: 'success',
            data: mergedEntry,
            downloadUrl: `http://localhost:3000/${outputPath}`,
        });

    } finally {
        // Wipes source clips, normalised clips, concat list - everything in temp/
        cleanupFiles(tmpFiles);
    }
});