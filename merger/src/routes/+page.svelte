<script>
	import { goto } from '$app/navigation';
	import { auth } from '../stores/auth.js';

	// ── State ──────────────────────────────────────────────────────────────────
	/** @type {Array<{_id:string, name:string, duration:number, format:string, tags:string[], path?:string, b64?:string, user_id?:number}>} */
	let videos = $state([]);
	let loading = $state(true);
	let error = $state(null);

	/** Ordered list of selected video IDs */
	let selectedIds = $state(/** @type {string[]} */ ([]));

	let mergeLoading = $state(false);
	let mergeError = $state('');
	let dragSrcId = $state(/** @type {string|null} */ (null));
	let dragOverId = $state(/** @type {string|null} */ (null));

	// File upload state
	let activeTab = $state('library'); // 'library' or 'upload'
	let uploadedFiles = $state(/** @type {File[]} */ ([]));
	let uploadLoading = $state(false);
	let uploadError = $state('');

	// Upload drag-to-reorder state
	let uploadDragSrcIdx = $state(/** @type {number|null} */ (null));
	let uploadDragOverIdx = $state(/** @type {number|null} */ (null));

	// Overlay state for merge
	let showOverlayOptions = $state(false);
	let overlayType = $state('intro'); // 'intro', 'outro', or 'both'
	let introBackgroundColor = $state('#000000');
	let introImage = $state(/** @type {File|null} */ (null));
	let introDuration = $state(3); // seconds
	let outroBackgroundColor = $state('#000000');
	let outroImage = $state(/** @type {File|null} */ (null));
	let outroDuration = $state(3); // seconds

	// ── Helpers ────────────────────────────────────────────────────────────────
	/** Normalise ID to string so ObjectId / number / string all compare equal */
	let _uidCounter = 0;

	/** Stamp a guaranteed-unique _uid onto every video object at load time.
	 *  All selection logic uses _uid — never _id/id which may be missing or duplicated. */
	function stamp(video) {
		if (!video._uid) video._uid = String(++_uidCounter);
		return video;
	}

	function getVideo(uid) {
		return videos.find((v) => v._uid === uid);
	}

	// ── Load ───────────────────────────────────────────────────────────────────
	async function loadVideos() {
		try {
			loading = true;
			error = null;

			let remote = [];
			try {
				// Get only regular media (not merged)
				const res = await fetch('http://localhost:3000/api/media/regular');
				if (res.ok) {
					const data = await res.json();
					remote = (data.data || [])
						.filter((v) => {
							// Filter videos for current user
							if (!$auth.user?.id) return true; // Show all if not logged in
							return v.user_id === $auth.user.id || v.user_id === null;
						})
						.map(stamp);
				}
			} catch {
				// API not available — fall through to embedded videos only
			}

			// Always include embedded demo videos
			videos = [...remote, ...[].map(stamp)];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			loading = false;
		}
	}

	// ── Selection ──────────────────────────────────────────────────────────────
	function toggleSelect(video) {
		const id = video._uid;
		if (selectedIds.includes(id)) {
			selectedIds = selectedIds.filter((x) => x !== id);
		} else {
			selectedIds = [...selectedIds, id];
		}
	}

	function removeFromSelection(id) {
		selectedIds = selectedIds.filter((x) => x !== id);
	}

	// ── Drag-to-reorder (library) ──────────────────────────────────────────────
	function onDragStart(e, id) {
		dragSrcId = id;
		e.dataTransfer.effectAllowed = 'move';
	}

	function onDragOver(e, targetId) {
		e.preventDefault();
		dragOverId = targetId;
		if (targetId === dragSrcId) return;
		const from = selectedIds.indexOf(dragSrcId);
		const to = selectedIds.indexOf(targetId);
		if (from === -1 || to === -1) return;
		const arr = [...selectedIds];
		arr.splice(from, 1);
		arr.splice(to, 0, dragSrcId);
		selectedIds = arr;
	}

	function onDragLeave() {
		dragOverId = null;
	}

	function onDragEnd() {
		dragSrcId = null;
		dragOverId = null;
	}

	// ── Merge ──────────────────────────────────────────────────────────────────
	async function mergeVideos() {
		if (selectedIds.length < 2) {
			mergeError = 'Please select at least 2 videos to merge';
			return;
		}

		mergeLoading = true;
		mergeError = '';

		try {
			// Check if all selected are embedded (client-side merge via Blob concat)
			const allEmbedded = selectedIds.every((id) => {
				const v = getVideo(id);
				return v?.b64;
			});

			let mergedUrl;
			let mergedName;

			if (allEmbedded) {
				// ── Client-side merge: concatenate MP4 blobs ──────────────────────
				const blobs = selectedIds.map((id) => {
					const v = getVideo(id);
					const binary = atob(v.b64);
					const bytes = new Uint8Array(binary.length);
					for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
					return new Blob([bytes], { type: 'video/mp4' });
				});

				const response = await fetch('http://localhost:3000/api/media/merge-b64', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						videos: selectedIds.map((uid) => {
							const v = getVideo(uid);
							return { name: v.name, b64: v.b64 };
						})
					})
				});

				if (response.ok) {
					const data = await response.json();
					mergedUrl = data.downloadUrl;
					mergedName = data.name;
				} else {
					throw new Error('Server merge failed');
				}
			} else {
				// ── Server merge via IDs ──────────────────────────────────────────
				let response;

				// Check if we need FormData (when any overlay images are present)
				const hasOverlayImages =
					(overlayType === 'intro' && introImage) ||
					(overlayType === 'outro' && outroImage) ||
					(overlayType === 'both' && (introImage || outroImage));

				console.log('Overlay debug:', {
					overlayType,
					hasOverlayImages,
					introImage: introImage?.name,
					outroImage: outroImage?.name,
					showOverlayOptions
				});

				if (hasOverlayImages) {
					// Use FormData when there are overlay images
					const formData = new FormData();

					// Add video IDs and user info
					formData.append(
						'videoIds',
						JSON.stringify(selectedIds.map((uid) => getVideo(uid)?._id ?? getVideo(uid)?.id))
					);
					formData.append('user_id', $auth.user?.id || null);

					// Add intro data if needed
					if (overlayType === 'intro' || overlayType === 'both') {
						formData.append(
							'intro',
							JSON.stringify({
								backgroundColor: introBackgroundColor,
								duration: introDuration
							})
						);
						if (introImage) formData.append('introImage', introImage);
					}

					// Add outro data if needed
					if (overlayType === 'outro' || overlayType === 'both') {
						formData.append(
							'outro',
							JSON.stringify({
								backgroundColor: outroBackgroundColor,
								duration: outroDuration
							})
						);
						if (outroImage) formData.append('outroImage', outroImage);
					}

					response = await fetch('http://localhost:3000/api/media/merge', {
						method: 'POST',
						body: formData
					});
				} else {
					// Use JSON when no overlay images
					const requestBody = {
						videoIds: selectedIds.map((uid) => getVideo(uid)?._id ?? getVideo(uid)?.id),
						user_id: $auth.user?.id || null
					};

					// Add overlay data if enabled (but no images)
					if (showOverlayOptions) {
						if (overlayType === 'intro' || overlayType === 'both') {
							requestBody.intro = {
								backgroundColor: introBackgroundColor,
								duration: introDuration
							};
						}
						if (overlayType === 'outro' || overlayType === 'both') {
							requestBody.outro = {
								backgroundColor: outroBackgroundColor,
								duration: outroDuration
							};
						}
					}

					response = await fetch('http://localhost:3000/api/media/merge', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(requestBody)
					});
				}
				if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
				const data = await response.json();
				console.log('Merge response:', data);

				if (data.status !== 'success' && data.success !== true) {
					throw new Error(data.message || data.error || 'Merge failed');
				}

				mergedUrl = data.downloadUrl || `http://localhost:3000/${data.data?.path}`;
				mergedName = data.data?.name || 'merged.mp4';
			}

			const params = new URLSearchParams({
				url: mergedUrl ?? '',
				name: mergedName ?? 'merged.mp4',
				count: String(selectedIds.length),
				clips: selectedIds.map((id) => getVideo(id)?.name ?? id).join(',')
			});
			goto(`/completion?${params}`);
		} catch (err) {
			mergeError = err instanceof Error ? err.message : 'Failed to merge videos';
		} finally {
			mergeLoading = false;
		}
	}

	// ── File upload functions ──────────────────────────────────────────────────
	function handleFileSelect(event) {
		const files = Array.from(event.target.files);
		uploadedFiles = [...uploadedFiles, ...files];
		// Reset the input so the same file can be re-added after removal
		event.target.value = '';
	}

	function handleDropZoneDrop(event) {
		event.preventDefault();
		const files = Array.from(event.dataTransfer.files).filter((f) => f.type.startsWith('video/'));
		if (files.length) uploadedFiles = [...uploadedFiles, ...files];
	}

	function handleDropZoneDragOver(event) {
		event.preventDefault();
	}

	function removeFile(index) {
		uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
	}

	// Drag-to-reorder for upload list
	function onUploadDragStart(e, idx) {
		uploadDragSrcIdx = idx;
		e.dataTransfer.effectAllowed = 'move';
	}

	function onUploadDragOver(e, idx) {
		e.preventDefault();
		uploadDragOverIdx = idx;
		if (idx === uploadDragSrcIdx) return;
		const arr = [...uploadedFiles];
		const [moved] = arr.splice(uploadDragSrcIdx, 1);
		arr.splice(idx, 0, moved);
		uploadedFiles = arr;
		uploadDragSrcIdx = idx;
	}

	function onUploadDragEnd() {
		uploadDragSrcIdx = null;
		uploadDragOverIdx = null;
	}

	// Overlay functions
	function handleIntroImageSelect(event) {
		introImage = event.target.files[0];
	}

	function handleOutroImageSelect(event) {
		outroImage = event.target.files[0];
	}

	function toggleOverlayOptions() {
		showOverlayOptions = !showOverlayOptions;
		if (!showOverlayOptions) {
			overlayType = 'intro';
			introImage = null;
			introBackgroundColor = '#000000';
			introDuration = 3;
			outroImage = null;
			outroBackgroundColor = '#000000';
			outroDuration = 3;
		}
	}

	async function uploadAndMerge() {
		if (uploadedFiles.length < 2) {
			uploadError = 'Please select at least 2 videos to merge';
			return;
		}

		try {
			uploadLoading = true;
			uploadError = '';

			const formData = new FormData();
			uploadedFiles.forEach((file) => {
				formData.append('videos', file);
			});
			formData.append('user_id', $auth.user?.id || null);

			const response = await fetch('http://localhost:3000/api/media/merge-upload', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				throw new Error(`Upload failed: ${response.status}`);
			}

			const data = await response.json();

			const params = new URLSearchParams({
				url: data.downloadUrl || `http://localhost:3000/${data.data?.path}`,
				name: data.data?.name || 'merged.mp4',
				count: String(uploadedFiles.length),
				clips: uploadedFiles.map((f) => f.name).join(',')
			});
			goto(`/completion?${params}`);
		} catch (err) {
			uploadError = err instanceof Error ? err.message : 'Upload failed';
		} finally {
			uploadLoading = false;
		}
	}

	loadVideos();
