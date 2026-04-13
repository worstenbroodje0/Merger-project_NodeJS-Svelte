<script>
	// @ts-nocheck

	let {
		pendingFiles,
		uploading,
		uploadProgress,
		isDragging,
		handleFiles,
		removeFile,
		uploadFiles,
		fmtSize
	} = $props();

	function onDragOver(e) {
		e.preventDefault();
		isDragging = true;
	}
	function onDragLeave() {
		isDragging = false;
	}
	function onDrop(e) {
		e.preventDefault();
		isDragging = false;
		handleFiles(e);
	}
</script>

<div
	onclick={() => document.getElementById('file-input').click()}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
	style="
		cursor:pointer; border-radius:10px; padding:60px 20px; text-align:center; transition:border-color 0.15s;
		border:1.5px dashed {isDragging ? '#8a9a30' : '#4a5520'};
		background:{isDragging ? '#252d12' : '#1e2210'};
	"
>
	<svg
		style="width:40px; height:40px; color:#4a5520; margin:0 auto 12px;"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="1.5"
	>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
		/>
	</svg>
	<p style="font-size:14px; font-weight:500; color:#a0b040; margin-bottom:6px;">Upload video's</p>
	<p style="font-size:12px; color:#5a6828;">MP4, MOV, AVI, MKV — drag & drop or click</p>
</div>

<input
	id="file-input"
	type="file"
	accept="video/*"
	multiple
	style="display:none;"
	onchange={handleFiles}
/>

{#if pendingFiles.length}
	<div style="margin-top:12px; display:flex; flex-direction:column; gap:6px;">
		{#each pendingFiles as f, i}
			<div
				style="display:flex; align-items:center; gap:10px; background:#2a2e1a; border:0.5px solid #4a5520; border-radius:6px; padding:10px 14px;"
			>
				<span
					style="font-size:12px; font-weight:500; color:#c8d870; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
					>{f.name}</span
				>
				<span style="font-size:11px; color:#5a6828; flex-shrink:0;">{fmtSize(f.size)}</span>
				<button
					onclick={() => removeFile(i)}
					style="background:none; border:none; color:#4a5520; cursor:pointer; font-size:16px; padding:0 2px;"
					onmouseenter={(e) => (e.target.style.color = '#c85050')}
					onmouseleave={(e) => (e.target.style.color = '#4a5520')}>×</button
				>
			</div>
		{/each}
	</div>

	<div style="margin-top:12px;">
		{#if uploading}
			<div style="margin-bottom:10px;">
				<div
					style="display:flex; justify-content:space-between; font-size:11px; color:#7a8840; margin-bottom:4px;"
				>
					<span>Uploading…</span><span>{Math.round(uploadProgress)}%</span>
				</div>
				<div style="height:4px; background:#2a3010; border-radius:2px; overflow:hidden;">
					<div
						style="height:100%; background:#6b7a2e; border-radius:2px; transition:width 0.3s; width:{uploadProgress}%;"
					></div>
				</div>
			</div>
		{/if}
		<button
			onclick={uploadFiles}
			disabled={uploading}
			style="
				padding:8px 20px; font-size:13px; font-weight:500; border-radius:6px; border:none; cursor:{uploading
				? 'not-allowed'
				: 'pointer'};
				background:{uploading ? '#2a3010' : '#6b7a2e'};
				color:{uploading ? '#4a5520' : '#fff'};
			"
		>
			{uploading
				? 'Uploading…'
				: `Upload ${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''}`}
		</button>
	</div>
{/if}
