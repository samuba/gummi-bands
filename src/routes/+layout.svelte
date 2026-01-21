<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import * as workout from '$lib/stores/workout.svelte';
	import * as pwa from '$lib/stores/pwa.svelte';
	import { loader } from '$lib/stores/initialLoader.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import EditBandDialog from '$lib/components/EditBandDialog.svelte';
	import EditTemplateDialog from '$lib/components/EditTemplateDialog.svelte';
	import ErrorDialog from '$lib/components/ErrorDialog.svelte';
	import { markDialogReady } from '../hooks.client';
	import { preloadCode } from '$app/navigation';
	import DbRepl from '$lib/components/DbRepl.svelte';
	import { updated, page } from '$app/state';
	import { browser, version } from '$app/environment';
	import { resolve } from '$app/paths';

	let { children } = $props();

	let isLoading = $state(true);
	let loadingError = $state<Error | null>(null);
	let isUpdating = $state(false);

	onMount(async () => {
		markDialogReady();
		updated.check();

		if (browser && sessionStorage.getItem('app-updating') === 'true') {
			isUpdating = true;
			sessionStorage.removeItem('app-updating');
		}

		try {
			pwa.setupPwa();
			await workout.initialize();
			await preloadAllRoutes();
			loader.complete();
		} catch (error) {
			console.error('Failed to initialize app:', error);
			loadingError = error as Error;

			// If we're offline, provide a more helpful error message
			if (!navigator.onLine) {
				loadingError = new Error('App failed to load offline. Please check your internet connection and try again.');
			}
		} finally {
			isUpdating = false;
		}
		isLoading = false;
	});

	async function preloadAllRoutes() {
		loader.setLoading('Preloading routes...', 90);
		const modules = import.meta.glob('/src/routes/**/+page.svelte');
		const routes = Object.keys(modules).map((file) => {
			// file path will look something like '/src/routes/about/+page.svelte'
			let path = file.replace('/src/routes', '').replace('/+page.svelte', '');
			if (path === '') path = '/'; // Handle the root route specifically
			return path;
		});

		// Preload routes but don't fail if offline
		try {
			await Promise.allSettled(routes.map((route) => preloadCode(resolve(route as any))));
		} catch (error) {
			// Ignore preloading errors when offline - the routes will load when accessed
			console.warn('Route preloading failed (possibly offline):', error);
		}
	}

	// Reload page when a new version is deployed, but only when user is on home screen
	$effect(() => {
		console.log('effect in layout', { updated: updated.current, routeId: page.route.id, isUpdating, version });
		if (browser && updated.current && page.route.id === '/' && !isUpdating) {
			handleAppUpdate();
		}
	});

	async function handleAppUpdate() {
		console.log('Triggering app update');
		sessionStorage.setItem('app-updating', 'true');

		// Wait for the new service worker to take control before reloading
		// This ensures the reload is handled by the new SW and cached properly
		await waitForServiceWorker();
		location.reload();
	}

	async function waitForServiceWorker() {
		if (!('serviceWorker' in navigator)) return;

		const registration = await navigator.serviceWorker.getRegistration();
		if (!registration) return;

		if (registration.waiting) {
			// There's a waiting service worker - tell it to skip waiting
			registration.waiting.postMessage({ type: 'SKIP_WAITING' });

			// Wait for the new service worker to take control
			await new Promise<void>((resolve) => {
				navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
			});
			return;
		}

		if (registration.installing) {
			// Service worker is still installing - wait for it to activate
			await new Promise<void>((resolve) => {
				const sw = registration.installing!;
				sw.addEventListener('statechange', function onStateChange() {
					if (sw.state === 'activated') {
						sw.removeEventListener('statechange', onStateChange);
						resolve();
					}
				});
			});
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Gummi Bands - Workout Tracker</title>
	<meta name="description" content="Track your rubber band workouts with ease" />
	<meta name="theme-color" content="#0D0D0D" />
</svelte:head>
1
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
				{#if isUpdating}
					<div
						class="mb-4 flex items-center gap-3 rounded-xl bg-bg-tertiary p-4 text-text-secondary"
						in:fade={{ duration: 200, delay: 200 }}
					>
						<i class="icon-[ph--arrows-clockwise] size-5 animate-spin"></i>
						<p class="text-sm font-medium">New version found. Updating App.</p>
					</div>
				{/if}

				{@const circumference = 2 * Math.PI * 54}
				{@const offset = circumference - (loader.progress / 100) * circumference}
				<div class="flex flex-col items-center gap-5">
					<div class="relative size-32">
						<svg class="size-full -rotate-90" viewBox="0 0 120 120">
							<circle
								cx="60"
								cy="60"
								r="54"
								fill="none"
								stroke="currentColor"
								stroke-width="8"
								class="text-bg-tertiary"
							/>
							<circle
								cx="60"
								cy="60"
								r="54"
								fill="none"
								stroke="currentColor"
								stroke-width="8"
								stroke-linecap="round"
								class="text-primary transition-all duration-300 ease-out"
								style="stroke-dasharray: {circumference}; stroke-dashoffset: {offset}"
							/>
						</svg>
						<div class="absolute inset-0 flex items-center justify-center">
							<span class="text-2xl font-display tabular-nums text-text-primary">{loader.progress}%</span>
						</div>
					</div>
					
					<p class="text-sm text-text-secondary">{loader.text}</p>
				</div>
			{/if}
		</div>
	{:else}
		{@render children()}
	{/if}
</div>

<ConfirmDialog />
<EditBandDialog />
<EditTemplateDialog />
<ErrorDialog />

<DbRepl />
