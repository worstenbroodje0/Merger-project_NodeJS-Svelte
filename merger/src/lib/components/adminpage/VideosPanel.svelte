<script>
	// @ts-nocheck

	let { filteredVideos, loading, playVideo, openEditVideo, askDelete, getUserName } = $props();

	function fmtDuration(s) {
		const total = Math.round(s || 0);
		const m = Math.floor(total / 60);
		const sec = total % 60;
		return `${m}:${String(sec).padStart(2, '0')}`;
	}

	function fmtSize(b) {
		if (!b || b === 0) return '0.00 MB';
		return (b / (1024 * 1024)).toFixed(2) + ' MB';
	}
</script>

{#if loading}
	<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px;">
		{#each Array(6) as _}
			<div
				style="background:#2a2e1a; border:0.5px solid #4a5520; border-radius:8px; overflow:hidden;"
			>
				<div style="aspect-ratio:16/9; background:#1e2210;"></div>
				<div style="padding:10px;">
					<div style="height:10px; background:#2a3010; border-radius:4px; margin-bottom:6px;"></div>
					<div style="height:10px; width:60%; background:#2a3010; border-radius:4px;"></div>
				</div>
			</div>
		{/each}
	</div>
{:else if !filteredVideos.length}
	<div style="padding:60px; text-align:center; font-size:13px; color:#5a6828;">No videos found</div>
{:else}
	<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px,1fr)); gap:12px;">
		{#each filteredVideos as v, i (i)}
			<div
				role="button"
				tabindex="0"
				style="background:#2a2e1a; border:0.5px solid #4a5520; border-radius:8px; overflow:hidden; transition:border-color 0.15s; cursor:pointer;"
				onmouseenter={(e) => (e.currentTarget.style.borderColor = '#8a9a30')}
				onmouseleave={(e) => (e.currentTarget.style.borderColor = '#4a5520')}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						playVideo(v);
					}
				}}
			>
				<div
					style="position:relative; aspect-ratio:16/9; background:#111; display:flex; align-items:center; justify-content:center;"
				>
					<img
						src="http://localhost:3000/thumbnails/{v.name.replace(/\.[^/.]+$/, '')}.jpg"
						alt={v.name}
						style="width:100%; height:100%; object-fit:cover;"
						onerror={(e) => {
							e.currentTarget.style.display = 'none';
						}}
					/>
					<svg
						style="position:absolute; width:32px; height:32px; color:#3a4018;"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1"
					>
						<rect x="2" y="3" width="20" height="14" rx="2" />
						<path d="M10.5 10l3-1.8v3.6z" fill="currentColor" stroke="none" />
					</svg>
					<span
						style="position:absolute; bottom:5px; right:5px; background:rgba(0,0,0,0.7); color:#fff; font-size:10px; padding:2px 5px; border-radius:3px;"
					>
						{fmtDuration(v.duration)}
					</span>
					{#if v.merged}
						<span
							style="position:absolute; top:5px; left:5px; background:#3a5520; color:#a0d070; font-size:10px; padding:2px 6px; border-radius:3px; font-weight:500;"
							>merged</span
						>
					{/if}
				</div>

				<div style="padding:8px 10px 4px;">
					<p
						style="font-size:12px; font-weight:500; color:#c8d870; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
						title={v.name}
					>
						{v.name}
					</p>
					{#if v.merged && v.user_id}
						<p style="font-size:10px; color:#7a8840; margin-top:1px; font-weight:500;">
							User: {getUserName(v.user_id)}
						</p>
					{/if}
					<p style="font-size:11px; color:#5a6828; margin-top:2px;">{fmtSize(v.size)}</p>
					{#if Array.isArray(v.tags) && v.tags.length}
						<div style="display:flex; flex-wrap:wrap; gap:3px; margin-top:5px;">
							{#each v.tags.slice(0, 3) as tag}
								<span
									style="background:#3a4018; color:#a0b040; font-size:10px; padding:1px 6px; border-radius:3px;"
									>{tag}</span
								>
							{/each}
						</div>
					{/if}
				</div>

				<div style="display:flex; gap:5px; padding:6px 10px 10px;">
					<button
						onclick={() => playVideo(v)}
						style="flex:1; padding:5px 0; font-size:11px; font-weight:500; border-radius:5px; border:0.5px solid #5a7a2e; background:#3a5520; color:#c8e870; cursor:pointer; transition:background 0.15s;"
						onmouseenter={(e) => (e.currentTarget.style.background = '#4a6828')}
						onmouseleave={(e) => (e.currentTarget.style.background = '#3a5520')}>Play</button
					>
					<button
						onclick={() => openEditVideo(v)}
						style="flex:1; padding:5px 0; font-size:11px; font-weight:500; border-radius:5px; border:0.5px solid #4a5520; background:#1e2210; color:#a0b040; cursor:pointer; transition:background 0.15s;"
						onmouseenter={(e) => (e.currentTarget.style.background = '#2a3010')}
						onmouseleave={(e) => (e.currentTarget.style.background = '#1e2210')}>Edit</button
					>
					<button
						onclick={() => askDelete('video', v.id, v.name, v.merged)}
						style="width:28px; border-radius:5px; border:0.5px solid #4a5520; background:#1e2210; color:#7a8840; cursor:pointer; display:flex; align-items:center; justify-content:center;"
						onmouseenter={(e) => {
							e.currentTarget.style.borderColor = '#c85050';
							e.currentTarget.style.color = '#c85050';
						}}
						onmouseleave={(e) => {
							e.currentTarget.style.borderColor = '#4a5520';
							e.currentTarget.style.color = '#7a8840';
						}}
						title="Delete"
					>
						<svg style="width:12px; height:12px;" viewBox="0 0 20 20" fill="currentColor">
							<path
								fill-rule="evenodd"
								d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
				</div>
			</div>
		{/each}
	</div>
{/if}
