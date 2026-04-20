<script>
	// @ts-nocheck

	import { goto } from '$app/navigation';

	let {
		videos = [],
		selectedIds = $bindable([]),
		onDelete,
		showEditModal = $bindable(false),
		editingVideo = $bindable(null),
		user = null
	} = $props();

	function toggleSelect(video) {
		const id = video._uid;
		if (selectedIds.includes(id)) {
			selectedIds = selectedIds.filter((x) => x !== id);
		} else {
			selectedIds = [...selectedIds, id];
		}
	}
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
	{#each videos as video (video._uid)}
		{@const id = video._uid}
		{@const isSelected = selectedIds.includes(id)}
		{@const orderNum = selectedIds.indexOf(id) + 1}
		{@const src = video.b64
			? `data:video/mp4;base64,${video.b64}`
			: `http://localhost:3000/${video.path}`}

		<div
			class="hover:border-a0b840 relative cursor-pointer overflow-hidden rounded-md transition-all"
			style="
				background: #1e2210;
				border: {isSelected ? '1.5px solid #a0b840' : '0.5px solid #4a5520'};
			"
			onclick={() => toggleSelect(video)}
			role="checkbox"
			aria-checked={isSelected}
			tabindex="0"
			onkeydown={(e) => e.key === ' ' && toggleSelect(video)}
		>
			<div class="relative">
				{#if isSelected}
					<div
						class="absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium text-white"
						style="background: #8a9a30;"
					>
						{orderNum}
					</div>
				{/if}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video
					class="h-40 w-full object-cover"
					style="background:#111;"
					{src}
					onclick={(e) => e.stopPropagation()}
					controls
				></video>
			</div>

			<div class="flex items-center gap-2 px-3 py-2">
				<h3 class="flex-1 truncate text-sm font-medium" style="color:#c8d870;">{video.name}</h3>
				{#if video.duration}
					<span class="shrink-0 text-xs" style="color:#7a8840;">{video.duration}s</span>
				{/if}
				{#if video.b64}
					<span
						class="shrink-0 rounded px-2 py-0.5 text-xs"
						style="background:#3a4018; color:#a0b040;"
					>
						demo
					</span>
				{/if}
				{#if user?.role?.name === 'admin' || user?.role?.name === 'editor'}
					<button
						onclick={(e) => {
							e.stopPropagation();
							onDelete(video._id || video.id);
						}}
						class="shrink-0 rounded px-2 py-1 text-xs transition-colors"
						style="background:transparent; border:0.5px solid #4a5520; color:#7a8840;"
						onmouseenter={(e) => {
							e.target.style.background = '#3a1010';
							e.target.style.borderColor = '#c85050';
							e.target.style.color = '#c85050';
						}}
						onmouseleave={(e) => {
							e.target.style.background = 'transparent';
							e.target.style.borderColor = '#4a5520';
							e.target.style.color = '#7a8840';
						}}
						aria-label="Delete video"
					>
						🗑️
					</button>
				{/if}
			</div>

			{#if video.tags?.length}
				<div class="flex flex-wrap gap-1 px-3 pb-2">
					{#each video.tags as tag}
						<span class="rounded px-2 py-0.5 text-xs" style="background:#3a4018; color:#a0b040;">
							{tag}
						</span>
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>
