<script>
	// @ts-nocheck
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.js';
	import Notification from '$lib/components/Notification.svelte';

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let loading = $state(false);
	let notification = $state({ message: '', type: 'info', visible: false });
	let notificationRef;

	function showSuccess(message) {
		notification.message = message;
		notification.type = 'success';
		notification.visible = true;
	}

	function showError(message) {
		notification.message = message;
		notification.type = 'error';
		notification.visible = true;
	}

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
				console.error('Login failed:', data.message);
				showError?.(data.message || 'Login failed');
			}
		} catch (err) {
			console.error('Server connection error:', err);
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
						<div class="relative">
							<input
								id="password"
								type={showPassword ? 'text' : 'password'}
								bind:value={password}
								placeholder="Enter your password"
								class="w-full rounded-lg px-4 py-3 pr-12 text-sm outline-none"
								style="background:#1e2210; border:0.5px solid #4a5520; color:#c8d870; placeholder:#7a8840;"
								required
							/>
							<button
								type="button"
								class="absolute top-1/2 right-3 -translate-y-1/2 transform text-sm"
								style="color:#7a8840; background:none; border:none; cursor:pointer; padding:4px;"
								onclick={() => (showPassword = !showPassword)}
								aria-label={showPassword ? 'Hide password' : 'Show password'}
							>
								{#if showPassword}
									<svg
										width="16"
										height="16"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										viewBox="0 0 24 24"
									>
										<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
										<circle cx="12" cy="12" r="3" />
									</svg>
								{:else}
									<svg
										width="16"
										height="16"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										viewBox="0 0 24 24"
									>
										<path
											d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"
										/>
										<path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
										<line x1="1" y1="1" x2="23" y2="23" />
									</svg>
								{/if}
							</button>
						</div>
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