<script>
	// @ts-nocheck
	import { goto } from '$app/navigation';
	import Notification from '$lib/components/Notification.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import LibraryMergePanel from '$lib/components/homepage/LibraryMergePanel.svelte';
	import LibraryVideoGrid from '$lib/components/homepage/LibraryVideoGrid.svelte';

	import { auth } from '$lib/stores/auth';
	import { get } from 'svelte/store';

	const BASE = 'http://localhost:3000/api';

	let videos = $state([]);
	let loading = $state(true);
	let error = $state(null);
	let selectedIds = $state(/** @type {string[]} */ ([]));
	let mergeLoading = $state(false);
	let mergeError = $state('');
	let mergeProgress = $state(0);
	let mergeStatus = $state('');
	let activeTab = $state('library');
	let uploadedFiles = $state(/** @type {File[]} */ ([]));
	let uploadLoading = $state(false);
	let uploadError = $state('');
	let searchQuery = $state('');

	let mergePanelRef = $state(null);
	let uploadTabRef = $state(null);
	let showEditModal = $state(false);
	let editingVideo = $state(null);

	// Confirm delete state
	let confirmState = $state({ open: false, videoId: null, videoLabel: '' });

	let notification = $state({ message: '', type: 'info', visible: false });
	let notificationRef = $state(null);
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
	function getAuthState() {
		return get(auth);
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
					remote = (data.data || []).map(stamp);
				} else {
					console.error('[loadVideos] API error:', res.status, res.statusText);
					error = `Failed to load videos: ${res.statusText}`;
				}
			} catch (err) {
				console.error('[loadVideos] Fetch error:', err);
				error = `Error loading videos: ${err.message}`;
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
		mergeProgress = 0;
		mergeStatus = 'Starting merge…';
		mergeLoading = true;
		mergeError = '';
		try {
			const overlayConfig = mergePanelRef?.getOverlayConfig() ?? {};
			const {
				showOverlayOptions,
				overlayType,
				introBackgroundColor,
				introImage,
				introDuration,
				outroBackgroundColor,
				outroImage,
				outroDuration
			} = overlayConfig;
			const allEmbedded = selectedIds.every((id) => getVideo(id)?.b64);
			let mergedUrl, mergedName;
			if (allEmbedded) {
				mergeStatus = 'Processing videos…';
				const iv = setInterval(() => {
					if (mergeProgress < 90) mergeProgress = Math.min(mergeProgress + Math.random() * 15, 90);
				}, 500);
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
				clearInterval(iv);
				mergeProgress = 95;
				mergeStatus = 'Finalizing…';
				if (response.ok) {
					const d = await response.json();
					mergedUrl = d.downloadUrl;
					mergedName = d.name;
				} else throw new Error('Server merge failed');
			} else {
				mergeStatus = 'Processing videos…';
				const iv = setInterval(() => {
					if (mergeProgress < 90) mergeProgress = Math.min(mergeProgress + Math.random() * 15, 90);
				}, 500);
				const hasOverlayImages =
					(overlayType === 'intro' && introImage) ||
					(overlayType === 'outro' && outroImage) ||
					(overlayType === 'both' && introImage && outroImage);
				let response;
				if (hasOverlayImages) {
					const fd = new FormData();
					fd.append(
						'videoIds',
						JSON.stringify(selectedIds.map((uid) => getVideo(uid)?._id ?? getVideo(uid)?.id))
					);
					fd.append('user_id', null);
					if (overlayType === 'intro' || overlayType === 'both') {
						fd.append(
							'intro',
							JSON.stringify({ backgroundColor: introBackgroundColor, duration: introDuration })
						);
						if (introImage) fd.append('introImage', introImage);
					}
					if (overlayType === 'outro' || overlayType === 'both') {
						fd.append(
							'outro',
							JSON.stringify({ backgroundColor: outroBackgroundColor, duration: outroDuration })
						);
						if (outroImage) fd.append('outroImage', outroImage);
					}
					const authState = getAuthState();
					const headers = {
						Authorization: `Bearer ${authState?.token}`
					};
					response = await fetch(`${BASE}/media/merge`, {
						method: 'POST',
						headers,
						body: fd
					});
				} else {
					const body = {
						videoIds: selectedIds.map((uid) => getVideo(uid)?._id ?? getVideo(uid)?.id),
						user_id: null
					};
					if (showOverlayOptions) {
						if (overlayType === 'intro' || overlayType === 'both')
							body.intro = { backgroundColor: introBackgroundColor, duration: introDuration };
						if (overlayType === 'outro' || overlayType === 'both')
							body.outro = { backgroundColor: outroBackgroundColor, duration: outroDuration };
					}
					const authState = getAuthState();
					response = await fetch(`${BASE}/media/merge`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${authState?.token}`
						},
						body: JSON.stringify(body)
					});
				}
				clearInterval(iv);
				mergeProgress = 95;
				mergeStatus = 'Finalizing…';
				if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
				const data = await response.json();
				if (data.status !== 'success' && data.success !== true)
					throw new Error(data.message || data.error || 'Merge failed');
				mergedUrl = data.downloadUrl || `http://localhost:3000/${data.data?.path}`;
				const customName = mergePanelRef?.getOverlayConfig()?.customName?.trim();
				mergedName = customName || data.data?.name || 'merged.mp4';
			}
			mergeProgress = 100;
			mergeStatus = 'Merge complete!';
			await new Promise((r) => setTimeout(r, 500));
			goto(
				`/completion?${new URLSearchParams({ url: mergedUrl ?? '', name: mergedName ?? 'merged.mp4', count: String(selectedIds.length), clips: selectedIds.map((id) => getVideo(id)?.name ?? id).join(',') })}`
			);
		} catch (err) {
			mergeError = err instanceof Error ? err.message : 'Failed to merge videos';
			showError?.(mergeError);
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
			const overlayConfig = uploadTabRef?.getOverlayConfig() ?? {};
			const fd = new FormData();
			uploadedFiles.forEach((f) => fd.append('videos', f));
			fd.append('user_id', null);

			// Add intro/outro co
			if (overlayConfig.showOverlayOptions) {
				const {
					showOverlayOptions,
					overlayType,
					introBackgroundColor,
					introImage,
					introDuration,
					outroBackgroundColor,
					outroImage,
					outroDuration
				} = overlayConfig;

				if (showOverlayOptions) {
					fd.append('showOverlayOptions', 'true');
					fd.append('overlayType', overlayType);

					if (overlayType === 'intro' || overlayType === 'both') {
						fd.append(
							'intro',
							JSON.stringify({
								backgroundColor: introBackgroundColor,
								duration: introDuration
							})
						);
						if (introImage) fd.append('introImage', introImage);
					}

					if (overlayType === 'outro' || overlayType === 'both') {
						fd.append(
							'outro',
							JSON.stringify({
								backgroundColor: outroBackgroundColor,
								duration: outroDuration
							})
						);
						if (outroImage) fd.append('outroImage', outroImage);
					}
				}
			}

			const authState = getAuthState();
			const response = await fetch(`${BASE}/media/merge-upload`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${authState?.token}` },
				body: fd
			});
			if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
			const data = await response.json();
			goto(
				`/completion?${new URLSearchParams({ url: data.downloadUrl || `http://localhost:3000/${data.data?.path}`, name: data.data?.name || 'merged.mp4', count: String(uploadedFiles.length), clips: uploadedFiles.map((f) => f.name).join(',') })}`
			);
		} catch (err) {
			uploadError = err instanceof Error ? err.message : 'Upload failed';
			showError?.(uploadError);
		} finally {
			uploadLoading = false;
		}
	}

	function askDeleteVideo(videoId) {
		const v = videos.find((v) => (v._id || v.id) === videoId || v._uid === videoId);
		confirmState = { open: true, videoId, videoLabel: v?.name ?? videoId };
	}

	async function doDeleteVideo() {
		const videoId = confirmState.videoId;
		confirmState = { open: false, videoId: null, videoLabel: '' };
		try {
			const authState = getAuthState();
			const res = await fetch(`${BASE}/media/${videoId}`, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${authState?.token}` }
			});
			if (res.ok) {
				showSuccess?.('Video deleted successfully');
				await loadVideos();
			} else showError?.('Failed to delete video');
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
							.map((t) => t.trim())
							.filter(Boolean)
					: video.tags;
			const authState = getAuthState();
			const res = await fetch(`${BASE}/media/${videoId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${authState?.token}`
				},
				body: JSON.stringify({ name: video.name, tags })
			});
			if (res.ok) {
				showSuccess?.('Video updated successfully');
				await loadVideos();
				showEditModal = false;
				editingVideo = null;
			} else showError?.('Failed to update video');
		} catch {
			showError?.('Error updating video');
		}
	}
	loadVideos();
