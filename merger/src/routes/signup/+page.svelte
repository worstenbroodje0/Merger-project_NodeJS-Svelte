<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '../../stores/auth.js';

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

<div class="auth-container">
	<div class="auth-card">
		<div class="auth-header">
			<h1>Sign Up</h1>
			<p>Create an account to access the video merger</p>
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

		<form class="auth-form" on:submit|preventDefault={handleSignup}>
			<div class="form-group">
				<label for="name">Name:</label>
				<input id="name" type="text" bind:value={name} placeholder="Enter your name" required />
			</div>

			<div class="form-group">
				<label for="email">Email:</label>
				<input id="email" type="email" bind:value={email} placeholder="Enter your email" required />
			</div>

			<div class="form-group">
				<label for="password">Password:</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					placeholder="Enter your password (min 6 characters)"
					required
					minlength="6"
				/>
			</div>

			<div class="form-group">
				<label for="confirmPassword">Confirm Password:</label>
				<input
					id="confirmPassword"
					type="password"
					bind:value={confirmPassword}
					placeholder="Confirm your password"
					required
				/>
			</div>

			<button type="submit" class="auth-btn" disabled={loading}>
				{#if loading}
					Creating account...
				{:else}
					Sign Up
				{/if}
			</button>
		</form>

		<div class="auth-footer">
			<p>Already have an account?</p>
			<button class="link-btn" on:click={handleLogin}> Sign In </button>
		</div>
	</div>
</div>
