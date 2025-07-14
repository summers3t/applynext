<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { session } from '$lib/session';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';

	// --- Types ---
	type Project = {
		id: string;
		name: string;
		description: string | null;
		deadline: string | null;
		role: string;
		project_id?: string; // optional, for reference
	};

	type ProjectRow = {
		role: string;
		project_id: string;
		projects: { id: string; name: string; description: string | null; deadline: string | null }[];
	};

	let projects: Project[] = [];
	let loading = false;
	let error = '';
	let showCreateForm = false;
	let newProjectName = '';
	let newProjectDesc = '';
	let newProjectDeadline: string | null = null;
	let creating = false;
	let sessionValue = get(session);

	// Subscribe to session
	session.subscribe((s) => {
		sessionValue = s;
		if (sessionValue?.user?.id) {
			loadProjects();
		}
	});

	// --- Load projects for user (by user_id or invited_email) ---
	async function loadProjects() {
		if (!sessionValue) {
			projects = [];
			return;
		}
		loading = true;
		error = '';

		const { data, error: err } = await supabase
			.from('project_users')
			.select('role, projects(id, name, description, deadline)')
			.eq('user_id', sessionValue.user.id);

		if (err) {
			error = err.message;
			loading = false;
			return;
		}

		console.log('Project Users Result:', data);

		projects = ((data as ProjectRow[]) ?? [])
			.map((row) => {
				const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
				return project && { ...project, role: row.role };
			})
			.filter(Boolean) as Project[];

		console.log('Projects found:', projects);
		loading = false;
	}

	// --- Create new project
	async function createProject() {
		if (!newProjectName.trim() || !sessionValue?.user?.id) return;
		creating = true;
		error = '';
		const { data, error: err } = await supabase
			.from('projects')
			.insert([
				{
					name: newProjectName.trim(),
					description: newProjectDesc.trim() || null,
					created_by: sessionValue.user.id,
					deadline: newProjectDeadline
				}
			])
			.select();
		if (err || !data || !data[0]) {
			error = err?.message ?? 'Could not create project';
			creating = false;
			return;
		}
		const project = data[0];
		const { error: err2 } = await supabase.from('project_users').insert([
			{
				project_id: project.id,
				user_id: sessionValue.user.id,
				role: 'admin'
			}
		]);
		if (err2) {
			error = err2.message;
			creating = false;
			return;
		} else {
			console.log('Inserted project_user:', {
				project_id: project.id,
				user_id: sessionValue.user.id,
				role: 'admin'
			});
		}

		showCreateForm = false;
		newProjectName = '';
		newProjectDesc = '';
		newProjectDeadline = null;
		await loadProjects();
		goto(`/projects/${project.id}`);
	}

	function formatDate(date: string | null): string {
		if (!date) return '';
		const parts = date.split('-');
		if (parts.length !== 3) return date;
		return `${parts[2]}.${parts[1]}.${parts[0]}`;
	}

	// Initial load (covers page reload)
	onMount(() => {
		if (sessionValue?.user?.id) {
			loadProjects();
		}
	});

	session.subscribe((s) => {
		sessionValue = s;
		if (sessionValue?.user?.id) {
			loadProjects();
		}
	});
</script>

<div class="project-list-container">
	<div class="header-row">
		<h1>ApplyNext Projects</h1>
		<button class="create-btn" on:click={() => (showCreateForm = !showCreateForm)}>
			{showCreateForm ? 'Cancel' : 'Create Project'}
		</button>
	</div>

	{#if showCreateForm}
		<form class="create-form" on:submit|preventDefault={createProject}>
			<div>
				<label for="proj-name">Project Name</label>
				<input id="proj-name" type="text" bind:value={newProjectName} required maxlength="80" />
			</div>
			<div>
				<label for="proj-desc">Description (optional)</label>
				<textarea id="proj-desc" bind:value={newProjectDesc} maxlength="200" rows="2"></textarea>
			</div>
			<div>
				<label for="proj-deadline">Deadline (optional)</label>
				<input id="proj-deadline" type="date" bind:value={newProjectDeadline} />
			</div>
			<div>
				<button type="submit" class="create-btn" disabled={creating || !newProjectName.trim()}>
					{creating ? 'Creating…' : 'Create'}
				</button>
			</div>
			{#if error}<div style="color:#c00;">{error}</div>{/if}
		</form>
	{/if}

	{#if loading}
		<p>Loading projects…</p>
	{:else if projects.length === 0}
		<p>You have no projects yet. Create one to get started!</p>
	{:else}
		<div>
			{#each projects as p}
				<div class="project-row" on:click={() => goto(`/projects/${p.id}`)}>
					<span style="min-width:13em;"><b>Project:</b> {p.name}</span>
					<span>{p.description}</span>
					<span class="deadline">{p.deadline ? formatDate(p.deadline) : ''}</span>
					<span class="role-badge">{p.role[0].toUpperCase() + p.role.slice(1)}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.project-list-container {
		max-width: 700px;
		margin: 2em auto;
		background: #fff;
		border-radius: 1em;
		box-shadow: 0 2px 20px #0001;
		padding: 2em 2em 1em 2em;
	}
	.header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5em;
	}
	.project-row {
		display: flex;
		align-items: center;
		border-bottom: 1px solid #f0f0f0;
		padding: 1em 0.5em;
		cursor: pointer;
		transition: background 0.12s;
		gap: 1.5em;
	}
	.project-row:hover {
		background: #eaf5ff;
	}
	.role-badge {
		font-size: 0.95em;
		font-weight: 600;
		background: #1976d2;
		color: #fff;
		padding: 0.2em 0.85em;
		border-radius: 1em;
		margin-left: auto;
	}
	.deadline {
		color: #888;
		font-size: 0.97em;
		margin-left: 1em;
		min-width: 8em;
		text-align: right;
	}
	.create-btn {
		padding: 0.55em 2em;
		background: #2a8cff;
		color: #fff;
		border: none;
		border-radius: 1.5em;
		font-size: 1.09em;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 1px 8px #1976d222;
		transition: background 0.14s;
	}
	.create-btn:hover {
		background: #0c57b3;
	}
	.create-form {
		margin: 2em 0 0.7em 0;
		padding: 1.5em;
		background: #f7faff;
		border-radius: 1em;
		box-shadow: 0 1px 8px #1976d211;
		display: flex;
		flex-direction: column;
		gap: 1.3em;
	}
	.create-form input,
	.create-form textarea {
		font-size: 1em;
		padding: 0.7em;
		border-radius: 0.6em;
		border: 1px solid #bbb;
		background: #fff;
		width: 100%;
	}
	.create-form label {
		font-weight: 600;
		margin-bottom: 0.2em;
	}
</style>
