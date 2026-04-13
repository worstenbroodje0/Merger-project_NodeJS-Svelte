<script>
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.js';
	import Notification from '$lib/components/Notification.svelte';
	import UploadTab from '$lib/components/UploadTab.svelte';
	import LibraryMergePanel from '$lib/components/LibraryMergePanel.svelte';
	import LibraryVideoGrid from '$lib/components/LibraryVideoGrid.svelte';

	const BASE = 'http://localhost:3000/api';

	let videos = $state([]);
	let loading = $state(true);
	let error = $state(null);
	let selectedIds = $state(/** @type {string[]} */ ([]));
	let mergeLoading = $state(false);
	let mergeError = $state('');
	let activeTab = $state('upload');
	let uploadedFiles = $state(/** @type {File[]} */ ([]));
	let uploadLoading = $state(false);
	let uploadError = $state('');

	let mergePanelRef;
	let showEditModal = $state(false);
	let editingVideo = $state(null);

	let notification = $state({ message: '', type: 'info', visible: false });
	let notificationRef;
	let showSuccess, showError;

	$effect(() => {
		if (notificationRef) {
			showSuccess = notificationRef.showSuccess;
			showError = notificationRef.showError;
		}
	});

	let _uidCounter = 0;

	function stamp(video) {
		if (!video._uid) video._uid = String(++_uidCounter);
		return video;
	}

	function getVideo(uid) {
		return videos.find((v) => v._uid === uid);
	}

	async function loadVideos() {
		try {
			loading = true;
			error = null;
			let remote = [];
			try {
				const res = await fetch(`${BASE}/media/regular`);
				if (res.ok) {
					const data = await res.json();
					remote = (data.data || [])
						.filter((v) => {
							if (!$auth.user?.id) return true;
							return v.user_id === $auth.user.id || v.user_id === null;
						})
						.map(stamp);
				}
			} catch {
				// API not available
			}
			videos = [...remote, ...[].map(stamp)];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			loading = false;
		}
	}

	async function mergeVideos() {
		if (selectedIds.length < 2) {
			mergeError = 'Please select at least 2 videos to merge';
			return;
		}
		mergeLoading = true;
		mergeError = '';
		const {
			showOverlayOptions,
			overlayType,
			introBackgroundColor,
			introImage,
			introDuration,
			outroBackgroundColor,
			outroImage,
			outroDuration
		} = mergePanelRef?.getOverlayConfig() ?? {};
		try {
			const allEmbedded = selectedIds.every((id) => getVideo(id)?.b64);
			let mergedUrl, mergedName;
			if (allEmbedded) {
				const response = await fetch(`${BASE}/media/merge-b64`, {
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
				const hasOverlayImages =
					(overlayType === 'intro' && introImage) ||
					(overlayType === 'outro' && outroImage) ||
					(overlayType === 'both' && (introImage || outroImage));
				let response;
				if (hasOverlayImages) {
					const formData = new FormData();
					formData.append(
						'videoIds',
						JSON.stringify(selectedIds.map((uid) => getVideo(uid)?._id ?? getVideo(uid)?.id))
					);
					formData.append('user_id', $auth.user?.id || null);
					if (overlayType === 'intro' || overlayType === 'both') {
						formData.append(
							'intro',
							JSON.stringify({ backgroundColor: introBackgroundColor, duration: introDuration })
						);
						if (introImage) formData.append('introImage', introImage);
					}
					if (overlayType === 'outro' || overlayType === 'both') {
						formData.append(
							'outro',
							JSON.stringify({ backgroundColor: outroBackgroundColor, duration: outroDuration })
						);
						if (outroImage) formData.append('outroImage', outroImage);
					}
					response = await fetch(`${BASE}/media/merge`, { method: 'POST', body: formData });
				} else {
					const requestBody = {
						videoIds: selectedIds.map((uid) => getVideo(uid)?._id ?? getVideo(uid)?.id),
						user_id: $auth.user?.id || null
					};
					if (showOverlayOptions) {
						if (overlayType === 'intro' || overlayType === 'both')
							requestBody.intro = {
								backgroundColor: introBackgroundColor,
								duration: introDuration
							};
						if (overlayType === 'outro' || overlayType === 'both')
							requestBody.outro = {
								backgroundColor: outroBackgroundColor,
								duration: outroDuration
							};
					}
					response = await fetch(`${BASE}/media/merge`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(requestBody)
					});
				}
				if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
				const data = await response.json();
				if (data.status !== 'success' && data.success !== true)
					throw new Error(data.message || data.error || 'Merge failed');
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

	async function uploadAndMerge() {
		if (uploadedFiles.length < 2) {
			uploadError = 'Please select at least 2 videos to merge';
			return;
		}
		try {
			uploadLoading = true;
			uploadError = '';
			const formData = new FormData();
			uploadedFiles.forEach((file) => formData.append('videos', file));
			formData.append('user_id', $auth.user?.id || null);
			const response = await fetch(`${BASE}/media/merge-upload`, {
				method: 'POST',
				body: formData
			});
			if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
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

	async function deleteVideo(videoId) {
		if (!confirm('Are you sure you want to delete this video?')) return;
		try {
			const res = await fetch(`${BASE}/media/${videoId}`, { method: 'DELETE' });
			if (res.ok) {
				showSuccess?.('Video deleted successfully');
				await loadVideos();
			} else {
				showError?.('Failed to delete video');
			}
		} catch {
			showError?.('Error deleting video');
		}
	}

	function editVideo(video) {
		editingVideo = { ...video };
		showEditModal = true;
	}

	async function saveVideoEdit(video) {
		try {
			const videoId = video._id || video.id;
			const tags =
				typeof video.tags === 'string'
					? video.tags
							.split(',')
							.map((tag) => tag.trim())
							.filter((tag) => tag)
					: video.tags;
			const res = await fetch(`${BASE}/media/${videoId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: video.name, tags, duration: parseInt(video.duration) })
			});
			if (res.ok) {
				showSuccess?.('Video updated successfully');
				await loadVideos();
				showEditModal = false;
				editingVideo = null;
			} else {
				showError?.('Failed to update video');
			}
		} catch {
			showError?.('Error updating video');
		}
	}

	loadVideos();
</script>

<main class="min-h-screen" style="background:#1e1e1e;">
	<!-- Search bar + tab switcher row -->
	<div
		class="flex items-center gap-3 px-5 py-3"
		style="position:sticky; top:0; z-index:30; border-bottom:0.5px solid #3a4018; background:#1e1e1e;"
	>
		<input
			type="text"
			placeholder="Search…"
			class="rounded-md px-3 py-1.5 text-sm outline-none"
			style="width:200px; background:#2a2e1a; border:0.5px solid #4a5520; color:#c8d870;"
		/>
		<div class="ml-auto flex gap-1">
			<button
				onclick={() => (activeTab = 'upload')}
				class="rounded-md px-5 py-1.5 text-sm font-medium transition-colors"
				style="background:{activeTab === 'upload'
					? '#4a5520'
					: 'transparent'}; border:0.5px solid #4a5520; color:{activeTab === 'upload'
					? '#d6e08a'
					: '#7a8840'}; cursor:pointer;"
			>
				Upload
			</button>
			{#if $auth.user?.role?.name === 'admin' || $auth.user?.role?.name === 'editor'}
				<button
					onclick={() => (activeTab = 'library')}
					class="rounded-md px-5 py-1.5 text-sm font-medium transition-colors"
					style="background:{activeTab === 'library'
						? '#4a5520'
						: 'transparent'}; border:0.5px solid #4a5520; color:{activeTab === 'library'
						? '#d6e08a'
						: '#7a8840'}; cursor:pointer;"
				>
					Library
				</button>
			{/if}
		</div>
	</div>

	<!-- Content area: two-column when library tab active -->
	<div class="flex" style="min-height:calc(100vh - 90px);">
		<!-- Left: main content -->
		<div class="min-w-0 flex-1 p-5">
			{#if activeTab === 'upload'}
				<UploadTab bind:uploadedFiles {uploadLoading} {uploadError} onMerge={uploadAndMerge} />
			{:else if activeTab === 'library'}
				{#if loading}
					<div class="py-16 text-center">
						<p class="text-sm" style="color:#7a8840;">Loading videos…</p>
					</div>
				{:else if error}
					<div class="py-16 text-center">
						<p class="mb-4 text-sm" style="color:#c85050;">Error: {error}</p>
						<button
							onclick={loadVideos}
							class="rounded-md px-4 py-2 text-sm"
							style="background:#6b7a2e; border:none; color:#fff; cursor:pointer;"
						>
							Retry
						</button>
					</div>
				{:else if videos.length === 0}
					<div class="py-16 text-center">
						<p class="text-sm" style="color:#5a6828;">No videos found</p>
					</div>
				{:else}
					<LibraryVideoGrid
						{videos}
						bind:selectedIds
						onDelete={deleteVideo}
						onEdit={editVideo}
						bind:showEditModal
						bind:editingVideo
						onSaveEdit={saveVideoEdit}
					/>
				{/if}
			{/if}
		</div>

		<!-- Right: persistent sidebar, always visible in library tab -->
		{#if activeTab === 'library'}
			<aside
				style="position:sticky; top:42px; width:300px; height:calc(100vh - 42px); flex-shrink:0; border-left:0.5px solid #3a4018; background:#222a10; border-radius:12px 0 0 12px; overflow-y:auto;"
			>
				<LibraryMergePanel
					bind:selectedIds
					{getVideo}
					{mergeLoading}
					{mergeError}
					onMerge={mergeVideos}
					bind:this={mergePanelRef}
				/>
			</aside>
		{/if}
	</div>
</main>

<Notification bind:notification bind:this={notificationRef} />
