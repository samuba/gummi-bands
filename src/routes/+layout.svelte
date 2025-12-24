<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Gummi Bands - Workout Tracker</title>
	<meta name="description" content="Track your rubber band workouts with ease" />
	<meta name="theme-color" content="#0D0D0D" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
</svelte:head>

<div class="relative z-[1] min-h-screen max-w-[480px] mx-auto p-4 pb-[calc(2rem+env(safe-area-inset-bottom,0))]">
	{@render children()}
</div>
