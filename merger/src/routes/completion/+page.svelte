<script>
// @ts-nocheck
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth.js';

	let loading = $state(true);
	let error = $state('');
	let mergedVideo = $state(null);
	let downloadUrl = $state('');
	let videoName = $state('merged.mp4');
	let videoCount = $state(0);
	let clipNames = $state([]);
	let isAuthenticated = $state(false);

	onMount(() => {
		// Subscribe to auth state
		const unsubscribe = auth.subscribe((authState) => {
			isAuthenticated = authState.isAuthenticated;
		});

		// Get URL parameters from merge page
		const urlParams = new URLSearchParams(window.location.search);
		downloadUrl = urlParams.get('url') || '';
		videoName = urlParams.get('name') || 'merged.mp4';
		videoCount = parseInt(urlParams.get('count') || '0');
		clipNames = urlParams.get('clips')?.split(',') || [];

		loading = false;

		return unsubscribe;
	});

	function goToLibrary() {
		if (isAuthenticated) {
			goto('/video');
		} else {
			goto('/');
		}
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

<main class="min-h-screen" style="background:#1e1e1e; font-family:var(--font-sans);">
	<div class="mx-auto max-w-4xl p-8">
		<div class="mb-8 text-center">
			<div
				class="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full"
				style="background:#3a5520;"
			>
				<svg
					class="h-10 w-10"
					style="color:#c8d870;"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"
					></path>
				</svg>
			</div>
			<h1 class="mb-4 text-3xl font-bold" style="color:#c8d870;">Merge Complete!</h1>
			<p class="text-lg" style="color:#7a8840;">
				Your videos have been successfully uploaded and merged.
			</p>
		</div>

		<div style="background:#2a2e1a; border:0.5px solid #4a5520; border-radius:12px; padding:32px;">
			{#if loading}
				<div class="py-8 text-center">
					<div
						class="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4"
						style="border-color:#6b7a2e; border-top-color:transparent;"
					></div>
					<p class="text-lg" style="color:#c8d870;">Processing your merged video...</p>
				</div>
			{:else if error}
				<div class="py-8 text-center">
					<div
						class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
						style="background:#5a2e2e;"
					>
						<svg
							class="h-6 w-6"
							style="color:#c85050;"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							></path>
						</svg>
					</div>
					<p class="mb-4 text-lg" style="color:#c85050;">{error}</p>
					<button
						onclick={goBack}
						class="rounded px-6 py-2 font-medium"
						style="background:#6b7a2e; color:#fff; border:0.5px solid #8a9a30;"
						onmouseenter={(e) => (e.target.style.background = '#8a9a30')}
						onmouseleave={(e) => (e.target.style.background = '#6b7a2e')}
					>
						Try Again
					</button>
				</div>
			{:else}
				<div class="space-y-6">
					<div class="text-center">
						<h2 class="mb-2 text-xl font-semibold" style="color:#c8d870;">What's Next?</h2>
						<p class="mb-6" style="color:#7a8840;">
							Your merged video is now available in your video library.
						</p>
					</div>

					<div
						style="background:#3a5520; border:0.5px solid #5a7a2e; border-radius:8px; padding:16px;"
					>
						<h1 class="mb-4 text-3xl font-bold" style="color:#c8d870;">Merge Complete!</h1>
						<p class="text-lg" style="color:#a0b040;">
							Successfully merged {videoCount} videos into "{videoName}"
						</p>
					</div>

					{#if downloadUrl}
						<div
							style="background:#1e2210; border:0.5px solid #3a4018; border-radius:8px; padding:24px; margin-bottom:24px;"
						>
							<h2 class="mb-4 text-xl font-semibold" style="color:#c8d870;">Your Merged Video</h2>

							<!-- Video Preview -->
							<div class="mb-4" style="display:flex; justify-content:center;">
								<!-- svelte-ignore a11y_media_has_caption -->
								<video
									controls
									class="rounded-lg"
									src={downloadUrl}
									style="max-width:100%; max-height:400px; width:auto; height:auto; box-shadow:0 4px 12px rgba(0,0,0,0.3);"
								>
									Your browser does not support video tag.
								</video>
							</div>

							<!-- Download Button -->
							<button
								onclick={downloadVideo}
								class="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium"
								style="background:#6b7a2e; color:#fff; border:0.5px solid #8a9a30;"
								onmouseenter={(e) => (e.target.style.background = '#8a9a30')}
								onmouseleave={(e) => (e.target.style.background = '#6b7a2e')}
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
						<div
							style="background:#3a5520; border:0.5px solid #5a7a2e; border-radius:8px; padding:24px; margin-bottom:24px;"
						>
							<h3 class="mb-3 text-lg font-semibold" style="color:#c8d870;">Merged Videos:</h3>
							<ul class="list-inside list-disc space-y-1 text-sm" style="color:#a0b040;">
								{#each clipNames as name, i}
									<li>{i + 1}. {name}</li>
								{/each}
							</ul>
						</div>
					{/if}

					<div
						style="background:#1e2210; border:0.5px solid #3a4018; border-radius:8px; padding:24px;"
					>
						<div class="space-y-4">
							<button
								onclick={goToLibrary}
								class="w-full rounded-lg px-6 py-3 font-medium"
								style="background:#6b7a2e; color:#fff; border:0.5px solid #8a9a30;"
								onmouseenter={(e) => (e.target.style.background = '#8a9a30')}
								onmouseleave={(e) => (e.target.style.background = '#6b7a2e')}
							>
								{isAuthenticated ? 'View Videos' : 'Back to Home'}
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</main>
