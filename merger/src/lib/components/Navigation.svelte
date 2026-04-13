<script>
	import { auth } from '$lib/stores/auth.js';

	let user = $state(null);
	let isAuthenticated = $state(false);

	auth.subscribe((s) => {
		user = s.user;
		isAuthenticated = s.isAuthenticated;
	});
</script>

<nav
	class="flex items-center justify-between px-5"
	style="position:sticky; top:0; z-index:50; background:#6b7a2e; height:42px;"
>
	<div class="flex">
		<a
			href="/"
			class="flex items-center px-4 text-sm font-medium transition-colors"
			style="height:42px; color:#d6e08a;"
			onmouseenter={(e) => (e.target.style.background = '#5a6828')}
			onmouseleave={(e) => (e.target.style.background = 'transparent')}
		>
			Home
		</a>
		{#if isAuthenticated}
			<a
				href="/video"
				class="flex items-center px-4 text-sm font-medium transition-colors"
				style="height:42px; color:#d6e08a;"
				onmouseenter={(e) => (e.target.style.background = '#5a6828')}
				onmouseleave={(e) => (e.target.style.background = 'transparent')}
			>
				Video's
			</a>
		{/if}
		{#if user?.role?.name === 'admin' || user?.role?.name === 'editor'}
			<a
				href="/admin"
				class="flex items-center px-4 text-sm font-medium transition-colors"
				style="height:42px; color:#d6e08a;"
				onmouseenter={(e) => (e.target.style.background = '#5a6828')}
				onmouseleave={(e) => (e.target.style.background = 'transparent')}
			>
				Admin
			</a>
		{/if}
	</div>

	<div class="flex items-center gap-6">
		{#if user}
			<p class="text-sm" style="color:#c8d870;">Welcome, {user.name}</p>
		{/if}
		{#if !isAuthenticated}
			<a
				href="/login"
				class="text-sm transition-colors"
				style="color:#d6e08a;"
				onmouseenter={(e) => (e.target.style.color = '#fff')}
				onmouseleave={(e) => (e.target.style.color = '#d6e08a')}
			>
				Login
			</a>
		{:else}
			<a
				href="/logout"
				class="text-sm transition-colors"
				style="color:#d6e08a;"
				onmouseenter={(e) => (e.target.style.color = '#fff')}
				onmouseleave={(e) => (e.target.style.color = '#d6e08a')}
			>
				Logout
			</a>
		{/if}
	</div>
</nav>
