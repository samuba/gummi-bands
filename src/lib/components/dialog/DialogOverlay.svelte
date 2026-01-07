<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { fade } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children?: Snippet;
	}

	let {
		class: className = '',
		children
	}: Props = $props();

	const baseClass = 'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm';
	const finalClass = $derived(className ? `${baseClass} ${className}` : baseClass);
	
	// @ts-ignore - bits-ui supports transition props but types are incomplete
	const transitionProps = { transition: fade, transitionConfig: { duration: 150 } };
</script>

<Dialog.Overlay
	class={finalClass}
	{...transitionProps}
>
	{#if children}
		{@render children()}
	{/if}
</Dialog.Overlay>

