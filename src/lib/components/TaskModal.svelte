<script lang="ts">
	// Props (inputs to the modal)
	export let open = false; // Should modal be visible?
	export let onSave: (task: any, createAnother: boolean) => void; // When Save is clicked
	export let onCancel: () => void; // When Cancel is clicked

	import { onMount } from 'svelte';
	let titleInput: HTMLInputElement | null = null;
	onMount(() => {
		if (open && titleInput) titleInput.focus();
	});

	// Fields for the form
	let title = '';
	let description = '';
	let status = 'open';
	let dueDate: string | null = null;
	let assignedTo = '';
	let saving = false;
	let createAnother = false;

	// Field validation
	$: isValid = title.trim().length > 0;

	// Reset the form (helper)
	function resetForm(preserve: Partial<typeof $$props> = {}) {
		title = '';
		description = '';
		status = preserve.status ?? 'open';
		dueDate = null;
		assignedTo = preserve.assignedTo ?? '';
		createAnother = false;
	}
</script>

{#if open}
	<div
		class="modal-backdrop"
		tabindex="0"
		role="button"
		aria-label="Close modal"
		on:click={onCancel}
		on:keydown={(e) => {
			if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') onCancel();
		}}
	></div>

	<div class="modal" role="dialog" aria-modal="true" tabindex="0">
		<form
			on:submit|preventDefault={() => {
				if (!isValid) return;
				saving = true;
				onSave(
					{
						title,
						description,
						status,
						due_date: dueDate,
						assigned_to: assignedTo
					},
					createAnother
				);
				saving = false;
			}}
		>
			<h2>Add Task</h2>
			<label>
				Title* <input type="text" bind:value={title} required bind:this={titleInput} />
			</label>
			<label>
				Description <input type="text" bind:value={description} />
			</label>
			<label>
				Status
				<select bind:value={status}>
					<option value="open">Open</option>
					<option value="in_progress">In Progress</option>
					<option value="done">Done</option>
				</select>
			</label>
			<label>
				Due date <input type="date" bind:value={dueDate} />
			</label>
			<label>
				Assign to <input type="text" bind:value={assignedTo} />
				<!-- Replace with dropdown in next steps -->
			</label>
			<div class="modal-actions">
				<button type="button" on:click={onCancel}>Cancel</button>
				<button type="submit" disabled={!isValid || saving}>Save</button>
				<button type="submit" disabled={!isValid || saving} on:click={() => (createAnother = true)}>
					Create Another Task
				</button>
			</div>
		</form>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.23);
		z-index: 1001;
	}
	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: #fff;
		border-radius: 1.1em;
		padding: 2em;
		box-shadow: 0 8px 44px #0002;
		z-index: 1002;
		min-width: 340px;
		max-width: 94vw;
	}
	.modal-actions {
		display: flex;
		gap: 1em;
		margin-top: 1.4em;
	}
	label {
		display: block;
		margin: 1em 0 0.4em;
	}
</style>
