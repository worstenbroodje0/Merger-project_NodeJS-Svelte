<script>
// @ts-nocheck

	let {
		selectedIds = $bindable([]),
		getVideo,
		mergeLoading = false,
		mergeError = '',
		mergeProgress = 0,
		mergeStatus = '',
		onMerge
	} = $props();

	let dragSrcId = $state(/** @type {string|null} */ (null));
	let dragOverId = $state(/** @type {string|null} */ (null));

	let overlayType = $state('intro');
	let introBackgroundColor = $state('#000000');
	let introImage = $state(/** @type {File|null} */ (null));
	let introDuration = $state(3);
	let outroBackgroundColor = $state('#000000');
	let outroImage = $state(/** @type {File|null} */ (null));
	let outroDuration = $state(3);

	let showIntro = $derived(overlayType === 'intro' || overlayType === 'both');
	let showOutro = $derived(overlayType === 'outro' || overlayType === 'both');
	let showOverlayOptions = $derived(overlayType !== 'none');
	let customName = $state('');

	export function getOverlayConfig() {
		return {
			showOverlayOptions: showOverlayOptions,
			overlayType,
			introBackgroundColor,
			introImage,
			introDuration,
			outroBackgroundColor,
			outroImage,
			outroDuration,
			customName
		};
	}

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

	function handleIntroImageSelect(event) {
		introImage = event.target.files[0];
	}

	function handleOutroImageSelect(event) {
		outroImage = event.target.files[0];
	}
</script>

