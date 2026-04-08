<script>
	import { auth } from '../../stores/auth.js';

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

<div class="auth-container">
	<div class="auth-card">
		<div class="auth-header">
			<h1>Login</h1>
			<p>Sign in to access the video merger</p>
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

		<form class="auth-form" on:submit|preventDefault={handleLogin}>
			<div class="form-group">
				<label for="email">Email:</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					placeholder="Enter your email"
					class="auth-input"
					required
				/>
			</div>

			<div class="form-group">
				<label for="password">Password:</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					placeholder="Enter your password"
					class="auth-input"
					required
				/>
			</div>

			<button type="submit" class="auth-button" disabled={loading}>
				{loading ? 'Signing in...' : 'Sign In'}
			</button>
		</form>

		<div class="auth-link">
			<p>Don't have an account? <a href="/signup">Sign up</a></p>
		</div>
	</div>
</div>
