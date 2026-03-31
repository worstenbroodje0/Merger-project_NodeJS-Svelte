const catchAsync = require('../utils/catchAsync');
const { getMediaData, getMediaById, insertMedia, newId } = require('../db');
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
        console.log('[FFmpeg]', args.join(' ')); // <-- add this line
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
        const ff = spawn(FFPROBE, ['-v', 'quiet', '-print_format', 'json', '-show_format', filePath]);
        let out = '';
        ff.stdout.on('data', d => (out += d));
        ff.on('close', code => {
            if (code !== 0) return reject(new Error('FFprobe exited non-zero'));
            try { resolve(Math.round(parseFloat(JSON.parse(out).format.duration) || 0)); }
            catch { reject(new Error('FFprobe parse error')); }
        });
        ff.on('error', err => reject(err));
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
            if (code !== 0) console.warn('[thumbnail] FFmpeg failed:', errOut.slice(-300));
            resolve(code === 0 ? thumbPath : null);
        });
        ff.on('error', () => resolve(null));
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
    const rawColor = slate.color || slate.bgColor || '#000000';
    const bgColor = rawColor.startsWith('#') ? rawColor.replace('#', '0x') : rawColor;
    const outPath = path.join('temp', `_slate_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`);
    tmpFiles.push(outPath);

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
            '-f', 'image2', '-loop', '1', '-i', pngPath,
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
    const all = await getMediaData();
    res.json({ status: 'success', results: all.length, data: all });
});

// ── GET single media ──────────────────────────────────────────────────────────
exports.getMedia = catchAsync(async (req, res) => {
    console.log('[getMedia] params:', req.params, '| method:', req.method, '| url:', req.url);
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
    fs.renameSync(tempPath, finalPath);

    let duration = 0;
    try { duration = await getVideoDuration(finalPath); } catch (_) { }

    const entry = await insertMedia({
        name: uniqueFilename,
        path: finalPath,
        duration,
        format: path.extname(originalname).slice(1).toLowerCase(),
        size: fs.statSync(finalPath).size,
        tags: [],
        uploadedAt: new Date().toISOString(),
    });

    generateThumbnail(path.resolve(finalPath), path.join('thumbnails', uniqueFilename.replace(/\.[^/.]+$/, '') + '.jpg')).catch(() => { });
    res.status(201).json({ status: 'success', data: entry });
});

// ── Merge videos by IDs ───────────────────────────────────────────────────────
exports.mergeByIds = catchAsync(async (req, res) => {
    console.log('[mergeByIds] body:', req.body, '| url:', req.url);
    let videoIds = req.body.videoIds;
    if (!videoIds) return res.status(400).json({ error: 'No videoIds provided' });
    if (!Array.isArray(videoIds)) videoIds = [videoIds];
    if (videoIds.length < 2) return res.status(400).json({ error: 'Need at least 2 videos to merge' });

    videoIds = videoIds.map(id => parseInt(id, 10));
    if (videoIds.some(isNaN)) return res.status(400).json({ error: 'Invalid video ID provided' });

    const outputName = (req.body.outputName || `merge_${Date.now()}`).trim();
    let intro = null, outro = null;
    try {
        if (req.body.intro) intro = typeof req.body.intro === 'string' ? JSON.parse(req.body.intro) : req.body.intro;
        if (req.body.outro) outro = typeof req.body.outro === 'string' ? JSON.parse(req.body.outro) : req.body.outro;
    } catch (e) {
        return res.status(400).json({ error: 'Invalid intro/outro JSON: ' + e.message });
    }

    const tmpFiles = [];

    // Attach uploaded logo files to the slate objects and register for cleanup
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

        // Step 3: Intro / Outro slates (built in temp, never saved to DB)
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

        const newMedia = await insertMedia({
            name: fileName,
            path: outputPath,
            duration,
            format: 'mp4',
            size: fs.statSync(outputPath).size,
            tags: [],
            uploadedAt: new Date().toISOString(),
        });

        generateThumbnail(outputPath, path.join('thumbnails', fileName.replace(/\.[^/.]+$/, '') + '.jpg')).catch(() => { });
        res.status(201).json({ status: 'success', data: newMedia });

    } finally {
        cleanupFiles(tmpFiles);
    }
});

// ── Apply overlays ────────────────────────────────────────────────────────────
exports.applyOverlay = catchAsync(async (req, res) => {
    const video = await getMediaById(parseInt(req.params.id, 10));
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

    const newEntry = await insertMedia({
        name: outputName,
        path: outputPath,
        duration,
        format: ext.slice(1).toLowerCase(),
        size: fs.statSync(outputPath).size,
        tags: [],
        uploadedAt: new Date().toISOString(),
    });

    generateThumbnail(outputPath, path.join('thumbnails', outputName.replace(/\.[^/.]+$/, '') + '.jpg')).catch(() => { });
    res.status(201).json({ status: 'success', data: newEntry });
});

// ── Apply intro / outro slates ────────────────────────────────────────────────
exports.applySlates = catchAsync(async (req, res) => {
    const video = await getMediaById(parseInt(req.params.id, 10));
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const inputPath = resolveVideoPath(video);
    if (!inputPath) return res.status(404).json({ error: 'Video file not found on disk' });

    let intro = null, outro = null;
    try {
        if (req.body.intro) intro = typeof req.body.intro === 'string' ? JSON.parse(req.body.intro) : req.body.intro;
        if (req.body.outro) outro = typeof req.body.outro === 'string' ? JSON.parse(req.body.outro) : req.body.outro;
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

        const newEntry = await insertMedia({
            name: outputName,
            path: outputPath,
            duration,
            format: ext.slice(1).toLowerCase(),
            size: fs.statSync(outputPath).size,
            tags: [],
            uploadedAt: new Date().toISOString(),
        });

        generateThumbnail(outputPath, path.join('thumbnails', outputName.replace(/\.[^/.]+$/, '') + '.jpg')).catch(() => { });
        res.status(201).json({ status: 'success', data: newEntry });

    } finally {
        cleanupFiles(tmpFiles);
    }
});