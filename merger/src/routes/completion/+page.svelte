<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let loading = $state(true);
	let error = $state('');
	let mergedVideo = $state(null);
	let downloadUrl = $state('');
	let videoName = $state('merged.mp4');
	let videoCount = $state(0);
	let clipNames = $state([]);

	onMount(() => {
		// Get URL parameters from merge page
		const urlParams = new URLSearchParams(window.location.search);
		downloadUrl = urlParams.get('url') || '';
		videoName = urlParams.get('name') || 'merged.mp4';
		videoCount = parseInt(urlParams.get('count') || '0');
		clipNames = urlParams.get('clips')?.split(',') || [];

		loading = false;
	});

	function goToLibrary() {
		goto('/');
	}

	function goBack() {
		goto('/upload');
	}

	function downloadVideo() {
		if (downloadUrl) {
			// Fetch the video file and create a blob for download
			fetch(downloadUrl)
				.then((response) => response.blob())
				.then((blob) => {
					const url = window.URL.createObjectURL(blob);
					const link = document.createElement('a');
					link.href = url;
					link.download = videoName;
					document.body.appendChild(link);
					link.click();
					document.body.removeChild(link);
					// Clean up the object URL
					window.URL.revokeObjectURL(url);
				})
				.catch((error) => {
					console.error('Download failed:', error);
					// Fallback: try opening in new tab if blob download fails
					window.open(downloadUrl, '_blank');
				});
		}
	}
</script>

<main class="container mx-auto px-4 py-8">
	<div class="mx-auto max-w-2xl">
		<div class="mb-8 text-center">
			<div
				class="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100"
			>
				<svg class="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"
					></path>
				</svg>
			</div>
			<h1 class="mb-4 text-3xl font-bold">Merge Complete!</h1>
			<p class="text-lg text-gray-600">Your videos have been successfully uploaded and merged.</p>
		</div>

		<div class="rounded-lg bg-white p-8 shadow-lg">
			{#if loading}
				<div class="py-8 text-center">
					<div
						class="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
					></div>
					<p class="text-lg">Processing your merged video...</p>
				</div>
			{:else if error}
				<div class="py-8 text-center">
					<div
						class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100"
					>
						<svg class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							></path>
						</svg>
					</div>
					<p class="mb-4 text-lg text-red-600">{error}</p>
					<button
						onclick={goBack}
						class="rounded bg-blue-500 px-6 py-2 text-white hover:bg-blue-600"
					>
						Try Again
					</button>
				</div>
			{:else}
				<div class="space-y-6">
					<div class="text-center">
						<h2 class="mb-2 text-xl font-semibold">What's Next?</h2>
						<p class="mb-6 text-gray-600">
							Your merged video is now available in your video library.
						</p>
					</div>

					<div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
						<h1 class="mb-4 text-3xl font-bold">Merge Complete!</h1>
						<p class="text-lg text-gray-600">
							Successfully merged {videoCount} videos into "{videoName}"
						</p>
					</div>

					{#if downloadUrl}
						<div class="mb-6 rounded-lg bg-gray-50 p-6">
							<h2 class="mb-4 text-xl font-semibold">Your Merged Video</h2>

							<!-- Video Preview -->
							<div class="mb-4">
								<!-- svelte-ignore a11y_media_has_caption -->
								<video controls class="w-full rounded-lg shadow-md" src={downloadUrl}>
									Your browser does not support the video tag.
								</video>
							</div>

							<!-- Download Button -->
							<button
								onclick={downloadVideo}
								class="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-6 py-3 font-medium text-white hover:bg-green-600"
							>
								<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									></path>
								</svg>
								Download {videoName}
							</button>
						</div>
					{/if}

					{#if clipNames.length > 0}
						<div class="mb-6 rounded-lg bg-blue-50 p-6">
							<h3 class="mb-3 text-lg font-semibold">Merged Videos:</h3>
							<ul class="list-inside list-disc space-y-1 text-sm text-gray-600">
								{#each clipNames as name, i}
									<li>{i + 1}. {name}</li>
								{/each}
							</ul>
						</div>
					{/if}

					<div class="rounded-lg bg-gray-50 p-6">
						<div class="space-y-4">
							<button
								onclick={goToLibrary}
								class="w-full rounded-lg bg-blue-500 px-6 py-3 font-medium text-white hover:bg-blue-600"
							>
								View Video Library
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</main>
