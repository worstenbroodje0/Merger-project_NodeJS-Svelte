<script>
	// @ts-nocheck

	let { open = false, roles = [], isLoading = false, onClose, onCreate } = $props();

	let formData = $state({
		name: '',
		email: '',
		password: '',
		confirmPassword: '',
		role_id: null
	});

	let errors = $state({});
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);

	// Get the default user role ID
	let defaultUserRoleId = $derived.by(() => {
		return roles.find((r) => r.name?.toLowerCase() === 'user')?.id ?? 3;
	});

	// Filter out user role from the displayed options
	let displayedRoles = $derived(roles.filter((r) => r.name?.toLowerCase() !== 'user'));

	function validateForm() {
		errors = {};

		if (!formData.name.trim()) {
			errors.name = 'Name is required';
		}

		if (!formData.email.trim()) {
			errors.email = 'Email is required';
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
			errors.email = 'Invalid email address';
		}

		if (!formData.password.trim()) {
			errors.password = 'Password is required';
		} else if (formData.password.length < 6) {
			errors.password = 'Password must be at least 6 characters';
		}

		if (!formData.confirmPassword.trim()) {
			errors.confirmPassword = 'Please confirm the password';
		} else if (formData.password !== formData.confirmPassword) {
			errors.confirmPassword = 'Passwords do not match';
		}

		return Object.keys(errors).length === 0;
	}

	async function handleSubmit() {
		if (!validateForm()) return;

		await onCreate({
			name: formData.name.trim(),
			email: formData.email.trim(),
			password: formData.password,
			role_id: formData.role_id || defaultUserRoleId
		});

		resetForm();
	}

	function resetForm() {
		formData = {
			name: '',
			email: '',
			password: '',
			confirmPassword: '',
			role_id: null
		};
		errors = {};
		showPassword = false;
		showConfirmPassword = false;
	}

	function handleClose() {
		resetForm();
		onClose();
	}
</script>

