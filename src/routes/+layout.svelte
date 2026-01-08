<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import * as workout from '$lib/stores/workout.svelte';
	import * as pwa from '$lib/stores/pwa.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import EditBandDialog from '$lib/components/EditBandDialog.svelte';
	import { preloadCode } from '$app/navigation';

	let { children } = $props();

	let isLoading = $state(true);
	let loadingError = $state<Error | null>(null);

	onMount(async () => {
		try {
			pwa.setupPwa();
			await workout.initialize();

			preloadAllRoutes();
		} catch (error) {
			console.error(error);
			loadingError = error as Error;
		}
		isLoading = false;
	});

	async function preloadAllRoutes() {
		const modules = import.meta.glob('/src/routes/**/+page.svelte');
		const routes = Object.keys(modules).map((file) => {
			// file path will look something like '/src/routes/about/+page.svelte'
			let path = file.replace('/src/routes', '').replace('/+page.svelte', '');
			if (path === '') path = '/'; // Handle the root route specifically
			return path;
		});
		routes.forEach((route) => {
			preloadCode(route);
		});
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Gummi Bands - Workout Tracker</title>
	<meta name="description" content="Track your rubber band workouts with ease" />
	<meta name="theme-color" content="#0D0D0D" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
</svelte:head>

<div
	class="relative z-1 mx-auto min-h-screen max-w-[480px] p-4 pb-[calc(2rem+env(safe-area-inset-bottom,0))]"
>
	{#if isLoading}
		<div
			class="flex min-h-[80vh] flex-col items-center justify-center gap-6"
			in:fade={{ duration: 200 }}
		>
			{#if loadingError}
				<div class="flex flex-col items-center justify-center gap-6">
					<i class="icon-[ph--warning] text-5xl text-error"></i>
					<p class="text-sm text-text-secondary">An error occurred while loading the Database.</p>
					<p>
						{loadingError.message}
					</p>
				</div>
			{:else}
				<div
					class="h-12 w-12 animate-spin rounded-full border-4 border-bg-tertiary border-t-primary"
				></div>
				<p class="text-sm text-text-secondary">Loading your workouts...</p>
			{/if}
		</div>
	{:else}
		{@render children()}
	{/if}
</div>

<ConfirmDialog />
<EditBandDialog />
