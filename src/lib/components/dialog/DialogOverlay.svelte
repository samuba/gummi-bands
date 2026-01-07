<script lang="ts">
	import { Dialog, type WithoutChildrenOrChild } from 'bits-ui';
	import type { Snippet } from 'svelte';

	let {
		ref = $bindable(null),
		inDuration = 200,
		outDuration = 100,
		children,
		...restProps
	}: WithoutChildrenOrChild<Dialog.OverlayProps> & {
		inDuration?: number;
		outDuration?: number;
		children?: Snippet;
	} = $props();
</script>

<Dialog.Overlay
	class={[
		'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
		'will-change-[opacity] data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:duration-150 data-[state=closed]:ease-in data-[state=open]:duration-300 data-[state=open]:ease-out',
		restProps.class
	]}
>
	{@render children?.()}
</Dialog.Overlay>

