<script>
	// @ts-nocheck
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.js';
	import Notification from '$lib/components/Notification.svelte';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let notification = $state({ message: '', type: 'info', visible: false });
	let notificationRef;
	let showSuccess, showError;

	$effect(() => {
		if (notificationRef) {
			showSuccess = notificationRef.showSuccess;
			showError = notificationRef.showError;
		}
	});

	async function handleLogin() {
		loading = true;
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
				showSuccess?.('Login successful! Redirecting...');
				auth.login(data.data.token, data.data.user);

				setTimeout(() => {
					goto('/');
				}, 500);
			} else {
				showError?.(data.message || 'Login failed');
			}
		} catch {
			showError?.('Failed to connect to server. Please try again.');
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-screen font-sans" style="background:#1e1e1e; color:#c8d870;">
	<main class="mx-auto max-w-7xl px-6 py-8">
		<div class="mx-auto max-w-md">
			<div class="rounded-xl p-8" style="background:#2a2e1a; border:0.5px solid #4a5520;">
				<div class="mb-8">
					<h2 class="mb-2 text-2xl font-bold" style="color:#c8d870;">Welcome Back</h2>
					<p class="text-sm" style="color:#7a8840;">Sign in to access your account</p>
				</div>

				<form onsubmit={handleLogin} class="space-y-6">
					<div>
						<label for="email" class="mb-2 block text-sm font-medium" style="color:#c8d870;">
							Email Address
						</label>
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
						<label for="password" class="mb-2 block text-sm font-medium" style="color:#c8d870;">
							Password
						</label>
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
						<a href="/forgot-password" class="text-sm" style="color:#7a8840;">
							Forgot your password?
						</a>
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
						<a href="/signup" class="font-medium" style="color:#a0b040;">Sign up</a>
					</p>
				</div>
			</div>
		</div>
	</main>
</div>

<Notification bind:notification bind:this={notificationRef} />
