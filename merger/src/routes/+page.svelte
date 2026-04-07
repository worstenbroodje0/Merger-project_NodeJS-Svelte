<script>
	/** @type {Array<{name: string, duration: number, format: string, size: number, uploadedAt: string, tags: Array<string>, path: string}>} */
	let videos = $state([]);
	let loading = $state(true);
	let error = $state(null);

	/**
	 * Loads videos from the API and updates the component state.
	 */
	async function loadVideos() {
		try {
			loading = true;
			error = null;
			const response = await fetch('http://localhost:3000/api/media');
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const data = await response.json();
			videos = data.data || [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error occurred';
			console.error('Error loading videos:', err);
		} finally {
			loading = false;
		}
	}

	// Load videos when component mounts
	loadVideos();
</script>

<main>
	<h1>Video Library</h1>

	{#if loading}
		<p>Loading videos...</p>
	{:else if error}
		<p>Error loading videos: {error}</p>
		<button onclick={loadVideos}>Retry</button>
	{:else if videos.length === 0}
		<p>No videos found</p>
	{:else}
		<div>
			<h2>All Videos ({videos.length})</h2>
			{#each videos as video}
				<div>
					<h3>{video.name}</h3>
					<p>Duration: {video.duration}s</p>
					<p>Format: {video.format}</p>
					<p>Size: {Math.round(video.size / 1024 / 1024)}MB</p>
					<p>Uploaded: {new Date(video.uploadedAt).toLocaleString()}</p>
					{#if video.tags && video.tags.length > 0}
						<p>Tags: {video.tags.join(', ')}</p>
					{/if}
					<video controls width="400">
						<source src={`http://localhost:3000/${video.path}`} type={`video/${video.format}`} />
						Your browser does not support the video tag.
					</video>
					<hr />
				</div>
			{/each}
		</div>
	{/if}
</main>
