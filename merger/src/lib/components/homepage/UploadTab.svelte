<script>
	let {
		uploadedFiles = $bindable([]),
		uploadLoading = false,
		uploadError = '',
		onMerge
	} = $props();

	let uploadDragSrcIdx = $state(/** @type {number|null} */ (null));
	let uploadDragOverIdx = $state(/** @type {number|null} */ (null));

	// Intro/Outro overlay options
	let overlayType = $state('intro');
	let introBackgroundColor = $state('#000000');
	let introImage = $state(/** @type {File|null} */ (null));
	let introDuration = $state(3);
	let outroBackgroundColor = $state('#000000');
	let outroImage = $state(/** @type {File|null} */ (null));
	let outroDuration = $state(3);

	// Size limit popup
	let sizeErrorFiles = $state(/** @type {string[]} */ ([]));
	let showSizeError = $state(false);

	const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

	let showIntro = $derived(overlayType === 'intro' || overlayType === 'both');
	let showOutro = $derived(overlayType === 'outro' || overlayType === 'both');
	let showOverlayOptions = $derived(overlayType !== 'none');

	export function getOverlayConfig() {
		return {
			showOverlayOptions,
			overlayType,
			introBackgroundColor,
			introImage,
			introDuration,
			outroBackgroundColor,
			outroImage,
			outroDuration
		};
	}

	function filterAndAddFiles(files) {
		const oversized = files.filter((f) => f.size > MAX_FILE_SIZE);
		const valid = files.filter((f) => f.size <= MAX_FILE_SIZE);
		if (oversized.length > 0) {
			sizeErrorFiles = oversized.map(
				(f) => `${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`
			);
			showSizeError = true;
		}
		if (valid.length > 0) {
			uploadedFiles = [...uploadedFiles, ...valid];
		}
	}

	function handleIntroImageSelect(event) {
		const file = event.target.files[0];
		if (file) introImage = file;
	}

	function handleOutroImageSelect(event) {
		const file = event.target.files[0];
		if (file) outroImage = file;
	}

	function handleFileSelect(event) {
		filterAndAddFiles(Array.from(event.target.files));
		event.target.value = '';
	}

	function handleDropZoneDrop(event) {
		event.preventDefault();
		const files = Array.from(event.dataTransfer.files).filter((f) => f.type.startsWith('video/'));
		if (files.length) filterAndAddFiles(files);
	}

	function handleDropZoneDragOver(event) {
		event.preventDefault();
	}

	function removeFile(index) {
		uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
	}

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
</script>

