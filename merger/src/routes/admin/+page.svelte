<script>
	// @ts-nocheck
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth.js';
	import Notification from '$lib/components/Notification.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import UsersPanel from '$lib/components/adminpage/UsersPanel.svelte';
	import VideosPanel from '$lib/components/adminpage/VideosPanel.svelte';
	import UploadPanel from '$lib/components/adminpage/UploadPanel.svelte';

	const BASE = 'http://localhost:3000/api';

	let activeTab = $state('users');
	let users = $state([]);
	let videos = $state([]);
	let loading = $state(true);
	let userSearch = $state('');
	let videoSearch = $state('');
	let videoTagFilter = $state('');
	let videoMergeFilter = $state('');
	let selectedRoleFilter = $state('');
	let notification = $state({ message: '', type: 'info', visible: false });
	let notificationRef;

	let modal = $state({ open: false, type: '', target: null });
	let editName = $state('');
	let editEmail = $state('');
	let editRoleId = $state(null);
	let editTags = $state('');

	let roles = $state([]);

	// Unified confirm state
	let confirmState = $state({ open: false, type: '', id: null, label: '', merged: false });

	let videoPlayer = $state({ open: false, video: null });
	let pendingFiles = $state([]);
	let uploading = $state(false);
	let uploadProgress = $state(0);
	let isDragging = $state(false);
	let uploadKey = $state(0);

	let filteredUsers = $derived(
		users.filter((u) => {
			const searchMatch =
				!userSearch ||
				u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
				u.email?.toLowerCase().includes(userSearch.toLowerCase());
			const roleMatch =
				!selectedRoleFilter || u.role?.name?.toLowerCase() === selectedRoleFilter.toLowerCase();
			return searchMatch && roleMatch;
		})
	);

	let filteredVideos = $derived(
		videos.filter((v) => {
			const nameMatch = !videoSearch || v.name?.toLowerCase().includes(videoSearch.toLowerCase());
			let tagMatch = true;
			if (videoTagFilter) {
				tagMatch = Array.isArray(v.tags) && v.tags.length ? v.tags.includes(videoTagFilter) : false;
			}
			let mergeMatch = true;
			if (videoMergeFilter) {
				mergeMatch = videoMergeFilter === 'merged' ? v.merged : !v.merged;
			}
			return nameMatch && tagMatch && mergeMatch;
		})
	);

	let regularVideos = $derived(videos.filter((v) => !v.merged));
	let mergedVideos = $derived(videos.filter((v) => v.merged));
	let availableTags = $state([]);

	$effect(() => {
		const tagSet = new Set();
		videos.forEach((v) => {
			if (Array.isArray(v.tags)) v.tags.forEach((t) => tagSet.add(t));
		});
		availableTags = Array.from(tagSet).sort();
	});

	function getAuthState() {
		let state;
		auth.subscribe((s) => (state = s))();
		return state;
	}

	async function load() {
		const authState = getAuthState();

		if (!authState?.isAuthenticated) {
			goto('/');
			return;
		}
		loading = true;
		try {
			const headers = {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${authState?.token}`
			};

			const [uRes, vRes, rRes] = await Promise.all([
				fetch(`${BASE}/admin/users`, { headers }),
				fetch(`${BASE}/media`, { headers }),
				fetch(`${BASE}/roles`, { headers }).catch(() => ({ ok: false }))
			]);
			users = uRes.ok ? (await uRes.json()).data || [] : [];
			const rawVideos = vRes.ok ? (await vRes.json()).data || [] : [];
			try {
				const regRes = await fetch(`${BASE}/media/regular`, { headers });
				const regIds = regRes.ok
					? new Set(((await regRes.json()).data || []).map((v) => v.id))
					: new Set();
				videos = rawVideos.map((v) => ({ ...v, merged: !regIds.has(v.id) }));
			} catch {
				videos = rawVideos.map((v) => ({ ...v, merged: false }));
			}
			roles = rRes.ok
				? (await rRes.json()).data || []
				: [
						{ id: 1, name: 'admin' },
						{ id: 2, name: 'editor' },
						{ id: 3, name: 'user' }
					];
		} catch {
			showError?.('Failed to load data');
		} finally {
			loading = false;
		}
	}

	onMount(async () => {
		auth.initialize();
		await load();
	});

	function openEditUser(u) {
		modal = { open: true, type: 'user', target: u };
		editName = u.name || '';
		editEmail = u.email || '';
		editRoleId = u.role?.id ?? u.role_id ?? null;
	}
	function openEditVideo(v) {
		editName = v.name;
		editTags = Array.isArray(v.tags) ? v.tags.join(', ') : '';
		modal = { open: true, type: 'video', target: v };
	}
	function playVideo(v) {
		videoPlayer = { open: true, video: v };
	}
	function closeVideoPlayer() {
		videoPlayer = { open: false, video: null };
	}
	function closeModal() {
		modal = { open: false, type: '', target: null };
	}

	async function downloadVideo(video) {
		try {
			const url = video.b64
				? `data:video/mp4;base64,${video.b64}`
				: `http://localhost:3000/${video.path.replace(/\\/g, '/')}`;
			const blob = await (await fetch(url)).blob();
			const blobUrl = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = blobUrl;
			link.download = video.name || 'video.mp4';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(blobUrl);
		} catch {
			window.open(`http://localhost:3000/${video.path?.replace(/\\/g, '/')}`, '_blank');
		}
	}

	async function saveEdit() {
		const { type, target } = modal;
		if (!target) return;
		if (type === 'user') {
			try {
				const isEdit = target.id !== undefined;
				const response = await fetch(
					isEdit ? `${BASE}/admin/users/${target.id}` : `${BASE}/admin/users`,
					{
						method: isEdit ? 'PUT' : 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${getAuthState()?.token}`
						},
						body: JSON.stringify({ name: editName, email: editEmail, role_id: editRoleId })
					}
				);
				if (response.status === 401) {
					auth.logout();
					showError?.('Your session has expired. Please log in again.');
					return;
				}
				if (!response.ok) throw new Error('Failed to save user');
			} catch (_) {}
			const matchedRole = roles.find((r) => r.id === Number(editRoleId)) ?? null;
			users = users.map((u) =>
				u.id === target.id
					? { ...u, name: editName, email: editEmail, role_id: editRoleId, role: matchedRole }
					: u
			);
			showSuccess?.('User updated successfully');
		} else {
			const tags = editTags
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean);
			try {
				const response = await fetch(`${BASE}/media/${target.id}`, {
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${getAuthState()?.token}`
					},
					body: JSON.stringify({ name: editName, tags })
				});
				if (response.status === 401) {
					auth.logout();
					showError?.('Your session has expired. Please log in again.');
					return;
				}
				if (!response.ok) throw new Error('Failed to update video');
			} catch {
				showError?.('Failed to update video');
				return;
			}
			videos = videos.map((v) => (v.id === target.id ? { ...v, name: editName, tags } : v));
			showSuccess?.('Video updated successfully');
		}
		closeModal();
	}

	function askDelete(type, id, label, merged = false) {
		// Only allow admins to delete users
		if (type === 'user' && !auth.isAdmin()) {
			showError?.('Only administrators can delete users');
			return;
		}
		confirmState = { open: true, type, id, label, merged };
	}
	function getUserName(userId) {
		if (!userId) return 'Unknown';
		return users.find((u) => u.id === userId)?.name ?? 'Unknown';
	}

	async function doDelete() {
		const { type, id } = confirmState;
		confirmState = { open: false, type: '', id: null, label: '', merged: false };
		if (type === 'user') {
			// Double-check: only admins can delete users
			if (!auth.isAdmin()) {
				showError?.('Only administrators can delete users');
				return;
			}
			try {
				await fetch(`${BASE}/admin/users/${id}`, {
					method: 'DELETE',
					headers: { Authorization: `Bearer ${getAuthState()?.token}` }
				});
			} catch (_) {}
			users = users.filter((u) => u.id !== id);
			showSuccess?.('User deleted successfully');
		} else {
			try {
				const response = await fetch(`${BASE}/media/${id}`, {
					method: 'DELETE',
					headers: { Authorization: `Bearer ${getAuthState()?.token}` }
				});
				if (!response.ok) throw new Error('Failed to delete video');
			} catch {
				showError?.('Failed to delete video');
				return;
			}
			videos = videos.filter((v) => v.id !== id);
			showSuccess?.('Video deleted successfully');
		}
	}

	function handleFiles(e) {
		const files = Array.from(e.target?.files || e.dataTransfer?.files || []);
		pendingFiles = files.length > 0 ? files : [];
		if (e.target) e.target.value = '';
	}
	function removeFile(i) {
		pendingFiles = pendingFiles.filter((_, idx) => idx !== i);
	}

	async function uploadFiles() {
		if (!pendingFiles.length) return;
		uploading = true;
		uploadProgress = 0;

		const totalFiles = pendingFiles.length;
		let uploadedCount = 0;
		let failedFiles = [];
		const authState = getAuthState();

		console.log('[DEBUG] Upload starting:', {
			totalFiles,
			pendingFiles: pendingFiles.map((f) => f.name),
			authState: authState
				? { isAuthenticated: authState.isAuthenticated, hasToken: !!authState.token }
				: null
		});

		const iv = setInterval(() => {
			const progress = (uploadedCount / totalFiles) * 85;
			if (uploadProgress < progress)
				uploadProgress = Math.min(uploadProgress + Math.random() * 5, progress);
		}, 200);

		try {
			for (const file of pendingFiles) {
				console.log(`[DEBUG] Uploading file: ${file.name}, size: ${file.size}`);

				const fd = new FormData();
				fd.append('video', file);

				const res = await fetch(`${BASE}/media/upload`, {
					method: 'POST',
					headers: { Authorization: `Bearer ${authState?.token}` },
					body: fd
				});

				console.log(`[DEBUG] Upload response for ${file.name}:`, {
					status: res.status,
					ok: res.ok,
					statusText: res.statusText
				});

				if (res.ok) {
					uploadedCount++;
					console.log(`[DEBUG] Successfully uploaded: ${file.name}`);
				} else if (res.status === 401) {
					// Token expired - logout and show login popup
					console.log('[DEBUG] Token expired, logging out...');
					auth.logout();
					showError?.('Your session has expired. Please log in again.');
					// Stop uploading and break out of the loop
					throw new Error('Token expired');
				} else {
					const errorText = await res.text();
					console.error(`[DEBUG] Upload failed for ${file.name}:`, errorText);
					failedFiles.push(file.name);
				}
			}

			clearInterval(iv);
			uploadProgress = 100;

			if (uploadedCount === totalFiles) {
				showSuccess?.(
					`Successfully uploaded ${uploadedCount} video${uploadedCount !== 1 ? 's' : ''}!`
				);
			} else if (uploadedCount > 0) {
				showSuccess?.(
					`Uploaded ${uploadedCount} of ${totalFiles} videos. Failed: ${failedFiles.join(', ')}`
				);
			} else {
				showError?.(`Failed to upload any videos. Failed: ${failedFiles.join(', ')}`);
			}

			pendingFiles = [];
			uploadKey++;
			await load();
		} catch (error) {
			clearInterval(iv);
			console.error('[DEBUG] Upload error:', error);

			if (error.message === 'Token expired') {
				// Don't show additional error - the auth.logout and showError already handled it
				// Just clean up the upload state
				pendingFiles = [];
				uploadKey++;
			} else {
				showError?.(`Upload failed: ${error.message}`);
			}
		} finally {
			setTimeout(() => {
				uploading = false;
				uploadProgress = 0;
			}, 600);
		}
	}

	let showSuccess, showError, showWarning, showInfo, showToast, showNotification;
	$effect(() => {
		if (notificationRef) {
			showSuccess = notificationRef.showSuccess;
			showError = notificationRef.showError;
			showWarning = notificationRef.showWarning;
			showInfo = notificationRef.showInfo;
			showToast = notificationRef.showToast;
			showNotification = notificationRef.showNotification;
		}
	});

	function fmtDuration(s) {
		const t = Math.round(s || 0);
		return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
	}
	function fmtSize(b) {
		if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
		if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
		return Math.round(b / 1024) + ' KB';
	}
