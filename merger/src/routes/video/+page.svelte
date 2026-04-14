<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth.js';
	import Notification from '$lib/components/Notification.svelte';

	let videos = $state([]);
	let loading = $state(true);
	let error = $state(null);
	let editingVideo = $state(null);
	let showEditModal = $state(false);
	let authInitialized = $state(false);

	// Notification system
	let notification = $state({ message: '', type: 'info', visible: false });
	let notificationRef;

	onMount(() => {
		// Check if user is authenticated, redirect if not
		const unsubscribe = auth.subscribe((authState) => {
			// Wait for auth to be initialized before making decisions
			if (!authInitialized) {
				authInitialized = true;
				// Check if user is already authenticated after initialization
				if (authState && authState.user) {
					loadVideos();
				}
				return;
			}

			if (!authState || !authState.user) {
				goto('/login');
				return;
			}

			if (authState) {
				loadVideos();
			}
		});

		return unsubscribe;
	});

	async function loadVideos() {
		try {
			loading = true;
			error = null;

			// Get all media (both regular and merged) from main endpoint
			const response = await fetch('http://localhost:3000/api/media');

			if (response.ok) {
				const data = await response.json();
				const allVideos = data.data || [];

				// Filter videos for current user
				const currentUserId = $auth.user?.id || 8; // Temporarily hardcoded to 8 for testing
				videos = allVideos.filter((video) => {
					return video.user_id === currentUserId;
				});
			} else {
				throw new Error('Failed to fetch videos');
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load videos';
		} finally {
			loading = false;
		}
	}

	function goToLibrary() {
		goto('/');
	}

	function goToVideoDetail(videoId) {
		goto(`/video/${videoId}`);
	}

	function formatDate(dateString) {
		return new Date(dateString).toLocaleDateString();
	}

	function formatFileSize(bytes) {
		if (!bytes) return 'Unknown';
		return (bytes / 1024 / 1024).toFixed(2) + ' MB';
	}

	function formatDuration(seconds) {
		if (!seconds) return 'Unknown';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function isMergedVideo(video) {
		const name = (video.name || '').toLowerCase();
		const path = (video.path || '').toLowerCase();
		return name.includes('merged') || name.includes('_merged') || path.includes('merged');
	}

	async function deleteVideo(video) {
		if (!confirm(`Are you sure you want to delete "${video.name}"?`)) return;

		try {
			const response = await fetch(`http://localhost:3000/api/media/${video._id || video.id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				// Remove video from the list
				const videoId = video._id || video.id;
				videos = videos.filter((v) => (v._id || v.id) !== videoId);
				console.log(`Video ${videoId} deleted successfully`);
			} else {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to delete video');
			}
		} catch (err) {
			alert('Error deleting video: ' + err.message);
		}
	}

	function openEditModal(video) {
		editingVideo = {
			...video,
			tagsString: video.tags ? video.tags.join(', ') : ''
		};
		showEditModal = true;
	}

	function closeEditModal() {
		showEditModal = false;
		editingVideo = null;
	}

	async function saveVideo() {
		if (!editingVideo) return;

		try {
			const response = await fetch(
				`http://localhost:3000/api/media/${editingVideo._id || editingVideo.id}`,
				{
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						name: editingVideo.name,
						tags: editingVideo.tagsString
							? editingVideo.tagsString
									.split(',')
									.map((tag) => tag.trim())
									.filter((tag) => tag)
							: []
					})
				}
			);

			if (response.ok) {
				// Update video in the list
				const result = await response.json();
				console.log('Update response:', result);

				if (result.data) {
					videos = videos.map((v) =>
						(v._id || v.id) === (result.data._id || result.data.id) ? result.data : v
					);
					closeEditModal();
				} else {
					throw new Error('No data returned from update');
				}
			} else {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to update video');
			}
		} catch (err) {
			alert('Error updating video: ' + err.message);
		}
	}

	async function downloadVideo(video) {
		try {
			// Get the video URL
			const videoUrl = video.b64
				? `data:video/mp4;base64,${video.b64}`
				: `http://localhost:3000/${video.path.replace(/\\/g, '/')}`;

			// Always fetch as blob for consistent download behavior
			const response = await fetch(videoUrl);
			const blob = await response.blob();
			const blobUrl = window.URL.createObjectURL(blob);

			// Create download link
			const link = document.createElement('a');
			link.href = blobUrl;
			link.download = video.name || 'video.mp4';

			// Trigger download
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);

			// Clean up object URL
			window.URL.revokeObjectURL(blobUrl);
		} catch (err) {
			console.error('Download failed:', err);
			// Fallback: try opening in new tab if blob download fails
			const fallbackUrl = video.b64
				? `data:video/mp4;base64,${video.b64}`
				: `http://localhost:3000/${video.path.replace(/\\/g, '/')}`;
			window.open(fallbackUrl, '_blank');
		}
	}

	// Notification functions (using component)
	let showSuccess, showError, showWarning, showInfo, showNotification;

	// Initialize notification functions from component
	$effect(() => {
		if (notificationRef) {
			showSuccess = notificationRef.showSuccess;
			showError = notificationRef.showError;
			showWarning = notificationRef.showWarning;
			showInfo = notificationRef.showInfo;
			showNotification = notificationRef.showNotification;
		}
	});
