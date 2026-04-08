<script>
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
		token = urlParams.get('token') || '';



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

		try {
			const requestBody = {
				token,
				password,
				passwordConfirm: confirmPassword
			};
			console.log('Request body:', requestBody);

			const response = await fetch('http://localhost:3000/api/mail/reset-password', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			console.log('Response status:', response.status);
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
		} catch (err) {
			console.log('Network error:', err);
			error = 'Failed to connect to server. Please try again.';
		} finally {
			console.log('Finally block, setting loading to false');
			loading = false;
		}
	}
</script>

<div class="auth-container">
	<div class="auth-card">
		<div class="auth-header">
			<h1>Reset Password</h1>
			<p>Enter your new password</p>
		</div>

		{#if error}
			<div class="error-message">
				{error}
			</div>
		{/if}

		{#if success}
			<div class="success-message">
				{success}
			</div>
		{/if}

		<form on:submit|preventDefault={handleResetPassword}>
			<div class="form-group">
				<label for="password">New Password:</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					placeholder="Enter your new password (min 6 characters)"
					required
					minlength="6"
				/>
			</div>

			<div class="form-group">
				<label for="confirmPassword">Confirm New Password:</label>
				<input
					id="confirmPassword"
					type="password"
					bind:value={confirmPassword}
					placeholder="Confirm your new password"
					required
				/>
			</div>

			<button type="submit" disabled={loading || !token}>
				{loading ? 'Resetting...' : 'Reset Password'}
			</button>
		</form>

		<div class="auth-link">
			<p><a href="/login">Back to Login</a></p>
		</div>
	</div>
</div>
