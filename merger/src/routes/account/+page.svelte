<script>
	// @ts-nocheck
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.js';
	import Notification from '$lib/components/Notification.svelte';

	const BASE = 'http://localhost:3000/api';

	let authInitialized = $state(false);
	let user = $state(null);
	let loading = $state(true);
	let isChangingPassword = $state(false);

	let notification = $state({ message: '', type: 'info', visible: false });
	let notificationRef = $state(null);
	let showSuccess, showError;

	$effect(() => {
		if (notificationRef) {
			showSuccess = notificationRef.showSuccess;
			showError = notificationRef.showError;
		}
	});

	// Password change form
	let passwordForm = $state({
		oldPassword: '',
		newPassword: '',
		confirmPassword: ''
	});
	let passwordErrors = $state({});
	let showPasswordForm = $state(false);
	let showPasswords = $state({
		oldPassword: false,
		newPassword: false,
		confirmPassword: false
	});

	onMount(() => {
		auth.initialize();
		const unsubscribe = auth.subscribe((authState) => {
			if (!authInitialized) {
				authInitialized = true;
				if (!authState?.user) {
					goto('/login');
					return;
				}
				user = authState.user;
				loading = false;
			}
		});
		return unsubscribe;
	});

	function validatePasswordForm() {
		passwordErrors = {};

		if (!passwordForm.oldPassword.trim()) {
			passwordErrors.oldPassword = 'Current password is required';
		}

		if (!passwordForm.newPassword.trim()) {
			passwordErrors.newPassword = 'New password is required';
		} else if (passwordForm.newPassword.length < 6) {
			passwordErrors.newPassword = 'Password must be at least 6 characters';
		}

		if (!passwordForm.confirmPassword.trim()) {
			passwordErrors.confirmPassword = 'Please confirm your password';
		} else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
			passwordErrors.confirmPassword = 'Passwords do not match';
		}

		return Object.keys(passwordErrors).length === 0;
	}

	async function changePassword() {
		if (!validatePasswordForm()) {
			showError?.('Please fix the errors below');
			return;
		}

		isChangingPassword = true;
		try {
			const authState = $auth;
			const response = await fetch(`${BASE}/users/${user.id}/change-password`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${authState.token}`
				},
				body: JSON.stringify({
					oldPassword: passwordForm.oldPassword,
					newPassword: passwordForm.newPassword
				})
			});

			const data = await response.json();

			if (response.ok) {
				showSuccess?.('Password changed successfully!');
				passwordForm = { oldPassword: '', newPassword: '', confirmPassword: '' };
				showPasswordForm = false;
				passwordErrors = {};
			} else {
				showError?.(data.message || 'Failed to change password');
			}
		} catch (err) {
			showError?.(err instanceof Error ? err.message : 'An error occurred');
		} finally {
			isChangingPassword = false;
		}
	}
</script>

<main class="min-h-screen" style="background:#1e1e1e;">
	<div class="mx-auto max-w-2xl px-5 py-8">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="mb-2 text-3xl font-bold" style="color:#7a8840;">My Account</h1>
			<p style="color:#7a8840;">Manage your account settings and security</p>
		</div>

		{#if loading}
			<div class="py-16 text-center">
				<p style="color:#7a8840;">Loading account information…</p>
			</div>
		{:else if user}
			<!-- User Information Card -->
			<div class="mb-8 rounded-lg p-6" style="background:#222a10; border:0.5px solid #3a4018;">
				<h2 class="mb-6 text-xl font-semibold" style="color:#c8d870;">Account Information</h2>

				<div class="space-y-4">
					<!-- Name -->
					<div>
						<label for="name" class="mb-2 block text-sm font-medium" style="color:#7a8840;"
							>Name</label
						>
						<input
							id="name"
							type="text"
							value={user.name}
							disabled
							class="w-full rounded-md px-4 py-2 text-sm"
							style="background:#1e2210; border:0.5px solid #3a4018; color:#c8d870; cursor:not-allowed;"
						/>
					</div>

					<!-- Email -->
					<div>
						<label for="email" class="mb-2 block text-sm font-medium" style="color:#7a8840;"
							>Email</label
						>
						<input
							id="email"
							type="email"
							value={user.email}
							disabled
							class="w-full rounded-md px-4 py-2 text-sm"
							style="background:#1e2210; border:0.5px solid #3a4018; color:#c8d870; cursor:not-allowed;"
						/>
					</div>

					<!-- Role -->
					{#if user.role?.name}
						<div>
							<label for="role" class="mb-2 block text-sm font-medium" style="color:#7a8840;"
								>Role</label
							>
							<div
								id="role"
								class="inline-block w-full rounded-md px-4 py-2 text-sm"
								style="background:#2a3518; border:0.5px solid #4a5520; color:#a0b840; text-transform:capitalize;"
							>
								{user.role.name}
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Security Card -->
			<div class="rounded-lg p-6" style="background:#222a10; border:0.5px solid #3a4018;">
				<h2 class="mb-6 text-xl font-semibold" style="color:#c8d870;">Security</h2>

				{#if !showPasswordForm}
					<button
						onclick={() => (showPasswordForm = true)}
						class="rounded-md px-4 py-2 text-sm font-medium transition-all"
						style="background:#6b7a2e; border:none; color:#fff; cursor:pointer;"
						onmouseenter={(e) => (e.target.style.background = '#7a8940')}
						onmouseleave={(e) => (e.target.style.background = '#6b7a2e')}
					>
						Change Password
					</button>
				{:else}
					<form
						onsubmit={(e) => {
							e.preventDefault();
							changePassword();
						}}
						class="space-y-4"
					>
						<!-- Current Password -->
						<div>
							<label
								for="oldPassword"
								class="mb-2 block text-sm font-medium"
								style="color:#7a8840;"
							>
								Current Password
							</label>
							<div class="relative">
								<input
									id="oldPassword"
									type={showPasswords.oldPassword ? 'text' : 'password'}
									bind:value={passwordForm.oldPassword}
									placeholder="Enter your current password"
									class="w-full rounded-md px-4 py-2 pr-10 text-sm"
									style="background:#1e2210; border:{passwordErrors.oldPassword
										? '0.5px solid #c85050'
										: '0.5px solid #3a4018'}; color:#c8d870;"
								/>
								<button
									type="button"
									onclick={() => (showPasswords.oldPassword = !showPasswords.oldPassword)}
									class="absolute top-1/2 right-3 -translate-y-1/2 transform text-xl"
									style="background:none; border:none; cursor:pointer; color:#7a8840;"
									onmouseenter={(e) => (e.target.style.color = '#a0b840')}
									onmouseleave={(e) => (e.target.style.color = '#7a8840')}
									aria-label={showPasswords.oldPassword ? 'Hide password' : 'Show password'}
								>
									{showPasswords.oldPassword ? '👁️' : '👁️‍🗨️'}
								</button>
							</div>
							{#if passwordErrors.oldPassword}
								<p class="mt-1 text-xs" style="color:#c85050;">{passwordErrors.oldPassword}</p>
							{/if}
						</div>

						<!-- New Password -->
						<div>
							<label
								for="newPassword"
								class="mb-2 block text-sm font-medium"
								style="color:#7a8840;"
							>
								New Password
							</label>
							<div class="relative">
								<input
									id="newPassword"
									type={showPasswords.newPassword ? 'text' : 'password'}
									bind:value={passwordForm.newPassword}
									placeholder="Enter your new password"
									class="w-full rounded-md px-4 py-2 pr-10 text-sm"
									style="background:#1e2210; border:{passwordErrors.newPassword
										? '0.5px solid #c85050'
										: '0.5px solid #3a4018'}; color:#c8d870;"
								/>
								<button
									type="button"
									onclick={() => (showPasswords.newPassword = !showPasswords.newPassword)}
									class="absolute top-1/2 right-3 -translate-y-1/2 transform text-xl"
									style="background:none; border:none; cursor:pointer; color:#7a8840;"
									onmouseenter={(e) => (e.target.style.color = '#a0b840')}
									onmouseleave={(e) => (e.target.style.color = '#7a8840')}
									aria-label={showPasswords.newPassword ? 'Hide password' : 'Show password'}
								>
									{showPasswords.newPassword ? '👁️' : '👁️‍🗨️'}
								</button>
							</div>
							{#if passwordErrors.newPassword}
								<p class="mt-1 text-xs" style="color:#c85050;">{passwordErrors.newPassword}</p>
							{/if}
						</div>

						<!-- Confirm Password -->
						<div>
							<label
								for="confirmPassword"
								class="mb-2 block text-sm font-medium"
								style="color:#7a8840;"
							>
								Confirm Password
							</label>
							<div class="relative">
								<input
									id="confirmPassword"
									type={showPasswords.confirmPassword ? 'text' : 'password'}
									bind:value={passwordForm.confirmPassword}
									placeholder="Confirm your new password"
									class="w-full rounded-md px-4 py-2 pr-10 text-sm"
									style="background:#1e2210; border:{passwordErrors.confirmPassword
										? '0.5px solid #c85050'
										: '0.5px solid #3a4018'}; color:#c8d870;"
								/>
								<button
									type="button"
									onclick={() => (showPasswords.confirmPassword = !showPasswords.confirmPassword)}
									class="absolute top-1/2 right-3 -translate-y-1/2 transform text-xl"
									style="background:none; border:none; cursor:pointer; color:#7a8840;"
									onmouseenter={(e) => (e.target.style.color = '#a0b840')}
									onmouseleave={(e) => (e.target.style.color = '#7a8840')}
									aria-label={showPasswords.confirmPassword ? 'Hide password' : 'Show password'}
								>
									{showPasswords.confirmPassword ? '👁️' : '👁️‍🗨️'}
								</button>
							</div>
							{#if passwordErrors.confirmPassword}
								<p class="mt-1 text-xs" style="color:#c85050;">{passwordErrors.confirmPassword}</p>
							{/if}
						</div>

						<!-- Info Message -->
						<p
							class="rounded-md p-3 text-xs"
							style="background:#2a3518; border:0.5px solid #4a5520; color:#a0b840;"
						>
							💡 Passwords must be at least 6 characters long. You'll need your current password to
							proceed.
						</p>

						<!-- Buttons -->
						<div class="flex gap-3 pt-4">
							<button
								type="submit"
								disabled={isChangingPassword}
								class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all"
								style="background:{isChangingPassword
									? '#556b28'
									: '#6b7a2e'}; border:none; color:#fff; cursor:{isChangingPassword
									? 'not-allowed'
									: 'pointer'}; opacity:{isChangingPassword ? '0.7' : '1'};"
							>
								{isChangingPassword ? 'Saving…' : 'Save New Password'}
							</button>
							<button
								type="button"
								onclick={() => {
									showPasswordForm = false;
									passwordForm = { oldPassword: '', newPassword: '', confirmPassword: '' };
									passwordErrors = {};
									showPasswords = {
										oldPassword: false,
										newPassword: false,
										confirmPassword: false
									};
								}}
								disabled={isChangingPassword}
								class="rounded-md px-4 py-2 text-sm font-medium transition-all"
								style="background:transparent; border:0.5px solid #4a5520; color:#7a8840; cursor:pointer;"
								onmouseenter={(e) => {
									e.target.style.borderColor = '#7a8840';
									e.target.style.color = '#a0b840';
								}}
								onmouseleave={(e) => {
									e.target.style.borderColor = '#4a5520';
									e.target.style.color = '#7a8840';
								}}
							>
								Cancel
							</button>
						</div>

						<!-- Forgot Password Link -->
						<div class="pt-2 text-center">
							<a
								href="/forgot-password"
								class="text-xs transition-colors"
								style="color:#6b9fd0;"
								onmouseenter={(e) => (e.target.style.color = '#8ab8e6')}
								onmouseleave={(e) => (e.target.style.color = '#6b9fd0')}
							>
								Forgot your password? Reset it here
							</a>
						</div>
					</form>
				{/if}
			</div>
		{/if}
	</div>
</main>

<Notification bind:notification bind:this={notificationRef} />
