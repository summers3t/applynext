<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { session } from '$lib/session';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	// ========== Project Info & Members ==========
	type Member = {
		user_id: string | null;
		email: string;
		role: string;
		status: string;
		invited_email?: string | null; // <-- ADD THIS
	};
	type Project = {
		id: string;
		name: string;
		description: string | null;
		deadline: string | null;
		created_by: string; // <-- ADD THIS LINE
		// ...any other fields you have
	};

	type MemberRow = {
		user_id: string;
		role: string;
		status?: string;
		invited_email?: string;
		users?: { email: string }[];
	};

	let projectId = '';
	$: projectId = $page.params.projectId;

	let project: Project | null = null;
	let members: Member[] = [];
	let myRole = '';
	let loadingProject = false;
	let errorProject = '';

	let sessionValue = get(session);

	let activeTab: "members" | "edit" = "members"; // default tab is Members
	let isCreator = false; // Will be set after loading project

	// ----- Edit Project state -----
	let editProjectName = '';
	let editProjectDesc = '';
	let editProjectDeadline: string | null = null;
	let updatingProject = false;
	let projectUpdateError = '';
	let projectUpdateSuccess = false;
	let showMembersPanel = false;
	let showEditProjectPanel = false;

	$: isCreator =
		!!project && !!sessionValue?.user?.id && project.created_by === sessionValue.user.id;

	$: if (project && activeTab === 'edit') {
		editProjectName = project.name;
		editProjectDesc = project.description || '';
		editProjectDeadline = project.deadline || null;
	}

	// --- Invite Member UI/Logic ---
	let inviteEmail = '';
	let inviteRole = 'editor';
	let inviting = false;
	let inviteError = '';
	let inviteSuccess = '';

	// --- Role Update/Remove ---
	let updatingRoleUserId = '';
	let updateRoleError = '';
	let removingUserId = '';
	let removeError = '';

	// --- Delete project ---
	let deletingProject = false;
	let deleteError = '';

	// ========== Tasks & Subtasks (Project Scoped) ==========
	type Status = 'open' | 'in_progress' | 'done';
	const statusColors: Record<Status, string> = {
		open: '#fff',
		in_progress: '#1976d2',
		done: '#43a047'
	};
	const overdueColor = '#e74c3c';

	type Subtask = {
		id: string;
		task_id: string;
		project_id: string;
		content: string;
		status: Status;
		due_date: string | null;
		sort_index: number;
		created_at: string;
		updated_at: string;
	};

	type Task = {
		id: string;
		project_id: string;
		title: string;
		description: string;
		status: Status;
		due_date: string | null;
		sort_index: number;
		created_at: string;
		updated_at: string;
		created_by_email?: string;
		subtasks: Subtask[];
	};

	let tasks: Task[] = [];
	let loadingTasks = false;
	let errorTasks = '';

	// Task form states
	let newTitle = '';
	let newDescription = '';
	let newStatus: Status = 'open';
	let newDueDate: string | null = null;
	let creating = false;
	let insertingAtIndex: number | null = null;

	let selected: { type: 'task' | 'subtask'; id: string; parentTaskId?: string } | null = null;
	let editingTaskId: string | null = null;
	let editTitle = '';
	let editDescription = '';
	let editStatus: Status = 'open';
	let editDueDate: string | null = null;
	let savingEdit = false;

	// Subtask
	let insertingSubtaskAt: { taskId: string; index: number } | null = null;
	let newSubtaskContent = '';
	let newSubtaskStatus: Status = 'open';
	let newSubtaskDueDate: string | null = null;
	let creatingSubtask = false;
	let editingSubtaskId: string | null = null;
	let editSubtaskContent = '';
	let editSubtaskStatus: Status = 'open';
	let editSubtaskDueDate: string | null = null;
	let savingSubtaskEdit = false;

	// Expanded/collapsed
	let expandedTasks: Set<string> = new Set();

	// ---- Helpers ----
	function closePanels() {
		showMembersPanel = false;
		showEditProjectPanel = false;
	}

	function formatDate(dateStr: string | null | undefined): string {
		if (!dateStr) return '';
		const parts = dateStr.slice(0, 10).split('-');
		if (parts.length !== 3) return dateStr;
		return `${parts[2]}.${parts[1]}.${parts[0]}`;
	}
	function isOverdue(due_date: string | null, status: Status): boolean {
		if (!due_date || status === 'done') return false;
		const today = new Date();
		const d = new Date(due_date);
		return d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
	}
	function statusDotColor(status: Status, overdue: boolean): string {
		if (overdue) return overdueColor;
		return statusColors[status];
	}

	function getInitials(email: string | null | undefined): string {
		if (!email) return '—';
		const match = email.match(/^([a-zA-Z])[a-zA-Z.]*[._]?([a-zA-Z])?/i);
		if (match) {
			const first = email[0].toUpperCase();
			// Try to find the first letter after "." or before "@" (e.g., "brambashki" in your email)
			const afterDot = email.match(/\.?([a-zA-Z])[a-zA-Z]*@/);
			const second = afterDot && afterDot[1] ? afterDot[1].toUpperCase() : '';
			return (first + second).slice(0, 2);
		}
		return email[0].toUpperCase();
	}

	async function updateProject() {
		projectUpdateError = '';
		projectUpdateSuccess = false;
		updatingProject = true;
		const { error } = await supabase
			.from('projects')
			.update({
				name: editProjectName.trim(),
				description: editProjectDesc.trim(),
				deadline: editProjectDeadline
			})
			.eq('id', projectId);
		updatingProject = false;
		if (error) {
			projectUpdateError = error.message;
			return;
		}
		// Re-load latest data
		await loadProject();
		projectUpdateSuccess = true;
	}

	async function fetchEmailsForUserIds(userIds: string[]) {
		if (!userIds.length) return {};
		const { data, error } = await supabase
			.from('auth.users') // may need to use the admin API if using Supabase self-hosted, or use a Postgres view
			.select('id, email')
			.in('id', userIds);
		if (error) {
			console.error('Failed to fetch user emails:', error);
			return {};
		}
		// Build a map: { userId: email }
		return (data || []).reduce(
			(map, row) => {
				map[row.id] = row.email;
				return map;
			},
			{} as Record<string, string>
		);
	}

	// ---- Project & Members ----
	async function loadProject() {
		if (!projectId || projectId.length < 10) {
			// Prevent empty/invalid queries!
			project = null;
			members = [];
			loadingProject = false;
			return;
		}

		loadingProject = true;
		errorProject = '';
		// Project info
		const { data: projectData, error: err1 } = await supabase
			.from('projects')
			.select('id, name, description, deadline, created_by')
			.eq('id', projectId)
			.single();
		if (err1 || !projectData) {
			errorProject = 'Project not found';
			loadingProject = false;
			return;
		}
		project = projectData;
		isCreator =
			!!project && !!sessionValue?.user?.id && project.created_by === sessionValue.user.id;

		// Members

		const { data: memberRows, error: err2 } = await supabase
			.from('project_users')
			.select('user_id, role, status, invited_email')
			.eq('project_id', projectId);

		console.log('Member rows from Supabase:', memberRows);

		if (err2) {
			errorProject = err2.message;
			members = [];
			loadingProject = false;
			return;
		}

		const userIds = (memberRows ?? []).filter((r) => r.user_id).map((r) => r.user_id);

		let userEmailMap: Record<string, string> = {};
		if (userIds.length > 0) {
			const { data: emailRows } = await supabase
				.from('user_emails')
				.select('id, email')
				.in('id', userIds);
			userEmailMap = (emailRows ?? []).reduce(
				(map, row) => {
					map[row.id] = row.email;
					return map;
				},
				{} as Record<string, string>
			);
		}

		members = (memberRows ?? []).map((row: MemberRow) => {
			let email = row.invited_email || (row.user_id && userEmailMap[row.user_id]) || 'Unknown';
			// For self, always show your own email (cleaner experience)
			if (row.user_id && sessionValue?.user?.id === row.user_id) {
				email = sessionValue?.user?.email ?? 'Unknown';
			}
			return {
				user_id: row.user_id,
				email,
				role: row.role,
				status: row.status ?? (row.invited_email ? 'Invited' : 'Active'),
				invited_email: row.invited_email
			};
		});
		// Set my role
		const me = members.find((m) => m.user_id === sessionValue?.user.id);
		myRole = me?.role ?? '';
		loadingProject = false;
	}

	// --- Invite/Change/Remove ---
	async function inviteMember() {
		inviteError = '';
		inviteSuccess = '';
		if (!inviteEmail.trim() || !projectId) return;
		inviting = true;
		if (!inviteEmail.includes('@')) {
			inviteError = 'Please enter a valid email.';
			inviting = false;
			return;
		}
		const { error: err } = await supabase.from('project_users').insert([
			{
				project_id: projectId,
				user_id: null,
				invited_email: inviteEmail.trim().toLowerCase(),
				role: inviteRole,
				status: 'invited'
			}
		]);
		if (err) {
			inviteError = err.message || 'Error inviting user';
			inviting = false;
			return;
		}
		inviteSuccess = 'Invitation sent!';
		inviteEmail = '';
		inviteRole = 'editor';
		inviting = false;
		await loadProject();
	}
	async function updateMemberRole(
		userId: string | undefined,
		newRole: string,
		invitedEmail?: string
	) {
		// Only admins can do this (already handled in UI)
		if (!projectId || (!userId && !invitedEmail)) return;
		updatingRoleUserId = userId || invitedEmail || '';
		let match;
		if (userId) {
			match = { project_id: projectId, user_id: userId };
		} else if (invitedEmail) {
			match = { project_id: projectId, invited_email: invitedEmail };
		} else {
			return;
		}
		const { error } = await supabase.from('project_users').update({ role: newRole }).match(match);
		updatingRoleUserId = '';
		if (error) {
			updateRoleError = error.message;
		} else {
			await loadProject();
		}
	}
	async function removeMember(userId: string | undefined, invitedEmail?: string) {
		if (!confirm('Are you sure you want to remove this member?')) return;
		removeError = '';
		removingUserId = userId || invitedEmail || '';
		let match;
		if (userId) {
			match = { project_id: projectId, user_id: userId };
		} else if (invitedEmail) {
			match = { project_id: projectId, invited_email: invitedEmail };
		} else {
			return;
		}
		const { error } = await supabase.from('project_users').delete().match(match);
		removingUserId = '';
		if (error) {
			removeError = error.message;
		} else {
			await loadProject();
		}
	}

	async function handleDeleteProject() {
		if (!projectId || !myRole || myRole !== 'admin') return;
		if (!confirm('Are you sure you want to DELETE this project? This cannot be undone.')) return;

		deletingProject = true;
		deleteError = '';

		// 1. Delete from projects table (will also remove from project_users via FK CASCADE if set)
		const { error } = await supabase.from('projects').delete().eq('id', projectId);

		deletingProject = false;
		if (error) {
			deleteError = 'Error deleting project: ' + error.message;
			return;
		}

		// 2. Redirect to /projects
		goto('/projects');
	}

	// ---- Tasks ----
	async function fetchTasks() {
		if (!projectId || projectId.length < 10 || !sessionValue) {
			tasks = [];
			loadingTasks = false;
			return;
		}

		loadingTasks = true;
		errorTasks = '';
		if (!sessionValue) {
			tasks = [];
			loadingTasks = false;
			return;
		}
		// Admin sees all, others see tasks for this project only
		const { data, error: err } = await supabase
			.from('tasks')
			.select('*, subtasks(*)')
			.eq('project_id', projectId)
			.order('sort_index', { ascending: true });

		if (err) {
			errorTasks = err.message;
			tasks = [];
			loadingTasks = false;
			return;
		}
		tasks = (data ?? []).map((t) => {
			const subtasks = Array.isArray(t.subtasks)
				? t.subtasks.map((st: Subtask) => ({ ...st, sort_index: st.sort_index ?? 0 }))
				: [];
			return {
				...t,
				subtasks: subtasks.sort((a: Subtask, b: Subtask) => a.sort_index - b.sort_index)
			};
		});
		loadingTasks = false;
		selected = null;
		insertingAtIndex = null;
		editingTaskId = null;
		insertingSubtaskAt = null;
		editingSubtaskId = null;
		// Keep expanded state for still-present tasks
		expandedTasks = new Set(
			[...expandedTasks].filter((id) => tasks.some((t) => t.id === id && t.subtasks.length > 0))
		);
	}

	// ---- Reindex helpers ----
	async function reindexTasks(newOrder: Task[]) {
		await Promise.all(
			newOrder.map((task, idx) =>
				supabase.from('tasks').update({ sort_index: idx }).eq('id', task.id)
			)
		);
		await fetchTasks();
	}

	async function reindexSubtasks(taskId: string, newOrder: Subtask[]) {
		await Promise.all(
			newOrder.map((st, idx) =>
				supabase.from('subtasks').update({ sort_index: idx }).eq('id', st.id)
			)
		);
		await fetchTasks();
	}

	// ---- Task CRUD (permission checks) ----
	function canEditTasks() {
		return myRole === 'admin' || myRole === 'editor';
	}
	async function createTask(atIndex: number | null = null) {
		if (!canEditTasks() || !newTitle.trim() || !sessionValue) return;
		creating = true;
		let sort_index = tasks.length;
		const taskData = {
			project_id: projectId,
			title: newTitle.trim(),
			description: newDescription.trim(),
			status: newStatus,
			due_date: newDueDate,
			sort_index,
			owner_id: sessionValue.user.id, // <-- ESSENTIAL
			created_by_email: sessionValue.user.email // <-- NEW LINE (add this!)
		};

		if (atIndex !== null) {
			sort_index = atIndex + 1;
			const before = tasks.slice(0, sort_index);
			const after = tasks.slice(sort_index);
			const { data, error: err } = await supabase
				.from('tasks')
				.insert([{ ...taskData, sort_index }])
				.select('*, subtasks(*)');
			creating = false;
			if (err || !data || !data[0]) {
				alert('Error creating task: ' + (err?.message ?? 'unknown'));
				await fetchTasks();
				return;
			}
			const inserted = data[0];
			const newTasks = [...before, inserted, ...after];
			await reindexTasks(newTasks);
		} else {
			const { data, error: err } = await supabase
				.from('tasks')
				.insert([taskData])
				.select('*, subtasks(*)');
			creating = false;
			if (err || !data || !data[0]) {
				alert('Error creating task: ' + (err?.message ?? 'unknown'));
				await fetchTasks();
				return;
			}
			await fetchTasks();
		}
		newTitle = '';
		newDescription = '';
		newStatus = 'open';
		newDueDate = null;
		insertingAtIndex = null;
	}

	function showInsertFormAt(idx: number) {
		insertingAtIndex = idx;
		newTitle = '';
		newDescription = '';
		newStatus = 'open';
		newDueDate = null;
		editingTaskId = null;
		editingSubtaskId = null;
		insertingSubtaskAt = null;
	}

	async function moveSelectedTask(offset: number) {
		if (!canEditTasks() || !selected || selected.type !== 'task') return;
		const idx = tasks.findIndex((t) => t.id === selected?.id);
		if (idx === -1) return;
		const swapWith = idx + offset;
		if (swapWith < 0 || swapWith >= tasks.length) return;
		const newOrder = [...tasks];
		const [moved] = newOrder.splice(idx, 1);
		newOrder.splice(swapWith, 0, moved);
		await reindexTasks(newOrder);
		selected = { type: 'task', id: moved.id };
	}

	async function deleteSelected() {
		if (!canEditTasks()) return;
		if (!selected) return;

		const sel = selected!; // TypeScript: sel is NOT null after this

		if (sel.type === 'task') {
			await supabase.from('tasks').delete().eq('id', sel.id).eq('project_id', projectId);
			const newTasks = tasks.filter((t) => t.id !== sel.id);
			await reindexTasks(newTasks);
			selected = null;
		} else if (sel.type === 'subtask' && sel.parentTaskId) {
			const task = tasks.find((t) => t.id === sel.parentTaskId);
			if (!task) return;
			await supabase
				.from('subtasks')
				.delete()
				.eq('id', sel.id)
				.eq('task_id', task.id)
				.eq('project_id', projectId);
			const newSubtasks = task.subtasks.filter((st) => st.id !== sel.id);
			await reindexSubtasks(task.id, newSubtasks);
			selected = null;
		}
	}

	function selectTask(taskId: string) {
		selected = { type: 'task', id: taskId };
		insertingAtIndex = null;
		editingTaskId = null;
		insertingSubtaskAt = null;
		editingSubtaskId = null;
	}
	function selectSubtask(subtaskId: string, taskId: string) {
		selected = { type: 'subtask', id: subtaskId, parentTaskId: taskId };
		insertingAtIndex = null;
		editingTaskId = null;
		insertingSubtaskAt = null;
		editingSubtaskId = null;
	}

	// ---- Inline Edit ----
	function startEdit() {
		if (!canEditTasks() || !selected) return;

		const sel = selected!; // TypeScript: guaranteed not null below

		if (sel.type === 'task') {
			const task = tasks.find((t) => t.id === sel.id);
			if (!task) return;
			editingTaskId = task.id;
			editTitle = task.title;
			editDescription = task.description ?? '';
			editStatus = task.status;
			editDueDate = task.due_date;
			insertingAtIndex = null;
			insertingSubtaskAt = null;
			editingSubtaskId = null;
		} else if (sel.type === 'subtask' && sel.parentTaskId) {
			const task = tasks.find((t) => t.id === sel.parentTaskId);
			const subtask = task?.subtasks.find((st) => st.id === sel.id);
			if (!subtask) return;
			editingSubtaskId = subtask.id;
			editSubtaskContent = subtask.content;
			editSubtaskStatus = subtask.status;
			editSubtaskDueDate = subtask.due_date;
			insertingAtIndex = null;
			insertingSubtaskAt = null;
			editingTaskId = null;
		}
	}

	function cancelEdit() {
		editingTaskId = null;
		editTitle = '';
		editDescription = '';
		editDueDate = null;
		editStatus = 'open';
		editingSubtaskId = null;
		editSubtaskContent = '';
		editSubtaskDueDate = null;
		editSubtaskStatus = 'open';
	}
	async function saveEditTask() {
		if (!canEditTasks() || !editingTaskId || !editTitle.trim() || !sessionValue) return;
		savingEdit = true;
		const { error: err } = await supabase
			.from('tasks')
			.update({
				title: editTitle.trim(),
				description: editDescription.trim(),
				status: editStatus,
				due_date: editDueDate
			})
			.eq('id', editingTaskId)
			.eq('project_id', projectId);
		savingEdit = false;
		if (err) {
			alert('Error saving task: ' + err.message);
		}
		await fetchTasks();
		editingTaskId = null;
	}

	// ---- Subtask CRUD/ordering ----
	function showInsertSubtaskForm(taskId: string, idx: number) {
		if (!canEditTasks()) return;
		insertingSubtaskAt = { taskId, index: idx };
		newSubtaskContent = '';
		newSubtaskStatus = 'open';
		newSubtaskDueDate = null;
		editingTaskId = null;
		editingSubtaskId = null;
		insertingAtIndex = null;
		// Expand the task
		expandedTasks = new Set([...expandedTasks, taskId]);
	}
	async function createSubtask(taskId: string, atIndex: number | null = null) {
		if (!canEditTasks() || !newSubtaskContent.trim() || !sessionValue) return;
		creatingSubtask = true;
		const task = tasks.find((t) => t.id === taskId);
		if (!task) return;
		let sort_index = task.subtasks.length;
		if (atIndex !== null) {
			sort_index = atIndex + 1;

			console.log('Creating subtask (insert at index), owner_id:', sessionValue?.user?.id);

			const before = task.subtasks.slice(0, sort_index);
			const after = task.subtasks.slice(sort_index);

			const { data, error: err } = await supabase
				.from('subtasks')
				.insert([
					{
						project_id: projectId,
						task_id: taskId,
						content: newSubtaskContent.trim(),
						status: newSubtaskStatus,
						due_date: newSubtaskDueDate,
						sort_index,
						owner_id: sessionValue.user.id
					}
				])
				.select();
			creatingSubtask = false;
			if (err || !data || !data[0]) {
				alert('Error creating subtask: ' + (err?.message ?? 'unknown'));
				await fetchTasks();
				return;
			}
			const inserted = data[0];
			const newSubtasks = [...before, inserted, ...after];
			await reindexSubtasks(taskId, newSubtasks);
		} else {
			const { data, error: err } = await supabase
				.from('subtasks')
				.insert([
					{
						project_id: projectId,
						task_id: taskId,
						content: newSubtaskContent.trim(),
						status: newSubtaskStatus,
						due_date: newSubtaskDueDate,
						sort_index,
						owner_id: sessionValue.user.id // <-- THIS LINE IS NEEDED
					}
				])
				.select();
			creatingSubtask = false;
			if (err || !data || !data[0]) {
				alert('Error creating subtask: ' + (err?.message ?? 'unknown'));
				await fetchTasks();
				return;
			}
			await fetchTasks();
		}
		newSubtaskContent = '';
		newSubtaskStatus = 'open';
		newSubtaskDueDate = null;
		insertingSubtaskAt = null;
	}
	async function moveSelectedSubtask(offset: number) {
		if (!canEditTasks() || !selected || selected.type !== 'subtask' || !selected.parentTaskId)
			return;

		const sel = selected!; // TypeScript: guaranteed non-null after the guard above

		const task = tasks.find((t) => t.id === sel.parentTaskId);
		if (!task) return;
		const idx = task.subtasks.findIndex((st) => st.id === sel.id);
		if (idx === -1) return;
		const swapWith = idx + offset;
		if (swapWith < 0 || swapWith >= task.subtasks.length) return;
		const newOrder = [...task.subtasks];
		const [moved] = newOrder.splice(idx, 1);
		newOrder.splice(swapWith, 0, moved);
		await reindexSubtasks(task.id, newOrder);
		selected = { type: 'subtask', id: moved.id, parentTaskId: task.id };
	}

	async function saveEditSubtask() {
		if (!canEditTasks() || !editingSubtaskId || !editSubtaskContent.trim() || !sessionValue) return;
		savingSubtaskEdit = true;
		const { error: err } = await supabase
			.from('subtasks')
			.update({
				content: editSubtaskContent.trim(),
				status: editSubtaskStatus,
				due_date: editSubtaskDueDate
			})
			.eq('id', editingSubtaskId)
			.eq('project_id', projectId);
		savingSubtaskEdit = false;
		if (err) {
			alert('Error saving subtask: ' + err.message);
		}
		await fetchTasks();
		editingSubtaskId = null;
	}

	// ---- Expand/collapse logic ----
	function toggleExpand(taskId: string) {
		if (expandedTasks.has(taskId)) {
			expandedTasks = new Set([...expandedTasks].filter((id) => id !== taskId));
		} else {
			expandedTasks = new Set([...expandedTasks, taskId]);
		}
	}

	// ---- Effect: Load everything on mount or session/project change ----
	onMount(() => {
		if (projectId && projectId.length >= 10) {
			loadProject();
			fetchTasks();
		}
	});
	session.subscribe((s) => {
		sessionValue = s;
		if (projectId && projectId.length >= 10) {
			loadProject();
			fetchTasks();
		}
	});

	function handleInsertClick() {
		if (!selected) return;

		const sel = selected!; // This assures TypeScript: sel is not null

		if (sel.type === 'task') {
			const idx = tasks.findIndex((t) => t.id === sel.id);
			showInsertFormAt(idx);
		} else if (sel.type === 'subtask' && sel.parentTaskId) {
			const parentTask = tasks.find((t) => t.id === sel.parentTaskId);
			const stIdx = parentTask?.subtasks.findIndex((st) => st.id === sel.id) ?? -1;
			showInsertSubtaskForm(sel.parentTaskId, stIdx);
		}
	}

	function handleAddSubtaskClick() {
		if (!selected || selected.type !== 'task') return;

		const sel = selected!; // TypeScript: safe
		const parentTask = tasks.find((t) => t.id === sel.id);
		const stIdx = parentTask ? parentTask.subtasks.length - 1 : -1;

		showInsertSubtaskForm(sel.id, stIdx);
	}

	function handleMoveUpClick() {
		if (!selected) return;
		const sel = selected!;

		if (sel.type === 'task') {
			moveSelectedTask(-1);
		} else if (sel.type === 'subtask') {
			moveSelectedSubtask(-1);
		}
	}
