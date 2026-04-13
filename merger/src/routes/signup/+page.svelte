<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.js';

	let name = '';
	let email = '';
	let password = '';
	let confirmPassword = '';
	let loading = false;
	let error = '';
	let success = '';

	onMount(() => {
		// Check if already authenticated
		const unsubscribe = auth.subscribe((authState) => {
			if (authState.isAuthenticated) {
				goto('/');
			}
		});
		return unsubscribe;
	});

	async function handleSignup() {
		loading = true;
		error = '';
		success = '';

		// Validation
		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			loading = false;
			return;
		}

		if (password.length < 6) {
			error = 'Password must be at least 6 characters long';
			loading = false;
			return;
		}

		try {
			const response = await fetch('http://localhost:3000/api/users/register', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name,
					email,
					password,
					passwordConfirm: confirmPassword
				})
			});

			const data = await response.json();

			if (data.status === 'success') {
				success = 'Account created! Redirecting...';

				// Use auth store to handle login state
				auth.login(data.token, data.data.user);

				// Immediate redirect after successful signup
				setTimeout(() => {
					goto('/');
				}, 500);
			} else {
				error = data.message;
			}
		} catch (err) {
			error = 'Failed to connect to server. Please try again.';
		} finally {
			loading = false;
		}
	}

	function handleLogin() {
		goto('/login');
	}
</script>

<div class="min-h-screen font-sans" style="background:#1e1e1e; color:#c8d870;">
	<!-- Main Content -->
	<main class="mx-auto max-w-7xl px-6 py-8">
		<div class="mx-auto max-w-md">
			<div class="rounded-xl p-8" style="background:#2a2e1a; border:0.5px solid #4a5520;">
				<div class="mb-8">
					<h2 class="mb-2 text-2xl font-bold" style="color:#c8d870;">Create Account</h2>
					<p class="text-sm" style="color:#7a8840;">Join us to start managing your videos</p>
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

				<form onsubmit={handleSignup} class="space-y-6">
					<div>
						<label for="name" class="mb-2 block text-sm font-medium" style="color:#c8d870;"
							>Full Name</label
						>
						<input
							id="name"
							type="text"
							bind:value={name}
							placeholder="Enter your full name"
							class="w-full rounded-lg px-4 py-3 text-sm outline-none"
							style="background:#1e2210; border:0.5px solid #4a5520; color:#c8d870; placeholder:#7a8840;"
							required
						/>
					</div>

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
							placeholder="Enter your password (min 6 characters)"
							class="w-full rounded-lg px-4 py-3 text-sm outline-none"
							style="background:#1e2210; border:0.5px solid #4a5520; color:#c8d870; placeholder:#7a8840;"
							required
							minlength="6"
						/>
					</div>

					<div>
						<label
							for="confirmPassword"
							class="mb-2 block text-sm font-medium"
							style="color:#c8d870;">Confirm Password</label
						>
						<input
							id="confirmPassword"
							type="password"
							bind:value={confirmPassword}
							placeholder="Confirm your password"
							class="w-full rounded-lg px-4 py-3 text-sm outline-none"
							style="background:#1e2210; border:0.5px solid #4a5520; color:#c8d870; placeholder:#7a8840;"
							required
						/>
					</div>

					<button
						type="submit"
						disabled={loading}
						class="w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors"
						style="background:#4a5520; color:#c8d870; border:none; cursor:pointer;"
						onmouseenter={(e) => {
							e.target.style.background = '#6b7a2e';
						}}
						onmouseleave={(e) => {
							e.target.style.background = '#4a5520';
						}}
					>
						{#if loading}
							Creating account...
						{:else}
							Sign Up
						{/if}
					</button>
				</form>

				<div class="mt-8 text-center">
					<p class="text-sm" style="color:#7a8840;">
						Already have an account?
						<a href="/login" class="font-medium" style="color:#4a5520;">Sign in</a>
					</p>
				</div>
			</div>
		</div>
	</main>
</div>
