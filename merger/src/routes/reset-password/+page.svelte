<script>
	// @ts-nocheck
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Notification from '$lib/components/Notification.svelte';

	let token = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let notification = $state({ message: '', type: 'info', visible: false });
	let notificationRef = $state(null);
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);

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

	onMount(() => {
		const urlParams = new URLSearchParams(window.location.search);
		token = urlParams.get('token') || '';
		email = urlParams.get('email') || '';
		if (!token) {
			goto('/forgot-password');
		}
	});

	async function handleResetPassword() {
		if (!email) {
			showError('Please enter your email address');
			return;
		}
		if (password !== confirmPassword) {
			showError('Passwords do not match');
			return;
		}
		if (password.length < 6) {
			showError('Password must be at least 6 characters');
			return;
		}
		if (!token) {
			showError('Invalid or missing reset token');
			return;
		}

		loading = true;
		try {
			const response = await fetch('http://localhost:3000/api/mail/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token: token.trim(),
					email: email.trim(),
					password,
					passwordConfirm: confirmPassword
				})
			});

			if (!response.ok) {
				const msg =
					response.status === 401
						? 'Invalid or expired reset token. Please request a new one.'
						: `Server error (${response.status})`;
				showError(msg);
				return;
			}

			const data = await response.json();
			if (data.success === true || data.status === 'success') {
				showSuccess('Password reset successfully! Redirecting to login…');
				setTimeout(() => goto('/login'), 2500);
			} else {
				showError(data.message || 'Failed to reset password');
			}
		} catch {
			showError('Failed to connect to server. Please try again.');
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
					<h2 class="mb-2 text-2xl font-bold" style="color:#c8d870;">Reset Password</h2>
					<p class="text-sm" style="color:#7a8840;">Enter your email and choose a new password</p>
				</div>

				<form onsubmit={handleResetPassword} class="space-y-6">

					<!-- New Password -->
					<div>
						<label for="password" class="mb-2 block text-sm font-medium" style="color:#c8d870;">
							New Password
						</label>
						<div class="relative">
							<input
								id="password"
								type={showPassword ? 'text' : 'password'}
								bind:value={password}
								placeholder="Min 6 characters"
								class="w-full rounded-lg px-4 py-3 pr-12 text-sm outline-none"
								style="background:#1e2210; border:0.5px solid #4a5520; color:#c8d870;"
								onfocus={(e) => (e.target.style.borderColor = '#6b7a2e')}
								onblur={(e) => (e.target.style.borderColor = '#4a5520')}
								required
								minlength="6"
							/>
							<button
								type="button"
								class="absolute top-1/2 right-3 -translate-y-1/2 transform"
								style="color:#7a8840; background:none; border:none; cursor:pointer; padding:4px;"
								onclick={() => (showPassword = !showPassword)}
								aria-label={showPassword ? 'Hide password' : 'Show password'}
							>
								{#if showPassword}
									<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
										<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
										<circle cx="12" cy="12" r="3" />
									</svg>
								{:else}
									<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
										<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
										<path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
										<line x1="1" y1="1" x2="23" y2="23" />
									</svg>
								{/if}
							</button>
						</div>
					</div>

					<!-- Confirm Password -->
					<div>
						<label for="confirmPassword" class="mb-2 block text-sm font-medium" style="color:#c8d870;">
							Confirm New Password
						</label>
						<div class="relative">
							<input
								id="confirmPassword"
								type={showConfirmPassword ? 'text' : 'password'}
								bind:value={confirmPassword}
								placeholder="Confirm your new password"
								class="w-full rounded-lg px-4 py-3 pr-12 text-sm outline-none"
								style="background:#1e2210; border:0.5px solid #4a5520; color:#c8d870;"
								onfocus={(e) => (e.target.style.borderColor = '#6b7a2e')}
								onblur={(e) => (e.target.style.borderColor = '#4a5520')}
								required
							/>
							<button
								type="button"
								class="absolute top-1/2 right-3 -translate-y-1/2 transform"
								style="color:#7a8840; background:none; border:none; cursor:pointer; padding:4px;"
								onclick={() => (showConfirmPassword = !showConfirmPassword)}
								aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
							>
								{#if showConfirmPassword}
									<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
										<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
										<circle cx="12" cy="12" r="3" />
									</svg>
								{:else}
									<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
										<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
										<path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
										<line x1="1" y1="1" x2="23" y2="23" />
									</svg>
								{/if}
							</button>
						</div>
					</div>

					<button
						type="submit"
						disabled={loading || !token}
						class="w-full rounded-lg px-4 py-3 text-sm font-medium"
						style="background:#4a5520; color:#c8d870; border:none; cursor:pointer;"
						onmouseenter={(e) => { if (!loading && token) e.target.style.background = '#6b7a2e'; }}
						onmouseleave={(e) => { if (!loading && token) e.target.style.background = '#4a5520'; }}
					>
						{loading ? 'Resetting…' : 'Reset Password'}
					</button>
				</form>

				<div class="mt-8 text-center">
					<a href="/login" class="text-sm font-medium" style="color:#a0b040;">← Back to Login</a>
				</div>
			</div>
		</div>
	</main>
</div>

<Notification bind:notification bind:this={notificationRef} />