{#if showSizeError}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		style="background: rgba(0,0,0,0.7);"
		onclick={(e) => { if (e.target === e.currentTarget) showSizeError = false; }}
	>
		<div
			class="w-full max-w-sm rounded-xl p-6"
			style="background:#1e2210; border:0.5px solid #c85050;"
		>
			<div class="mb-4 flex items-start justify-between gap-3">
				<div class="flex items-center gap-2">
					<svg style="width:20px;height:20px;color:#c85050;shrink:0;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
					</svg>
					<p class="text-sm font-medium" style="color:#c85050;">Files too large</p>
				</div>
				<button
					onclick={() => (showSizeError = false)}
					style="background:none; border:none; color:#5a6828; cursor:pointer; font-size:1.25rem; line-height:1; padding:0;"
					onmouseenter={(e) => (e.target.style.color = '#c8d870')}
					onmouseleave={(e) => (e.target.style.color = '#5a6828')}
					aria-label="Close"
				>×</button>
			</div>

			<p class="mb-3 text-xs" style="color:#7a8840;">
				The following file{sizeErrorFiles.length === 1 ? '' : 's'} exceed the 100 MB limit and {sizeErrorFiles.length === 1 ? 'was' : 'were'} not added:
			</p>

			<ul class="mb-4 rounded-lg" style="background:#2a3018; border:0.5px solid #3a4018; padding:0; list-style:none; margin:0;">
				{#each sizeErrorFiles as name, i}
					<li
						class="px-3 py-2 text-xs"
						style="color:#c8d870; border-bottom:{i < sizeErrorFiles.length - 1 ? '0.5px solid #3a4018' : 'none'};"
					>
						{name}
					</li>
				{/each}
			</ul>

			<p class="mb-4 text-xs" style="color:#5a6828;">
				Please compress or trim your videos before uploading. Maximum size per file is 100 MB.
			</p>

			<button
				onclick={() => (showSizeError = false)}
				class="w-full rounded-md py-2 text-xs font-medium transition-colors"
				style="background:#3a4018; border:0.5px solid #4a5520; color:#a0b040; cursor:pointer;"
				onmouseenter={(e) => (e.target.style.background = '#4a5520')}
				onmouseleave={(e) => (e.target.style.background = '#3a4018')}
			>
				Got it
			</button>
		</div>
	</div>
{/if}


<div class="max-w-2xl">
	<h2 class="mb-1 text-sm font-medium" style="color:#c8d870;">Merge your own videos</h2>
	<p class="mb-5 text-xs" style="color:#7a8840;">
		Pick 2 or more video files from your device — they'll be merged in the order listed. Drag rows
		to reorder.
	</p>

	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
	<label
		class="mb-5 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg px-6 py-10 text-center transition-colors"
		style="border: 1.5px dashed #4a5520; background:#1e2210;"
		ondragover={handleDropZoneDragOver}
		ondrop={handleDropZoneDrop}
		onmouseenter={(e) => (e.currentTarget.style.borderColor = '#8a9a30')}
		onmouseleave={(e) => (e.currentTarget.style.borderColor = '#4a5520')}
	>
		<svg
			style="width:36px;height:36px;color:#5a6828;"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="1.5"
				d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
			/>
		</svg>
		<div>
			<p class="text-sm font-medium" style="color:#a0b040;">Click to select videos</p>
			<p class="mt-1 text-xs" style="color:#5a6828;">or drag & drop here (max 100mb per file)</p>
			<p class="text-xs" style="color:#5a6828;">MP4, MOV, AVI, MKV, WebM supported</p>
		</div>
		<input type="file" accept="video/*" multiple class="sr-only" onchange={handleFileSelect} />
	</label>

	{#if uploadedFiles.length > 0}
		<div class="mb-5 overflow-hidden rounded-lg" style="border:0.5px solid #4a5520;">
			<div
				class="flex items-center justify-between px-4 py-2"
				style="background:#2a2e1a; border-bottom:0.5px solid #3a4018;"
			>
				<h3 class="text-xs font-medium" style="color:#a0b040;">
					{uploadedFiles.length} file{uploadedFiles.length === 1 ? '' : 's'} selected
				</h3>
				<span class="text-xs" style="color:#5a6828;">Drag rows to reorder</span>
			</div>

			<ol>
				{#each uploadedFiles as file, i}
					<li
						class="flex items-center gap-3 px-4 py-2 transition-colors"
						style="
							background: {uploadDragOverIdx === i && uploadDragSrcIdx !== i ? '#2a3a1a' : '#1e2210'};
							opacity: {uploadDragSrcIdx === i ? '0.4' : '1'};
							border-bottom: 0.5px solid #2a3018;
						"
						draggable="true"
						ondragstart={(e) => onUploadDragStart(e, i)}
						ondragover={(e) => onUploadDragOver(e, i)}
						ondragend={onUploadDragEnd}
					>
						<span class="cursor-grab text-base leading-none select-none" style="color:#4a5520;"
							>⠿</span
						>
						<span
							class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium"
							style="background:#4a5520; color:#c8d870;"
						>
							{i + 1}
						</span>
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs font-medium" style="color:#c8d870;">{file.name}</p>
							<p class="text-xs" style="color:#5a6828;">
								{(file.size / 1024 / 1024).toFixed(1)} MB
							</p>
						</div>
						<button
							onclick={() => removeFile(i)}
							class="ml-1 text-lg leading-none transition-colors"
							style="background:none; border:none; color:#4a5520; cursor:pointer;"
							onmouseenter={(e) => (e.target.style.color = '#c85050')}
							onmouseleave={(e) => (e.target.style.color = '#4a5520')}
							aria-label="Remove file"
						>
							×
						</button>
					</li>
				{/each}
			</ol>
		</div>

		<!-- Intro/Outro overlay options -->
		<div class="mb-5 rounded-lg" style="border:0.5px solid #4a5520; background:#1e2210;">
			<div class="p-4">
				<!-- Overlay type tabs -->
				<p class="mb-2 text-xs font-medium" style="color:#a0b040;">Intro/outro options</p>
				<div class="mb-4 flex gap-1">
					{#each ['none', 'intro', 'outro', 'both'] as type}
						<button
							onclick={() => (overlayType = type)}
							class="flex-1 rounded-md py-1.5 text-xs font-medium transition-colors"
							style="
								background:{overlayType === type ? '#4a5520' : '#2a3018'};
								border:0.5px solid {overlayType === type ? '#6b7a2e' : '#3a4018'};
								color:{overlayType === type ? '#d6e08a' : '#7a8840'};
								cursor:pointer;
							"
						>
							{type}
						</button>
					{/each}
				</div>

				<!-- Intro settings -->
				{#if showIntro}
					<div class="mb-4">
						{#if overlayType === 'both'}
							<p class="mb-2 text-xs font-medium" style="color:#a0b040;">Intro</p>
						{/if}

						<div class="mb-3">
							<p class="mb-1.5 text-xs" style="color:#7a8840;">color</p>
							<div class="flex items-center gap-2">
								<input
									type="color"
									bind:value={introBackgroundColor}
									class="h-16 w-16 shrink-0 rounded-md"
									style="border:0.5px solid #4a5520; background:#1e2210; cursor:pointer; padding:2px;"
								/>
								<input
									type="text"
									bind:value={introBackgroundColor}
									class="flex-1 rounded-md px-2 py-1.5 text-xs outline-none"
									style="background:#2a3018; border:0.5px solid #3a4018; color:#c8d870;"
									placeholder="#000000"
								/>
							</div>
						</div>

						<div class="mb-3">
							<p class="mb-1.5 text-xs" style="color:#7a8840;">image</p>
							<label
								class="flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-xs transition-colors"
								style="background:#2a3018; border:0.5px solid #3a4018; color:#7a8840;"
								onmouseenter={(e) => (e.currentTarget.style.borderColor = '#6b7a2e')}
								onmouseleave={(e) => (e.currentTarget.style.borderColor = '#3a4018')}
							>
								{#if introImage}
									<span style="color:#a0b040;">{introImage.name}</span>
								{:else}
									Choose file...
								{/if}
								<input
									type="file"
									accept="image/*"
									class="sr-only"
									onchange={handleIntroImageSelect}
								/>
							</label>
						</div>

						<div class="mb-3">
							<p class="mb-1.5 text-xs" style="color:#7a8840;">duration</p>
							<input
								type="number"
								bind:value={introDuration}
								min="1"
								max="10"
								class="w-full rounded-md px-3 py-2 text-xs outline-none"
								style="background:#2a3018; border:0.5px solid #3a4018; color:#c8d870;"
							/>
						</div>
					</div>
				{/if}

				<!-- Outro settings -->
				{#if showOutro}
					<div class="mb-4">
						{#if overlayType === 'both'}
							<div class="mb-3" style="height:0.5px; background:#3a4018;"></div>
							<p class="mb-2 text-xs font-medium" style="color:#a0b040;">Outro</p>
						{/if}

						<div class="mb-3">
							<p class="mb-1.5 text-xs" style="color:#7a8840;">color</p>
							<div class="flex items-center gap-2">
								<input
									type="color"
									bind:value={outroBackgroundColor}
									class="h-16 w-16 shrink-0 rounded-md"
									style="border:0.5px solid #4a5520; background:#1e2210; cursor:pointer; padding:2px;"
								/>
								<input
									type="text"
									bind:value={outroBackgroundColor}
									class="flex-1 rounded-md px-2 py-1.5 text-xs outline-none"
									style="background:#2a3018; border:0.5px solid #3a4018; color:#c8d870;"
									placeholder="#000000"
								/>
							</div>
						</div>

						<div class="mb-3">
							<p class="mb-1.5 text-xs" style="color:#7a8840;">image</p>
							<label
								class="flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-xs transition-colors"
								style="background:#2a3018; border:0.5px solid #3a4018; color:#7a8840;"
								onmouseenter={(e) => (e.currentTarget.style.borderColor = '#6b7a2e')}
								onmouseleave={(e) => (e.currentTarget.style.borderColor = '#3a4018')}
							>
								{#if outroImage}
									<span style="color:#a0b040;">{outroImage.name}</span>
								{:else}
									Choose file...
								{/if}
								<input
									type="file"
									accept="image/*"
									class="sr-only"
									onchange={handleOutroImageSelect}
								/>
							</label>
						</div>

						<div class="mb-3">
							<p class="mb-1.5 text-xs" style="color:#7a8840;">duration</p>
							<input
								type="number"
								bind:value={outroDuration}
								min="1"
								max="10"
								class="w-full rounded-md px-3 py-2 text-xs outline-none"
								style="background:#2a3018; border:0.5px solid #3a4018; color:#c8d870;"
							/>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<button
				onclick={onMerge}
				disabled={uploadLoading || uploadedFiles.length < 2}
				class="rounded-md px-5 py-2 text-sm font-medium text-white transition-colors"
				style="background:{uploadLoading || uploadedFiles.length < 2
					? '#3a4018'
					: '#6b7a2e'}; border:none; cursor:{uploadLoading || uploadedFiles.length < 2
					? 'not-allowed'
					: 'pointer'}; color:{uploadLoading || uploadedFiles.length < 2 ? '#5a6828' : '#fff'};"
				onmouseenter={(e) => {
					if (!uploadLoading && uploadedFiles.length >= 2) e.target.style.background = '#7a8a35';
				}}
				onmouseleave={(e) => {
					if (!uploadLoading && uploadedFiles.length >= 2) e.target.style.background = '#6b7a2e';
				}}
			>
				{uploadLoading
					? 'Uploading & merging…'
					: `Merge ${uploadedFiles.length} video${uploadedFiles.length === 1 ? '' : 's'}`}
			</button>
			<button
				onclick={() => (uploadedFiles = [])}
				class="rounded-md px-4 py-2 text-xs transition-colors"
				style="background:#1e2210; border:0.5px solid #4a5520; color:#a0b040; cursor:pointer;"
				onmouseenter={(e) => (e.target.style.background = '#2a3018')}
				onmouseleave={(e) => (e.target.style.background = '#1e2210')}
			>
				Clear all
			</button>
			{#if uploadError}
				<p class="text-xs" style="color:#c85050;">{uploadError}</p>
			{/if}
		</div>
	{:else}
		<p class="text-xs" style="color:#5a6828;">No files selected yet. Pick at least 2 to merge.</p>
	{/if}
</div>
