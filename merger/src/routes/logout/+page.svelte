<script>
	import { auth } from '$lib/stores/auth.js';
	import { onMount } from 'svelte';

	onMount(() => {
		auth.logout();
		// Redirect to home after logout
		window.location.href = '/';
	});
</script>

<div class="logout-container">
	<p>Logging out...</p>
</div>