<div class="flex flex-col gap-0" style="height:100%; padding:16px;">
	<!-- Merge order list -->
	{#if selectedIds.length > 0}
		<div class="mb-4">
			<p class="mb-3 text-xs font-medium" style="color:#7a8840;">Merge order — drag to reorder</p>
			<ol class="flex flex-col gap-1.5">
				{#each selectedIds as id, i}
					{@const video = getVideo(id)}
					<li
						class="flex cursor-grab items-center gap-2 rounded-md px-3 py-2 transition-colors"
						style="
							background:{dragSrcId === id ? 'transparent' : '#1e2210'};
							border:0.5px solid {dragOverId === id && dragSrcId !== id ? '#8a9a30' : '#3a4018'};
							opacity:{dragSrcId === id ? '0.4' : '1'};
						"
						draggable="true"
						ondragstart={(e) => onDragStart(e, id)}
						ondragover={(e) => onDragOver(e, id)}
						ondragleave={onDragLeave}
						ondragend={onDragEnd}
					>
						<span class="text-sm leading-none select-none" style="color:#4a5520;">⠿</span>
						<span
							class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium"
							style="background:#4a5520; color:#c8d870;"
						>
							{i + 1}
						</span>
						<span class="flex-1 truncate text-xs font-medium" style="color:#c8d870;"
							>{video?.name ?? id}</span
						>
						{#if video?.duration}
							<span class="text-xs" style="color:#5a6828;">{video.duration}s</span>
						{/if}
						<button
							onclick={() => (selectedIds = selectedIds.filter((x) => x !== id))}
							style="background:none; border:none; color:#4a5520; cursor:pointer; font-size:16px; line-height:1; padding:0 2px;"
							onmouseenter={(e) => (e.target.style.color = '#c85050')}
							onmouseleave={(e) => (e.target.style.color = '#4a5520')}
							aria-label="Remove">×</button
						>
					</li>
				{/each}
			</ol>
		</div>
		<div class="mb-4" style="height:0.5px; background:#3a4018;"></div>
	{:else}
		<div
			class="mb-4 rounded-md px-3 py-4 text-center"
			style="background:#1e2210; border:0.5px solid #3a4018;"
		>
			<p class="text-xs" style="color:#5a6828;">
				Click videos in the grid to add them to the merge queue
			</p>
		</div>
		<div class="mb-4" style="height:0.5px; background:#3a4018;"></div>
	{/if}

	<!-- Custom name input -->
	<div class="mb-4">
		<p class="mb-1.5 text-xs" style="color:#7a8840;">Output filename (optional)</p>
		<input
			type="text"
			bind:value={customName}
			placeholder="merged.mp4"
			class="w-full rounded-md px-3 py-2 text-xs outline-none"
			style="background:#1e2210; border:0.5px solid #3a4018; color:#c8d870;"
		/>
	</div>

	<!-- Overlay type tabs -->
	<p class="mb-2 text-xs font-medium" style="color:#a0b040;">Intro/outro options</p>
	<div class="mb-4 flex gap-1">
		{#each ['none', 'intro', 'outro', 'both'] as type}
			<button
				onclick={() => (overlayType = type)}
				class="flex-1 rounded-md py-1.5 text-xs font-medium transition-colors"
				style="
					background:{overlayType === type ? '#4a5520' : '#1e2210'};
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
						style="background:#1e2210; border:0.5px solid #3a4018; color:#c8d870;"
						placeholder="#000000"
					/>
				</div>
			</div>

			<div class="mb-3">
				<p class="mb-1.5 text-xs" style="color:#7a8840;">image</p>
				<label
					class="flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-xs transition-colors"
					style="background:#1e2210; border:0.5px solid #3a4018; color:#7a8840;"
					onmouseenter={(e) => (e.currentTarget.style.borderColor = '#6b7a2e')}
					onmouseleave={(e) => (e.currentTarget.style.borderColor = '#3a4018')}
				>
					{#if introImage}
						<span style="color:#a0b040;">{introImage.name}</span>
					{:else}
						Choose file…
					{/if}
					<input type="file" accept="image/*" class="sr-only" onchange={handleIntroImageSelect} />
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
					style="background:#1e2210; border:0.5px solid #3a4018; color:#c8d870;"
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
						style="background:#1e2210; border:0.5px solid #3a4018; color:#c8d870;"
						placeholder="#000000"
					/>
				</div>
			</div>

			<div class="mb-3">
				<p class="mb-1.5 text-xs" style="color:#7a8840;">image</p>
				<label
					class="flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-xs transition-colors"
					style="background:#1e2210; border:0.5px solid #3a4018; color:#7a8840;"
					onmouseenter={(e) => (e.currentTarget.style.borderColor = '#6b7a2e')}
					onmouseleave={(e) => (e.currentTarget.style.borderColor = '#3a4018')}
				>
					{#if outroImage}
						<span style="color:#a0b040;">{outroImage.name}</span>
					{:else}
						Choose file…
					{/if}
					<input type="file" accept="image/*" class="sr-only" onchange={handleOutroImageSelect} />
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
					style="background:#1e2210; border:0.5px solid #3a4018; color:#c8d870;"
				/>
			</div>
		</div>
	{/if}

	<!-- Action buttons -->
	<div class="mt-auto flex gap-2 pt-2">
		<button
			onclick={onMerge}
			disabled={mergeLoading || selectedIds.length < 2}
			class="flex-1 rounded-md py-2 text-sm font-medium transition-colors"
			style="
				background:{mergeLoading || selectedIds.length < 2 ? '#2a3010' : '#6b7a2e'};
				border:none;
				color:{mergeLoading || selectedIds.length < 2 ? '#4a5520' : '#fff'};
				cursor:{mergeLoading || selectedIds.length < 2 ? 'not-allowed' : 'pointer'};
			"
			onmouseenter={(e) => {
				if (!mergeLoading && selectedIds.length >= 2) e.target.style.background = '#7a8a35';
			}}
			onmouseleave={(e) => {
				if (!mergeLoading && selectedIds.length >= 2) e.target.style.background = '#6b7a2e';
			}}
		>
			{mergeLoading ? 'Merging…' : 'merge'}
		</button>
		<button
			onclick={() => (selectedIds = [])}
			class="rounded-md px-4 py-2 text-sm transition-colors"
			style="background:#c8d870; border:none; color:#2a3010; cursor:pointer; font-weight:500;"
			onmouseenter={(e) => (e.target.style.background = '#d6e08a')}
			onmouseleave={(e) => (e.target.style.background = '#c8d870')}
		>
			clear
		</button>
	</div>

	{#if mergeLoading}
		<!-- Progress Bar -->
		<div class="mt-4">
			<div class="mb-2 flex justify-between text-xs" style="color:#c8d870;">
				<span>{mergeStatus || 'Processing...'}</span>
				<span>{mergeProgress.toFixed(2)}%</span>
			</div>
			<div class="h-2 overflow-hidden rounded-full" style="background:#1e2210;">
				<div
					class="h-full rounded-full transition-all duration-300 ease-out"
					style="background:#6b7a2e; width:{mergeProgress}%;"
				></div>
			</div>
		</div>
	{/if}

	{#if mergeError}
		<p class="mt-2 text-xs" style="color:#c85050;">{mergeError}</p>
	{/if}
</div>
