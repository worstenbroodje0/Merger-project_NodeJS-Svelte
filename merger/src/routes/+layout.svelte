<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navigation from '../components/Navigation.svelte';
	import { auth } from '../stores/auth.js';
	import { onMount } from 'svelte';

	let { children } = $props();

	// Initialize auth store on app load
	onMount(() => {
		auth.initialize();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<Navigation />
{@render children()}
