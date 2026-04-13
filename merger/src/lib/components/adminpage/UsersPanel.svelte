<script>
	// @ts-nocheck

	let {
		users,
		filteredUsers,
		userSearch,
		selectedRoleFilter,
		roles,
		loading,
		openEditUser,
		askDelete
	} = $props();

	function initials(name) {
		return (name || 'U')
			.split(' ')
			.map((w) => w[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	function roleName(u) {
		return u.role?.name ?? '—';
	}

	function roleBadgeStyle(name) {
		const map = {
			admin: 'background:#3a4018; color:#c8d870;',
			editor: 'background:#3a3010; color:#c8b040;',
			user: 'background:#1e2a1e; color:#80b080;'
		};
		return map[name?.toLowerCase()] ?? 'background:#2a2e1a; color:#7a8840;';
	}
</script>

<div style="background:#2a2e1a; border:0.5px solid #4a5520; border-radius:8px; overflow:hidden;">
	<table style="width:100%; border-collapse:collapse; font-size:13px; table-layout:fixed;">
		<colgroup>
			<col style="width:25%" />
			<col style="width:28%" />
			<col style="width:15%" />
			<col style="width:18%" />
			<col style="width:14%" />
		</colgroup>
		<thead>
			<tr style="border-bottom:0.5px solid #3a4018; background:#1e2210;">
				{#each ['Name', 'Email', 'Role', 'Joined', 'Actions'] as h}
					<th
						style="padding:10px 14px; text-align:left; font-size:11px; font-weight:500; color:#5a6828; text-transform:uppercase; letter-spacing:0.05em;"
						>{h}</th
					>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#if loading}
				{#each Array(4) as _}
					<tr style="border-bottom:0.5px solid #2a3018;">
						{#each Array(5) as _}
							<td style="padding:12px 14px;"
								><div
									style="height:12px; background:#2a3010; border-radius:4px; animation:pulse 1.5s infinite;"
								></div></td
							>
						{/each}
					</tr>
				{/each}
			{:else if !filteredUsers.length}
				<tr>
					<td colspan="5" style="padding:40px; text-align:center; font-size:13px; color:#5a6828;"
						>No users found</td
					>
				</tr>
			{:else}
				{#each filteredUsers as u (u.id)}
					<tr
						style="border-bottom:0.5px solid #2a3018;"
						onmouseenter={(e) => (e.currentTarget.style.background = '#252d12')}
						onmouseleave={(e) => (e.currentTarget.style.background = 'transparent')}
					>
						<td style="padding:10px 14px;">
							<div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
								<div
									style="width:26px; height:26px; border-radius:50%; background:#3a4018; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:500; color:#c8d870; flex-shrink:0;"
								>
									{initials(u.name)}
								</div>
								<span
									style="font-size:13px; font-weight:500; color:#c8d870; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
									>{u.name}</span
								>
							</div>
						</td>
						<td
							style="padding:10px 14px; font-size:12px; color:#7a8840; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
							>{u.email}</td
						>
						<td style="padding:10px 14px;">
							<span
								style="display:inline-flex; align-items:center; border-radius:20px; padding:2px 8px; font-size:11px; font-weight:500; {roleBadgeStyle(
									roleName(u)
								)}"
							>
								{roleName(u)}
							</span>
						</td>
						<td style="padding:10px 14px; font-size:12px; color:#5a6828;">
							{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
						</td>
						<td style="padding:10px 14px;">
							<div style="display:flex; gap:6px;">
								<button
									onclick={() => openEditUser(u)}
									style="width:28px; height:28px; border-radius:5px; border:0.5px solid #4a5520; background:#1e2210; color:#7a8840; cursor:pointer; display:flex; align-items:center; justify-content:center;"
									onmouseenter={(e) => {
										e.currentTarget.style.borderColor = '#8a9a30';
										e.currentTarget.style.color = '#c8d870';
									}}
									onmouseleave={(e) => {
										e.currentTarget.style.borderColor = '#4a5520';
										e.currentTarget.style.color = '#7a8840';
									}}
									title="Edit"
								>
									<svg style="width:13px; height:13px;" viewBox="0 0 20 20" fill="currentColor">
										<path
											d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
										/>
									</svg>
								</button>
								<button
									onclick={() => askDelete('user', u.id, u.name)}
									style="width:28px; height:28px; border-radius:5px; border:0.5px solid #4a5520; background:#1e2210; color:#7a8840; cursor:pointer; display:flex; align-items:center; justify-content:center;"
									onmouseenter={(e) => {
										e.currentTarget.style.borderColor = '#c85050';
										e.currentTarget.style.color = '#c85050';
									}}
									onmouseleave={(e) => {
										e.currentTarget.style.borderColor = '#4a5520';
										e.currentTarget.style.color = '#7a8840';
									}}
									title="Delete"
								>
									<svg style="width:13px; height:13px;" viewBox="0 0 20 20" fill="currentColor">
										<path
											fill-rule="evenodd"
											d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
											clip-rule="evenodd"
										/>
									</svg>
								</button>
							</div>
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
