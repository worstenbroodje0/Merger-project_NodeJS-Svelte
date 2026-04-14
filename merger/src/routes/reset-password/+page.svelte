<script>
// @ts-nocheck
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let token = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let error = $state('');
	let success = $state('');

	onMount(() => {
		// Get token from URL query params
		const urlParams = new URLSearchParams(window.location.search);
		const rawToken = urlParams.get('token');
		token = rawToken || '';

		console.log('Full URL:', window.location.href);
		console.log('URL search params:', window.location.search);
		console.log('Raw token from URL:', rawToken);
		console.log('Processed token:', token);

		if (!token) {
			error = 'Invalid or missing reset token';
			console.log('No token found in URL');
		}
	});

	async function handleResetPassword() {
		loading = true;
		error = '';
		success = '';

		// Validation
		if (password !== confirmPassword) {
			console.log('Passwords do not match');
			error = 'Passwords do not match';
			loading = false;
			return;
		}

		if (password.length < 6) {
			console.log('Password too short');
			error = 'Password must be at least 6 characters long';
			loading = false;
			return;
		}

		console.log('Validation passed, making API call...');

		// Additional token validation
		if (!token || token.trim() === '') {
			console.log('Token is empty or invalid');
			error = 'Invalid or missing reset token';
			loading = false;
			return;
		}

		try {
			const requestBody = {
				token: token.trim(),
				password,
				passwordConfirm: confirmPassword
			};
			console.log('Request body:', requestBody);
			console.log('Token being sent:', token.trim());

			const response = await fetch('http://localhost:3000/api/mail/reset-password', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			console.log('Response status:', response.status);

			// Check if response is successful
			if (!response.ok) {
				// Handle HTTP errors (400, 401, 500, etc.)
				if (response.status === 400) {
					error = 'Invalid request. Please check your token and try again.';
				} else if (response.status === 401) {
					error = 'Invalid or expired reset token. Please request a new one.';
				} else {
					error = `Server error: ${response.status} ${response.statusText}`;
				}
			} else {
				const data = await response.json();
				console.log('Response data:', data);

				if (data.success === true || data.status === 'success') {
					console.log('Password reset successful');
					success = 'Password reset successful! Redirecting to login...';
					setTimeout(() => {
						goto('/login');
					}, 2000);
				} else {
					console.log('Password reset failed:', data.message);
					error = data.message || 'Failed to reset password';
				}
			}
		} catch (err) {
			console.log('Network error:', err);
			error = 'Failed to connect to server. Please try again.';
		} finally {
			console.log('Finally block, setting loading to false');
			loading = false;
		}
	}
</script>

<div class="min-h-screen font-sans" style="background:#1e1e1e; color:#c8d870;">
	<!-- Main Content -->
	<main class="mx-auto max-w-7xl px-6 py-8">
		<div class="mx-auto max-w-md">
			<div class="rounded-xl p-8" style="background:#2a2e1a; border:0.5px solid #4a5520;">
				<div class="mb-8">
					<h2 class="mb-2 text-2xl font-bold" style="color:#c8d870;">Reset Password</h2>
					<p class="text-sm" style="color:#7a8840;">Enter your new password below</p>
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

				<form onsubmit={handleResetPassword} class="space-y-6">
					<div>
						<label for="password" class="mb-2 block text-sm font-medium" style="color:#c8d870;"
							>New Password</label
						>
						<input
							id="password"
							type="password"
							bind:value={password}
							placeholder="Enter your new password (min 6 characters)"
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
							style="color:#c8d870;">Confirm New Password</label
						>
						<input
							id="confirmPassword"
							type="password"
							bind:value={confirmPassword}
							placeholder="Confirm your new password"
							class="w-full rounded-lg px-4 py-3 text-sm outline-none"
							style="background:#1e2210; border:0.5px solid #4a5520; color:#c8d870; placeholder:#7a8840;"
							required
						/>
					</div>

					<button
						type="submit"
						disabled={loading || !token}
						class="w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors"
						style="background:#4a5520; color:#c8d870; border:none; cursor:pointer;"
						onmouseenter={(e) => {
							e.target.style.background = '#6b7a2e';
						}}
						onmouseleave={(e) => {
							e.target.style.background = '#4a5520';
						}}
					>
						{loading ? 'Resetting...' : 'Reset Password'}
					</button>
				</form>

				<div class="mt-8 text-center">
					<p class="text-sm" style="color:#7a8840;">
						<a href="/login" class="font-medium" style="color:#4a5520;">Back to Login</a>
					</p>
				</div>
			</div>
		</div>
	</main>
</div>