</script>

<div class="flex min-h-screen" style="background:#1e1e1e; font-family:var(--font-sans);">
	<!-- Sidebar -->
	<aside style="width:200px; flex-shrink:0; background:#222a10; border-right:0.5px solid #3a4018;">
		<div style="padding:16px; border-bottom:0.5px solid #3a4018;">
			<span style="font-size:14px; font-weight:500; color:#c8d870;">VideoAdmin</span>
		</div>
		<nav style="padding:12px 8px;">
			{#each [{ key: 'users', label: 'Users' }, { key: 'videos', label: 'Videos' }, { key: 'upload', label: 'Upload' }] as tab}
				<button
					onclick={() => (activeTab = tab.key)}
					style="display:flex; align-items:center; width:100%; padding:8px 12px; border-radius:6px; border:none; cursor:pointer; font-size:13px; font-weight:500; margin-bottom:2px; text-align:left; background:{activeTab ===
					tab.key
						? '#4a5520'
						: 'transparent'}; color:{activeTab === tab.key ? '#d6e08a' : '#7a8840'};"
					onmouseenter={(e) => {
						if (activeTab !== tab.key) e.currentTarget.style.background = '#2a3010';
					}}
					onmouseleave={(e) => {
						if (activeTab !== tab.key) e.currentTarget.style.background = 'transparent';
					}}>{tab.label}</button
				>
			{/each}
		</nav>
		<div style="padding:12px 8px; margin-top:8px; border-top:0.5px solid #3a4018;">
			<div
				style="background:#1e2210; border:0.5px solid #3a4018; border-radius:6px; padding:10px 12px; margin-bottom:8px;"
			>
				<p style="font-size:10px; color:#5a6828; margin-bottom:2px;">Normal videos</p>
				<p style="font-size:20px; font-weight:500; color:#a0b840;">
					{loading ? '—' : regularVideos.length}
				</p>
			</div>
			<div
				style="background:#1e2210; border:0.5px solid #3a4018; border-radius:6px; padding:10px 12px; margin-bottom:8px;"
			>
				<p style="font-size:10px; color:#5a6828; margin-bottom:2px;">Merged videos</p>
				<p style="font-size:20px; font-weight:500; color:#a0b840;">
					{loading ? '—' : mergedVideos.length}
				</p>
			</div>

			<div
				style="background:#1e2210; border:0.5px solid #3a4018; border-radius:6px; padding:10px 12px;"
			>
				<p style="font-size:10px; color:#5a6828; margin-bottom:2px;">Total users</p>
				<p style="font-size:20px; font-weight:500; color:#a0b840;">
					{loading ? '—' : users.length}
				</p>
			</div>
		</div>
	</aside>

	<main style="flex:1; min-width:0; padding:20px;">
		<!-- Search row -->
		<div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
			{#if activeTab === 'users'}
				<input
					type="text"
					placeholder="Search users…"
					bind:value={userSearch}
					style="flex:1; max-width:320px; height:32px; border-radius:6px; padding:0 12px; font-size:13px; outline:none; background:#2a2e1a; border:0.5px solid #4a5520; color:#c8d870;"
					onfocus={(e) => (e.target.style.borderColor = '#6b7a2e')}
					onblur={(e) => (e.target.style.borderColor = '#4a5520')}
				/>
				<select
					bind:value={selectedRoleFilter}
					style="height:32px; border-radius:6px; padding:0 12px; font-size:13px; outline:none; background:#2a2e1a; border:0.5px solid #4a5520; color:#c8d870; cursor:pointer;"
				>
					<option value="">All Roles</option>
					{#each roles as role}<option value={role.name}>{role.name}</option>{/each}
				</select>
				{#if selectedRoleFilter}<button
						onclick={() => (selectedRoleFilter = '')}
						style="padding:4px 12px; font-size:12px; border-radius:5px; border:0.5px solid #4a5520; background:#1e2210; color:#a0b040; cursor:pointer;"
						>Clear</button
					>{/if}
			{:else if activeTab === 'videos'}
				<input
					type="text"
					placeholder="Search videos…"
					bind:value={videoSearch}
					style="flex:1; max-width:320px; height:32px; border-radius:6px; padding:0 12px; font-size:13px; outline:none; background:#2a2e1a; border:0.5px solid #4a5520; color:#c8d870;"
					onfocus={(e) => (e.target.style.borderColor = '#6b7a2e')}
					onblur={(e) => (e.target.style.borderColor = '#4a5520')}
				/>
				<select
					bind:value={videoTagFilter}
					style="width:180px; height:32px; border-radius:6px; padding:0 8px; font-size:13px; outline:none; background:#2a2e1a; border:0.5px solid #4a5520; color:#c8d870; cursor:pointer;"
				>
					<option value="">All tags</option>
					{#each availableTags as tag}<option value={tag}>{tag}</option>{/each}
				</select>
				<select
					bind:value={videoMergeFilter}
					style="width:140px; height:32px; border-radius:6px; padding:0 8px; font-size:13px; outline:none; background:#2a2e1a; border:0.5px solid #4a5520; color:#c8d870; cursor:pointer;"
				>
					<option value="">All videos</option>
					<option value="merged">Merged</option>
					<option value="unmerged">Not merged</option>
				</select>
				{#if videoTagFilter}<button
						onclick={() => (videoTagFilter = '')}
						style="padding:4px 12px; font-size:12px; border-radius:5px; border:0.5px solid #4a5520; background:#1e2210; color:#a0b040; cursor:pointer;"
						>Clear</button
					>{/if}
			{/if}
		</div>

		{#if activeTab === 'users'}
			<UsersPanel
				{users}
				{filteredUsers}
				{userSearch}
				{selectedRoleFilter}
				{roles}
				{loading}
				{openEditUser}
				{askDelete}
			/>
		{/if}
		{#if activeTab === 'videos'}
			<VideosPanel
				{filteredVideos}
				{loading}
				{playVideo}
				{openEditVideo}
				{askDelete}
				{getUserName}
			/>
		{/if}
		{#if activeTab === 'upload'}
			<UploadPanel
				key={uploadKey}
				{pendingFiles}
				{uploading}
				{uploadProgress}
				{isDragging}
				{handleFiles}
				{removeFile}
				{uploadFiles}
				{fmtSize}
			/>
		{/if}
	</main>
</div>

<!-- Edit Modal -->
{#if modal.open}
	<div
		style="position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.6);"
		onclick={closeModal}
		onkeydown={(e) => e.key === 'Escape' && closeModal()}
		tabindex="-1"
		role="dialog"
		aria-modal="true"
	>
		<div
			style="width:380px; background:#2a2e1a; border:0.5px solid #4a5520; border-radius:10px; padding:24px;"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<h3 style="font-size:14px; font-weight:500; color:#c8d870; margin-bottom:20px;">
				{modal.type === 'user' ? 'Edit user' : 'Edit video'}
			</h3>
			<div style="display:flex; flex-direction:column; gap:14px;">
				<div>
					<label
						style="display:block; font-size:11px; color:#7a8840; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.05em;"
						>Name</label
					>
					<input
						bind:value={editName}
						style="width:100%; background:#1e2210; border:0.5px solid #4a5520; border-radius:6px; padding:8px 10px; font-size:13px; color:#c8d870; outline:none;"
						onfocus={(e) => (e.target.style.borderColor = '#6b7a2e')}
						onblur={(e) => (e.target.style.borderColor = '#4a5520')}
					/>
				</div>
				{#if modal.type === 'user'}
					<div>
						<label
							style="display:block; font-size:11px; color:#7a8840; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.05em;"
							>Email</label
						>
						<input
							bind:value={editEmail}
							style="width:100%; background:#1e2210; border:0.5px solid #4a5520; border-radius:6px; padding:8px 10px; font-size:13px; color:#c8d870; outline:none;"
							onfocus={(e) => (e.target.style.borderColor = '#6b7a2e')}
							onblur={(e) => (e.target.style.borderColor = '#4a5520')}
						/>
					</div>
					{#if auth.isAdmin()}
						<div>
							<label
								style="display:block; font-size:11px; color:#7a8840; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.05em;"
								>Role</label
							>
							<select
								bind:value={editRoleId}
								style="width:100%; background:#1e2210; border:0.5px solid #4a5520; border-radius:6px; padding:8px 10px; font-size:13px; color:#c8d870; outline:none; cursor:pointer;"
								onfocus={(e) => (e.target.style.borderColor = '#6b7a2e')}
								onblur={(e) => (e.target.style.borderColor = '#4a5520')}
							>
								{#each roles as role}
									<option value={role.id}>{role.name}</option>
								{/each}
							</select>
						</div>
					{/if}
				{:else}
					<div>
						<label
							style="display:block; font-size:11px; color:#7a8840; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.05em;"
							>Tags (comma separated)</label
						>
						<input
							bind:value={editTags}
							placeholder="tag1, tag2, tag3"
							style="width:100%; background:#1e2210; border:0.5px solid #4a5520; border-radius:6px; padding:8px 10px; font-size:13px; color:#c8d870; outline:none;"
							onfocus={(e) => (e.target.style.borderColor = '#6b7a2e')}
							onblur={(e) => (e.target.style.borderColor = '#4a5520')}
						/>
					</div>
				{/if}
			</div>
			<div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px;">
				<button
					onclick={closeModal}
					style="padding:7px 16px; font-size:13px; border-radius:6px; border:0.5px solid #4a5520; background:#1e2210; color:#a0b040; cursor:pointer;"
					>Cancel</button
				>
				<button
					onclick={saveEdit}
					style="padding:7px 16px; font-size:13px; font-weight:500; border-radius:6px; border:none; background:#6b7a2e; color:#fff; cursor:pointer;"
					>Save changes</button
				>
			</div>
		</div>
	</div>
{/if}

<!-- Confirm Delete -->
<ConfirmModal
	open={confirmState.open}
	title="Delete {confirmState.type}?"
	message={confirmState.label}
	confirmLabel="Delete"
	onConfirm={doDelete}
	onCancel={() => (confirmState = { open: false, type: '', id: null, label: '', merged: false })}
/>

<!-- Video Player -->
{#if videoPlayer.open && videoPlayer.video}
	<div
		style="position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.85);"
		onclick={closeVideoPlayer}
		onkeydown={(e) => e.key === 'Escape' && closeVideoPlayer()}
		tabindex="0"
		role="dialog"
		aria-modal="true"
	>
		<div
			style="width:100%; max-width:900px; margin:0 16px; background:#111; border-radius:10px; overflow:hidden; border:0.5px solid #3a4018;"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<div
				style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:0.5px solid #2a3010;"
			>
				<h3 style="font-size:14px; font-weight:500; color:#c8d870;">{videoPlayer.video.name}</h3>
				<div style="display:flex; gap:8px; align-items:center;">
					<button
						onclick={() => downloadVideo(videoPlayer.video)}
						style="background:#3a5520; border:0.5px solid #5a7a2e; color:#c8d870; cursor:pointer; font-size:12px; padding:4px 10px; border-radius:4px; font-weight:500;"
						>Download</button
					>
					<button
						onclick={closeVideoPlayer}
						style="background:none; border:none; color:#5a6828; cursor:pointer; font-size:20px; line-height:1;"
						onmouseenter={(e) => (e.target.style.color = '#c8d870')}
						onmouseleave={(e) => (e.target.style.color = '#5a6828')}>×</button
					>
				</div>
			</div>
			<div style="aspect-ratio:16/9;">
				<!-- svelte-ignore a11y_media_has_caption -->
				<video
					controls
					autoplay
					style="width:100%; height:100%;"
					src={videoPlayer.video.b64
						? `data:video/mp4;base64,${videoPlayer.video.b64}`
						: `http://localhost:3000/${videoPlayer.video.path?.replace(/\\/g, '/')}`}
				></video>
			</div>
			<div
				style="padding:12px 16px; border-top:0.5px solid #2a3010; display:flex; gap:20px; flex-wrap:wrap;"
			>
				{#if videoPlayer.video.duration}<span style="font-size:12px; color:#7a8840;"
						>Duration: <span style="color:#a0b040;">{fmtDuration(videoPlayer.video.duration)}</span
						></span
					>{/if}
				{#if videoPlayer.video.size}<span style="font-size:12px; color:#7a8840;"
						>Size: <span style="color:#a0b040;">{fmtSize(videoPlayer.video.size)}</span></span
					>{/if}
				{#if Array.isArray(videoPlayer.video.tags) && videoPlayer.video.tags.length}
					<div style="display:flex; gap:4px; flex-wrap:wrap;">
						{#each videoPlayer.video.tags as tag}<span
								style="background:#3a4018; color:#a0b040; font-size:11px; padding:2px 7px; border-radius:3px;"
								>{tag}</span
							>{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<Notification bind:notification bind:this={notificationRef} />
