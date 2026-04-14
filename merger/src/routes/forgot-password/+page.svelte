<script>
// @ts-nocheck
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

<div
	style="min-height:100vh; background:#1e1e1e; display:flex; align-items:center; justify-content:center; padding:20px;"
>
	<div
		style="background:#2a2e1a; border:0.5px solid #4a5520; border-radius:12px; padding:32px; width:100%; max-width:400px; box-shadow:0 4px 12px rgba(0,0,0,0.3);"
	>
		<div style="text-align:center; margin-bottom:24px;">
			<h1 style="font-size:24px; font-weight:600; color:#c8d870; margin-bottom:8px;">
				Forgot Password
			</h1>
			<p style="color:#7a8840; font-size:14px; margin:0;">
				Enter your email to receive a reset link
			</p>
		</div>

		{#if error}
			<div
				style="background:#3a1a1a; border:0.5px solid #6a3020; border-radius:6px; padding:12px; margin-bottom:16px;"
			>
				<p style="color:#e8a870; font-size:13px; margin:0;">{error}</p>
			</div>
		{/if}

		{#if success}
			<div
				style="background:#1a3a1a; border:0.5px solid #206a30; border-radius:6px; padding:12px; margin-bottom:16px;"
			>
				<p style="color:#a8e870; font-size:13px; margin:0;">{success}</p>
			</div>
		{/if}

		<form onsubmit={handleForgotPassword}>
			<div style="margin-bottom:20px;">
				<label
					for="email"
					style="display:block; color:#c8d870; font-size:13px; font-weight:500; margin-bottom:6px;"
					>Email</label
				>
				<input
					id="email"
					type="email"
					bind:value={email}
					placeholder="Enter your email"
					required
					style="
						width:100%; 
						height:40px; 
						border-radius:6px; 
						padding:0 12px; 
						font-size:14px; 
						outline:none; 
						background:#1e2210; 
						border:0.5px solid #4a5520; 
						color:#c8d870;
						transition:border-color 0.2s;
					"
					onfocus={(e) => (e.target.style.borderColor = '#6b7a2e')}
					onblur={(e) => (e.target.style.borderColor = '#4a5520')}
				/>
			</div>

			<button
				type="submit"
				disabled={loading}
				style="
					width:100%; 
					height:40px; 
					border-radius:6px; 
					background:#4a5520; 
					color:#c8d870; 
					border:none; 
					font-size:14px; 
					font-weight:500; 
					cursor:pointer;
					transition:background 0.2s;
					margin-bottom:16px;
				"
				onmouseenter={(e) => {
					if (!loading) e.target.style.background = '#6b7a2e';
				}}
				onmouseleave={(e) => {
					if (!loading) e.target.style.background = '#4a5520';
				}}
			>
				{loading ? 'Sending...' : 'Send Reset Link'}
			</button>
		</form>

		<div style="text-align:center;">
			<p style="color:#7a8840; font-size:13px; margin:0;">
				<a
					href="/login"
					style="color:#c8d870; text-decoration:none; font-weight:500; transition:color 0.2s;"
					onmouseenter={(e) => (e.target.style.color = '#d6e08a')}
					onmouseleave={(e) => (e.target.style.color = '#c8d870')}
				>
					Back to Login
				</a>
			</p>
		</div>
	</div>
</div>
