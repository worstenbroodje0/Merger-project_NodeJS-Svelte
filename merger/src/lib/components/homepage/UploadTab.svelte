<script>
// @ts-nocheck
	let {
		uploadedFiles = $bindable([]),
		uploadLoading = false,
		uploadError = '',
		onMerge,
	} = $props();

	let uploadDragSrcIdx = $state(/** @type {number|null} */ (null));
	let uploadDragOverIdx = $state(/** @type {number|null} */ (null));

	function handleFileSelect(event) {
		const files = Array.from(event.target.files);
		uploadedFiles = [...uploadedFiles, ...files];
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

<div class="max-w-2xl">
	<h2 class="mb-1 text-sm font-medium" style="color:#c8d870;">Merge your own videos</h2>
	<p class="mb-5 text-xs" style="color:#7a8840;">
		Pick 2 or more video files from your device — they'll be merged in the order listed. Drag rows to reorder.
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
		<svg style="width:36px;height:36px;color:#5a6828;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
				d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
		</svg>
		<div>
			<p class="text-sm font-medium" style="color:#a0b040;">Click to select videos</p>
			<p class="mt-1 text-xs" style="color:#5a6828;">or drag & drop here</p>
			<p class="text-xs" style="color:#5a6828;">MP4, MOV, AVI, MKV, WebM supported</p>
		</div>
		<input type="file" accept="video/*" multiple class="sr-only" onchange={handleFileSelect} />
	</label>

	{#if uploadedFiles.length > 0}
		<div class="mb-5 overflow-hidden rounded-lg" style="border:0.5px solid #4a5520;">
			<div class="flex items-center justify-between px-4 py-2" style="background:#2a2e1a; border-bottom:0.5px solid #3a4018;">
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
						<span class="cursor-grab select-none text-base leading-none" style="color:#4a5520;">⠿</span>
						<span
							class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium"
							style="background:#4a5520; color:#c8d870;"
						>
							{i + 1}
						</span>
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs font-medium" style="color:#c8d870;">{file.name}</p>
							<p class="text-xs" style="color:#5a6828;">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
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

		<div class="flex flex-wrap items-center gap-2">
			<button
				onclick={onMerge}
				disabled={uploadLoading || uploadedFiles.length < 2}
				class="rounded-md px-5 py-2 text-sm font-medium text-white transition-colors"
				style="background:{uploadLoading || uploadedFiles.length < 2 ? '#3a4018' : '#6b7a2e'}; border:none; cursor:{uploadLoading || uploadedFiles.length < 2 ? 'not-allowed' : 'pointer'}; color:{uploadLoading || uploadedFiles.length < 2 ? '#5a6828' : '#fff'};"
				onmouseenter={(e) => { if (!uploadLoading && uploadedFiles.length >= 2) e.target.style.background = '#7a8a35'; }}
				onmouseleave={(e) => { if (!uploadLoading && uploadedFiles.length >= 2) e.target.style.background = '#6b7a2e'; }}
			>
				{uploadLoading ? 'Uploading & merging…' : `Merge ${uploadedFiles.length} video${uploadedFiles.length === 1 ? '' : 's'}`}
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