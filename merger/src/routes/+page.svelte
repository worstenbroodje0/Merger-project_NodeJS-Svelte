<script>
	import { goto } from '$app/navigation';
	import { auth } from '../stores/auth.js';

	// ── State ──────────────────────────────────────────────────────────────────
	/** @type {Array<{_id:string, name:string, duration:number, format:string, tags:string[], path?:string, b64?:string, user_id?:number}>} */
	let videos = $state([]);
	let loading = $state(true);
	let error = $state(null);

	/** Ordered list of selected video IDs */
	let selectedIds = $state(/** @type {string[]} */ ([]));

	let mergeLoading = $state(false);
	let mergeError = $state('');
	let dragSrcId = $state(/** @type {string|null} */ (null));
	let dragOverId = $state(/** @type {string|null} */ (null));

	// ── Helpers ────────────────────────────────────────────────────────────────
	/** Normalise ID to string so ObjectId / number / string all compare equal */
	let _uidCounter = 0;

	/** Stamp a guaranteed-unique _uid onto every video object at load time.
	 *  All selection logic uses _uid — never _id/id which may be missing or duplicated. */
	function stamp(video) {
		if (!video._uid) video._uid = String(++_uidCounter);
		return video;
	}

	function getVideo(uid) {
		return videos.find((v) => v._uid === uid);
	}

	// ── Load ───────────────────────────────────────────────────────────────────
	async function loadVideos() {
		try {
			loading = true;
			error = null;

			let remote = [];
			try {
				// Get only regular media (not merged)
				const res = await fetch('http://localhost:3000/api/media/regular');
				if (res.ok) {
					const data = await res.json();
					remote = (data.data || [])
						.filter((v) => {
							// Filter videos for current user
							if (!$auth.user?.id) return true; // Show all if not logged in
							return v.user_id === $auth.user.id || v.user_id === null;
						})
						.map(stamp);
				}
			} catch {
				// API not available — fall through to embedded videos only
			}

			// Always include embedded demo videos
			videos = [...remote, ...[].map(stamp)];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			loading = false;
		}
	}

	// ── Selection ──────────────────────────────────────────────────────────────
	function toggleSelect(video) {
		const id = video._uid;
		if (selectedIds.includes(id)) {
			selectedIds = selectedIds.filter((x) => x !== id);
		} else {
			selectedIds = [...selectedIds, id];
		}
	}

	function removeFromSelection(id) {
		selectedIds = selectedIds.filter((x) => x !== id);
	}

	// ── Drag-to-reorder ────────────────────────────────────────────────────────
	function onDragStart(e, id) {
		dragSrcId = id;
		e.dataTransfer.effectAllowed = 'move';
	}

	function onDragOver(e, targetId) {
		e.preventDefault();
		dragOverId = targetId;
		if (targetId === dragSrcId) return;
		const from = selectedIds.indexOf(dragSrcId);
		const to = selectedIds.indexOf(targetId);
		if (from === -1 || to === -1) return;
		const arr = [...selectedIds];
		arr.splice(from, 1);
		arr.splice(to, 0, dragSrcId);
		selectedIds = arr;
	}

	function onDragLeave() {
		dragOverId = null;
	}

	function onDragEnd() {
		dragSrcId = null;
		dragOverId = null;
	}

	// ── Merge ──────────────────────────────────────────────────────────────────
	async function mergeVideos() {
		if (selectedIds.length < 2) {
			mergeError = 'Please select at least 2 videos to merge';
			return;
		}

		mergeLoading = true;
		mergeError = '';

		try {
			// Check if all selected are embedded (client-side merge via Blob concat)
			const allEmbedded = selectedIds.every((id) => {
				const v = getVideo(id);
				return v?.b64;
			});

			let mergedUrl;
			let mergedName;

			if (allEmbedded) {
				// ── Client-side merge: concatenate MP4 blobs ──────────────────────
				// NOTE: simple binary concat only works reliably when videos share
				// identical codec/resolution, which our generated test clips do.
				// For production use the server endpoint.
				const blobs = selectedIds.map((id) => {
					const v = getVideo(id);
					const binary = atob(v.b64);
					const bytes = new Uint8Array(binary.length);
					for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
					return new Blob([bytes], { type: 'video/mp4' });
				});

				// Use MediaSource or just redirect to server with blobs
				// For a proper merge we POST the b64 data to the server
				const response = await fetch('http://localhost:3000/api/media/merge-b64', {
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
				// ── Server merge via IDs ──────────────────────────────────────────
				const response = await fetch('http://localhost:3000/api/media/merge', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						videoIds: selectedIds.map((uid) => getVideo(uid)?._id ?? getVideo(uid)?.id),
						user_id: $auth.user?.id || null
					})
				});
				if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
				const data = await response.json();
				console.log('Merge response:', data); // Debug log

				// Check for success - backend might return status: 'success' or success: true
				if (data.status !== 'success' && data.success !== true) {
					throw new Error(data.message || data.error || 'Merge failed');
				}

				mergedUrl = data.downloadUrl || `http://localhost:3000/${data.data?.path}`;
				mergedName = data.data?.name || 'merged.mp4';
			}

			// Redirect to completion page using goto for proper routing
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

	loadVideos();
</script>

<main class="container mx-auto px-4 py-8">
	<h1 class="mb-8 text-3xl font-bold">Video Library</h1>

	{#if loading}
		<div class="py-8 text-center"><p class="text-lg">Loading videos…</p></div>
	{:else if error}
		<div class="py-8 text-center">
			<p class="mb-4 text-lg text-red-600">Error: {error}</p>
			<button
				onclick={loadVideos}
				class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">Retry</button
			>
		</div>
	{:else if videos.length === 0}
		<div class="py-8 text-center">
			<p class="text-lg text-gray-500">No videos found</p>
		</div>
	{:else}
		<!-- ── Merge panel ─────────────────────────────────────────────────────── -->
		{#if selectedIds.length > 0}
			<div class="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-5">
				<h2 class="mb-1 text-xl font-semibold">Merge order</h2>
				<p class="mb-4 text-sm text-gray-500">
					Drag rows to reorder — videos will be merged top to bottom.
				</p>

				<ol class="mb-4 flex flex-col gap-2">
					{#each selectedIds as id, i}
						{@const video = getVideo(id)}
						<li
							class="flex cursor-grab items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm transition-colors
                {dragSrcId === id ? 'opacity-40' : ''}
                {dragOverId === id && dragSrcId !== id
								? 'border-blue-400 bg-blue-50'
								: 'border-gray-200'}"
							draggable="true"
							ondragstart={(e) => onDragStart(e, id)}
							ondragover={(e) => onDragOver(e, id)}
							ondragleave={onDragLeave}
							ondragend={onDragEnd}
						>
							<span class="text-lg leading-none text-gray-300 select-none">⠿</span>
							<span
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                           bg-blue-100 text-xs font-semibold text-blue-700"
							>
								{i + 1}
							</span>
							<span class="flex-1 truncate text-sm font-medium">{video?.name ?? id}</span>
							{#if video?.duration}
								<span class="text-xs text-gray-400">{video.duration}s</span>
							{/if}
							{#if video?.b64}
								<span class="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">demo</span>
							{/if}
							<button
								onclick={() => removeFromSelection(id)}
								class="ml-1 text-xl leading-none text-gray-300 transition-colors hover:text-red-500"
								aria-label="Remove from selection">×</button
							>
						</li>
					{/each}
				</ol>

				<div class="flex flex-wrap items-center gap-3">
					<button
						onclick={mergeVideos}
						disabled={mergeLoading || selectedIds.length < 2}
						class="rounded-lg bg-green-500 px-6 py-2 font-medium text-white
                   transition-colors hover:bg-green-600 disabled:cursor-not-allowed
                   disabled:bg-gray-300"
					>
						{mergeLoading
							? 'Merging…'
							: `Merge ${selectedIds.length} video${selectedIds.length === 1 ? '' : 's'}`}
					</button>
					<button
						onclick={() => (selectedIds = [])}
						class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm
                   text-gray-700 transition-colors hover:bg-gray-100"
					>
						Clear selection
					</button>
					{#if mergeError}
						<p class="text-sm text-red-500">{mergeError}</p>
					{/if}
				</div>
			</div>
		{/if}

		<!-- ── Video grid ──────────────────────────────────────────────────────── -->
		<h2 class="mb-4 text-xl font-semibold">All Videos ({videos.length})</h2>
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each videos as video (video._uid)}
				{@const id = video._uid}
				{@const isSelected = selectedIds.includes(id)}
				{@const orderNum = selectedIds.indexOf(id) + 1}
				{@const src = video.b64
					? `data:video/mp4;base64,${video.b64}`
					: `http://localhost:3000/${video.path}`}

				<div
					class="cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm transition-all
                 hover:shadow-md
                 {isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : 'border border-gray-200'}"
					onclick={() => toggleSelect(video)}
					ondblclick={() => goto(`/video/${video._id || video.id}`)}
					role="checkbox"
					aria-checked={isSelected}
					tabindex="0"
					onkeydown={(e) => e.key === ' ' && toggleSelect(video)}
				>
					<div class="relative">
						{#if isSelected}
							<div
								class="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center
                           rounded-full bg-blue-500 text-xs font-bold text-white shadow"
							>
								{orderNum}
							</div>
						{/if}
						<!-- svelte-ignore a11y_media_has_caption -->
						<video
							class="h-48 w-full object-cover"
							{src}
							onclick={(e) => e.stopPropagation()}
							controls
						/>
					</div>

					<div class="p-4">
						<h3 class="mb-1 truncate font-semibold">{video.name}</h3>
						{#if video.tags?.length}
							<div class="mb-2 flex flex-wrap gap-1">
								{#each video.tags as tag}
									<span class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{tag}</span>
								{/each}
							</div>
						{/if}
						<div class="flex gap-3 text-xs text-gray-400">
							{#if video.duration}<span>{video.duration}s</span>{/if}
							{#if video.format}<span>{video.format.toUpperCase()}</span>{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</main>
