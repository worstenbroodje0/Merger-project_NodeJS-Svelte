<script>
	// @ts-nocheck

	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth.js';
	import Notification from '$lib/components/Notification.svelte';

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
	let confirm = $state({ open: false, type: '', id: null, label: '', merged: false });
	let videoPlayer = $state({ open: false, video: null });

	let pendingFiles = $state([]);
	let uploading = $state(false);
	let uploadProgress = $state(0);
	let isDragging = $state(false);

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
				if (!Array.isArray(v.tags) || !v.tags.length) {
					tagMatch = false;
				} else {
					tagMatch = v.tags.includes(videoTagFilter);
				}
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

	// Update availableTags when videos change
	$effect(() => {
		const tagSet = new Set();
		if (videos && videos.length > 0) {
			videos.forEach((video) => {
				if (video.tags && Array.isArray(video.tags)) {
					video.tags.forEach((tag) => tagSet.add(tag));
				}
			});
		}
		availableTags = Array.from(tagSet).sort();
	});

	async function load() {
		if (!(await auth.isAdmin()) && !(await auth.isEditor())) {
			goto('/');
			return;
		}
		loading = true;
		try {
			const [uRes, vRes, rRes] = await Promise.all([
				fetch(`${BASE}/admin/users`),
				fetch(`${BASE}/media`),
				fetch(`${BASE}/roles`).catch(() => ({ ok: false }))
			]);
			users = uRes.ok ? (await uRes.json()).data || [] : [];
			const rawVideos = vRes.ok ? (await vRes.json()).data || [] : [];
			try {
				const regRes = await fetch(`${BASE}/media/regular`);
				if (regRes.ok) {
					const regIds = new Set(((await regRes.json()).data || []).map((v) => v.id));
					videos = rawVideos.map((v) => ({ ...v, merged: !regIds.has(v.id) }));
				} else {
					videos = rawVideos.map((v) => ({ ...v, merged: false }));
				}
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
			showError('Failed to load data');
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
	function closeModal() {
		modal = { open: false, type: '', target: null };
	}

	async function saveEdit() {
		const { type, target } = modal;
		if (!target) return;
		if (type === 'user') {
			try {
				const isEdit = target.id !== undefined;
				await fetch(isEdit ? `${BASE}/admin/users/${target.id}` : `${BASE}/admin/users`, {
					method: isEdit ? 'PUT' : 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name: editName, email: editEmail, role_id: editRoleId })
				});
			} catch (_) {}
			const matchedRole = roles.find((r) => r.id === Number(editRoleId)) ?? null;
			users = users.map((u) =>
				u.id === target.id
					? { ...u, name: editName, email: editEmail, role_id: editRoleId, role: matchedRole }
					: u
			);
			showSuccess('User updated successfully');
		} else {
			const tags = editTags
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean);
			try {
				const response = await fetch(`${BASE}/media/${target.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name: editName, tags })
				});
				if (!response.ok) throw new Error('Failed to update video');
			} catch (error) {
				showError('Failed to update video');
				return;
			}
			videos = videos.map((v) => (v.id === target.id ? { ...v, name: editName, tags } : v));
			showSuccess('Video updated successfully');
		}
		closeModal();
	}

	function askDelete(type, id, label, merged = false) {
		confirm = { open: true, type, id, label, merged };
	}

	function getUserName(userId) {
		if (!userId) return 'Unknown';
		const user = users.find((u) => u.id === userId);
		return user ? user.name : 'Unknown';
	}

	async function doDelete() {
		const { type, id } = confirm;
		confirm = { open: false, type: '', id: null, label: '', merged: false };
		if (type === 'user') {
			try {
				await fetch(`${BASE}/admin/users/${id}`, { method: 'DELETE' });
			} catch (_) {}
			users = users.filter((u) => u.id !== id);
			showSuccess('User deleted successfully');
		} else {
			try {
				const response = await fetch(`${BASE}/media/${id}`, { method: 'DELETE' });
				if (!response.ok) throw new Error('Failed to delete video');
			} catch (error) {
				showError('Failed to delete video');
				return;
			}
			videos = videos.filter((v) => v.id !== id);
			showSuccess('Video deleted successfully');
		}
	}

	function handleFiles(e) {
		const files = Array.from(e.target?.files || e.dataTransfer?.files || []);
		// Only keep the first file (single file upload)
		pendingFiles = files.length > 0 ? [files[0]] : [];
		if (e.target) e.target.value = '';
	}

	function removeFile(i) {
		pendingFiles = pendingFiles.filter((_, idx) => idx !== i);
	}

	async function uploadFiles() {
		if (!pendingFiles.length) return;
		uploading = true;
		uploadProgress = 0;
		const formData = new FormData();
		pendingFiles.forEach((f) => formData.append('video', f));
		const iv = setInterval(() => {
			if (uploadProgress < 85) uploadProgress = Math.min(uploadProgress + Math.random() * 10, 85);
		}, 200);
		try {
			const res = await fetch(`${BASE}/media/upload`, { method: 'POST', body: formData });
			clearInterval(iv);
			uploadProgress = 100;
			if (res.ok) {
				showNotification('Video uploaded successfully!', 'success');
				pendingFiles = [];
				await load();
			} else {
				showNotification('Upload failed', 'error');
			}
		} catch {
			clearInterval(iv);
			showNotification('Upload failed — check your upload endpoint', 'error');
		} finally {
			setTimeout(() => {
				uploading = false;
				uploadProgress = 0;
			}, 600);
		}
	}

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
		const total = Math.round(s || 0);
		const m = Math.floor(total / 60);
		const sec = total % 60;
		return `${m}:${String(sec).padStart(2, '0')}`;
	}

	function fmtSize(b) {
		if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
		if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
		return Math.round(b / 1024) + ' KB';
	}

	function initials(name) {
		return (name || 'U')
			.split(' ')
			.map((w) => w[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	function roleName(u) {
		return u.role?.name ?? '—';
	}

	function roleBadgeStyle(name) {
		const map = {
			admin: 'background:#3a4018; color:#c8d870;',
			editor: 'background:#3a3010; color:#c8b040;',
			user: 'background:#1e2a1e; color:#80b080;'
		};
		return map[name?.toLowerCase()] ?? 'background:#2a2e1a; color:#7a8840;';
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
					style="
						display:flex; align-items:center; width:100%; padding:8px 12px;
						border-radius:6px; border:none; cursor:pointer; font-size:13px;
						font-weight:500; margin-bottom:2px; text-align:left; transition:background 0.15s;
						background:{activeTab === tab.key ? '#4a5520' : 'transparent'};
						color:{activeTab === tab.key ? '#d6e08a' : '#7a8840'};
					"
					onmouseenter={(e) => {
						if (activeTab !== tab.key) e.currentTarget.style.background = '#2a3010';
					}}
					onmouseleave={(e) => {
						if (activeTab !== tab.key) e.currentTarget.style.background = 'transparent';
					}}
				>
					{tab.label}
				</button>
			{/each}
		</nav>

		<!-- Stats -->
		<div style="padding:12px 8px; margin-top:8px; border-top:0.5px solid #3a4018;">
			<div
				style="background:#1e2210; border:0.5px solid #3a4018; border-radius:6px; padding:10px 12px; margin-bottom:8px;"
			>
				<p style="font-size:10px; color:#5a6828; margin-bottom:2px;">Total videos</p>
				<p style="font-size:20px; font-weight:500; color:#a0b840;">
					{loading ? '—' : regularVideos.length}
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

	<!-- Main content -->
	<main style="flex:1; min-width:0; padding:20px;">
		<!-- Search + sub-tabs row -->
		<div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
			<!-- Search input -->
			{#if activeTab === 'users'}
				<input
					type="text"
					placeholder="Search users..."
					bind:value={userSearch}
					style="
						flex:1; max-width:320px; height:32px; border-radius:6px; padding:0 12px;
						font-size:13px; outline:none;
						background:#2a2e1a; border:0.5px solid #4a5520; color:#c8d870;
					"
				/>

				<!-- Role filter dropdown -->
				<select
					bind:value={selectedRoleFilter}
					style="
						height:32px; border-radius:6px; padding:0 12px;
						font-size:13px; outline:none;
						background:#2a2e1a; border:0.5px solid #4a5520; color:#c8d870;
						cursor:pointer;
					"
				>
					<option value="">All Roles</option>
					{#each roles as role}
						<option value={role.name}>{role.name}</option>
					{/each}
				</select>

				{#if selectedRoleFilter}
					<button
						onclick={() => (selectedRoleFilter = '')}
						style="padding:4px 12px; font-size:12px; border-radius:5px; border:0.5px solid #4a5520; background:#1e2210; color:#a0b040; cursor:pointer;"
						>Clear</button
					>
				{/if}
			{:else}
				<input
					type="text"
					placeholder="Search videos..."
					bind:value={videoSearch}
					style="
						flex:1; max-width:320px; height:32px; border-radius:6px; padding:0 12px;
						font-size:13px; outline:none;
						background:#2a2e1a; border:0.5px solid #4a5520; color:#c8d870;
					"
				/>
			{/if}

			{#if activeTab === 'videos'}
				<select
					bind:value={videoTagFilter}
					style="
						width:180px; height:32px; border-radius:6px; padding:0 8px;
						font-size:13px; outline:none;
						background:#2a2e1a; border:0.5px solid #4a5520; color:#c8d870;
						cursor:pointer;
					"
				>
					<option value="">All tags</option>
					{#each availableTags as tag}
						<option value={tag}>{tag}</option>
					{/each}
				</select>
				<select
					bind:value={videoMergeFilter}
					style="
						width:140px; height:32px; border-radius:6px; padding:0 8px;
						font-size:13px; outline:none;
						background:#2a2e1a; border:0.5px solid #4a5520; color:#c8d870;
						cursor:pointer;
					"
				>
					<option value="">All videos</option>
					<option value="merged">Merged</option>
					<option value="unmerged">Not merged</option>
				</select>
				{#if videoTagFilter}
					<button
						onclick={() => (videoTagFilter = '')}
						style="padding:4px 12px; font-size:12px; border-radius:5px; border:0.5px solid #4a5520; background:#1e2210; color:#a0b040; cursor:pointer;"
						>Clear</button
					>
				{/if}
			{/if}
		</div>

		<!-- ── USERS TAB ── -->
		{#if activeTab === 'users'}
			<div
				style="background:#2a2e1a; border:0.5px solid #4a5520; border-radius:8px; overflow:hidden;"
			>
				<table style="width:100%; border-collapse:collapse; font-size:13px; table-layout:fixed;">
					<colgroup>
						<col style="width:25%" />
						<col style="width:28%" />
						<col style="width:15%" />
						<col style="width:18%" />
						<col style="width:14%" />
					</colgroup>
					<thead>
						<tr style="border-bottom:0.5px solid #3a4018; background:#1e2210;">
							{#each ['Name', 'Email', 'Role', 'Joined', 'Actions'] as h}
								<th
									style="padding:10px 14px; text-align:left; font-size:11px; font-weight:500; color:#5a6828; text-transform:uppercase; letter-spacing:0.05em;"
									>{h}</th
								>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#if loading}
							{#each Array(4) as _}
								<tr style="border-bottom:0.5px solid #2a3018;">
									{#each Array(5) as _}
										<td style="padding:12px 14px;"
											><div
												style="height:12px; background:#2a3010; border-radius:4px; animation:pulse 1.5s infinite;"
											></div></td
										>
									{/each}
								</tr>
							{/each}
						{:else if !filteredUsers.length}
							<tr>
								<td
									colspan="5"
									style="padding:40px; text-align:center; font-size:13px; color:#5a6828;"
									>No users found</td
								>
							</tr>
						{:else}
							{#each filteredUsers as u (u.id)}
								<tr
									style="border-bottom:0.5px solid #2a3018;"
									onmouseenter={(e) => (e.currentTarget.style.background = '#252d12')}
									onmouseleave={(e) => (e.currentTarget.style.background = 'transparent')}
								>
									<td style="padding:10px 14px;">
										<div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
											<div
												style="width:26px; height:26px; border-radius:50%; background:#3a4018; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:500; color:#c8d870; flex-shrink:0;"
											>
												{initials(u.name)}
											</div>
											<span
												style="font-size:13px; font-weight:500; color:#c8d870; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
												>{u.name}</span
											>
										</div>
									</td>
									<td
										style="padding:10px 14px; font-size:12px; color:#7a8840; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
										>{u.email}</td
									>
									<td style="padding:10px 14px;">
										<span
											style="display:inline-flex; align-items:center; border-radius:20px; padding:2px 8px; font-size:11px; font-weight:500; {roleBadgeStyle(
												roleName(u)
											)}"
										>
											{roleName(u)}
										</span>
									</td>
									<td style="padding:10px 14px; font-size:12px; color:#5a6828;">
										{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
									</td>
									<td style="padding:10px 14px;">
										<div style="display:flex; gap:6px;">
											<button
												onclick={() => openEditUser(u)}
												style="width:28px; height:28px; border-radius:5px; border:0.5px solid #4a5520; background:#1e2210; color:#7a8840; cursor:pointer; display:flex; align-items:center; justify-content:center;"
												onmouseenter={(e) => {
													e.currentTarget.style.borderColor = '#8a9a30';
													e.currentTarget.style.color = '#c8d870';
												}}
												onmouseleave={(e) => {
													e.currentTarget.style.borderColor = '#4a5520';
													e.currentTarget.style.color = '#7a8840';
												}}
												title="Edit"
											>
												<svg
													style="width:13px; height:13px;"
													viewBox="0 0 20 20"
													fill="currentColor"
												>
													<path
														d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
													/>
												</svg>
											</button>
											<button
												onclick={() => askDelete('user', u.id, u.name)}
												style="width:28px; height:28px; border-radius:5px; border:0.5px solid #4a5520; background:#1e2210; color:#7a8840; cursor:pointer; display:flex; align-items:center; justify-content:center;"
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
												<svg
													style="width:13px; height:13px;"
													viewBox="0 0 20 20"
													fill="currentColor"
												>
													<path
														fill-rule="evenodd"
														d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
														clip-rule="evenodd"
													/>
												</svg>
											</button>
										</div>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		{/if}

		<!-- ── VIDEOS TAB ── -->
		{#if activeTab === 'videos'}
			{#if loading}
				<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px;">
					{#each Array(6) as _}
						<div
							style="background:#2a2e1a; border:0.5px solid #4a5520; border-radius:8px; overflow:hidden;"
						>
							<div style="aspect-ratio:16/9; background:#1e2210;"></div>
							<div style="padding:10px;">
								<div
									style="height:10px; background:#2a3010; border-radius:4px; margin-bottom:6px;"
								></div>
								<div style="height:10px; width:60%; background:#2a3010; border-radius:4px;"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if !filteredVideos.length}
				<div style="padding:60px; text-align:center; font-size:13px; color:#5a6828;">
					No videos found
				</div>
			{:else}
				<div
					style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px,1fr)); gap:12px;"
				>
					{#each filteredVideos as v, i (i)}
						<div
							style="background:#2a2e1a; border:0.5px solid #4a5520; border-radius:8px; overflow:hidden; transition:border-color 0.15s;"
							onmouseenter={(e) => (e.currentTarget.style.borderColor = '#8a9a30')}
							onmouseleave={(e) => (e.currentTarget.style.borderColor = '#4a5520')}
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
		{/if}

		<!-- ── UPLOAD TAB ── -->
		{#if activeTab === 'upload'}
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
				<p style="font-size:14px; font-weight:500; color:#a0b040; margin-bottom:6px;">
					Upload video's
				</p>
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
		{/if}
	</main>
</div>

<!-- ── Edit Modal ── -->
{#if modal.open}
	<div
		style="position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.6);"
		onclick={closeModal}
	>
		<div
			style="width:380px; background:#2a2e1a; border:0.5px solid #4a5520; border-radius:10px; padding:24px;"
			onclick={(e) => e.stopPropagation()}
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
							type="email"
							style="width:100%; background:#1e2210; border:0.5px solid #4a5520; border-radius:6px; padding:8px 10px; font-size:13px; color:#c8d870; outline:none;"
						/>
					</div>
					<div>
						<label
							style="display:block; font-size:11px; color:#7a8840; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.05em;"
							>Role</label
						>
						<select
							bind:value={editRoleId}
							style="width:100%; background:#1e2210; border:0.5px solid #4a5520; border-radius:6px; padding:8px 10px; font-size:13px; color:#c8d870; outline:none;"
						>
							<option value={null}>— no role —</option>
							{#each roles as r (r.id)}
								<option value={r.id}>{r.name}</option>
							{/each}
						</select>
					</div>
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

<!-- ── Confirm Delete Modal ── -->
{#if confirm.open}
	<div
		style="position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.6);"
		onclick={() => (confirm.open = false)}
	>
		<div
			style="width:320px; background:#2a2e1a; border:0.5px solid #4a5520; border-radius:10px; padding:24px;"
			onclick={(e) => e.stopPropagation()}
		>
			<div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
				<div
					style="width:36px; height:36px; border-radius:50%; background:#3a1010; display:flex; align-items:center; justify-content:center; flex-shrink:0;"
				>
					<svg
						style="width:16px; height:16px; color:#c85050;"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div>
					<p style="font-size:13px; font-weight:500; color:#c8d870;">Delete {confirm.type}?</p>
					<p
						style="font-size:12px; color:#5a6828; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px;"
					>
						{confirm.label}
					</p>
				</div>
			</div>
			<p style="font-size:12px; color:#7a8840; margin-bottom:18px;">
				This action cannot be undone.
			</p>
			<div style="display:flex; justify-content:flex-end; gap:8px;">
				<button
					onclick={() => (confirm.open = false)}
					style="padding:6px 14px; font-size:12px; border-radius:5px; border:0.5px solid #4a5520; background:#1e2210; color:#a0b040; cursor:pointer;"
					>Cancel</button
				>
				<button
					onclick={doDelete}
					style="padding:6px 14px; font-size:12px; font-weight:500; border-radius:5px; border:none; background:#7a2020; color:#f0a0a0; cursor:pointer;"
					>Delete</button
				>
			</div>
		</div>
	</div>
{/if}

<!-- ── Video Player Modal ── -->
{#if videoPlayer.open && videoPlayer.video}
	<div
		style="position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.85);"
		onclick={closeVideoPlayer}
	>
		<div
			style="width:100%; max-width:900px; margin:0 16px; background:#111; border-radius:10px; overflow:hidden; border:0.5px solid #3a4018;"
			onclick={(e) => e.stopPropagation()}
		>
			<div
				style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:0.5px solid #2a3010;"
			>
				<h3 style="font-size:14px; font-weight:500; color:#c8d870;">{videoPlayer.video.name}</h3>
				<div style="display:flex; gap:8px; align-items:center;">
					<button
						onclick={() => downloadVideo(videoPlayer.video)}
						style="background:#3a5520; border:0.5px solid #5a7a2e; color:#c8d870; cursor:pointer; font-size:12px; padding:4px 8px; border-radius:4px; font-weight:500; transition:all 0.15s;"
						onmouseenter={(e) => {
							e.target.style.background = '#4a6828';
							e.target.style.borderColor = '#6a8a3e';
						}}
						onmouseleave={(e) => {
							e.target.style.background = '#3a5520';
							e.target.style.borderColor = '#5a7a2e';
						}}
						title="Download video"
					>
						Download
					</button>
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
				{#if videoPlayer.video.duration}
					<span style="font-size:12px; color:#7a8840;"
						>Duration: <span style="color:#a0b040;">{fmtDuration(videoPlayer.video.duration)}</span
						></span
					>
				{/if}
				{#if videoPlayer.video.size}
					<span style="font-size:12px; color:#7a8840;"
						>Size: <span style="color:#a0b040;">{fmtSize(videoPlayer.video.size)}</span></span
					>
				{/if}
				{#if Array.isArray(videoPlayer.video.tags) && videoPlayer.video.tags.length}
					<div style="display:flex; gap:4px; flex-wrap:wrap;">
						{#each videoPlayer.video.tags as tag}
							<span
								style="background:#3a4018; color:#a0b040; font-size:11px; padding:2px 7px; border-radius:3px;"
								>{tag}</span
							>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<Notification bind:notification bind:this={notificationRef} />
