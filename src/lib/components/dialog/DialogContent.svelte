<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { scale } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children?: Snippet;
	}

	let {
		class: className = '',
		children
	}: Props = $props();

	const baseClass = 'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-bg-elevated bg-bg-secondary p-6 shadow-2xl focus:outline-none';
	const finalClass = $derived(className ? `${baseClass} ${className}` : baseClass);
	
	// @ts-ignore - bits-ui supports transition props but types are incomplete
	const transitionProps = { transition: scale, transitionConfig: { duration: 150, start: 0.95 } };
</script>

<Dialog.Content
	class={finalClass}
	{...transitionProps}
>
	{#if children}
		{@render children()}
	{/if}
</Dialog.Content>

