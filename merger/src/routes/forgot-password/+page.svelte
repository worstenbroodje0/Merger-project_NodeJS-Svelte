<script>
	import { goto } from '$app/navigation';

	let email = '';
	let loading = false;
	let error = '';
	let success = '';

	async function handleForgotPassword() {
		loading = true;
		error = '';
		success = '';

		try {
			const response = await fetch('http://localhost:3000/api/mail/forgot-password', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ email })
			});

			const data = await response.json();

			if (data.status === 'success') {
				success = 'Reset link sent! Redirecting...';
				setTimeout(() => {
					goto('/reset-password');
				}, 2000);
			} else {
				error = data.message || 'Failed to send reset link';
			}
		} catch (err) {
			error = 'Failed to connect to server. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="auth-container">
	<div class="auth-card">
		<div class="auth-header">
			<h1>Forgot Password</h1>
			<p>Enter your email to receive a reset link</p>
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

		<form on:submit|preventDefault={handleForgotPassword}>
			<div class="form-group">
				<label for="email">Email:</label>
				<input id="email" type="email" bind:value={email} placeholder="Enter your email" required />
			</div>

			<button type="submit" disabled={loading}>
				{loading ? 'Sending...' : 'Send Reset Link'}
			</button>
		</form>

		<div class="auth-link">
			<p><a href="/login">Back to Login</a></p>
		</div>
	</div>
</div>