</script>

<div class="min-h-screen font-sans" style="background:#1e1e1e; color:#c8d870;">
	<!-- Main Content -->
	<main class="mx-auto max-w-7xl px-6 py-8">
		<div class="mb-8">
			<!-- Search bar + header row -->
			<div class="mb-6 flex items-center gap-3">
				<div>
					<h2 class="mb-2 text-2xl font-bold" style="color:#c8d870;">My Videos</h2>
					<p class="text-sm" style="color:#7a8840;">
						All your uploaded and merged videos in one place
					</p>
				</div>
			</div>

			<!-- Search bar -->
			<div
				class="flex items-center gap-3"
				style="border-bottom:0.5px solid #3a4018; padding-bottom:12px;"
			>
				<input
					type="text"
					placeholder="Search videos..."
					class="rounded-md px-3 py-1.5 text-sm outline-none"
					style="width:200px; background:#2a2e1a; border:0.5px solid #4a5520; color:#c8d870;"
				/>
			</div>
		</div>

		{#if loading}
			<div class="py-16 text-center">
				<p class="text-lg" style="color:#7a8840;">Loading your videos...</p>
			</div>
		{:else if error}
			<div class="py-16 text-center">
				<div class="mb-6 inline-block rounded-lg p-4" style="background:#c85050; color:#fff;">
					{error}
				</div>
				<div>
					<button
						onclick={loadVideos}
						class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
						style="background:#4a5520; color:#c8d870; border:none; cursor:pointer;"
						onmouseenter={(e) => {
							e.target.style.background = '#6b7a2e';
						}}
						onmouseleave={(e) => {
							e.target.style.background = '#4a5520';
						}}
					>
						Retry
					</button>
				</div>
			</div>
		{:else if videos.length === 0}
			<div class="py-16 text-center">
				<p class="mb-2 text-lg" style="color:#7a8840;">No videos found</p>
				<p class="mb-6 text-sm" style="color:#5a6828;">Merge some videos to get started!</p>
				<button
					onclick={goToLibrary}
					class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
					style="background:#4a5520; color:#c8d870; border:none; cursor:pointer;"
					onmouseenter={(e) => {
						e.target.style.background = '#6b7a2e';
					}}
					onmouseleave={(e) => {
						e.target.style.background = '#4a5520';
					}}
				>
					Merge
				</button>
			</div>
		{:else}
			<div
				style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px,1fr)); gap:16px;"
			>
				{#each videos as video, index (`${video._id || video.id || 'video'}-${index}`)}
					<div
						class="overflow-hidden rounded-xl transition-all"
						style="background:#2a2e1a; border:0.5px solid #4a5520;"
						onmouseenter={(e) => (e.currentTarget.style.borderColor = '#8a9a30')}
						onmouseleave={(e) => (e.currentTarget.style.borderColor = '#4a5520')}
					>
						<div class="relative">
							<!-- Video thumbnail/player -->
							<div style="position:relative; aspect-ratio:16/9; background:#111;">
								{#if video.path}
									{@const src = video.b64
										? `data:video/mp4;base64,${video.b64}`
										: `http://localhost:3000/${video.path.replace(/\\/g, '/')}`}

									<!-- svelte-ignore a11y_media_has_caption -->
									<video
										style="width:100%; height:100%; object-fit:cover;"
										{src}
										controls
										preload="metadata"
									/>
								{:else}
									<div
										style="display:flex; align-items:center; justify-content:center; height:100%; background:#1e2210;"
									>
										<svg
											style="width:48px; height:48px; color:#4a5520;"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="1.5"
												d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
											></path>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="1.5"
												d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
											></path>
										</svg>
									</div>
								{/if}

								{#if isMergedVideo(video)}
									<div
										style="position:absolute; top:8px; right:8px; background:#3a5520; color:#a0d070; font-size:11px; padding:4px 8px; border-radius:4px; font-weight:500;"
									>
										Merged
									</div>
								{/if}
							</div>
						</div>

						<div style="padding:12px 14px;">
							<h3
								style="font-size:14px; font-weight:500; color:#c8d870; margin-bottom:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
							>
								{video.name}
							</h3>

							<div style="font-size:12px; color:#5a6828; line-height:1.5;">
								{#if video.duration}
									<div>
										Duration: <span style="color:#a0b040;">{formatDuration(video.duration)}</span>
									</div>
								{/if}
								{#if video.size}
									<div>Size: <span style="color:#a0b040;">{formatFileSize(video.size)}</span></div>
								{/if}
								{#if video.uploadedAt}
									<div>
										Created: <span style="color:#a0b040;">{formatDate(video.uploadedAt)}</span>
									</div>
								{/if}
							</div>

							{#if video.tags && video.tags.length > 0}
								<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:8px;">
									{#each video.tags as tag}
										<span
											style="background:#3a4018; color:#a0b040; font-size:10px; padding:2px 6px; border-radius:3px;"
											>{tag}</span
										>
									{/each}
								</div>
							{/if}

							<!-- Action buttons -->
							<div style="display:flex; gap:6px; margin-top:12px;">
								<button
									onclick={() => downloadVideo(video)}
									style="flex:1; padding:6px 0; font-size:11px; font-weight:500; border-radius:5px; border:0.5px solid #5a7a2e; background:#3a5520; color:#c8e870; cursor:pointer; transition:background 0.15s;"
									onmouseenter={(e) => (e.currentTarget.style.background = '#4a6828')}
									onmouseleave={(e) => (e.currentTarget.style.background = '#3a5520')}
								>
									Download
								</button>
								<button
									onclick={() => openEditModal(video)}
									style="flex:1; padding:6px 0; font-size:11px; font-weight:500; border-radius:5px; border:0.5px solid #4a5520; background:#1e2210; color:#a0b040; cursor:pointer; transition:background 0.15s;"
									onmouseenter={(e) => (e.currentTarget.style.background = '#2a3010')}
									onmouseleave={(e) => (e.currentTarget.style.background = '#1e2210')}
								>
									Edit
								</button>
								<button
									onclick={() => deleteVideo(video)}
									style="flex:1; padding:6px 0; font-size:11px; font-weight:500; border-radius:5px; border:0.5px solid #7a2020; background:#5a3030; color:#d0a0a0; cursor:pointer; transition:background 0.15s;"
									onmouseenter={(e) => (e.currentTarget.style.background = '#7a4040')}
									onmouseleave={(e) => (e.currentTarget.style.background = '#5a3030')}
								>
									Delete
								</button>
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
	<div
		style="position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.6);"
		onclick={closeEditModal}
	>
		<div
			style="width:380px; background:#2a2e1a; border:0.5px solid #4a5520; border-radius:10px; padding:24px;"
			onclick={(e) => e.stopPropagation()}
		>
			<h2 style="font-size:16px; font-weight:500; color:#c8d870; margin-bottom:20px;">
				Edit Video
			</h2>

			<div style="display:flex; flex-direction:column; gap:16px;">
				<div>
					<label
						for="video-name"
						style="display:block; font-size:12px; color:#7a8840; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.05em;"
						>Video Name</label
					>
					<input
						id="video-name"
						type="text"
						bind:value={editingVideo.name}
						style="width:100%; background:#1e2210; border:0.5px solid #4a5520; border-radius:6px; padding:8px 10px; font-size:13px; color:#c8d870; outline:none;"
					/>
				</div>

				<div>
					<label
						for="video-tags"
						style="display:block; font-size:12px; color:#7a8840; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.05em;"
						>Tags (comma separated)</label
					>
					<input
						id="video-tags"
						type="text"
						bind:value={editingVideo.tagsString}
						placeholder="tag1, tag2, tag3"
						style="width:100%; background:#1e2210; border:0.5px solid #4a5520; border-radius:6px; padding:8px 10px; font-size:13px; color:#c8d870; outline:none; placeholder:#5a6828;"
					/>
				</div>
			</div>

			<div style="display:flex; gap:8px; margin-top:20px;">
				<button
					onclick={closeEditModal}
					style="flex:1; padding:8px 16px; font-size:13px; border-radius:6px; border:0.5px solid #4a5520; background:#1e2210; color:#a0b040; cursor:pointer;"
				>
					Cancel
				</button>
				<button
					onclick={saveVideo}
					style="flex:1; padding:8px 16px; font-size:13px; font-weight:500; border-radius:6px; border:none; background:#6b7a2e; color:#fff; cursor:pointer;"
				>
					Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Notification Component -->
<Notification bind:notification bind:this={notificationRef} />
