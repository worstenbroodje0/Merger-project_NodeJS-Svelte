<script>
// @ts-nocheck
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Notification from '$lib/components/Notification.svelte';

	let token = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let notification = { message: '', type: 'info', visible: false };
	let notificationRef;
	let showSuccess, showError;

	$effect(() => {
		if (notificationRef) {
			showSuccess = notificationRef.showSuccess;
			showError   = notificationRef.showError;
		}
	});

	onMount(() => {
		const urlParams = new URLSearchParams(window.location.search);
		token = urlParams.get('token') || '';
		if (!token) showError?.('Invalid or missing reset token');
	});

	async function handleResetPassword() {
		if (password !== confirmPassword) { showError?.('Passwords do not match'); return; }
		if (password.length < 6) { showError?.('Password must be at least 6 characters'); return; }
		if (!token) { showError?.('Invalid or missing reset token'); return; }
		loading = true;
		try {
			const response = await fetch('http://localhost:3000/api/mail/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: token.trim(), password, passwordConfirm: confirmPassword })
			});
			if (!response.ok) {
				const msg = response.status === 401
					? 'Invalid or expired reset token. Please request a new one.'
					: `Server error (${response.status})`;
				showError?.(msg);
				return;
			}
			const data = await response.json();
			if (data.success === true || data.status === 'success') {
				showSuccess?.('Password reset! Redirecting to login…');
				setTimeout(() => goto('/login'), 2000);
			} else {
				showError?.(data.message || 'Failed to reset password');
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
					<h2 class="mb-2 text-2xl font-bold" style="color:#c8d870;">Reset Password</h2>
					<p class="text-sm" style="color:#7a8840;">Enter your new password below</p>
				</div>

				<form onsubmit={handleResetPassword} class="space-y-6">
					<div>
						<label for="password" class="mb-2 block text-sm font-medium" style="color:#c8d870;">New Password</label>
						<input id="password" type="password" bind:value={password} placeholder="Min 6 characters"
							class="w-full rounded-lg px-4 py-3 text-sm outline-none"
							style="background:#1e2210; border:0.5px solid #4a5520; color:#c8d870;"
							onfocus={(e) => e.target.style.borderColor='#6b7a2e'}
							onblur={(e) => e.target.style.borderColor='#4a5520'}
							required minlength="6" />
					</div>
					<div>
						<label for="confirmPassword" class="mb-2 block text-sm font-medium" style="color:#c8d870;">Confirm New Password</label>
						<input id="confirmPassword" type="password" bind:value={confirmPassword} placeholder="Confirm your new password"
							class="w-full rounded-lg px-4 py-3 text-sm outline-none"
							style="background:#1e2210; border:0.5px solid #4a5520; color:#c8d870;"
							onfocus={(e) => e.target.style.borderColor='#6b7a2e'}
							onblur={(e) => e.target.style.borderColor='#4a5520'}
							required />
					</div>
					<button type="submit" disabled={loading || !token}
						class="w-full rounded-lg px-4 py-3 text-sm font-medium"
						style="background:#4a5520; color:#c8d870; border:none; cursor:pointer;"
						onmouseenter={(e) => { if (!loading && token) e.target.style.background='#6b7a2e'; }}
						onmouseleave={(e) => { if (!loading && token) e.target.style.background='#4a5520'; }}
					>{loading ? 'Resetting…' : 'Reset Password'}</button>
				</form>

				<div class="mt-8 text-center">
					<a href="/login" class="text-sm font-medium" style="color:#a0b040;">← Back to Login</a>
				</div>
			</div>
		</div>
	</main>
</div>

<Notification bind:notification bind:this={notificationRef} />