</script>

<main class="min-h-screen" style="background:#1e1e1e;">
	<div
		class="flex items-center gap-3 px-5 py-3"
		style="position:sticky; top:0; z-index:30; border-bottom:0.5px solid #3a4018; background:#1e1e1e;"
	>
		<h1 class="text-2xl font-bold" style="color:#7a8840;">Video Merger</h1>
	</div>

	<div class="flex" style="min-height:calc(100vh - 90px);">
		<div class="min-w-0 flex-1 p-5">
			{#if loading}
				<div class="py-16 text-center"><p style="color:#7a8840;">Loading videos…</p></div>
			{:else if error}
				<div class="py-16 text-center">
					<div
						class="mb-4 inline-block rounded-lg px-4 py-3 text-sm"
						style="background:#3a1a1a; border:0.5px solid #7a3020; color:#e8a0a0;"
					>
						{error}
					</div>
					<div>
						<button
							onclick={loadVideos}
							class="rounded-md px-4 py-2 text-sm"
							style="background:#6b7a2e; border:none; color:#fff; cursor:pointer;">Retry</button
						>
					</div>
				</div>
			{:else if videos.length === 0}
				<div class="py-16 text-center"><p style="color:#5a6828;">No videos found</p></div>
			{:else}
				<LibraryVideoGrid
					{videos}
					user={null}
					bind:selectedIds
					onDelete={askDeleteVideo}
					onEdit={editVideo}
					bind:showEditModal
					bind:editingVideo
					onSaveEdit={saveVideoEdit}
				/>
			{/if}
		</div>

		{#if activeTab === 'library'}
			<aside
				style="position:sticky; top:42px; width:300px; min-height:600px; height:650px; flex-shrink:0; border-left:0.5px solid #3a4018; background:#222a10; border-radius:12px 0 0 12px; overflow-y:auto;"
			>
				<LibraryMergePanel
					bind:selectedIds
					{getVideo}
					{mergeLoading}
					{mergeError}
					{mergeProgress}
					{mergeStatus}
					onMerge={mergeVideos}
					bind:this={mergePanelRef}
				/>
			</aside>
		{/if}
	</div>
</main>

<!-- Confirm Delete -->
<ConfirmModal
	open={confirmState.open}
	title="Delete video?"
	message={confirmState.videoLabel}
	confirmLabel="Delete"
	onConfirm={doDeleteVideo}
	onCancel={() => (confirmState = { open: false, videoId: null, videoLabel: '' })}
/>

<Notification bind:notification bind:this={notificationRef} />
