<script>
	import { auth } from '$lib/stores/auth.js';
	import { onMount } from 'svelte';
	import Notification from '$lib/components/Notification.svelte';

	let notification = $state({ message: '', type: 'success', visible: false });
	let notificationRef;

	function showSuccess(message) {
		notification.message = message;
		notification.type = 'success';
		notification.visible = true;
	}

	onMount(() => {
		auth.logout();
		showSuccess('Successfully logged out!');
		notification.visible = false;
		window.location.href = '/';
	});
</script>

<div class="logout-container">
	<p>Logging out...</p>
</div>

<Notification bind:notification bind:this={notificationRef} />
