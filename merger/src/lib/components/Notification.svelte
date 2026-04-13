<script lang="ts">
	let { notification = $bindable(), bind: thisRef } = $props();

	// Auto-hide notification after 5 seconds
	$effect(() => {
		if (notification.visible) {
			const timeout = setTimeout(() => {
				notification.visible = false;
			}, 5000);

			return () => clearTimeout(timeout);
		}
	});

	// Expose methods to parent components
	$effect(() => {
		if (thisRef) {
			thisRef.showNotification = (
				message: string,
				type: 'success' | 'error' | 'warning' | 'info' | 'toast' = 'info'
			) => {
				notification.message = message;
				notification.type = type;
				notification.visible = true;
			};

			thisRef.showSuccess = (message: string) => {
				thisRef.showNotification(message, 'success');
			};

			thisRef.showError = (message: string) => {
				thisRef.showNotification(message, 'error');
			};

			thisRef.showWarning = (message: string) => {
				thisRef.showNotification(message, 'warning');
			};

			thisRef.showInfo = (message: string) => {
				thisRef.showNotification(message, 'info');
			};

			thisRef.showToast = (message: string) => {
				thisRef.showNotification(message, 'toast');
			};
		}
	});

	function closeNotification() {
		notification.visible = false;
	}

	function getNotificationClasses() {
		const baseClasses =
			'fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 transform';
		const typeClasses = {
			success: 'bg-green-500 text-white',
			error: 'bg-red-500 text-white',
			warning: 'bg-yellow-500 text-black',
			info: 'bg-blue-500 text-white',
			toast: 'bg-gray-800 text-white'
		};

		const type = notification.type as keyof typeof typeClasses;
		return `${baseClasses} ${typeClasses[type] || typeClasses.info}`;
	}
</script>

{#if notification.visible}
	<div class={getNotificationClasses()} role="alert">
		<div class="flex items-center justify-between">
			<div class="flex-1">
				<p class="font-medium">{notification.message}</p>
			</div>
			<button
				onclick={closeNotification}
				class="ml-4 text-white hover:text-gray-200 focus:outline-none"
				aria-label="Close notification"
			>
				<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
		</div>
	</div>
{/if}
