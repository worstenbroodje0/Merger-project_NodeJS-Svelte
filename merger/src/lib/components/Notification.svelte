<script lang="ts">
	let { notification = $bindable(), bind: thisRef } = $props();

	$effect(() => {
		if (notification.visible) {
			const timeout = setTimeout(() => {
				notification.visible = false;
			}, 4000);
			return () => clearTimeout(timeout);
		}
	});

	$effect(() => {
		if (thisRef) {
			thisRef.showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' | 'toast' = 'info') => {
				notification.message = message;
				notification.type = type;
				notification.visible = true;
			};
			thisRef.showSuccess = (message: string) => thisRef.showNotification(message, 'success');
			thisRef.showError   = (message: string) => thisRef.showNotification(message, 'error');
			thisRef.showWarning = (message: string) => thisRef.showNotification(message, 'warning');
			thisRef.showInfo    = (message: string) => thisRef.showNotification(message, 'info');
			thisRef.showToast   = (message: string) => thisRef.showNotification(message, 'toast');
		}
	});

	function close() { notification.visible = false; }

	const styles: Record<string, string> = {
		success: 'background:#2a4a1a; border-color:#5a8a2e; color:#a8d870;',
		error:   'background:#3a1a1a; border-color:#7a3020; color:#e8a0a0;',
		warning: 'background:#3a2a10; border-color:#7a5a20; color:#e8c870;',
		info:    'background:#1a2a3a; border-color:#205a7a; color:#70b8e8;',
		toast:   'background:#2a2e1a; border-color:#4a5520; color:#c8d870;',
	};

	const icons: Record<string, string> = {
		success: 'M5 13l4 4L19 7',
		error:   'M6 18L18 6M6 6l12 12',
		warning: 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
		info:    'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
		toast:   'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
	};
</script>

{#if notification.visible}
	<div
		role="alert"
		style="
			position:fixed; top:20px; right:20px; z-index:9999;
			min-width:280px; max-width:380px;
			border-radius:8px; border:0.5px solid;
			padding:12px 14px;
			display:flex; align-items:flex-start; gap:10px;
			{styles[notification.type] ?? styles.info}
			box-shadow:0 4px 16px rgba(0,0,0,0.4);
		"
	>
		<svg style="width:18px; height:18px; flex-shrink:0; margin-top:1px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" d={icons[notification.type] ?? icons.info} />
		</svg>
		<p style="flex:1; font-size:13px; font-weight:500; line-height:1.4; margin:0;">{notification.message}</p>
		<button
			onclick={close}
			style="background:none; border:none; cursor:pointer; color:inherit; opacity:0.6; font-size:18px; line-height:1; padding:0; flex-shrink:0;"
			onmouseenter={(e: any) => e.target.style.opacity='1'}
			onmouseleave={(e: any) => e.target.style.opacity='0.6'}
			aria-label="Close"
		>×</button>
	</div>
{/if}