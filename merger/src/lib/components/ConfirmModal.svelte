<script>
	let {
		open = false,
		title = 'Are you sure?',
		message = 'This action cannot be undone.',
		confirmLabel = 'Delete',
		cancelLabel = 'Cancel',
		danger = true,
		onConfirm,
		onCancel
	} = $props();
</script>

{#if open}
	<div
		style="position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.6);"
		onclick={onCancel}
		onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && onCancel()}
		tabindex="0"
		role="dialog"
		aria-modal="true"
		aria-label="Confirmation dialog"
	>
		<div
			style="width:320px; background:#2a2e1a; border:0.5px solid #4a5520; border-radius:10px; padding:24px;"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
				<div
					style="width:36px; height:36px; border-radius:50%; background:{danger
						? '#3a1010'
						: '#1e2210'}; display:flex; align-items:center; justify-content:center; flex-shrink:0;"
				>
					{#if danger}
						<svg
							style="width:16px; height:16px; color:#c85050;"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
								clip-rule="evenodd"
							/>
						</svg>
					{:else}
						<svg
							style="width:16px; height:16px; color:#a0b040;"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
								clip-rule="evenodd"
							/>
						</svg>
					{/if}
				</div>
				<div>
					<p style="font-size:13px; font-weight:500; color:#c8d870;">{title}</p>
					<p
						style="font-size:12px; color:#5a6828; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px;"
					>
						{message}
					</p>
				</div>
			</div>
			<p style="font-size:12px; color:#7a8840; margin-bottom:18px;">
				This action cannot be undone.
			</p>
			<div style="display:flex; justify-content:flex-end; gap:8px;">
				<button
					onclick={onCancel}
					style="padding:6px 14px; font-size:12px; border-radius:5px; border:0.5px solid #4a5520; background:#1e2210; color:#a0b040; cursor:pointer;"
					onmouseenter={(e) => (e.target.style.background = '#2a3010')}
					onmouseleave={(e) => (e.target.style.background = '#1e2210')}>{cancelLabel}</button
				>
				<button
					onclick={onConfirm}
					style="padding:6px 14px; font-size:12px; font-weight:500; border-radius:5px; border:none; background:{danger
						? '#7a2020'
						: '#4a5520'}; color:{danger ? '#f0a0a0' : '#c8d870'}; cursor:pointer;"
					onmouseenter={(e) => (e.target.style.opacity = '0.85')}
					onmouseleave={(e) => (e.target.style.opacity = '1')}>{confirmLabel}</button
				>
			</div>
		</div>
	</div>
{/if}
