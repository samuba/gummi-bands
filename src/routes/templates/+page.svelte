<script lang="ts">
	import { fade, slide } from 'svelte/transition';
	import Header from '$lib/components/Header.svelte';
	import { editTemplateDialog } from '$lib/components/EditTemplateDialog.svelte';
	import * as workout from '$lib/stores/workout.svelte';
	import type { TemplateWithExercises } from '$lib/stores/workout.svelte';
	import { flip } from 'svelte/animate';

	let workoutState = workout.getState();

	// Form state for adding templates
	let newTemplateName = $state('');

	async function handleAddTemplate() {
		if (!newTemplateName.trim()) return;
		await workout.addTemplate(newTemplateName.trim());
		newTemplateName = '';
	}

	async function handleEditTemplate(template: TemplateWithExercises) {
		const result = await editTemplateDialog.open({
			id: template.id,
			name: template.name,
			exercises: template.exercises
		});

		if (result) {
			if (result.action === 'delete') {
				await workout.deleteTemplate(template.id);
			} else {
				await workout.updateTemplate(
					template.id,
					result.name,
					result.exercises.map((e) => e.id)
				);
			}
		}
	}
</script>

<div class="flex flex-col gap-6 animate-fade-in">
	<Header title="Templates" showBack />

	<div class="card flex flex-col gap-4">
		<h3 class="text-base font-medium text-text-secondary">Create New Template</h3>
		<div class="flex flex-col gap-1">
			<label class="text-xs tracking-wide text-text-muted uppercase" for="name">
				Template Name
			</label>
			<input
				id="name"
				type="text"
				placeholder="e.g., Full Body Workout"
				bind:value={newTemplateName}
			/>
		</div>
		<button class="btn-primary" onclick={handleAddTemplate} disabled={!newTemplateName.trim()}>
			Create Template
		</button>
	</div>

	<div class="flex flex-col gap-2">
		{#if workoutState.templates.length === 0}
			<div class="text-center py-8 text-text-muted">
				<p>No templates yet. Create your first one!</p>
			</div>
		{:else}
			{#each workoutState.templates as template (template.id)}
				<button
					class="flex items-center gap-4 rounded-md border border-bg-tertiary bg-bg-secondary p-4 text-left transition-colors hover:bg-bg-tertiary active:bg-bg-elevated cursor-pointer w-full"
					in:slide={{ duration: 150 }}
					out:fade={{ duration: 150, delay: 150 }}
					animate:flip={{ duration: 250, delay: 150 }}
					onclick={() => handleEditTemplate(template)}
				>
					<div class="flex flex-1 flex-col gap-0.5">
						<span class="text-sm text-text-primary">{template.name}</span>
						<span class="text-xs text-text-muted">
							{template.exercises.length}
							{template.exercises.length === 1 ? 'exercise' : 'exercises'}
						</span>
					</div>
					<i class="icon-[ph--caret-right] size-5 text-text-muted"></i>
				</button>
			{/each}
		{/if}
	</div>
</div>
