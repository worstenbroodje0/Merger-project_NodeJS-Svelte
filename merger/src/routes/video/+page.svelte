<script>
// @ts-nocheck
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth.js';
	import Notification from '$lib/components/Notification.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';

	let videos = $state([]);
	let loading = $state(true);
	let error = $state(null);
	let editingVideo = $state(null);
	let showEditModal = $state(false);
	let authInitialized = $state(false);
	let searchQuery = $state('');

	// Confirm delete
	let confirmState = $state({ open: false, video: null });

	let notification = $state({ message: '', type: 'info', visible: false });
	let notificationRef;
	let showSuccess, showError;

	$effect(() => {
		if (notificationRef) {
			showSuccess = notificationRef.showSuccess;
			showError   = notificationRef.showError;
		}
	});

	let filteredVideos = $derived(
		!searchQuery.trim()
			? videos
			: videos.filter((v) => v.name?.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	onMount(() => {
		const unsubscribe = auth.subscribe((authState) => {
			if (!authInitialized) {
				authInitialized = true;
				if (authState?.user) loadVideos();
				return;
			}
			if (!authState?.user) { goto('/login'); return; }
			loadVideos();
		});
		return unsubscribe;
	});

	async function loadVideos() {
		try {
			loading = true;
			error = null;
			const response = await fetch('http://localhost:3000/api/media');
			if (response.ok) {
				const data = await response.json();
				const currentUserId = $auth.user?.id;
				videos = (data.data || []).filter((v) => v.user_id === currentUserId);
			} else {
				throw new Error('Failed to fetch videos');
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load videos';
		} finally {
			loading = false;
		}
	}

	function formatDate(d) { return new Date(d).toLocaleDateString(); }
	function formatFileSize(b) { if (!b) return 'Unknown'; return (b / 1024 / 1024).toFixed(2) + ' MB'; }
	function formatDuration(s) {
		if (!s) return 'Unknown';
		return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
	}
	function isMergedVideo(v) {
		const n = (v.name || '').toLowerCase(), p = (v.path || '').toLowerCase();
		return n.includes('merged') || p.includes('merged');
	}

	function askDelete(video) {
		confirmState = { open: true, video };
	}

	async function doDelete() {
		const video = confirmState.video;
		confirmState = { open: false, video: null };
		try {
			const response = await fetch(`http://localhost:3000/api/media/${video._id || video.id}`, { method: 'DELETE' });
			if (response.ok) {
				const id = video._id || video.id;
				videos = videos.filter((v) => (v._id || v.id) !== id);
				showSuccess?.('Video deleted successfully');
			} else {
				const d = await response.json();
				showError?.(d.error || 'Failed to delete video');
			}
		} catch (err) {
			showError?.('Error deleting video: ' + err.message);
		}
	}

	function openEditModal(video) {
		editingVideo = { ...video, tagsString: video.tags ? video.tags.join(', ') : '' };
		showEditModal = true;
	}

	function closeEditModal() { showEditModal = false; editingVideo = null; }

	async function saveVideo() {
		if (!editingVideo) return;
		try {
			const response = await fetch(`http://localhost:3000/api/media/${editingVideo._id || editingVideo.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: editingVideo.name,
					tags: editingVideo.tagsString
						? editingVideo.tagsString.split(',').map((t) => t.trim()).filter(Boolean)
						: []
				})
			});
			if (response.ok) {
				const result = await response.json();
				if (result.data) {
					videos = videos.map((v) => (v._id || v.id) === (result.data._id || result.data.id) ? result.data : v);
					showSuccess?.('Video updated successfully');
					closeEditModal();
				} else {
					throw new Error('No data returned from update');
				}
			} else {
				const d = await response.json();
				showError?.(d.error || 'Failed to update video');
			}
		} catch (err) {
			showError?.('Error updating video: ' + err.message);
		}
	}

	async function downloadVideo(video) {
		try {
			const url = video.b64
				? `data:video/mp4;base64,${video.b64}`
				: `http://localhost:3000/${video.path.replace(/\\/g, '/')}`;
			const blob = await (await fetch(url)).blob();
			const blobUrl = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = blobUrl; link.download = video.name || 'video.mp4';
			document.body.appendChild(link); link.click(); document.body.removeChild(link);
			URL.revokeObjectURL(blobUrl);
		} catch {
			const fallback = video.b64
				? `data:video/mp4;base64,${video.b64}`
				: `http://localhost:3000/${video.path.replace(/\\/g, '/')}`;
			window.open(fallback, '_blank');
		}
	}
</script>

<div class="min-h-screen font-sans" style="background:#1e1e1e; color:#c8d870;">
	<main class="mx-auto max-w-7xl px-6 py-8">
		<div class="mb-6">
			<h2 class="mb-1 text-2xl font-bold" style="color:#c8d870;">My Videos</h2>
			<p class="mb-4 text-sm" style="color:#7a8840;">All your uploaded and merged videos in one place</p>
			<input type="text" placeholder="Search videos…" bind:value={searchQuery}
				class="rounded-md px-3 py-1.5 text-sm outline-none"
				style="width:220px; background:#2a2e1a; border:0.5px solid #4a5520; color:#c8d870;"
				onfocus={(e) => e.target.style.borderColor='#6b7a2e'}
				onblur={(e) => e.target.style.borderColor='#4a5520'}
			/>
		</div>

		{#if loading}
			<div class="py-16 text-center"><p style="color:#7a8840;">Loading your videos…</p></div>
		{:else if error}
			<div class="py-16 text-center">
				<div class="mb-4 inline-block rounded-lg px-4 py-3" style="background:#3a1a1a; border:0.5px solid #7a3020; color:#e8a0a0; font-size:13px;">{error}</div>
				<div><button onclick={loadVideos} class="rounded-lg px-4 py-2 text-sm font-medium" style="background:#4a5520; color:#c8d870; border:none; cursor:pointer;">Retry</button></div>
			</div>
		{:else if filteredVideos.length === 0}
			<div class="py-16 text-center">
				<p class="mb-2 text-lg" style="color:#7a8840;">{searchQuery ? 'No results found' : 'No videos yet'}</p>
				{#if !searchQuery}
					<p class="mb-6 text-sm" style="color:#5a6828;">Merge some videos to get started!</p>
					<button onclick={() => goto('/')} class="rounded-lg px-4 py-2 text-sm font-medium" style="background:#4a5520; color:#c8d870; border:none; cursor:pointer;">Go to Merge</button>
				{/if}
			</div>
		{:else}
			<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px,1fr)); gap:16px;">
				{#each filteredVideos as video, index (`${video._id || video.id || 'v'}-${index}`)}
					<div class="overflow-hidden rounded-xl transition-all"
						style="background:#2a2e1a; border:0.5px solid #4a5520;"
						onmouseenter={(e) => e.currentTarget.style.borderColor='#8a9a30'}
						onmouseleave={(e) => e.currentTarget.style.borderColor='#4a5520'}
					>
						<div style="position:relative; aspect-ratio:16/9; background:#111;">
							{#if video.path}
								{@const src = video.b64 ? `data:video/mp4;base64,${video.b64}` : `http://localhost:3000/${video.path.replace(/\\/g, '/')}`}
								<!-- svelte-ignore a11y_media_has_caption -->
								<video style="width:100%; height:100%; object-fit:cover;" {src} controls preload="metadata" />
							{:else}
								<div style="display:flex; align-items:center; justify-content:center; height:100%; background:#1e2210;">
									<svg style="width:48px; height:48px; color:#4a5520;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
									</svg>
								</div>
							{/if}
							{#if isMergedVideo(video)}
								<div style="position:absolute; top:8px; right:8px; background:#3a5520; color:#a0d070; font-size:11px; padding:4px 8px; border-radius:4px; font-weight:500;">Merged</div>
							{/if}
						</div>

						<div style="padding:12px 14px;">
							<h3 style="font-size:14px; font-weight:500; color:#c8d870; margin-bottom:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{video.name}</h3>
							<div style="font-size:12px; color:#5a6828; line-height:1.6;">
								{#if video.duration}<div>Duration: <span style="color:#a0b040;">{formatDuration(video.duration)}</span></div>{/if}
								{#if video.size}<div>Size: <span style="color:#a0b040;">{formatFileSize(video.size)}</span></div>{/if}
								{#if video.uploadedAt}<div>Created: <span style="color:#a0b040;">{formatDate(video.uploadedAt)}</span></div>{/if}
							</div>
							{#if video.tags?.length}
								<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:8px;">
									{#each video.tags as tag}
										<span style="background:#3a4018; color:#a0b040; font-size:10px; padding:2px 6px; border-radius:3px;">{tag}</span>
									{/each}
								</div>
							{/if}
							<div style="display:flex; gap:6px; margin-top:12px;">
								<button onclick={() => downloadVideo(video)}
									style="flex:1; padding:6px 0; font-size:11px; font-weight:500; border-radius:5px; border:0.5px solid #5a7a2e; background:#3a5520; color:#c8e870; cursor:pointer;"
									onmouseenter={(e) => e.currentTarget.style.background='#4a6828'}
									onmouseleave={(e) => e.currentTarget.style.background='#3a5520'}
								>Download</button>
								<button onclick={() => openEditModal(video)}
									style="flex:1; padding:6px 0; font-size:11px; font-weight:500; border-radius:5px; border:0.5px solid #4a5520; background:#1e2210; color:#a0b040; cursor:pointer;"
									onmouseenter={(e) => e.currentTarget.style.background='#2a3010'}
									onmouseleave={(e) => e.currentTarget.style.background='#1e2210'}
								>Edit</button>
								<button onclick={() => askDelete(video)}
									style="flex:1; padding:6px 0; font-size:11px; font-weight:500; border-radius:5px; border:0.5px solid #7a2020; background:#3a1818; color:#d0a0a0; cursor:pointer;"
									onmouseenter={(e) => e.currentTarget.style.background='#4a2020'}
									onmouseleave={(e) => e.currentTarget.style.background='#3a1818'}
								>Delete</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>

<!-- Edit Modal -->
{#if showEditModal && editingVideo}
	<div style="position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.6);"
		onclick={closeEditModal} onkeydown={(e) => e.key==='Escape' && closeEditModal()} tabindex="-1" role="dialog" aria-modal="true">
		<div style="width:380px; background:#2a2e1a; border:0.5px solid #4a5520; border-radius:10px; padding:24px;"
			onclick={(e) => e.stopPropagation()} role="document">
			<h2 style="font-size:15px; font-weight:500; color:#c8d870; margin-bottom:20px;">Edit Video</h2>
			<div style="display:flex; flex-direction:column; gap:14px;">
				<div>
					<label style="display:block; font-size:11px; color:#7a8840; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.05em;">Video Name</label>
					<input type="text" bind:value={editingVideo.name}
						style="width:100%; background:#1e2210; border:0.5px solid #4a5520; border-radius:6px; padding:8px 10px; font-size:13px; color:#c8d870; outline:none;"
						onfocus={(e) => e.target.style.borderColor='#6b7a2e'}
						onblur={(e) => e.target.style.borderColor='#4a5520'} />
				</div>
				<div>
					<label style="display:block; font-size:11px; color:#7a8840; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.05em;">Tags (comma separated)</label>
					<input type="text" bind:value={editingVideo.tagsString} placeholder="tag1, tag2, tag3"
						style="width:100%; background:#1e2210; border:0.5px solid #4a5520; border-radius:6px; padding:8px 10px; font-size:13px; color:#c8d870; outline:none;"
						onfocus={(e) => e.target.style.borderColor='#6b7a2e'}
						onblur={(e) => e.target.style.borderColor='#4a5520'} />
				</div>
			</div>
			<div style="display:flex; gap:8px; margin-top:20px;">
				<button onclick={closeEditModal} style="flex:1; padding:8px 16px; font-size:13px; border-radius:6px; border:0.5px solid #4a5520; background:#1e2210; color:#a0b040; cursor:pointer;">Cancel</button>
				<button onclick={saveVideo} style="flex:1; padding:8px 16px; font-size:13px; font-weight:500; border-radius:6px; border:none; background:#6b7a2e; color:#fff; cursor:pointer;">Save Changes</button>
			</div>
		</div>
	</div>
{/if}

<!-- Confirm Delete -->
<ConfirmModal
	open={confirmState.open}
	title="Delete video?"
	message={confirmState.video?.name ?? ''}
	confirmLabel="Delete"
	onConfirm={doDelete}
	onCancel={() => (confirmState = { open: false, video: null })}
/>

<Notification bind:notification bind:this={notificationRef} />