{#if open}
	<div
		style="position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.6);"
		onclick={handleClose}
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
		tabindex="0"
		role="dialog"
		aria-modal="true"
		aria-label="Create new user"
	>
		<div
			style="width:420px; max-height:90vh; overflow-y:auto; background:#2a2e1a; border:0.5px solid #4a5520; border-radius:10px; padding:28px;"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<!-- Header -->
			<div style="margin-bottom:24px;">
				<h2 style="font-size:18px; font-weight:600; color:#c8d870; margin-bottom:8px;">
					Create New User
				</h2>
				<p style="font-size:13px; color:#7a8840;">
					Add a new user to the system with their details and role assignment.
				</p>
			</div>

			<!-- Form -->
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				style="display:flex; flex-direction:column; gap:16px;"
			>
				<!-- Name -->
				<div>
					<label
						for="create-name"
						style="display:block; font-size:12px; font-weight:500; color:#7a8840; margin-bottom:6px;"
					>
						Name *
					</label>
					<input
						id="create-name"
						type="text"
						bind:value={formData.name}
						placeholder="John Doe"
						disabled={isLoading}
						style="width:100%; padding:8px 12px; border-radius:6px; font-size:13px; border:{errors.name
							? '0.5px solid #c85050'
							: '0.5px solid #3a4018'}; background:#1e2210; color:#c8d870; outline:none;"
						onfocus={(e) => !errors.name && (e.target.style.borderColor = '#6b7a2e')}
						onblur={(e) => !errors.name && (e.target.style.borderColor = '#3a4018')}
					/>
					{#if errors.name}
						<p style="font-size:11px; color:#c85050; margin-top:4px;">{errors.name}</p>
					{/if}
				</div>

				<!-- Email -->
				<div>
					<label
						for="create-email"
						style="display:block; font-size:12px; font-weight:500; color:#7a8840; margin-bottom:6px;"
					>
						Email *
					</label>
					<input
						id="create-email"
						type="email"
						bind:value={formData.email}
						placeholder="user@example.com"
						disabled={isLoading}
						style="width:100%; padding:8px 12px; border-radius:6px; font-size:13px; border:{errors.email
							? '0.5px solid #c85050'
							: '0.5px solid #3a4018'}; background:#1e2210; color:#c8d870; outline:none;"
						onfocus={(e) => !errors.email && (e.target.style.borderColor = '#6b7a2e')}
						onblur={(e) => !errors.email && (e.target.style.borderColor = '#3a4018')}
					/>
					{#if errors.email}
						<p style="font-size:11px; color:#c85050; margin-top:4px;">{errors.email}</p>
					{/if}
				</div>

				<!-- Password -->
				<div>
					<label
						for="create-password"
						style="display:block; font-size:12px; font-weight:500; color:#7a8840; margin-bottom:6px;"
					>
						Password *
					</label>
					<div style="position:relative;">
						<input
							id="create-password"
							type={showPassword ? 'text' : 'password'}
							bind:value={formData.password}
							placeholder="Enter password"
							disabled={isLoading}
							style="width:100%; padding:8px 12px; padding-right:36px; border-radius:6px; font-size:13px; border:{errors.password
								? '0.5px solid #c85050'
								: '0.5px solid #3a4018'}; background:#1e2210; color:#c8d870; outline:none;"
							onfocus={(e) => !errors.password && (e.target.style.borderColor = '#6b7a2e')}
							onblur={(e) => !errors.password && (e.target.style.borderColor = '#3a4018')}
						/>
						<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#7a8840; font-size:16px;"
							onmouseenter={(e) => (e.target.style.color = '#a0b840')}
							onmouseleave={(e) => (e.target.style.color = '#7a8840')}
							aria-label={showPassword ? 'Hide password' : 'Show password'}
						>
							{showPassword ? '👁️' : '👁️‍🗨️'}
						</button>
					</div>
					{#if errors.password}
						<p style="font-size:11px; color:#c85050; margin-top:4px;">{errors.password}</p>
					{/if}
				</div>

				<!-- Confirm Password -->
				<div>
					<label
						for="create-confirm-password"
						style="display:block; font-size:12px; font-weight:500; color:#7a8840; margin-bottom:6px;"
					>
						Confirm Password *
					</label>
					<div style="position:relative;">
						<input
							id="create-confirm-password"
							type={showConfirmPassword ? 'text' : 'password'}
							bind:value={formData.confirmPassword}
							placeholder="Confirm password"
							disabled={isLoading}
							style="width:100%; padding:8px 12px; padding-right:36px; border-radius:6px; font-size:13px; border:{errors.confirmPassword
								? '0.5px solid #c85050'
								: '0.5px solid #3a4018'}; background:#1e2210; color:#c8d870; outline:none;"
							onfocus={(e) => !errors.confirmPassword && (e.target.style.borderColor = '#6b7a2e')}
							onblur={(e) => !errors.confirmPassword && (e.target.style.borderColor = '#3a4018')}
						/>
						<button
							type="button"
							onclick={() => (showConfirmPassword = !showConfirmPassword)}
							style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#7a8840; font-size:16px;"
							onmouseenter={(e) => (e.target.style.color = '#a0b840')}
							onmouseleave={(e) => (e.target.style.color = '#7a8840')}
							aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
						>
							{showConfirmPassword ? '👁️' : '👁️‍🗨️'}
						</button>
					</div>
					{#if errors.confirmPassword}
						<p style="font-size:11px; color:#c85050; margin-top:4px;">{errors.confirmPassword}</p>
					{/if}
				</div>

				<!-- Role -->
				<div>
					<label
						for="create-role"
						style="display:block; font-size:12px; font-weight:500; color:#7a8840; margin-bottom:6px;"
					>
						Role
					</label>
					<select
						id="create-role"
						bind:value={formData.role_id}
						disabled={isLoading}
						style="width:100%; padding:8px 12px; border-radius:6px; font-size:13px; border:0.5px solid #3a4018; background:#1e2210; color:#c8d870; outline:none; cursor:pointer;"
						onfocus={(e) => (e.target.style.borderColor = '#6b7a2e')}
						onblur={(e) => (e.target.style.borderColor = '#3a4018')}
					>
						<option value={null}>Select a role (optional)</option>
						{#each displayedRoles as role (role.id)}
							<option value={role.id}>{role.name}</option>
						{/each}
					</select>
				</div>

				<!-- Info message -->
				<div
					style="padding:12px; border-radius:6px; background:#2a3518; border:0.5px solid #4a5520; font-size:12px; color:#a0b840; display:flex; gap:8px; align-items:flex-start;"
				>
					<span style="flex-shrink:0; margin-top:2px;">ℹ️</span>
					<span
						>Password must be at least 6 characters. Users default to "user" role if no role is
						selected. User will receive a welcome email.</span
					>
				</div>

				<!-- Buttons -->
				<div style="display:flex; gap:10px; margin-top:8px;">
					<button
						type="button"
						onclick={handleClose}
						disabled={isLoading}
						style="flex:1; padding:8px 16px; border-radius:6px; border:0.5px solid #4a5520; background:#1e2210; color:#a0b040; font-size:13px; font-weight:500; cursor:pointer; opacity:{isLoading
							? '0.6'
							: '1'};"
						onmouseenter={(e) => !isLoading && (e.target.style.background = '#2a3010')}
						onmouseleave={(e) => !isLoading && (e.target.style.background = '#1e2210')}
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isLoading}
						style="flex:1; padding:8px 16px; border-radius:6px; border:none; background:{isLoading
							? '#556b28'
							: '#6b7a2e'}; color:#fff; font-size:13px; font-weight:500; cursor:{isLoading
							? 'not-allowed'
							: 'pointer'}; opacity:{isLoading ? '0.8' : '1'};"
						onmouseenter={(e) => !isLoading && (e.target.style.background = '#7a8940')}
						onmouseleave={(e) => !isLoading && (e.target.style.background = '#6b7a2e')}
					>
						{isLoading ? 'Creating…' : 'Create User'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