</script>

<div class="project-detail-container">
	{#if loadingProject}
		<p>Loading project...</p>
	{:else if errorProject}
		<p style="color:red;">{errorProject}</p>
	{:else if project}
		<!-- Project Top Navigation Buttons -->
		<div
			class="project-header-buttons"
			style="display:flex; align-items:center; gap:1em; margin-bottom:1.5em;"
		>
			<div class="project-toolbar">
				<button class="nav-btn" on:click={() => goto('/projects')}>← All Projects</button>

				<button
					class:active-tab={showMembersPanel}
					class="toolbar-btn"
					on:click={() => {
						showMembersPanel = !showMembersPanel;
						showEditProjectPanel = false;
					}}
				>
					👥 Members
				</button>

				{#if isCreator}
					<button
						class:active-tab={showEditProjectPanel}
						class="toolbar-btn"
						on:click={() => {
							showEditProjectPanel = !showEditProjectPanel;
							showMembersPanel = false;
							if (showEditProjectPanel && project) {
								// Prefill form fields with current project values
								editProjectName = project.name;
								editProjectDesc = project.description ?? '';
								editProjectDeadline = project.deadline ?? null;
							}
						}}
					>
						✏️ Edit Project
					</button>
				{/if}

				{#if myRole === 'admin' || isCreator}
					<button
						class="delete-project-btn"
						on:click={handleDeleteProject}
						disabled={deletingProject}
					>
						🗑️ Delete Project
					</button>
				{/if}
			</div>
			<!-- MEMBERS PANEL -->
			{#if showMembersPanel}
				<div class="panel-overlay" on:click={closePanels}></div>
				<div class="panel-drawer members-drawer" on:click|stopPropagation>
					<!-- MOVE your entire Members content here! -->
					<h3>Members</h3>
					{#if updateRoleError}
						<div style="color:#c00;">{updateRoleError}</div>
					{/if}
					{#if removeError}
						<div style="color:#c00;">{removeError}</div>
					{/if}
					<table>
						<thead>
							<tr>
								<th>Email</th>
								<th>Role</th>
								<th>Status</th>
								{#if myRole === 'admin'}
									<th>Remove</th>
								{/if}
							</tr>
						</thead>
						<tbody>
							{#each members as m}
								<tr>
									<td>
										{m.email}
									</td>
									<td>
										{#if myRole === 'admin' && m.user_id !== sessionValue?.user.id}
											<select
												bind:value={m.role}
												on:change={(e) =>
													updateMemberRole(
														m.user_id || '',
														(e.target as HTMLSelectElement).value,
														m.invited_email ? m.invited_email : undefined
													)}
												disabled={updatingRoleUserId === (m.user_id || m.invited_email)}
											>
												{#if isCreator}
													<option value="admin">Admin</option>
												{/if}
												<option value="editor">Editor</option>
												<option value="viewer">Viewer</option>
											</select>
										{:else}
											{m.role}
										{/if}
									</td>
									<td>
										{m.status}
									</td>
									{#if myRole === 'admin'}
										<td>
											{#if (m.user_id && m.user_id !== sessionValue?.user.id) || (!m.user_id && m.invited_email)}
												<button
													on:click={() =>
														removeMember(m.user_id || undefined, m.invited_email || undefined)}
													disabled={removingUserId === (m.user_id || m.invited_email)}
													style="color:#fff; background:#e74c3c; border:none; padding:0.3em 1.1em; border-radius:0.5em; cursor:pointer;"
												>
													{removingUserId === (m.user_id || m.invited_email)
														? 'Removing…'
														: 'Remove'}
												</button>
											{/if}
										</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
					{#if myRole === 'admin'}
						<div class="invite-container">
							<h4>Invite a member</h4>
							<form
								on:submit|preventDefault={inviteMember}
								style="display:flex; gap:0.7em; align-items:center;"
							>
								<input
									type="email"
									placeholder="Email"
									bind:value={inviteEmail}
									required
									style="min-width:17em;"
								/>
								<select bind:value={inviteRole}>
									{#if isCreator}
										<option value="admin">Admin</option>
									{/if}
									<option value="editor">Editor</option>
									<option value="viewer">Viewer</option>
								</select>

								{#if !isCreator}
									<div style="color:#888; font-size:0.98em; margin-bottom:0.5em;">
										Only the project creator can assign admin rights.
									</div>
								{/if}

								<button type="submit" disabled={inviting || !inviteEmail.trim()}>Invite</button>
							</form>
							{#if inviteError}<span style="color:#c00; margin-left:0.7em;">{inviteError}</span
								>{/if}
							{#if inviteSuccess}<span style="color:#080; margin-left:0.7em;">{inviteSuccess}</span
								>{/if}
						</div>
					{/if}
					<!-- ... (copy all your Members table, invite form, etc, here) ... -->
					<button on:click={closePanels} class="close-panel-btn">Close</button>
				</div>
			{/if}

			<!-- EDIT PROJECT PANEL (only creator can see) -->
			{#if showEditProjectPanel && isCreator}
				<div class="panel-overlay" on:click={closePanels}></div>
				<div class="panel-drawer edit-drawer" on:click|stopPropagation>
					<!-- MOVE your Edit Project form here! -->
					<h3>Edit Project</h3>
					<form
						on:submit|preventDefault={updateProject}
						style="display: flex; flex-direction: column; gap: 1em; max-width: 400px;"
					>
						<div>
							<label for="edit-name"><b>Name</b></label>
							<input
								id="edit-name"
								type="text"
								bind:value={editProjectName}
								maxlength="80"
								required
								style="width: 100%;"
							/>
						</div>
						<div>
							<label for="edit-desc"><b>Description</b></label>
							<textarea
								id="edit-desc"
								bind:value={editProjectDesc}
								maxlength="200"
								rows="2"
								style="width: 100%;"
							/>
						</div>
						<div>
							<label for="edit-deadline"><b>Deadline</b></label>
							<input
								id="edit-deadline"
								type="date"
								bind:value={editProjectDeadline}
								style="width: 100%;"
							/>
						</div>
						<div>
							<button
								type="submit"
								disabled={updatingProject}
								style="background:#1976d2;color:#fff;padding:0.5em 2em;border:none;border-radius:1em;"
							>
								{updatingProject ? 'Saving…' : 'Save Changes'}
							</button>
							{#if projectUpdateSuccess}
								<span style="color: #080; margin-left:1em;">Project updated!</span>
							{/if}
							{#if projectUpdateError}
								<span style="color: #c00; margin-left:1em;">{projectUpdateError}</span>
							{/if}
						</div>
					</form>
					<!-- ... (copy all your Edit Project form here) ... -->
					<button on:click={closePanels} class="close-panel-btn">Close</button>
				</div>
			{/if}
		</div>

		<h2>{project.name}</h2>
		<p>{project.description}</p>
		<p>
			<b>Deadline:</b>
			{project.deadline ? formatDate(project.deadline) : '—'}
			<span class="role-badge">{myRole && `Role: ${myRole}`}</span>
		</p>

		{#if activeTab === 'members'}
			<!-- ...all your current Members logic, table, and invite user form... -->
		{/if}

		{#if activeTab === 'edit' && isCreator}
			<!-- Placeholder for Edit Project form. Step 3 will fill this in. -->
			<div class="edit-project-container">
				<!-- FORM WILL BE ADDED IN NEXT STEP -->
			</div>
		{/if}

		<!-- TASK MANAGEMENT SECTION (Project Scoped) -->
		<h3 style="margin-top:2em;">Project Tasks</h3>
		{#if loadingTasks}
			<p>Loading tasks…</p>
		{:else if errorTasks}
			<p style="color:red;">{errorTasks}</p>
		{:else if tasks.length === 0}
			<!-- NEW: Add First Task UI when no tasks exist -->
			<div style="margin:2em 0;">
				<button
					class="toolbar-btn"
					on:click={() => (insertingAtIndex = 0)}
					disabled={!canEditTasks() || editingTaskId !== null}
				>
					Add First Task
				</button>
				{#if insertingAtIndex === 0}
					<form on:submit|preventDefault={() => createTask(0)} style="margin-top:1em;">
						<input
							type="text"
							placeholder="Task title"
							bind:value={newTitle}
							required
							style="margin-right:0.5em; width:25%;"
						/>
						<input
							type="text"
							placeholder="Description (optional)"
							bind:value={newDescription}
							style="margin-right:0.5em; width:35%;"
						/>
						<select bind:value={newStatus} style="margin-right:0.5em;">
							<option value="open">Open</option>
							<option value="in_progress">In Progress</option>
							<option value="done">Done</option>
						</select>
						<input type="date" bind:value={newDueDate} style="margin-right:0.5em;" />
						{#if newDueDate}
							<button type="button" on:click={() => (newDueDate = null)} style="margin-right:0.3em;"
								>❌</button
							>
						{/if}
						<button type="submit" disabled={creating || !newTitle.trim()}>
							{creating ? 'Adding…' : 'Insert Task'}
						</button>
						<button type="button" on:click={() => (insertingAtIndex = null)}>Cancel</button>
					</form>
				{/if}
			</div>
		{:else}
			<div class="action-toolbar">
				<button
					class="toolbar-btn"
					on:click={handleInsertClick}
					disabled={!canEditTasks() ||
						!selected ||
						(selected.type === 'task' && editingTaskId !== null) ||
						(selected.type === 'subtask' && editingSubtaskId !== null)}
				>
					Insert
				</button>

				<button
					class="toolbar-btn"
					on:click={handleAddSubtaskClick}
					disabled={!canEditTasks() ||
						!selected ||
						selected.type !== 'task' ||
						editingTaskId !== null ||
						editingSubtaskId !== null}
				>
					Add Subtask
				</button>

				<button
					class="toolbar-btn"
					on:click={handleMoveUpClick}
					disabled={!canEditTasks() ||
						!selected ||
						(selected?.type === 'task' &&
							(editingTaskId !== null || tasks.findIndex((t) => t.id === selected?.id) <= 0)) ||
						(selected?.type === 'subtask' &&
							(editingSubtaskId !== null ||
								!selected?.parentTaskId ||
								(() => {
									const task = tasks.find((t) => t.id === selected?.parentTaskId);
									if (!task) return true;
									return task.subtasks.findIndex((st) => st.id === selected?.id) <= 0;
								})()))}
				>
					↑
				</button>

				<button
					class="toolbar-btn"
					on:click={() =>
						selected && selected.type === 'task'
							? moveSelectedTask(1)
							: selected && selected.type === 'subtask'
								? moveSelectedSubtask(1)
								: undefined}
					disabled={!canEditTasks() ||
						!selected ||
						(selected?.type === 'task' &&
							(editingTaskId !== null ||
								tasks.findIndex((t) => t.id === selected?.id) === tasks.length - 1)) ||
						(selected?.type === 'subtask' &&
							(editingSubtaskId !== null ||
								!selected?.parentTaskId ||
								(() => {
									const task = tasks.find((t) => t.id === selected?.parentTaskId);
									if (!task) return true;
									return (
										task.subtasks.findIndex((st) => st.id === selected?.id) ===
										task.subtasks.length - 1
									);
								})()))}
				>
					↓
				</button>

				<button
					class="toolbar-btn"
					on:click={startEdit}
					disabled={!canEditTasks() ||
						!selected ||
						(selected.type === 'task' && editingTaskId !== null) ||
						(selected.type === 'subtask' && editingSubtaskId !== null)}>Edit</button
				>
				<button
					class="toolbar-btn delete-btn"
					on:click={deleteSelected}
					disabled={!canEditTasks() ||
						!selected ||
						(selected.type === 'task' && editingTaskId !== null) ||
						(selected.type === 'subtask' && editingSubtaskId !== null)}>Delete</button
				>
			</div>

			<table class="task-table">
				<thead>
					<tr>
						<th style="width:3em;"></th>
						<th style="width:2em;"></th>
						<th style="width:32%;">Task</th>
						<th style="width:26%;">Description / Subtask</th>
						<th style="width:18%;">Created by</th>
						<th class="date-cell">Due Date</th>
					</tr>
				</thead>
				<tbody>
					{#each tasks as task, i}
						<!-- TASK ROW -->
						<tr
							class:selected-row={selected && selected.type === 'task' && selected.id === task.id}
							style="cursor:pointer;"
							on:click={() => selectTask(task.id)}
						>
							<td>
								{#if task.subtasks.length > 0}
									<button
										class="expander"
										on:click|stopPropagation={() => toggleExpand(task.id)}
										aria-label={expandedTasks.has(task.id)
											? 'Collapse subtasks'
											: 'Expand subtasks'}
									>
										{expandedTasks.has(task.id) ? '➖' : '➕'}
									</button>
								{/if}
							</td>
							<td>
								<span
									class="status-dot"
									style="background:{statusDotColor(
										task.status,
										isOverdue(task.due_date, task.status)
									)};
                  border-color:{isOverdue(task.due_date, task.status) ? overdueColor : '#aaa'};"
									title={task.status === 'done'
										? 'Done'
										: isOverdue(task.due_date, task.status)
											? 'Overdue'
											: task.status === 'open'
												? 'Open'
												: 'In Progress'}
								></span>
							</td>
							{#if editingTaskId === task.id}
								<td colspan="4" class="edit-form-row">
									<form
										on:submit|preventDefault={saveEditTask}
										on:click|stopPropagation
										style="display:flex;align-items:center;gap:0.7em;"
									>
										<input type="text" bind:value={editTitle} required style="width:28%;" />
										<input
											type="text"
											bind:value={editDescription}
											placeholder="Description (optional)"
											style="width:38%;"
										/>
										<select bind:value={editStatus}>
											<option value="open">Open</option>
											<option value="in_progress">In Progress</option>
											<option value="done">Done</option>
										</select>
										<input type="date" bind:value={editDueDate} style="width:25%;" />
										{#if editDueDate}
											<button
												type="button"
												on:click={() => (editDueDate = null)}
												style="margin-right:0.3em;">❌</button
											>
										{/if}
										<button type="submit" disabled={savingEdit || !editTitle.trim()}>Save</button>
										<button type="button" on:click={cancelEdit} disabled={savingEdit}>Cancel</button
										>
									</form>
								</td>
							{:else}
								<td>{task.title}</td>
								<td>{task.description}</td>
								<td class="created-by">
									{#if task.created_by_email}
										{#if task.created_by_email === sessionValue?.user?.email}
											You
										{:else}
											<span title={task.created_by_email}>{getInitials(task.created_by_email)}</span
											>
										{/if}
									{:else}
										—
									{/if}
								</td>
								<td class="date-cell">
									{#if task.due_date}
										{formatDate(task.due_date)}
									{/if}
								</td>
							{/if}
						</tr>

						<!-- Insert form row (Task) -->
						{#if insertingAtIndex === i}
							<tr class="insert-form-row">
								<td colspan="5">
									<form on:submit|preventDefault={() => createTask(i)} on:click|stopPropagation>
										<input
											type="text"
											placeholder="Task title"
											bind:value={newTitle}
											required
											style="margin-right:0.5em; width:25%;"
										/>
										<input
											type="text"
											placeholder="Description (optional)"
											bind:value={newDescription}
											style="margin-right:0.5em; width:35%;"
										/>
										<select bind:value={newStatus} style="margin-right:0.5em;">
											<option value="open">Open</option>
											<option value="in_progress">In Progress</option>
											<option value="done">Done</option>
										</select>
										<input type="date" bind:value={newDueDate} style="margin-right:0.5em;" />
										{#if newDueDate}
											<button
												type="button"
												on:click={() => (newDueDate = null)}
												style="margin-right:0.3em;">❌</button
											>
										{/if}
										<button type="submit" disabled={creating || !newTitle.trim()}>
											{creating ? 'Adding…' : 'Insert Task'}
										</button>
										<button type="button" on:click={() => (insertingAtIndex = null)}>Cancel</button>
									</form>
								</td>
							</tr>
						{/if}

						<!-- SUBTASK ROWS (only if expanded) -->
						{#if expandedTasks.has(task.id)}
							{#each task.subtasks as subtask, stIdx}
								<tr
									class:selected-row={selected &&
										selected.type === 'subtask' &&
										selected.id === subtask.id}
									class="subtask-row"
									style="cursor:pointer;"
									on:click={() => selectSubtask(subtask.id, task.id)}
								>
									<td><span class="subtask-indent"></span></td>
									<td>
										<span
											class="status-dot"
											style="background:{statusDotColor(
												subtask.status,
												isOverdue(subtask.due_date, subtask.status)
											)};
                      border-color:{isOverdue(subtask.due_date, subtask.status)
												? overdueColor
												: '#aaa'};"
											title={subtask.status === 'done'
												? 'Done'
												: isOverdue(subtask.due_date, subtask.status)
													? 'Overdue'
													: subtask.status === 'open'
														? 'Open'
														: 'In Progress'}
										></span>
									</td>
									{#if editingSubtaskId === subtask.id}
										<td colspan="3" class="subtask-edit-row">
											<form
												on:submit|preventDefault={saveEditSubtask}
												on:click|stopPropagation
												style="display:flex;align-items:center;gap:0.7em;"
											>
												<input
													type="text"
													bind:value={editSubtaskContent}
													required
													style="width:38%;"
												/>
												<select bind:value={editSubtaskStatus}>
													<option value="open">Open</option>
													<option value="in_progress">In Progress</option>
													<option value="done">Done</option>
												</select>
												<input type="date" bind:value={editSubtaskDueDate} style="width:25%;" />
												{#if editSubtaskDueDate}
													<button
														type="button"
														on:click={() => (editSubtaskDueDate = null)}
														style="margin-right:0.3em;">❌</button
													>
												{/if}
												<button
													type="submit"
													disabled={savingSubtaskEdit || !editSubtaskContent.trim()}>Save</button
												>
												<button type="button" on:click={cancelEdit} disabled={savingSubtaskEdit}
													>Cancel</button
												>
											</form>
										</td>
									{:else}
										<td></td>
										<td>{subtask.content}</td>
										<td class="date-cell">
											{#if subtask.due_date}
												{formatDate(subtask.due_date)}
											{/if}
										</td>
									{/if}
								</tr>
								<!-- Insert form row (Subtask) -->
								{#if insertingSubtaskAt && insertingSubtaskAt.taskId === task.id && insertingSubtaskAt.index === stIdx}
									<tr class="subtask-insert-row">
										<td colspan="5">
											<form
												on:submit|preventDefault={() => createSubtask(task.id, stIdx)}
												on:click|stopPropagation
											>
												<input
													type="text"
													placeholder="Subtask content"
													bind:value={newSubtaskContent}
													required
													style="margin-right:0.5em; width:32%;"
												/>
												<select bind:value={newSubtaskStatus} style="margin-right:0.5em;">
													<option value="open">Open</option>
													<option value="in_progress">In Progress</option>
													<option value="done">Done</option>
												</select>
												<input
													type="date"
													bind:value={newSubtaskDueDate}
													style="margin-right:0.5em;"
												/>
												{#if newSubtaskDueDate}
													<button
														type="button"
														on:click={() => (newSubtaskDueDate = null)}
														style="margin-right:0.3em;">❌</button
													>
												{/if}
												<button
													type="submit"
													disabled={creatingSubtask || !newSubtaskContent.trim()}
												>
													{creatingSubtask ? 'Adding…' : 'Insert Subtask'}
												</button>
												<button type="button" on:click={() => (insertingSubtaskAt = null)}
													>Cancel</button
												>
											</form>
										</td>
									</tr>
								{/if}
							{/each}
							{#if insertingSubtaskAt && insertingSubtaskAt.taskId === task.id && task.subtasks.length === 0}
								<tr class="subtask-insert-row">
									<td colspan="5">
										<form
											on:submit|preventDefault={() =>
												createSubtask(task.id, task.subtasks.length - 1)}
											on:click|stopPropagation
										>
											<input
												type="text"
												placeholder="Subtask content"
												bind:value={newSubtaskContent}
												required
												style="margin-right:0.5em; width:32%;"
											/>
											<select bind:value={newSubtaskStatus} style="margin-right:0.5em;">
												<option value="open">Open</option>
												<option value="in_progress">In Progress</option>
												<option value="done">Done</option>
											</select>
											<input
												type="date"
												bind:value={newSubtaskDueDate}
												style="margin-right:0.5em;"
											/>
											{#if newSubtaskDueDate}
												<button
													type="button"
													on:click={() => (newSubtaskDueDate = null)}
													style="margin-right:0.3em;">❌</button
												>
											{/if}
											<button type="submit" disabled={creatingSubtask || !newSubtaskContent.trim()}>
												{creatingSubtask ? 'Adding…' : 'Insert Subtask'}
											</button>
											<button type="button" on:click={() => (insertingSubtaskAt = null)}
												>Cancel</button
											>
										</form>
									</td>
								</tr>
							{/if}
						{/if}
					{/each}
				</tbody>
			</table>
		{/if}
	{/if}
</div>

<style>
	.project-detail-container {
		max-width: 900px;
		margin: 2em auto;
		background: #fff;
		border-radius: 1em;
		box-shadow: 0 2px 20px #0001;
		padding: 2em 2em 1em 2em;
	}

	.project-toolbar {
		display: flex;
		gap: 1.2em;
		margin-bottom: 1.5em;
		align-items: center;
	}
	.active-tab {
		background: #1976d2;
		color: #fff;
	}

	.tab-btn {
		margin-left: 0.5em;
		margin-right: 0.5em;
		padding: 0.45em 1.7em;
		font-weight: 600;
		border-radius: 1.2em;
		border: none;
		background: #f0f4fc;
		cursor: pointer;
		transition: background 0.12s;
	}
	.tab-btn.active {
		background: #1976d2;
		color: #fff;
	}

	.nav-btn {
		padding: 0.38em 1.5em;
		border-radius: 1em;
		border: 1px solid #1976d2;
		background: #f7faff;
		color: #1976d2;
		font-weight: 600;
		font-size: 1em;
		cursor: pointer;
		margin-bottom: 1.2em;
		margin-right: 1em;
		transition:
			background 0.12s,
			color 0.12s;
	}

	.delete-project-btn {
		padding: 0.38em 1.5em;
		border-radius: 1em;
		border: 1px solid #e74c3c;
		background: #fff4f4;
		color: #e74c3c;
		font-weight: 600;
		font-size: 1em;
		cursor: pointer;
		margin-bottom: 1.2em;
		margin-right: 1em;
		transition:
			background 0.12s,
			color 0.12s;
	}
	.delete-project-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.delete-project-btn:hover:not(:disabled) {
		background: #e74c3c;
		color: #fff;
	}

	.nav-btn:hover {
		background: #1976d2;
		color: #fff;
	}

	.role-badge {
		background: #1976d2;
		color: #fff;
		font-size: 0.97em;
		border-radius: 0.8em;
		padding: 0.2em 0.9em;
		margin-left: 1em;
		font-weight: 600;
	}
	.invite-container {
		margin: 2em 0 1em 0;
		padding: 1.2em 1.7em;
		background: #f6fbff;
		border-radius: 0.7em;
		box-shadow: 0 1px 6px #1689f033;
	}
	.action-toolbar {
		display: flex;
		gap: 0.5em;
		margin-bottom: 0.8em;
		align-items: center;
	}
	.toolbar-btn {
		padding: 0.3em 1.1em;
		border-radius: 0.5em;
		border: 1px solid #aaa;
		background: #fafbfd;
		cursor: pointer;
		font-size: 1em;
		font-weight: 600;
		transition: background 0.15s;
	}
	.toolbar-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.toolbar-btn {
		background: #f0f4fa;
		color: #1976d2;
		border: none;
		border-radius: 0.7em;
		padding: 0.55em 1.4em;
		font-size: 1.05em;
		margin-right: 0.2em;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 0.14s,
			color 0.14s,
			box-shadow 0.14s;
		box-shadow: 0 1px 4px #0001;
	}
	.toolbar-btn:hover,
	.toolbar-btn:focus {
		background: #e3edfc;
		color: #0d47a1;
		outline: none;
	}
	.active-tab.toolbar-btn {
		background: #1976d2 !important;
		color: #fff !important;
		box-shadow: 0 2px 8px #1976d288;
	}

	.delete-btn {
		color: #fff;
		background: #e74c3c;
		border: 1px solid #e74c3c;
	}
	.task-table {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 1em;
	}
	.task-table th,
	.task-table td {
		padding: 0.5em;
		border-bottom: 1px solid #eee;
		text-align: left;
		vertical-align: middle;
	}
	.task-table th {
		background: #f8f8f8;
		font-weight: 600;
	}
	.status-dot {
		display: inline-block;
		width: 1.1em;
		height: 1.1em;
		border-radius: 0.5em;
		margin-right: 0.6em;
		vertical-align: middle;
		border: 2px solid #aaa;
		box-sizing: border-box;
		background: #fff;
	}
	.selected-row {
		background: #e3f4fc !important;
		box-shadow: 0 0 3px #2196f344 inset;
	}
	.subtask-row {
		background: #f7faff;
	}
	.subtask-indent {
		display: inline-block;
		width: 2em;
	}
	.date-cell {
		text-align: right;
		font-variant-numeric: tabular-nums;
		font-size: 0.97em;
		color: #2c3566;
		min-width: 8em;
	}
	.insert-form-row td,
	.edit-form-row td,
	.subtask-insert-row td,
	.subtask-edit-row td {
		background: #f9fafd !important;
		border-bottom: 1px solid #e5e5ee;
	}
	.expander {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1.3em;
		padding: 0 0.2em;
		margin-right: 0.4em;
		color: #1976d2;
		vertical-align: middle;
	}
	.expander:disabled {
		color: #bbb;
		cursor: default;
	}
	.created-by {
		color: #888;
		font-size: 0.97em;
		font-style: italic;
	}
	.panel-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.1);
		z-index: 100;
	}
	.panel-drawer {
		position: fixed;
		top: 6em;
		left: 50%;
		transform: translateX(-50%);
		background: #fff;
		border-radius: 1em;
		box-shadow: 0 4px 32px #0003;
		padding: 2em;
		z-index: 101;
		min-width: 350px;
		max-width: 90vw;
	}
	.close-panel-btn {
		margin-top: 1em;
		background: #eee;
		color: #1976d2;
		border: none;
		border-radius: 0.6em;
		padding: 0.5em 1.4em;
		font-weight: 600;
		cursor: pointer;
	}
</style>
