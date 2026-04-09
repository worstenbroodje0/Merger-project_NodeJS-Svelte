<script>
	import { auth } from '../stores/auth.js';

	let user = $state(null);
	let isAuthenticated = $state(false);

	auth.subscribe((s) => {
		user = s.user;
		isAuthenticated = s.isAuthenticated;
	});
</script>

<nav class="bg-blue-900 p-4 text-white shadow-lg">
	<div class="container mx-auto flex items-center justify-between">
		<div class="flex space-x-6">
			<a href="/" class="transition-colors hover:text-blue-200">Home</a>
			{#if isAuthenticated}
				<a href="/video" class="transition-colors hover:text-blue-200">Video</a>
			{/if}
		</div>
		<div>
			{#if user}
				<p>welcome {user.name}</p>
			{/if}
		</div>
		<div>
			{#if user?.role?.name === 'admin'}
				<a href="#" class="transition-colors hover:text-blue-200">Admin</a>
			{/if}
		</div>
		<div>
			{#if !isAuthenticated}
				<a href="/login" aria-label="Login" class="transition-colors hover:text-blue-200">Login</a>
			{:else}
				<a href="/logout" aria-label="Logout" class="transition-colors hover:text-blue-200"
					>Logout</a
				>
			{/if}
		</div>
	</div>
</nav>
