<script>
	import { auth } from '$lib/stores/auth.js';

	let email = '';
	let password = '';
	let loading = false;
	let error = '';
	let success = '';

	/** @param {string} path */
	function navigate(path) {
		if (typeof window !== 'undefined') {
			window.location.href = path;
		}
	}

	async function handleLogin() {
		loading = true;
		error = '';
		success = '';

		try {
			const response = await fetch('http://localhost:3000/api/users/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ email, password })
			});

			const data = await response.json();

			if (data.status === 'success') {
				success = data.message;

				// Use auth store to handle login
				auth.login(data.token, data.data.user);

				// Redirect to merge page after successful login
				setTimeout(() => {
					navigate('/');
				}, 1000);
			} else {
				error = data.message;
			}
		} catch (err) {
			error = 'Failed to connect to server. Please try again.';
		} finally {
			loading = false;
		}
	}

	function handleSignup() {
		navigate('/signup');
	}
</script>

<div class="min-h-screen font-sans" style="background:#1e1e1e; color:#c8d870;">
	<!-- Main Content -->
	<main class="mx-auto max-w-7xl px-6 py-8">
		<div class="mx-auto max-w-md">
			<div class="rounded-xl p-8" style="background:#2a2e1a; border:0.5px solid #4a5520;">
				<div class="mb-8">
					<h2 class="mb-2 text-2xl font-bold" style="color:#c8d870;">Welcome Back</h2>
					<p class="text-sm" style="color:#7a8840;">Sign in to access your account</p>
				</div>

				{#if error}
					<div class="mb-6 rounded-lg p-4" style="background:#c85050; color:#fff;">
						{error}
					</div>
				{/if}

				{#if success}
					<div class="mb-6 rounded-lg p-4" style="background:#4a5520; color:#c8d870;">
						{success}
					</div>
				{/if}

				<form onsubmit={handleLogin} class="space-y-6">
					<div>
						<label for="email" class="mb-2 block text-sm font-medium" style="color:#c8d870;"
							>Email Address</label
						>
						<input
							id="email"
							type="email"
							bind:value={email}
							placeholder="Enter your email"
							class="w-full rounded-lg px-4 py-3 text-sm outline-none"
							style="background:#1e2210; border:0.5px solid #4a5520; color:#c8d870; placeholder:#7a8840;"
							required
						/>
					</div>

					<div>
						<label for="password" class="mb-2 block text-sm font-medium" style="color:#c8d870;"
							>Password</label
						>
						<input
							id="password"
							type="password"
							bind:value={password}
							placeholder="Enter your password"
							class="w-full rounded-lg px-4 py-3 text-sm outline-none"
							style="background:#1e2210; border:0.5px solid #4a5520; color:#c8d870; placeholder:#7a8840;"
							required
						/>
					</div>

					<div class="flex items-center justify-between">
						<a href="/forgot-password" class="text-sm" style="color:#7a8840;"
							>Forgot your password?</a
						>
						<button
							type="submit"
							disabled={loading}
							class="flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors"
							style="background:#4a5520; color:#c8d870; border:none; cursor:pointer;"
							onmouseenter={(e) => {
								e.target.style.background = '#6b7a2e';
							}}
							onmouseleave={(e) => {
								e.target.style.background = '#4a5520';
							}}
						>
							{loading ? 'Signing in...' : 'Sign In'}
						</button>
					</div>
				</form>

				<div class="mt-8 text-center">
					<p class="text-sm" style="color:#7a8840;">
						Don't have an account?
						<a href="/signup" class="font-medium" style="color:#4a5520;">Sign up</a>
					</p>
				</div>
			</div>
		</div>
	</main>
</div>
