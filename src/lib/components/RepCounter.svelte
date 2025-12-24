<script lang="ts">
	interface Props {
		label: string;
		value: number;
		onchange: (value: number) => void;
		accent?: boolean;
	}

	let { label, value, onchange, accent = false }: Props = $props();

	function increment() {
		onchange(value + 1);
	}

	function decrement() {
		if (value > 0) {
			onchange(value - 1);
		}
	}
</script>

<div class="flex flex-col items-center gap-2">
	<span class="text-xs font-medium tracking-widest uppercase text-text-secondary">{label}</span>
	<div class="flex items-center gap-1">
		<button 
			class="flex items-center justify-center w-11 h-11 transition-all duration-150 border-2 cursor-pointer bg-bg-tertiary border-bg-elevated text-text-secondary rounded-md hover:enabled:bg-bg-elevated hover:enabled:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed" 
			onclick={decrement} 
			disabled={value === 0} 
			aria-label="Decrease {label}"
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
		</button>
		<input
			type="number"
			min="0"
			{value}
			aria-label={label}
			class="w-[60px] h-11 text-center p-0 border-2 bg-bg-primary border-bg-tertiary font-display text-2xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
			oninput={(e) => onchange(Math.max(0, parseInt(e.currentTarget.value) || 0))}
		/>
		<button 
			class="flex items-center justify-center w-11 h-11 transition-all duration-150 border-2 cursor-pointer text-white rounded-md hover:opacity-90"
			class:bg-primary={!accent}
			class:border-primary-dark={!accent}
			class:bg-secondary={accent}
			class:border-secondary-dark={accent}
			onclick={increment} 
			aria-label="Increase {label}"
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
		</button>
	</div>
</div>
