<script lang="ts">
	import { Dialog } from 'bits-ui';

	let {
		ref = $bindable(null),
		...restProps
	}: Dialog.ContentProps = $props();

	let isFullHeight = $state(false);

	$effect(() => {
		if (!ref) return;

		const checkHeight = () => {
			isFullHeight = ref!.offsetHeight >= window.innerHeight - 2;
		};

		const observer = new ResizeObserver(checkHeight);
		observer.observe(ref);
		window.addEventListener('resize', checkHeight);

		return () => {
			observer.disconnect();
			window.removeEventListener('resize', checkHeight);
		};
	});
</script>

<Dialog.Content
	onOpenAutoFocus={(e) => e.preventDefault()}
	bind:ref
	{...restProps}
	class={[
		'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 bg-bg-secondary p-6 shadow-2xl focus:outline-none',
		'max-h-dvh overflow-y-auto',
		!isFullHeight && 'rounded-xl border border-bg-elevated',
		'will-change-transform data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
		restProps.class
	]}>
	{@render restProps.children?.()}
</Dialog.Content>