</script>

<main class="container mx-auto px-4 py-8">
	<h1 class="mb-8 text-3xl font-bold">Upload & Merge</h1>

	<!-- ── Tab switcher ───────────────────────────────────────────────────────── -->
	<div class="mb-8 flex w-fit gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1">
		<button
			onclick={() => (activeTab = 'upload')}
			class="rounded-lg px-5 py-2 text-sm font-medium transition-all
			       {activeTab === 'upload'
				? 'bg-white text-gray-900 shadow-sm'
				: 'text-gray-500 hover:text-gray-700'}"
		>
			upload
		</button>
		<button
			onclick={() => (activeTab = 'library')}
			class="rounded-lg px-5 py-2 text-sm font-medium transition-all
			       {activeTab === 'library'
				? 'bg-white text-gray-900 shadow-sm'
				: 'text-gray-500 hover:text-gray-700'}"
		>
			Library
		</button>
	</div>

	<!-- ══════════════════════════════════════════════════════════════════════════
	     UPLOAD TAB
	     ══════════════════════════════════════════════════════════════════════ -->
	{#if activeTab === 'upload'}
		<div class="max-w-2xl">
			<h2 class="mb-1 text-xl font-semibold">Merge your own videos</h2>
			<p class="mb-6 text-sm text-gray-500">
				Pick 2 or more video files from your device — they'll be merged in the order listed below.
				Drag rows to reorder.
			</p>

			<!-- Drop zone / file picker -->
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
			<label
				class="mb-6 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl
				       border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center
				       transition-colors hover:border-blue-400 hover:bg-blue-50"
				ondragover={handleDropZoneDragOver}
				ondrop={handleDropZoneDrop}
			>
				<svg class="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
					/>
				</svg>
				<div>
					<p class="font-medium text-gray-700">Click to select videos</p>
					<p class="mt-1 text-xs text-gray-400">or drag & drop here</p>
					<p class="text-xs text-gray-400">MP4, MOV, AVI, MKV, WebM supported</p>
				</div>
				<input type="file" accept="video/*" multiple class="sr-only" onchange={handleFileSelect} />
			</label>

			<!-- Selected files list -->
			{#if uploadedFiles.length > 0}
				<div class="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
					<div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
						<h3 class="text-sm font-semibold text-gray-700">
							{uploadedFiles.length} file{uploadedFiles.length === 1 ? '' : 's'} selected
						</h3>
						<span class="text-xs text-gray-400">Drag rows to reorder</span>
					</div>

					<ol class="divide-y divide-gray-100">
						{#each uploadedFiles as file, i}
							<li
								class="flex items-center gap-3 px-4 py-3 transition-colors
								       {uploadDragSrcIdx === i ? 'opacity-40' : ''}
								       {uploadDragOverIdx === i && uploadDragSrcIdx !== i ? 'bg-blue-50' : 'bg-white'}"
								draggable="true"
								ondragstart={(e) => onUploadDragStart(e, i)}
								ondragover={(e) => onUploadDragOver(e, i)}
								ondragend={onUploadDragEnd}
							>
								<span class="cursor-grab text-lg leading-none text-gray-300 select-none">⠿</span>
								<span
									class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full
									       bg-blue-100 text-xs font-semibold text-blue-700"
								>
									{i + 1}
								</span>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-gray-800">{file.name}</p>
									<p class="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
								</div>
								<button
									onclick={() => removeFile(i)}
									class="ml-1 text-xl leading-none text-gray-300 transition-colors hover:text-red-500"
									aria-label="Remove file">×</button
								>
							</li>
						{/each}
					</ol>
				</div>

				<div class="flex flex-wrap items-center gap-3">
					<button
						onclick={uploadAndMerge}
						disabled={uploadLoading || uploadedFiles.length < 2}
						class="rounded-lg bg-green-500 px-6 py-2 font-medium text-white
						       transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-300"
					>
						{uploadLoading
							? 'Uploading & merging…'
							: `Merge ${uploadedFiles.length} video${uploadedFiles.length === 1 ? '' : 's'}`}
					</button>
					<button
						onclick={() => (uploadedFiles = [])}
						class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm
						       text-gray-700 transition-colors hover:bg-gray-100"
					>
						Clear all
					</button>
					{#if uploadError}
						<p class="text-sm text-red-500">{uploadError}</p>
					{/if}
				</div>
			{:else}
				<p class="text-sm text-gray-400">No files selected yet. Pick at least 2 to merge.</p>
			{/if}
		</div>
	{/if}

	<!-- ══════════════════════════════════════════════════════════════════════════
	     LIBRARY TAB
	     ══════════════════════════════════════════════════════════════════════ -->
	{#if activeTab === 'library'}
		{#if loading}
			<div class="py-8 text-center"><p class="text-lg">Loading videos…</p></div>
		{:else if error}
			<div class="py-8 text-center">
				<p class="mb-4 text-lg text-red-600">Error: {error}</p>
				<button
					onclick={loadVideos}
					class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">Retry</button
				>
			</div>
		{:else if videos.length === 0}
			<div class="py-8 text-center">
				<p class="text-lg text-gray-500">No videos found</p>
			</div>
		{:else}
			<!-- ── Merge panel ───────────────────────────────────────────────────── -->
			{#if selectedIds.length > 0}
				<div class="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-5">
					<h2 class="mb-1 text-xl font-semibold">Merge order</h2>
					<p class="mb-4 text-sm text-gray-500">
						Drag rows to reorder — videos will be merged top to bottom.
					</p>

					<ol class="mb-4 flex flex-col gap-2">
						{#each selectedIds as id, i}
							{@const video = getVideo(id)}
							<li
								class="flex cursor-grab items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm transition-colors
	                {dragSrcId === id ? 'opacity-40' : ''}
	                {dragOverId === id && dragSrcId !== id
									? 'border-blue-400 bg-blue-50'
									: 'border-gray-200'}"
								draggable="true"
								ondragstart={(e) => onDragStart(e, id)}
								ondragover={(e) => onDragOver(e, id)}
								ondragleave={onDragLeave}
								ondragend={onDragEnd}
							>
								<span class="text-lg leading-none text-gray-300 select-none">⠿</span>
								<span
									class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full
	                           bg-blue-100 text-xs font-semibold text-blue-700"
								>
									{i + 1}
								</span>
								<span class="flex-1 truncate text-sm font-medium">{video?.name ?? id}</span>
								{#if video?.duration}
									<span class="text-xs text-gray-400">{video.duration}s</span>
								{/if}
								{#if video?.b64}
									<span class="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">demo</span
									>
								{/if}
								<button
									onclick={() => removeFromSelection(id)}
									class="ml-1 text-xl leading-none text-gray-300 transition-colors hover:text-red-500"
									aria-label="Remove from selection">×</button
								>
							</li>
						{/each}
					</ol>

					<!-- Overlay Options -->
					<div class="mb-4 rounded-lg border border-gray-200 bg-white p-4">
						<div class="mb-3 flex items-center justify-between">
							<h3 class="text-sm font-semibold text-gray-700">Add Intro/Outro Overlay</h3>
							<button
								onclick={toggleOverlayOptions}
								class="text-sm text-blue-600 transition-colors hover:text-blue-700"
							>
								{showOverlayOptions ? 'Hide' : 'Show'} options
							</button>
						</div>

						{#if showOverlayOptions}
							<div class="space-y-4">
								<div>
									<label class="mb-1 block text-sm font-medium text-gray-600">Overlay Type</label>
									<select
										bind:value={overlayType}
										class="w-full rounded border border-gray-300 px-2 py-1 text-sm"
									>
										<option value="intro">Intro Only</option>
										<option value="outro">Outro Only</option>
										<option value="both">Both Intro & Outro</option>
									</select>
								</div>

								{#if overlayType === 'intro' || overlayType === 'both'}
									<div class="space-y-3 rounded-lg bg-blue-50 p-3">
										<h4 class="text-sm font-medium text-blue-800">Intro Settings</h4>
										<div>
											<label class="mb-1 block text-sm font-medium text-gray-600"
												>Background Color</label
											>
											<div class="flex items-center gap-2">
												<input
													type="color"
													bind:value={introBackgroundColor}
													class="h-8 w-16 rounded border border-gray-300"
												/>
												<input
													type="text"
													bind:value={introBackgroundColor}
													class="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
													placeholder="#000000"
												/>
											</div>
										</div>

										<div>
											<label class="mb-1 block text-sm font-medium text-gray-600"
												>Intro Image (optional)</label
											>
											<input
												type="file"
												accept="image/*"
												onchange={handleIntroImageSelect}
												class="w-full rounded border border-gray-300 px-2 py-1 text-sm file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-xs file:text-blue-700 hover:file:bg-blue-100"
											/>
											{#if introImage}
												<p class="mt-1 text-xs text-gray-500">Selected: {introImage.name}</p>
											{/if}
										</div>

										<div>
											<label class="mb-1 block text-sm font-medium text-gray-600"
												>Duration (seconds)</label
											>
											<input
												type="number"
												bind:value={introDuration}
												min="1"
												max="10"
												class="w-full rounded border border-gray-300 px-2 py-1 text-sm"
											/>
										</div>
									</div>
								{/if}

								{#if overlayType === 'outro' || overlayType === 'both'}
									<div class="space-y-3 rounded-lg bg-green-50 p-3">
										<h4 class="text-sm font-medium text-green-800">Outro Settings</h4>
										<div>
											<label class="mb-1 block text-sm font-medium text-gray-600"
												>Background Color</label
											>
											<div class="flex items-center gap-2">
												<input
													type="color"
													bind:value={outroBackgroundColor}
													class="h-8 w-16 rounded border border-gray-300"
												/>
												<input
													type="text"
													bind:value={outroBackgroundColor}
													class="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
													placeholder="#000000"
												/>
											</div>
										</div>

										<div>
											<label class="mb-1 block text-sm font-medium text-gray-600"
												>Outro Image (optional)</label
											>
											<input
												type="file"
												accept="image/*"
												onchange={handleOutroImageSelect}
												class="w-full rounded border border-gray-300 px-2 py-1 text-sm file:mr-2 file:rounded file:border-0 file:bg-green-50 file:px-2 file:py-1 file:text-xs file:text-green-700 hover:file:bg-green-100"
											/>
											{#if outroImage}
												<p class="mt-1 text-xs text-gray-500">Selected: {outroImage.name}</p>
											{/if}
										</div>

										<div>
											<label class="mb-1 block text-sm font-medium text-gray-600"
												>Duration (seconds)</label
											>
											<input
												type="number"
												bind:value={outroDuration}
												min="1"
												max="10"
												class="w-full rounded border border-gray-300 px-2 py-1 text-sm"
											/>
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<div class="flex flex-wrap items-center gap-3">
						<button
							onclick={mergeVideos}
							disabled={mergeLoading || selectedIds.length < 2}
							class="rounded-lg bg-green-500 px-6 py-2 font-medium text-white
	                   transition-colors hover:bg-green-600 disabled:cursor-not-allowed
	                   disabled:bg-gray-300"
						>
							{mergeLoading
								? 'Merging…'
								: `Merge ${selectedIds.length} video${selectedIds.length === 1 ? '' : 's'}`}
						</button>
						<button
							onclick={() => (selectedIds = [])}
							class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm
	                   text-gray-700 transition-colors hover:bg-gray-100"
						>
							Clear selection
						</button>
						{#if mergeError}
							<p class="text-sm text-red-500">{mergeError}</p>
						{/if}
					</div>
				</div>
			{/if}

			<!-- ── Video grid ────────────────────────────────────────────────────── -->
			<h2 class="mb-4 text-xl font-semibold">All Videos ({videos.length})</h2>
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each videos as video (video._uid)}
					{@const id = video._uid}
					{@const isSelected = selectedIds.includes(id)}
					{@const orderNum = selectedIds.indexOf(id) + 1}
					{@const src = video.b64
						? `data:video/mp4;base64,${video.b64}`
						: `http://localhost:3000/${video.path}`}

					<div
						class="cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm transition-all
	                 hover:shadow-md
	                 {isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : 'border border-gray-200'}"
						onclick={() => toggleSelect(video)}
						ondblclick={() => goto(`/video/${video._id || video.id}`)}
						role="checkbox"
						aria-checked={isSelected}
						tabindex="0"
						onkeydown={(e) => e.key === ' ' && toggleSelect(video)}
					>
						<div class="relative">
							{#if isSelected}
								<div
									class="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center
	                           rounded-full bg-blue-500 text-xs font-bold text-white shadow"
								>
									{orderNum}
								</div>
							{/if}
							<!-- svelte-ignore a11y_media_has_caption -->
							<video
								class="h-48 w-full object-cover"
								{src}
								onclick={(e) => e.stopPropagation()}
								controls
							/>
						</div>

						<div class="p-4">
							<h3 class="mb-1 truncate font-semibold">{video.name}</h3>
							{#if video.tags?.length}
								<div class="mb-2 flex flex-wrap gap-1">
									{#each video.tags as tag}
										<span class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{tag}</span>
									{/each}
								</div>
							{/if}
							<div class="flex gap-3 text-xs text-gray-400">
								{#if video.duration}<span>{video.duration}s</span>{/if}
								{#if video.format}<span>{video.format.toUpperCase()}</span>{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</main>
