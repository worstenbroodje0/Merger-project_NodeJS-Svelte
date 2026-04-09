<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { auth } from '../../stores/auth.js';

	let videos = $state([]);
	let loading = $state(true);
	let error = $state(null);
	let editingVideo = $state(null);
	let showEditModal = $state(false);

	onMount(() => {
		// Wait for auth to be ready, then load videos
		const unsubscribe = auth.subscribe((authState) => {
			if (authState) {
				console.log('Auth updated in video page:', authState);
				loadVideos();
			}
		});

		return unsubscribe;
	});

	async function loadVideos() {
		try {
			loading = true;
			error = null;

			// Debug: Check auth state
			console.log('Auth state:', JSON.stringify($auth, null, 2));
			console.log('Current user:', JSON.stringify($auth.user, null, 2));
			console.log('User ID:', $auth.user?.id);
			console.log('Is authenticated:', $auth.isAuthenticated);

			// Get all media (both regular and merged) from main endpoint
			const response = await fetch('http://localhost:3000/api/media');

			if (response.ok) {
				const data = await response.json();
				const allVideos = data.data || [];

				console.log('All videos from API:', allVideos);
				console.log('Total videos count:', allVideos.length);

				// Filter videos for current user
				const currentUserId = $auth.user?.id || 8; // Temporarily hardcoded to 8 for testing
				videos = allVideos.filter((video) => {
					console.log(
						`Video: ${video.name}, user_id: ${video.user_id}, current user: ${currentUserId}`
					);
					return video.user_id === currentUserId;
				});

				console.log('Filtered videos for user:', videos);
				console.log('Filtered videos count:', videos.length);
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
</script>

<main class="container mx-auto px-4 py-8">
	<div class="mx-auto max-w-6xl">
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold">My Videos</h1>
				<p class="text-gray-600">All your uploaded and merged videos in one place</p>
			</div>
			<button
				onclick={goToLibrary}
				class="rounded border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
			>
				Back to Editor
			</button>
		</div>

		{#if loading}
			<div class="py-8 text-center">
				<p class="text-lg">Loading your videos...</p>
			</div>
		{:else if error}
			<div class="py-8 text-center">
				<p class="mb-4 text-lg text-red-600">Error: {error}</p>
				<button
					onclick={loadVideos}
					class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
				>
					Retry
				</button>
			</div>
		{:else if videos.length === 0}
			<div class="py-8 text-center">
				<p class="text-lg text-gray-600">No videos found</p>
				<p class="text-gray-500">Upload some videos to get started!</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each videos as video, index (`${video._id || video.id || 'video'}-${index}`)}
					<div class="overflow-hidden rounded-lg bg-white shadow-md transition-all hover:shadow-lg">
						<div class="relative">
							<!-- Video thumbnail/player -->
							<div class="relative h-40 bg-gray-900">
								{#if video.path}
									{@const src = video.b64
										? `data:video/mp4;base64,${video.b64}`
										: `http://localhost:3000/${video.path.replace(/\\/g, '/')}`}

									<!-- svelte-ignore a11y_media_has_caption -->
									<video class="h-full w-full object-cover" {src} controls preload="metadata" />
								{:else}
									<div class="flex h-40 items-center justify-center bg-gray-100">
										<svg
											class="h-12 w-12 text-gray-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
											></path>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
											></path>
										</svg>
									</div>
								{/if}

								{#if isMergedVideo(video)}
									<div
										class="absolute top-2 right-2 rounded bg-purple-500 px-2 py-1 text-xs text-white"
									>
										Merged
									</div>
								{/if}
							</div>
						</div>

						<div class="p-4">
							<h3 class="mb-2 truncate font-semibold">{video.name}</h3>

							<div class="space-y-1 text-sm text-gray-600">
								{#if video.duration}
									<div>Duration: {formatDuration(video.duration)}</div>
								{/if}
								{#if video.size}
									<div>Size: {formatFileSize(video.size)}</div>
								{/if}
								{#if video.uploadedAt}
									<div>Created: {formatDate(video.uploadedAt)}</div>
								{/if}
							</div>

							{#if video.tags && video.tags.length > 0}
								<div class="mt-3 flex flex-wrap gap-1">
									{#each video.tags as tag}
										<span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">{tag}</span>
									{/each}
								</div>
							{/if}

							<!-- Action buttons -->
							<div class="mt-4 flex gap-2">
								<button
									onclick={() => openEditModal(video)}
									class="flex-1 rounded border border-blue-500 bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
								>
									Edit
								</button>
								<button
									onclick={() => deleteVideo(video)}
									class="flex-1 rounded border border-red-500 bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
								>
									Delete
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</main>

<!-- Edit Modal -->
{#if showEditModal && editingVideo}
	<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
		<div class="w-full max-w-md rounded-lg bg-white p-6">
			<h2 class="mb-4 text-xl font-bold">Edit Video</h2>

			<div class="space-y-4">
				<div>
					<label for="video-name" class="mb-1 block text-sm font-medium text-gray-700">
						Video Name
					</label>
					<input
						id="video-name"
						type="text"
						bind:value={editingVideo.name}
						class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					/>
				</div>

				<div>
					<label for="video-tags" class="mb-1 block text-sm font-medium text-gray-700">
						Tags (comma separated)
					</label>
					<input
						id="video-tags"
						type="text"
						bind:value={editingVideo.tagsString}
						placeholder="tag1, tag2, tag3"
						class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					/>
				</div>
			</div>

			<div class="mt-6 flex gap-3">
				<button
					onclick={closeEditModal}
					class="flex-1 rounded border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
				>
					Cancel
				</button>
				<button
					onclick={saveVideo}
					class="flex-1 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
				>
					Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}
