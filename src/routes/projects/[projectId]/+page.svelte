<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { session } from '$lib/session';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { statusFilter, dueFilter, searchQuery } from '$lib/filterStore';
	import ItemChecklist from '$lib/components/ItemChecklist.svelte';
	//export let onSave: (task: any) => Promise<void>;
	//export let closeModal: () => void;

	// ========== Project Info & Members ==========
	type Member = {
		user_id: string | null;
		email: string;
		role: string;
		status: string;
		invited_email?: string | null;
	};
	type Project = {
		id: string;
		name: string;
		description: string | null;
		deadline: string | null;
		created_by: string; //
	};

	type MemberRow = {
		user_id: string;
		role: string;
		status?: string;
		invited_email?: string;
		users?: { email: string }[];
	};
	type ItemStatus = 'present' | 'not_present';

	type Item = {
		id: string;
		project_id: string;
		name: string;
		status: ItemStatus;
		created_by: string;
		created_at: string;
	};

	type Comment = {
		id: string;
		project_id: string;
		task_id: string | null;
		subtask_id: string | null;
		user_id: string;
		content: string;
		created_at: string;
		updated_at: string;
	};

	let projectId = '';
	$: projectId = page.params.projectId;

	let project: Project | null = null;
	let members: Member[] = [];
	let myRole = '';
	let loadingProject = false;
	let errorProject = '';

	let centerMainEl: HTMLDivElement | null = null;
	let pendingCenterMainScroll: number | null = null;

	// -----------------------------------------------------------------------------------------------------.
	// “New” Badge for Newly Created Task/Subtask
	let recentlyAddedTaskId: string | null = null;
	let newBadgeTimeout: any = null;
	let recentlyAddedSubtaskId: string | null = null;
	let newSubtaskBadgeTimeout: ReturnType<typeof setTimeout> | null = null;

	// -----------------------------------------------------------------------------------------------------.
	// For comments feature.
	// -----------------------------------------------------------------------------------------------------.
	let comments: Comment[] = [];
	let loadingComments = false;
	let errorComments = '';
	//let newCommentContent = '';
	let newCommentText = '';
	let addingComment = false;

	// -----------------------------------------------------------------------------------------------------.
	// For add task add new task modal.
	// -----------------------------------------------------------------------------------------------------.

	let showAddTaskModal = false; // Controls if modal is visible
	let modalTaskTitle = '';
	let modalTaskDescription = '';
	let modalTaskStatus: Status = 'open';
	let modalTaskDueDate: string | null = null;
	let modalTaskAssignedTo: string = '';
	let showModal = false;
	let inputEl: HTMLInputElement | null = null;
	let isSaving = false;
	let modalTaskSelectedItemIds: string[] = [];
	let modalnewBadgeTimeout: ReturnType<typeof setTimeout> | null = null;
	let modalpendingScrollTarget: { type: string; id: string } | null = null;

	type NewTask = {
		title: string;
		description: string;
		status: string;
		due_date: string | null;
		assigned_to: string | null;
	};

	$: if (showAddTaskModal) {
		tick().then(() => inputEl?.focus());
	}

	function closeAddTaskModal() {
		showAddTaskModal = false;
		addAtIndex = null;
		resetModalFields();
	}

	async function handleAddTask(task: NewTask) {
		// Validate fields if needed
		// await supabase call to insert task
		// Refresh the tasks list
		// Optionally: show toast/notification
		closeAddTaskModal();
	}

	function closeModal() {
		closeAddTaskModal();
	}

	function resetModalFields() {
		modalTaskTitle = '';
		modalTaskDescription = '';
		modalTaskStatus = 'open'; // or your default
		modalTaskDueDate = null;
		newTaskAssignedTo = '';
		modalTaskSelectedItemIds = []; // if you use items
	}

	// function closeModal() {
	// 	showAddTaskModal = false;
	// 	// Reset modal fields if needed
	// }

	function onClickAddTask() {
		// Determine insertion point
		if (selected && selected.type === 'task') {
			addAtIndex = tasks.findIndex((t) => t.id === selected?.id);
		} else {
			addAtIndex = tasks.length - 1; // End of list
		}
		showAddTaskModal = true;
		// Optionally reset fields if desired, or keep last-used for batch UX
	}

	async function insertTaskWithModalFields(atIndex: number | null = null) {
		// 1️⃣ Prevent blank title
		if (!modalTaskTitle.trim()) return null;

		// 2️⃣ Prevent duplicate title (case-insensitive)
		const duplicate = tasks.some(
			(t) => t.title.trim().toLowerCase() === modalTaskTitle.trim().toLowerCase()
		);
		if (duplicate) {
			alert('A task with this title already exists.');
			return null;
		}

		// 3️⃣ Figure out sort_index for DB/UI order
		let sort_index = tasks.length;
		if (atIndex !== null && atIndex >= -1) sort_index = atIndex + 1;

		// 4️⃣ Compose task object
		const taskData = {
			project_id: projectId,
			title: modalTaskTitle.trim(),
			description: modalTaskDescription.trim(),
			status: modalTaskStatus,
			due_date: modalTaskDueDate,
			sort_index,
			owner_id: sessionValue?.user?.id,
			created_by_email: sessionValue?.user?.email,
			last_edited_by: sessionValue?.user?.id,
			assigned_to:
				modalTaskAssignedTo && modalTaskAssignedTo.trim() !== '' ? modalTaskAssignedTo : null
		};

		// 5️⃣ Insert in Supabase and memory
		let inserted;
		let wasEmpty = tasks.length === 0;

		const { data, error } = await supabase
			.from('tasks')
			.insert([taskData])
			.select('*, subtasks(*)');

		if (error || !data || !data[0]) {
			alert('Error creating task: ' + (error?.message ?? 'unknown'));
			return null;
		}
		inserted = data[0];

		// Insert in UI array at correct spot
		if (sort_index >= 0 && sort_index < tasks.length) {
			const before = tasks.slice(0, sort_index);
			const after = tasks.slice(sort_index);
			tasks = [...before, inserted, ...after];
			await reindexTasks(tasks);
		} else {
			tasks = [...tasks, inserted];
		}

		// Optionally update user map for initials badge (if empty)
		if (wasEmpty && inserted.assigned_to) {
			try {
				const { data: users } = await supabase
					.from('user_emails')
					.select('id, email')
					.in('id', [inserted.assigned_to, inserted.last_edited_by].filter(Boolean));
				if (users) users.forEach((u) => (userMap[u.id] = u.email));
				userMap = { ...userMap };
			} catch {}
		}

		// 6️⃣ Link items
		if (modalTaskSelectedItemIds && modalTaskSelectedItemIds.length > 0) {
			const links = modalTaskSelectedItemIds.map((item_id) => ({
				task_id: inserted.id,
				item_id,
				project_id: projectId,
				created_by: sessionValue?.user?.id
			}));
			const { error: linkError } = await supabase.from('task_items').insert(links);
			if (linkError) {
				console.error('Failed to link items to task:', linkError.message);
			}
		}
		await fetchTaskItems();

		// 7️⃣ Show “New” badge
		recentlyAddedTaskId = inserted.id;
		if (newBadgeTimeout) clearTimeout(newBadgeTimeout);
		newBadgeTimeout = setTimeout(() => {
			recentlyAddedTaskId = null;
		}, 60000);

		// 8️⃣ Scroll to new
		pendingScrollTarget = { type: 'task', id: inserted.id };

		return inserted;
	}

	async function handleModalSave() {
		isSaving = true;
		// Always insert after selected, else end
		let atIndex = null;
		if (selected && selected.type === 'task') {
			atIndex = tasks.findIndex((t) => t.id === selected?.id);
		} else if (tasks.length > 0) {
			atIndex = tasks.length - 1;
		}
		const task = await insertTaskWithModalFields(atIndex);
		isSaving = false;
		if (task) {
			resetModalFields();
			closeModal();
		}
	}

	let addAtIndex: number | null = null; // tracks where to insert next

	async function handleSaveAndAddAnother() {
		isSaving = true;

		// 1️⃣ Validate required fields
		const titleTrimmed = modalTaskTitle.trim();
		if (!titleTrimmed) {
			isSaving = false;
			return;
		}

		// 2️⃣ Prevent duplicate
		const duplicate = tasks.some(
			(t) => t.title.trim().toLowerCase() === titleTrimmed.toLowerCase()
		);
		if (duplicate) {
			alert('A task with this title already exists.');
			isSaving = false;
			return;
		}

		// 3️⃣ Insert after previous (addAtIndex), or after selected, or at end
		let atIndex = addAtIndex;
		if (atIndex === null) {
			if (selected && selected.type === 'task') {
				atIndex = tasks.findIndex((t) => t.id === selected?.id);
			} else if (tasks.length > 0) {
				atIndex = tasks.length - 1;
			}
		}

		const inserted = await insertTaskWithModalFields(atIndex);
		if (!inserted) {
			isSaving = false;
			return;
		}

		// 4️⃣ Set addAtIndex to the new task’s index (so next new task goes below)
		addAtIndex = tasks.findIndex((t) => t.id === inserted.id);

		// 5️⃣ Reset for rapid entry, but keep status, assigned, items
		const prevStatus = modalTaskStatus;
		const prevAssignedTo = modalTaskAssignedTo;
		const prevItems = modalTaskSelectedItemIds.slice();

		modalTaskTitle = '';
		modalTaskDescription = '';
		modalTaskStatus = prevStatus;
		modalTaskAssignedTo = prevAssignedTo;
		modalTaskDueDate = null;
		modalTaskSelectedItemIds = prevItems;

		isSaving = false;

		await tick();
		inputEl?.focus();
	}

	// -----------------------------------------------------------------------------------------------------.
	// For edited by feature.
	// -----------------------------------------------------------------------------------------------------.
	let userMap: Record<string, string> = {};

	// -----------------------------------------------------------------------------------------------------.
	// For items feature.
	// -----------------------------------------------------------------------------------------------------.

	let items: Item[] = [];
	let loadingItems = false;
	let errorItems = '';
	let showItemsPanel = false;
	let newItemName = '';
	let addingItem = false;
	let removingItemId: string | null = null;
	let editTaskSelectedItemIds: string[] = []; // for editing tasks
	let newTaskSelectedItemIds: string[] = []; // for creating tasks
	let savingItems = false;
	let showAllItems = false;

	function toggleShowAllItems() {
		showAllItems = !showAllItems;
	}

	async function fetchItems() {
		if (!projectId) {
			items = [];
			loadingItems = false;
			return;
		}
		loadingItems = true;
		errorItems = '';
		const { data, error } = await supabase
			.from('items')
			.select('*')
			.eq('project_id', projectId)
			.order('name', { ascending: true });
		if (error) {
			errorItems = error.message;
			items = [];
			loadingItems = false;
			return;
		}
		items = data ?? [];
		loadingItems = false;
	}

	async function addNewItem() {
		if (!newItemName.trim() || addingItem) return;
		addingItem = true;
		errorItems = '';

		const { data, error } = await supabase
			.from('items')
			.insert([
				{
					project_id: projectId,
					name: newItemName.trim(),
					status: 'not_present',
					created_by: sessionValue?.user?.id ?? null
				}
			])
			.select()
			.single(); // Gets the newly created item

		addingItem = false;

		if (error) {
			errorItems = error.message;
			return;
		}

		if (data) {
			items = [...items, data]; // Add the new item directly to the local array
			newItemName = '';
		}
	}

	async function removeItem(itemId: string) {
		if (!itemId || removingItemId) return;
		removingItemId = itemId;

		const { error } = await supabase.from('items').delete().eq('id', itemId);
		removingItemId = null;

		if (error) {
			errorItems = error.message;
			return;
		}

		// Update local items list (no full fetch)
		items = items.filter((item) => item.id !== itemId);
	}

	async function toggleItemStatus(itemId: string, currentStatus: 'present' | 'not_present') {
		const newStatus = currentStatus === 'present' ? 'not_present' : 'present';

		const { error } = await supabase.from('items').update({ status: newStatus }).eq('id', itemId);

		if (error) {
			errorItems = error.message;
			return;
		}

		// Update local state for instant UI
		items = items.map((item) => (item.id === itemId ? { ...item, status: newStatus } : item));
		taskItems = taskItems.map((link) =>
			link.item.id === itemId ? { ...link, item: { ...link.item, status: newStatus } } : link
		);
		console.log('[DEBUG] After toggle, taskItems:', taskItems);
	}

	async function fetchTaskItemLinks(taskId: string) {
		const { data, error } = await supabase
			.from('task_items')
			.select('item_id')
			.eq('task_id', taskId);
		if (error) {
			console.error('Error fetching task items:', error.message);
			return [];
		}
		return data ? data.map((row) => row.item_id) : [];
	}

	async function handleRightPaneItemsChange(newIds: string[]) {
		if (!selectedTask) return;
		savingItems = true;

		// 1. Remove all previous links for this task
		await supabase.from('task_items').delete().eq('task_id', selectedTask.id);

		// 2. Insert new links (if any)
		if (newIds.length > 0) {
			const links = newIds.map((item_id) => ({
				task_id: selectedTask.id,
				item_id,
				project_id: projectId,
				created_by: sessionValue?.user.id
			}));
			const { error: linkError } = await supabase.from('task_items').insert(links);
			if (linkError) {
				alert('Error updating items: ' + linkError.message);
			}
		}

		// 3. Refetch local links for UI
		await fetchTaskItems();

		savingItems = false;
	}

	// Get the currently selected task's item IDs (for right pane), null if not a task, otherwise array of item IDs
	$: selectedTaskItemIds = selectedTask
		? taskItems.filter((link) => link.task_id === selectedTask.id).map((link) => link.item_id)
		: [];

	// --- Compute missing and present items for selected task (right pane)
	$: selectedTaskItems = selectedTask ? (taskIdToItems[selectedTask.id] ?? []) : [];
	$: missingItems = selectedTaskItems.filter((item) => item.status === 'not_present');
	$: presentItems = selectedTaskItems.filter((item) => item.status === 'present');
	$: currentTaskItems = selectedTask ? (taskIdToItems[selectedTask.id] ?? []) : [];

	$: missingItemsSummary = items.filter(
		(i) => selectedTaskItemIds.includes(i.id) && i.status === 'not_present'
	);

	// Reset expanded items list view when switching selection
	$: if (selected) {
		showAllItems = false;
	}

	// -----------------------------------------------------------------------------------------------------.
	// Comments feature comments.
	// -----------------------------------------------------------------------------------------------------.
	async function fetchComments({
		taskId = null,
		subtaskId = null
	}: {
		taskId?: string | null;
		subtaskId?: string | null;
	}) {
		if (!projectId) {
			comments = [];
			loadingComments = false;
			return;
		}
		loadingComments = true;
		errorComments = '';
		let query = supabase.from('comments').select('*').eq('project_id', projectId);

		if (taskId) {
			query = query.eq('task_id', taskId).is('subtask_id', null);
		} else if (subtaskId) {
			query = query.eq('subtask_id', subtaskId);
		} else {
			// No task or subtask selected
			comments = [];
			loadingComments = false;
			return;
		}

		const { data, error } = await query.order('created_at', { ascending: true });

		if (error) {
			errorComments = error.message;
			comments = [];
		} else {
			comments = data ?? [];
		}
		loadingComments = false;
	}

	// Find the selected task (for right pane context)
	$: selectedTask =
		selected && selected.type === 'task' ? tasks.find((t) => t.id === selected?.id) : null;

	// Find the selected subtask (and its parent) if needed
	$: selectedSubtask =
		selected && selected.type === 'subtask'
			? (tasks.find((t) => t.id === selected?.parentTaskId)?.subtasks ?? []).find(
					(st) => st.id === selected?.id
				)
			: null;

	// -----------------------------------------------------------------------------------------------------.
	// General stay at the same row after edit.
	// -----------------------------------------------------------------------------------------------------.

	let pendingScrollTarget: {
		type: 'task' | 'subtask';
		id: string;
		parentTaskId?: string | null;
	} | null = null;

	$: if (pendingScrollTarget) {
		(async () => {
			await tick();
			const { type, id, parentTaskId } = pendingScrollTarget!;
			let el: HTMLElement | null = null;

			if (type === 'task') {
				el = document.getElementById('task-' + id);
			} else if (type === 'subtask') {
				el = document.getElementById('subtask-' + id);
			}
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			}
			pendingScrollTarget = null;
		})();
	}

	// -----------------------------------------------------------------------------------------------------.
	// Scroll the New Row Into View When It Appears.

	let insertRowEl: HTMLTableRowElement | null = null;
	let insertSubtaskRowEl: HTMLTableRowElement | null = null;

	$: if (insertingAtIndex !== null && insertRowEl) {
		// Use setTimeout to ensure DOM is updated before scrolling
		setTimeout(() => {
			insertRowEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}, 0);
	}
	$: if (insertSubtaskRowEl) {
		insertSubtaskRowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}
	// -----------------------------------------------------------------------------------------------.
	// ---------------------------right pane edit task subtask----------------------------------------.
	// -----------------------------------------------------------------------------------------------.
	let editingTaskRP = false; // Tracks if we're editing the task in right pane
	let editingSubtaskRP = false; // Tracks if we're editing the subtask in right pane
	// Local edit buffers tasks
	let editTaskTitleRP = '';
	let editTaskDescriptionRP = '';
	let editTaskStatusRP: 'open' | 'in_progress' | 'done' = 'open';
	let editTaskDueDateRP: string | null = null;
	let editTaskAssignedToRP = '';
	// Local edit buffers subtasks
	let editSubtaskContentRP = '';
	let editSubtaskStatusRP: 'open' | 'in_progress' | 'done' = 'open';
	let editSubtaskDueDateRP: string | null = null;
	let editSubtaskAssignedToRP = '';

	$: if (selectedTask) {
		editTaskTitleRP = selectedTask.title ?? '';
		editTaskDescriptionRP = selectedTask.description ?? '';
		editTaskStatusRP = selectedTask.status ?? 'open';
		editTaskDueDateRP = selectedTask.due_date ?? null;
		editTaskAssignedToRP = selectedTask.assigned_to ?? '';
	}
	$: if (selectedSubtask) {
		editSubtaskContentRP = selectedSubtask.content ?? '';
		editSubtaskStatusRP = selectedSubtask.status ?? 'open';
		editSubtaskDueDateRP = selectedSubtask.due_date ?? null;
		editSubtaskAssignedToRP = selectedSubtask.assigned_to ?? '';
	}
	$: isTaskChanged =
		editTaskTitleRP.trim() !== (selectedTask?.title ?? '').trim() ||
		editTaskDescriptionRP.trim() !== (selectedTask?.description ?? '').trim() ||
		editTaskStatusRP !== (selectedTask?.status ?? '') ||
		editTaskAssignedToRP !== (selectedTask?.assigned_to ?? '') ||
		(editTaskDueDateRP || '') !== (selectedTask?.due_date || '');
	$: isSubtaskChanged =
		editSubtaskContentRP.trim() !== (selectedSubtask?.content ?? '').trim() ||
		editSubtaskStatusRP !== (selectedSubtask?.status ?? '') ||
		editSubtaskAssignedToRP !== (selectedSubtask?.assigned_to ?? '') ||
		(editSubtaskDueDateRP ?? '') !== (selectedSubtask?.due_date ?? '');

	async function saveTaskEdit() {
		// ---- edit task ---------------
		// --------- Right Pane Save button save button -------------
		isSaving = true;

		// 1. Validation: blank and duplicate title
		const titleTrimmed = editTaskTitleRP.trim();
		if (!titleTrimmed) {
			alert('Task title cannot be blank.');
			isSaving = false;
			return;
		}
		const duplicate = tasks.some(
			(t) =>
				t.id !== selectedTask?.id && t.title.trim().toLowerCase() === titleTrimmed.toLowerCase()
		);
		if (duplicate) {
			alert('A task with this title already exists.');
			isSaving = false;
			return;
		}

		// 2. Update Supabase
		const { error } = await supabase
			.from('tasks')
			.update({
				title: editTaskTitleRP,
				description: editTaskDescriptionRP,
				status: editTaskStatusRP,
				due_date: editTaskDueDateRP,
				assigned_to: editTaskAssignedToRP || null
			})
			.eq('id', selectedTask?.id);

		if (error) {
			alert('Error updating task: ' + error.message);
			isSaving = false;
			return;
		}

		// 3. Update local tasks array (for instant UI)
		const idx = tasks.findIndex((t) => t.id === selectedTask?.id);
		if (idx !== -1) {
			tasks[idx] = {
				...tasks[idx],
				title: editTaskTitleRP,
				description: editTaskDescriptionRP,
				status: editTaskStatusRP,
				due_date: editTaskDueDateRP,
				assigned_to: editTaskAssignedToRP
			};
			tasks = [...tasks]; // trigger reactivity
		}

		// 4. Exit edit mode/reset flags if you use any
		isSaving = false;
	}

	async function saveSubtaskEdit() {
		isSaving = true;

		// 1. Validation: blank and duplicate content
		const contentTrimmed = editSubtaskContentRP.trim();
		if (!contentTrimmed) {
			alert('Subtask content cannot be blank.');
			isSaving = false;
			return;
		}
		const parentTask = tasks.find((t) => t.id === selected?.parentTaskId);
		const duplicateSubtask = parentTask?.subtasks.some(
			(st) =>
				st.id !== selectedSubtask?.id &&
				st.content.trim().toLowerCase() === contentTrimmed.toLowerCase()
		);
		if (duplicateSubtask) {
			alert('A subtask with this content already exists under this task.');
			isSaving = false;
			return;
		}

		// 2. Update Supabase
		const { error } = await supabase
			.from('subtasks')
			.update({
				content: editSubtaskContentRP,
				status: editSubtaskStatusRP,
				due_date: editSubtaskDueDateRP,
				last_edited_by: sessionValue?.user.id,
				assigned_to: editSubtaskAssignedToRP || null
			})
			.eq('id', selectedSubtask?.id)
			.eq('project_id', projectId);

		isSaving = false;
		if (error) {
			alert('Error updating subtask: ' + error.message);
			return;
		}

		// 3. Patch local data (NO fetchTasks, NO resetting selected)
		if (parentTask && selectedSubtask) {
			const subIdx = parentTask.subtasks.findIndex((st) => st.id === selectedSubtask.id);
			if (subIdx !== -1) {
				parentTask.subtasks[subIdx] = {
					...parentTask.subtasks[subIdx],
					content: editSubtaskContentRP,
					status: editSubtaskStatusRP,
					due_date: editSubtaskDueDateRP,
					last_edited_by: sessionValue?.user.id,
					assigned_to: editSubtaskAssignedToRP || null,
					updated_at: new Date().toISOString()
				};
				// To trigger Svelte reactivity
				tasks = tasks.map((t) =>
					t.id === parentTask.id ? { ...t, subtasks: [...parentTask.subtasks] } : t
				);
			}
		}
		// 4. DO NOT clear selection or edit buffer—UI remains steady
	}

	function cancelTaskEdit() {
		if (!selectedTask) return;

		editTaskTitleRP = selectedTask.title ?? '';
		editTaskDescriptionRP = selectedTask.description ?? '';
		editTaskStatusRP = selectedTask.status ?? 'open';
		editTaskDueDateRP = selectedTask.due_date ?? null;
		editTaskAssignedToRP = selectedTask.assigned_to ?? '';

		selected = null; // Hides the right pane
	}

	function cancelSubtaskEdit() {
		if (!selectedSubtask) return;

		editSubtaskContentRP = selectedSubtask?.content ?? '';
		editSubtaskStatusRP = selectedSubtask?.status ?? 'open';
		editSubtaskDueDateRP = selectedSubtask?.due_date ?? null;
		editSubtaskAssignedToRP = selectedSubtask?.assigned_to ?? '';

		selected = null;
	}

	// -----------------------------------------------------------------------------------------------.

	// Add Improved Scroll-to-Visible for Status Dot Popover.

	let statusMenuPopoverEl: HTMLDivElement | null = null;
	let subtaskStatusMenuPopoverEl: HTMLDivElement | null = null;

	$: if (statusMenuPopoverEl) {
		statusMenuPopoverEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}
	$: if (subtaskStatusMenuPopoverEl) {
		subtaskStatusMenuPopoverEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}

	function getTaskById(id: string): Task | undefined {
		return tasks.find((t) => t.id === id);
	}

	// Add in <script>
	$: taskForStatusMenu = statusMenuOpenFor ? tasks.find((t) => t.id === statusMenuOpenFor) : null;

	// -------------------------------------------------------------------------------------------.

	function isRowVisibleInContainer(rowId: string, container: HTMLElement) {
		const row = document.getElementById(rowId);
		if (!row) return false;
		const containerRect = container.getBoundingClientRect();
		const rowRect = row.getBoundingClientRect();

		return rowRect.top >= containerRect.top && rowRect.bottom <= containerRect.bottom;
	}

	// -------------------------------------------------------------------------------------------.
	let sessionValue = get(session);

	type TabKey = 'members' | 'edit' | 'tasks'; // add 'tasks' or others as needed
	let activeTab: TabKey = 'members';

	let isCreator = false; // Will be set after loading project

	// For quick status popover on task
	let statusMenuOpenFor: string | null = null; // task.id, or null if closed
	let statusMenuPos = { x: 0, y: 0 }; // absolute menu coordinates

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

	//Prevent scrolling the background when overlay is open
	$: {
		if (showMembersPanel || showEditProjectPanel) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
	}

	$: filteredTasks = tasks
		// Status filter
		.filter((t) => $statusFilter === 'all' || t.status === $statusFilter)
		// Due date filter
		.filter((t) => {
			if ($dueFilter === 'all') return true;
			if ($dueFilter === 'none') return !t.due_date;
			if (!t.due_date) return false;
			const today = new Date();
			const due = new Date(t.due_date);
			if ($dueFilter === 'overdue') {
				// Before today, not done
				return (
					due < new Date(today.getFullYear(), today.getMonth(), today.getDate()) &&
					t.status !== 'done'
				);
			}
			if ($dueFilter === 'today') {
				return due.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
			}
			if ($dueFilter === 'upcoming') {
				return due > today && t.status !== 'done';
			}
			return true;
		})
		// Search filter
		.filter((t) => {
			if (!$searchQuery.trim()) return true;
			const q = $searchQuery.trim().toLowerCase();
			return (
				(t.title && t.title.toLowerCase().includes(q)) ||
				(t.description && t.description.toLowerCase().includes(q))
			);
		});

	// taskId → [linked item objs...]
	$: taskIdToItems = tasks.reduce(
		(map, task) => {
			map[task.id] = taskItems.filter((link) => link.task_id === task.id).map((link) => link.item);
			return map;
		},
		{} as Record<string, Item[]>
	);

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
		short_id: string;
		task_id: string;
		project_id: string;
		content: string;
		status: Status;
		due_date: string | null;
		sort_index: number;
		created_at: string;
		updated_at: string;
		created_by_email: string;
		assigned_to?: string | null;
		last_edited_by?: string | null;
	};

	type Task = {
		id: string;
		short_id: string;
		project_id: string;
		title: string;
		description: string;
		status: Status;
		due_date: string | null;
		sort_index: number;
		created_at: string;
		updated_at: string;
		created_by_email?: string;
		last_edited_by?: string | null;
		assigned_to?: string | null;
		subtasks: Subtask[];
	};

	let tasks: Task[] = [];
	let loadingTasks = false;
	let errorTasks = '';

	type TaskItemLink = {
		task_id: string;
		item_id: string;
		item: Item; // will contain status, name, etc.
	};

	let taskItems: TaskItemLink[] = [];
	let loadingTaskItems = false;
	let errorTaskItems = '';

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
	let newTaskAssignedTo: string = '';
	let editAssignedTo = '';

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
	let newSubtaskAssignedTo: string = ''; // For assignee in "create" form
	let editSubtaskAssignedTo: string | null = ''; // For assignee in "edit" form

	let subtaskStatusMenuOpenFor: string | null = null; // subtask.id, or null if closed
	let subtaskStatusMenuPos = { x: 0, y: 0 };

	// Expanded/collapsed
	let expandedTasks: Set<string> = new Set();

	// ---- Helpers ----
	function openStatusMenu(event: MouseEvent, task: Task) {
		statusMenuOpenFor = task.id;
		subtaskStatusMenuOpenFor = null;

		const dotEl = event.target as HTMLElement;
		const container = centerMainEl;

		if (container && dotEl) {
			const dotRect = dotEl.getBoundingClientRect();
			const containerRect = container.getBoundingClientRect();
			// Center horizontally, and place *just above* the dot
			statusMenuPos = {
				x: dotRect.left - containerRect.left + dotRect.width / 2,
				y: dotRect.top - containerRect.top - 8 // 8px gap above the dot; menu’s bottom aligns with dot’s top
			};
		}

		setTimeout(() => {
			window.addEventListener('click', closeStatusMenu, { once: true });
		}, 1);
	}

	function closeStatusMenu() {
		statusMenuOpenFor = null;
	}

	async function setTaskStatus(task: Task, status: Status) {
		await supabase.from('tasks').update({ status }).eq('id', task.id);
		statusMenuOpenFor = null;

		// Update in-memory for instant UI
		const idx = tasks.findIndex((t) => t.id === task.id);
		if (idx !== -1) {
			const updatedTask = { ...tasks[idx], status };
			tasks = [...tasks.slice(0, idx), updatedTask, ...tasks.slice(idx + 1)];
		}

		pendingScrollTarget = { type: 'task', id: task.id };
	}

	function filteredIndexToTasksIndex(filteredIndex: number): number {
		const taskId = filteredTasks[filteredIndex]?.id;
		return tasks.findIndex((t) => t.id === taskId);
	}

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

	function formatDateTime(dateStr: string | null | undefined): string {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		const pad = (n: number) => n.toString().padStart(2, '0');
		return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

	function openSubtaskStatusMenu(event: MouseEvent | KeyboardEvent, subtask: Subtask) {
		subtaskStatusMenuOpenFor = subtask.id;
		statusMenuOpenFor = null;

		let rect;
		// If this was a mouse event, use the mouse target's bounding rect
		if (event instanceof MouseEvent) {
			const dotEl = event.target as HTMLElement;
			rect = dotEl.getBoundingClientRect();
		} else if (event instanceof KeyboardEvent) {
			// For keyboard, use the currently focused element
			const dotEl = document.activeElement as HTMLElement;
			if (dotEl) {
				rect = dotEl.getBoundingClientRect();
			}
		}

		if (rect) {
			subtaskStatusMenuPos = {
				x: rect.left + rect.width / 2,
				y: rect.top - 8 // popover above
			};
		}

		setTimeout(() => {
			window.addEventListener('click', closeSubtaskStatusMenu, { once: true });
		}, 1);
	}

	function closeSubtaskStatusMenu() {
		subtaskStatusMenuOpenFor = null;
	}

	async function setSubtaskStatus(subtask: Subtask, status: Status, parentTaskId: string) {
		await supabase.from('subtasks').update({ status }).eq('id', subtask.id);
		subtaskStatusMenuOpenFor = null;

		// Update in-memory for instant UI
		const taskIdx = tasks.findIndex((t) => t.id === parentTaskId);
		if (taskIdx !== -1) {
			const subIdx = tasks[taskIdx].subtasks.findIndex((st) => st.id === subtask.id);
			if (subIdx !== -1) {
				const updatedSubtask = { ...tasks[taskIdx].subtasks[subIdx], status };
				const updatedSubtasks = [
					...tasks[taskIdx].subtasks.slice(0, subIdx),
					updatedSubtask,
					...tasks[taskIdx].subtasks.slice(subIdx + 1)
				];
				const updatedTask = {
					...tasks[taskIdx],
					subtasks: updatedSubtasks
				};
				tasks = [...tasks.slice(0, taskIdx), updatedTask, ...tasks.slice(taskIdx + 1)];
			}
		}

		pendingScrollTarget = { type: 'subtask', id: subtask.id, parentTaskId };
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

		// --- 1. Gather all unique last_edited_by user IDs (for both tasks and subtasks) ---
		// const userIdsFromTasks = tasks.map((t) => t.last_edited_by).filter((id) => !!id);
		// const userIdsFromSubtasks = tasks.flatMap((t) =>
		// 	Array.isArray(t.subtasks)
		// 		? t.subtasks.map((st) => st.last_edited_by).filter((id) => !!id)
		// 		: []
		// );

		// const allEditedByIds = Array.from(new Set([...userIdsFromTasks, ...userIdsFromSubtasks]));

		// --- 1. Gather all user IDs for assigned_to and last_edited_by (tasks and subtasks)
		const userIdsFromTasks = tasks.map((t) => t.last_edited_by).filter((id) => !!id);
		const userIdsFromSubtasks = tasks.flatMap((t) =>
			Array.isArray(t.subtasks)
				? t.subtasks.map((st) => st.last_edited_by).filter((id) => !!id)
				: []
		);
		const assigneeIdsFromTasks = tasks.map((t) => t.assigned_to).filter((id) => !!id);
		const assigneeIdsFromSubtasks = tasks.flatMap((t) =>
			Array.isArray(t.subtasks) ? t.subtasks.map((st) => st.assigned_to).filter((id) => !!id) : []
		);
		const allUserIds = Array.from(
			new Set([
				...userIdsFromTasks,
				...userIdsFromSubtasks,
				...assigneeIdsFromTasks,
				...assigneeIdsFromSubtasks
			])
		);

		// --- 2. Fetch user emails and build the userMap ---
		if (allUserIds.length > 0) {
			const { data: users, error } = await supabase
				.from('user_emails')
				.select('id, email')
				.in('id', allUserIds);

			if (error) {
				console.error('Error loading user emails:', error.message);
				userMap = {};
			} else {
				userMap = (users ?? []).reduce(
					(map, u) => {
						map[u.id] = u.email;
						return map;
					},
					{} as Record<string, string>
				);
			}
		} else {
			userMap = {};
		}

		// --- 3. Reset UI state as before ---
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

	async function fetchTaskItems() {
		if (!projectId) {
			taskItems = [];
			loadingTaskItems = false;
			return;
		}
		loadingTaskItems = true;
		errorTaskItems = '';
		// JOIN: Get all task_items + item fields
		const { data, error } = await supabase
			.from('task_items')
			.select('task_id, item_id, item:items(*)')
			.eq('project_id', projectId);

		if (error) {
			errorTaskItems = error.message;
			taskItems = [];
			loadingTaskItems = false;
			return;
		}
		// Only keep links with loaded item (defensive)
		taskItems = (data ?? [])
			.map((link) => ({
				...link,
				item: Array.isArray(link.item) ? link.item[0] : link.item
			}))
			.filter((link) => link.item);

		loadingTaskItems = false;
	}

	// ---- Reindex helpers ----
	async function reindexTasks(newOrder: Task[]) {
		await Promise.all(
			newOrder.map((task, idx) =>
				supabase.from('tasks').update({ sort_index: idx }).eq('id', task.id)
			)
		);
		//await fetchTasks();
	}

	async function reindexSubtasks(taskId: string, newOrder: Subtask[]) {
		await Promise.all(
			newOrder.map((st, idx) =>
				supabase.from('subtasks').update({ sort_index: idx }).eq('id', st.id)
			)
		);
		//await fetchTasks();
	}

	// ---- Task CRUD (permission checks) ----
	function canEditTasks() {
		return myRole === 'admin' || myRole === 'editor';
	}
	async function createTask(atIndex: number | null = null) {
		if (!canEditTasks() || !newTitle.trim() || !sessionValue) return;
		creating = true;
		const wasEmpty = tasks.length === 0;
		let sort_index = tasks.length;
		const taskData = {
			project_id: projectId,
			title: newTitle.trim(),
			description: newDescription.trim(),
			status: newStatus,
			due_date: newDueDate,
			sort_index,
			owner_id: sessionValue.user.id,
			created_by_email: sessionValue.user.email,
			last_edited_by: sessionValue.user.id,
			assigned_to: newTaskAssignedTo && newTaskAssignedTo.trim() !== '' ? newTaskAssignedTo : null
		};
		let inserted;

		if (atIndex !== null) {
			sort_index = atIndex + 1;
			const { data, error: err } = await supabase
				.from('tasks')
				.insert([{ ...taskData, sort_index }])
				.select('*, subtasks(*)');
			creating = false;
			if (err || !data || !data[0]) {
				alert('Error creating task: ' + (err?.message ?? 'unknown'));
				return;
			}
			inserted = data[0];
			const before = tasks.slice(0, sort_index);
			const after = tasks.slice(sort_index);
			const newTasks = [...before, inserted, ...after];
			await reindexTasks(newTasks);
			tasks = newTasks;
		} else {
			const { data, error: err } = await supabase
				.from('tasks')
				.insert([taskData])
				.select('*, subtasks(*)');
			creating = false;
			if (err || !data || !data[0]) {
				alert('Error creating task: ' + (err?.message ?? 'unknown'));
				return;
			}
			inserted = data[0];
			tasks = [...tasks, inserted];

			tasks = tasks.map((task) => ({ ...task }));

			const insertedUserIds = [inserted.assigned_to, inserted.last_edited_by].filter(
				Boolean
			) as string[];

			// --- Ensure userMap includes the assignee for first task ---
			if (wasEmpty && insertedUserIds.length > 0) {
				const { data: users, error } = await supabase
					.from('user_emails')
					.select('id, email')
					.in('id', insertedUserIds);
				if (!error && users) {
					for (const u of users) {
						userMap[u.id] = u.email;
					}
				} else if (error) {
					console.error('Failed to fetch user emails after first task insertion:', error.message);
				}
				userMap = { ...userMap };
			}
		}

		// --- Add links to items for this task ---
		if (newTaskSelectedItemIds && newTaskSelectedItemIds.length > 0) {
			const links = newTaskSelectedItemIds.map((item_id) => ({
				task_id: inserted.id,
				item_id,
				project_id: projectId,
				created_by: sessionValue?.user.id
			}));
			const { error: linkError } = await supabase.from('task_items').insert(links);
			if (linkError) {
				console.error('Failed to link items to task:', linkError.message);
				// Optionally: alert('Error linking items: ' + linkError.message);
			}
		}
		newTaskSelectedItemIds = [];

		await fetchTaskItems();

		// Always fetch tasks after insert to ensure no UI duplication issues
		//await fetchTasks();

		recentlyAddedTaskId = inserted.id;
		if (newBadgeTimeout) clearTimeout(newBadgeTimeout);
		newBadgeTimeout = setTimeout(() => {
			recentlyAddedTaskId = null;
		}, 60000);

		pendingScrollTarget = { type: 'task', id: inserted.id };

		// Reset form state
		newTitle = '';
		newDescription = '';
		newStatus = 'open';
		newDueDate = null;
		insertingAtIndex = null;
		newTaskAssignedTo = '';
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

		const filteredIdx = filteredTasks.findIndex((t) => t.id === selected?.id);
		if (filteredIdx === -1) return;

		const filteredSwapWith = filteredIdx + offset;
		if (filteredSwapWith < 0 || filteredSwapWith >= filteredTasks.length) return;

		const mainIdx = tasks.findIndex((t) => t.id === filteredTasks[filteredIdx].id);
		const mainSwapWith = tasks.findIndex((t) => t.id === filteredTasks[filteredSwapWith].id);

		if (mainIdx === -1 || mainSwapWith === -1) return;

		const newOrder = [...tasks];
		const [moved] = newOrder.splice(mainIdx, 1);
		newOrder.splice(mainSwapWith, 0, moved);

		// Locally update sort_index
		for (let i = 0; i < newOrder.length; ++i) {
			newOrder[i].sort_index = i;
		}

		tasks = newOrder; // <-- THIS triggers a local UI update without refetch

		// Call backend to update indices asynchronously (don't wait for it to finish)
		await reindexTasks(newOrder);

		// Keep selection and pending scroll
		selected = { type: 'task', id: moved.id };
		pendingScrollTarget = { type: 'task', id: moved.id };

		//await fetchTasks();
	}

	async function deleteSelected() {
		if (!canEditTasks()) return;
		if (!selected) return;

		const sel = selected!; // TypeScript: sel is NOT null after this

		// ---------- TASK ----------
		if (sel.type === 'task') {
			// Find which Task to scroll to after deletion (next or previous, if available)
			let scrollToTaskId = null;
			const deletedIndex = filteredTasks.findIndex((t) => t.id === sel.id);
			if (deletedIndex < filteredTasks.length - 1) {
				scrollToTaskId = filteredTasks[deletedIndex + 1]?.id;
			} else if (deletedIndex > 0) {
				scrollToTaskId = filteredTasks[deletedIndex - 1]?.id;
			}

			await supabase.from('tasks').delete().eq('id', sel.id).eq('project_id', projectId);
			const newTasks = tasks.filter((t) => t.id !== sel.id);
			await reindexTasks(newTasks);
			tasks = newTasks; // This is the key line: update the local array
			selected = null;
		}

		// ---------- SUBTASK ----------
		else if (sel.type === 'subtask' && sel.parentTaskId) {
			const task = tasks.find((t) => t.id === sel.parentTaskId);
			if (!task) return;

			// Find which Subtask to scroll to after deletion (next or previous, if available)
			let scrollToSubtaskId = null;
			const stList = task.subtasks;
			const deletedStIndex = stList.findIndex((st) => st.id === sel.id);
			if (deletedStIndex < stList.length - 1) {
				scrollToSubtaskId = stList[deletedStIndex + 1]?.id;
			} else if (deletedStIndex > 0) {
				scrollToSubtaskId = stList[deletedStIndex - 1]?.id;
			}

			await supabase
				.from('subtasks')
				.delete()
				.eq('id', sel.id)
				.eq('task_id', task.id)
				.eq('project_id', projectId);
			const newSubtasks = task.subtasks.filter((st) => st.id !== sel.id);
			await reindexSubtasks(task.id, newSubtasks);
			// Mutate local array:
			const taskIdx = tasks.findIndex((t) => t.id === task.id);
			if (taskIdx !== -1) {
				tasks[taskIdx] = { ...task, subtasks: newSubtasks };
			}
			selected = null;
		}
	}

	async function selectTask(taskId: string) {
		selected = { type: 'task', id: taskId };
		insertingAtIndex = null;
		editingTaskId = null;
		insertingSubtaskAt = null;
		editingSubtaskId = null;
		await fetchComments({ taskId });
	}
	async function selectSubtask(subtaskId: string, taskId: string) {
		selected = { type: 'subtask', id: subtaskId, parentTaskId: taskId };
		insertingAtIndex = null;
		editingTaskId = null;
		insertingSubtaskAt = null;
		editingSubtaskId = null;
		await fetchComments({ subtaskId });
	}

	// ---- Inline Edit ----
	async function startEdit() {
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
			editAssignedTo = task.assigned_to || '';

			editTaskSelectedItemIds = await fetchTaskItemLinks(task.id);
			console.log('[DEBUG] Selected items for editing:', editTaskSelectedItemIds);
		} else if (sel.type === 'subtask' && sel.parentTaskId) {
			const task = tasks.find((t) => t.id === sel.parentTaskId);
			const subtask = task?.subtasks.find((st) => st.id === sel.id);
			if (!subtask) return;
			editingSubtaskId = subtask.id;
			editSubtaskContent = subtask.content;
			editSubtaskStatus = subtask.status;
			editSubtaskDueDate = subtask.due_date;
			editSubtaskAssignedTo = subtask.assigned_to || '';
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

		if (centerMainEl) {
			pendingCenterMainScroll = centerMainEl.scrollTop;
		}

		const sanitizedAssignedTo =
			editAssignedTo && editAssignedTo.trim() !== '' ? editAssignedTo : null;

		const { error: err } = await supabase
			.from('tasks')
			.update({
				title: editTitle.trim(),
				description: editDescription.trim(),
				status: editStatus,
				due_date: editDueDate,
				last_edited_by: sessionValue?.user?.id,
				assigned_to: sanitizedAssignedTo
			})
			.eq('id', editingTaskId)
			.eq('project_id', projectId);

		savingEdit = false;
		if (err) {
			alert('Error saving task: ' + err.message);
		}

		// --- Update linked items in task_items ---
		// Remove all previous links
		await supabase.from('task_items').delete().eq('task_id', editingTaskId);

		// Insert new links, if any
		if (editTaskSelectedItemIds && editTaskSelectedItemIds.length > 0) {
			const links = editTaskSelectedItemIds.map((item_id) => ({
				task_id: editingTaskId,
				item_id,
				project_id: projectId,
				created_by: sessionValue?.user.id
			}));
			const { error: linkError } = await supabase.from('task_items').insert(links);
			if (linkError) {
				console.error('Failed to update linked items:', linkError.message);
				// Optionally: alert('Error updating item links: ' + linkError.message);
			}
		}
		editTaskSelectedItemIds = [];

		await fetchTaskItems();
		await fetchTasks();

		if (pendingCenterMainScroll !== null && centerMainEl) {
			centerMainEl.scrollTop = pendingCenterMainScroll;
			pendingCenterMainScroll = null;
		}

		editingTaskId = null;
	}

	// ---- Subtask CRUD/ordering ----
	function showInsertSubtaskForm(taskId: string, idx: number) {
		if (!canEditTasks()) return;
		insertingSubtaskAt = { taskId, index: idx };
		newSubtaskContent = '';
		newSubtaskStatus = 'open';
		newSubtaskDueDate = null;
		newSubtaskAssignedTo = '';
		editingTaskId = null;
		editingSubtaskId = null;
		insertingAtIndex = null;
		// Expand the task
		expandedTasks = new Set([...expandedTasks, taskId]);
	}
	async function createSubtask(taskId: string, atIndex: number | null = null) {
		if (!canEditTasks() || !newSubtaskContent.trim() || !sessionValue) return;
		creatingSubtask = true;
		const taskIdx = tasks.findIndex((t) => t.id === taskId);
		if (taskIdx === -1) return;
		const task = tasks[taskIdx];
		let inserted;
		let sort_index = task.subtasks.length;

		// -------------- Duplicate subtasks ------------------

		const { data: latestSubtasks, error: fetchError } = await supabase
			.from('subtasks')
			.select('content')
			.eq('task_id', taskId);

		if (fetchError) {
			alert('Error fetching subtasks: ' + fetchError.message);
			creatingSubtask = false;
			return;
		}

		const contentTrimmed = newSubtaskContent.trim();
		if (!contentTrimmed) {
			alert('Subtask content cannot be blank.');
			creatingSubtask = false;
			return;
		}
		const duplicateSubtask = (latestSubtasks ?? []).some(
			(st) => st.content.trim().toLowerCase() === contentTrimmed.toLowerCase()
		);
		if (duplicateSubtask) {
			alert('A subtask with this content already exists under this task.');
			creatingSubtask = false;
			return;
		}

		// ----------------------------------------------------

		if (atIndex !== null) {
			sort_index = atIndex + 1;
			console.log('Creating subtask with assigned_to:', newSubtaskAssignedTo);
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
						owner_id: sessionValue.user.id,
						last_edited_by: sessionValue.user.id,
						created_by_email: sessionValue.user.email,
						assigned_to: newSubtaskAssignedTo || null
					}
				])
				.select();
			creatingSubtask = false;
			if (err || !data || !data[0]) {
				alert('Error creating subtask: ' + (err?.message ?? 'unknown'));
				return;
			}
			inserted = data[0];
			const before = task.subtasks.slice(0, sort_index);
			const after = task.subtasks.slice(sort_index);
			const newSubtasks = [...before, inserted, ...after];
			await reindexSubtasks(task.id, newSubtasks);
			tasks[taskIdx] = { ...task, subtasks: newSubtasks };
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
						owner_id: sessionValue.user.id
					}
				])
				.select();
			creatingSubtask = false;
			if (err || !data || !data[0]) {
				alert('Error creating subtask: ' + (err?.message ?? 'unknown'));
				return;
			}
			inserted = data[0];
			tasks[taskIdx] = { ...task, subtasks: [...task.subtasks, inserted] };
		}

		recentlyAddedSubtaskId = inserted.id;
		if (newSubtaskBadgeTimeout) clearTimeout(newSubtaskBadgeTimeout);
		newSubtaskBadgeTimeout = setTimeout(() => {
			recentlyAddedSubtaskId = null;
		}, 60000);

		pendingScrollTarget = { type: 'subtask', id: inserted.id, parentTaskId: taskId };

		newSubtaskContent = '';
		newSubtaskStatus = 'open';
		newSubtaskDueDate = null;
		insertingSubtaskAt = null;
	}

	async function moveSelectedSubtask(offset: number) {
		if (!canEditTasks() || !selected || selected.type !== 'subtask' || !selected.parentTaskId)
			return;

		const sel = selected!;

		const taskIdx = tasks.findIndex((t) => t.id === sel.parentTaskId);
		if (taskIdx === -1) return;

		const task = tasks[taskIdx];
		const idx = task.subtasks.findIndex((st) => st.id === sel.id);
		if (idx === -1) return;

		const swapWith = idx + offset;
		if (swapWith < 0 || swapWith >= task.subtasks.length) return;

		// Create new subtasks order for this task
		const newSubtasks = [...task.subtasks];
		const [moved] = newSubtasks.splice(idx, 1);
		newSubtasks.splice(swapWith, 0, moved);

		await reindexSubtasks(task.id, newSubtasks);

		// Update only this task's subtasks locally, to avoid reload/flicker
		tasks[taskIdx] = {
			...task,
			subtasks: newSubtasks
		};

		// Keep the moved subtask selected
		selected = { type: 'subtask', id: moved.id, parentTaskId: task.id };
	}

	async function saveEditSubtask() {
		if (!canEditTasks() || !editingSubtaskId || !editSubtaskContent.trim() || !sessionValue) return;
		savingSubtaskEdit = true;

		// --- Capture scroll before reload
		if (centerMainEl) {
			pendingCenterMainScroll = centerMainEl.scrollTop;
		}

		const { error: err } = await supabase
			.from('subtasks')
			.update({
				content: editSubtaskContent.trim(),
				status: editSubtaskStatus,
				due_date: editSubtaskDueDate,
				last_edited_by: sessionValue.user.id,
				assigned_to: editSubtaskAssignedTo || null // save null if blank/unassigned
			})
			.eq('id', editingSubtaskId)
			.eq('project_id', projectId);
		savingSubtaskEdit = false;
		if (err) {
			alert('Error saving subtask: ' + err.message);
		}
		await fetchTasks();

		// --- Restore scroll after reload
		if (pendingCenterMainScroll !== null && centerMainEl) {
			centerMainEl.scrollTop = pendingCenterMainScroll;
			pendingCenterMainScroll = null;
		}

		editingSubtaskId = null;
	}

	// -------------- Comments logic comments --------------
	async function addComment() {
		if (!selected || !newCommentText.trim() || addingComment) return;
		addingComment = true;

		let commentPayload: any = {
			content: newCommentText.trim(),
			created_at: new Date().toISOString(),
			user_id: sessionValue?.user?.id,
			project_id: projectId
		};

		if (selected.type === 'task') {
			commentPayload.task_id = selected.id;
		}
		if (selected.type === 'subtask') {
			commentPayload.subtask_id = selected.id;
		}

		const { error } = await supabase.from('comments').insert([commentPayload]);

		addingComment = false;
		if (error) {
			alert('Error adding comment: ' + error.message);
			return;
		}
		newCommentText = '';
		// Re-fetch comments
		if (selected.type === 'task') await fetchComments({ taskId: selected.id });
		if (selected.type === 'subtask') await fetchComments({ subtaskId: selected.id });
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
			fetchItems();
			fetchTaskItems();
		}
	});
	session.subscribe((s) => {
		sessionValue = s;
		if (projectId && projectId.length >= 10) {
			loadProject();
			fetchTasks();
			fetchTaskItems();
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
		if (!selected) return;

		if (selected.type === 'subtask' && selected.parentTaskId) {
			const parentTask = tasks.find((t) => t.id === selected?.parentTaskId);
			const stIdx = parentTask?.subtasks.findIndex((st) => st.id === selected?.id) ?? -1;
			showInsertSubtaskForm(selected.parentTaskId, stIdx);
		} else if (selected.type === 'task') {
			const parentTask = tasks.find((t) => t.id === selected?.id);
			const lastIdx =
				parentTask && parentTask.subtasks.length > 0 ? parentTask.subtasks.length - 1 : -1;
			showInsertSubtaskForm(selected.id, lastIdx);
		}
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

<!-- Main page layout main -->
<div class="project-page-layout">
	{#if loadingProject}
		<p>Loading project...</p>
	{:else if errorProject}
		<p style="color:red;">{errorProject}</p>
	{:else if project}
		<!-- Left side pane left -->
		<aside class="left-pane">
			<!-- 1. Back button -->
			<button class="nav-btn" on:click={() => goto('/projects')}>← All Projects</button>

			<!-- 2. Project name -->
			<h2 style="margin:1.2em 0 0.5em 0;">{project.name}</h2>

			<!-- 3. Project description -->
			<div class="desc">{project.description}</div>

			<!-- 4. Deadline -->
			<div class="deadline">
				<b>Deadline:</b>
				{project.deadline ? formatDate(project.deadline) : '—'}
			</div>

			<!-- 5. Role -->
			<div class="role-row">
				<span class="role-badge">{myRole && `Role: ${myRole}`}</span>
			</div>

			<!-- 6. Edit Project button edit project -->
			{#if isCreator}
				<button
					class="toolbar-btn"
					class:active-tab={showEditProjectPanel}
					on:click={() => {
						showEditProjectPanel = !showEditProjectPanel;
						showMembersPanel = false;
						if (showEditProjectPanel && project) {
							editProjectName = project.name;
							editProjectDesc = project.description ?? '';
							editProjectDeadline = project.deadline ?? null;
						}
					}}
					style="width:100%; margin:1.3em 0 0.7em 0;">✏️ Edit Project</button
				>
			{/if}

			<!-- 7. Members button members -->
			<button
				class:active-tab={showMembersPanel}
				class="toolbar-btn"
				on:click={() => {
					showMembersPanel = !showMembersPanel;
					showEditProjectPanel = false;
				}}
				style="width:100%; margin-bottom:2em;">👥 Members</button
			>

			<!-- 7. Items button items -->
			<button
				class="toolbar-btn"
				class:active-tab={showItemsPanel}
				on:click={() => {
					showItemsPanel = !showItemsPanel;
					showMembersPanel = false;
					showEditProjectPanel = false;
				}}
				style="width:100%; margin-bottom:2em;"
			>
				📦 Items
			</button>

			<!-- 8. Delete Project button delete at the bottom -->
			<div style="flex:1"></div>
			<!-- pushes delete button to the bottom -->
			{#if myRole === 'admin' || isCreator}
				<button
					class="delete-project-btn"
					on:click={handleDeleteProject}
					disabled={deletingProject}
					style="width:100%; margin-top:auto;">🗑️ Delete Project</button
				>
			{/if}
		</aside>

		<!-- Center and center top panes -->
		<div class="center-pane">
			<div class="center-top">
				<div class="action-toolbar">
					<!-- Add Task Button, always visible -->
					<button class="toolbar-btn" on:click={() => (showAddTaskModal = true)}> Add Task </button>

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
							!(selected.type === 'task' || selected.type === 'subtask') ||
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
								(editingTaskId !== null ||
									filteredTasks.findIndex((t) => t.id === selected?.id) <= 0)) ||
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
									filteredTasks.findIndex((t) => t.id === selected?.id) ===
										filteredTasks.length - 1)) ||
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
							(selected.type === 'subtask' && editingSubtaskId !== null)}
					>
						Edit
					</button>

					<button
						class="toolbar-btn delete-btn"
						on:click={deleteSelected}
						disabled={!canEditTasks() ||
							!selected ||
							(selected.type === 'task' && editingTaskId !== null) ||
							(selected.type === 'subtask' && editingSubtaskId !== null)}
					>
						Delete
					</button>
				</div>
			</div>

			<div class="center-main" bind:this={centerMainEl}>
				{#if loadingTasks}
					<p>Loading tasks…</p>
				{:else if errorTasks}
					<p style="color:red;">{errorTasks}</p>
				{:else if tasks.length === 0}
					<!-- add first task new task when no tasks exist -->
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
									<button
										type="button"
										on:click={() => (newDueDate = null)}
										style="margin-right:0.3em;">❌</button
									>
								{/if}

								<select bind:value={newTaskAssignedTo} style="margin-right:0.5em;">
									<option value="">Unassigned</option>
									{#each members as m}
										{#if m.user_id}
											<option value={m.user_id}>{m.email}</option>
										{/if}
									{/each}
								</select>

								<!-- ---------- items checklist --------- -->
								<ItemChecklist
									{items}
									selectedIds={editTaskSelectedItemIds}
									onChange={(ids) => (editTaskSelectedItemIds = ids)}
								/>

								<button type="submit" disabled={creating || !newTitle.trim()}>
									{creating ? 'Adding…' : 'Insert Task'}
								</button>
								<button type="button" on:click={() => (insertingAtIndex = null)}>Cancel</button>
							</form>
						{/if}
					</div>
				{:else}
					<table class="task-table">
						<!-- ------ task table header -------- -->
						<thead>
							<tr>
								<th style="width:3em;">ID</th>
								<th style="width:3em;"></th>
								<th style="width:2em;"></th>
								<th style="width:32%;">Task</th>
								<th style="width:18%;">Assigned to</th>
								<th class="date-cell">Due Date</th>
								<th style="width:12%;">Edited by</th>
							</tr>
						</thead>

						<tbody>
							{#each filteredTasks as task, i}
								<!-- ------ task table -------- -->
								<tr
									class:selected-row={selected &&
										selected.type === 'task' &&
										selected.id === task.id}
									class:highlight-missing-items={taskIdToItems[task.id]?.some(
										(item) => item.status === 'not_present'
									)}
									id={'task-' + task.id}
									style="cursor:pointer;"
									on:click={() => selectTask(task.id)}
									on:dblclick={startEdit}
								>
									<!-------- Task ID task id --------->
									<td class="short-id">{task.short_id}</td>

									<!-------- Color circle dot --------->
									<td>
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<span
											class="status-dot status-dot-clickable"
											style="background:{statusDotColor(
												task.status,
												isOverdue(task.due_date, task.status)
											)};
         border-color:{isOverdue(task.due_date, task.status) ? overdueColor : '#aaa'};"
											title="Click to change status"
											on:click|stopPropagation={(e) => openStatusMenu(e, task)}
										></span>
										{#if statusMenuOpenFor && taskForStatusMenu}
											<div
												class="status-menu-popover"
												style="position:fixed; left:{statusMenuPos.x}px; top:{statusMenuPos.y}px; z-index:99999;"
												bind:this={statusMenuPopoverEl}
												role="dialog"
												aria-label="Change task status"
												tabindex="0"
												on:click|stopPropagation
												on:keydown={(e) => {
													if (e.key === 'Escape') closeStatusMenu();
												}}
											>
												<div class="popover-arrow"></div>
												{#each Object.entries(statusColors) as [status, color]}
													{#if status !== 'overdue'}
														<button
															type="button"
															class="status-menu-dot"
															style="background:{color}; border-color:{status ===
															taskForStatusMenu.status
																? '#1976d2'
																: '#bbb'};"
															title={status}
															aria-label={'Set status to ' + status}
															on:click={() => setTaskStatus(taskForStatusMenu, status as Status)}
														></button>
													{/if}
												{/each}
											</div>
										{/if}
									</td>

									<!-------- Expand subtasks if any +/- --------->
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

									{#if editingTaskId === task.id}
										<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
										<td colspan="4" class="edit-form-row">
											<!-- svelte-ignore a11y_click_events_have_key_events -->
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

												<!-- ------ Assign to assign -------- -->
												<select bind:value={editAssignedTo} style="margin-right:0.5em;">
													<option value="">Unassigned</option>
													{#each members as m}
														{#if m.user_id}
															<option value={m.user_id}>{m.email}</option>
														{/if}
													{/each}
												</select>

												<!-- ---------- items checklist --------- -->
												<!-- <ItemChecklist
													{items}
													selectedIds={editTaskSelectedItemIds}
													onChange={(ids) => (editTaskSelectedItemIds = ids)}
												/> -->

												<button type="submit" disabled={savingEdit || !editTitle.trim()}
													>Save</button
												>
												<button type="button" on:click={cancelEdit} disabled={savingEdit}
													>Cancel</button
												>
											</form>
										</td>
									{:else}
										<!-- ------- task title ------ -->
										<td>
											{task.title}
											{#if recentlyAddedTaskId === task.id}
												<span class="new-badge">New</span>
											{/if}
										</td>

										<!-- ------- task assigned to ------ -->
										<td>
											{#if task.assigned_to}
												{#if userMap[task.assigned_to]}
													<span title={userMap[task.assigned_to]}>
														{getInitials(userMap[task.assigned_to])}
													</span>
												{:else}
													<span title="User not found">{task.assigned_to}</span>
												{/if}
											{:else}
												—
											{/if}
										</td>

										<!-- Task description
										<td>{task.description}</td> -->

										<!-- Task created by
										<td class="created-by">
											{#if task.created_by_email}
												{#if task.created_by_email === sessionValue?.user?.email}
													You
												{:else}
													<span title={task.created_by_email}
														>{getInitials(task.created_by_email)}</span
													>
												{/if}
											{:else}
												—
											{/if}
										</td> -->

										<!-- Task due date -->
										<td class="date-cell">
											{#if task.due_date}
												{formatDate(task.due_date)}
											{/if}
										</td>
										<td class="edited-by">
											{#if task.last_edited_by && userMap[task.last_edited_by]}
												<span title={userMap[task.last_edited_by]}>
													{getInitials(userMap[task.last_edited_by])}
												</span>
											{:else}
												—
											{/if}
										</td>
									{/if}
								</tr>

								<!-- insert form row (task) -->
								{#if insertingAtIndex === i}
									<tr class="insert-form-row" bind:this={insertRowEl}>
										<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
										<td colspan="5">
											<!-- svelte-ignore a11y_click_events_have_key_events -->
											<form
												on:submit|preventDefault={() => createTask(filteredIndexToTasksIndex(i))}
												on:click|stopPropagation
											>
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

												<select bind:value={newTaskAssignedTo} style="margin-right:0.5em;">
													<option value="">Unassigned</option>
													{#each members as m}
														{#if m.user_id}
															<option value={m.user_id}>{m.email}</option>
														{/if}
													{/each}
												</select>

												<!-- ---------- items checklist --------- -->
												<ItemChecklist
													{items}
													selectedIds={newTaskSelectedItemIds}
													onChange={(ids) => (newTaskSelectedItemIds = ids)}
												/>

												<button type="submit" disabled={creating || !newTitle.trim()}>
													{creating ? 'Adding…' : 'Insert Task'}
												</button>
												<button type="button" on:click={() => (insertingAtIndex = null)}
													>Cancel</button
												>
											</form>
										</td>
									</tr>
								{/if}

								<!-- SUBTASK ROWS subtasks rows (only if expanded) -->
								{#if expandedTasks.has(task.id)}
									{#each task.subtasks as subtask, stIdx}
										<tr
											class:selected-row={selected &&
												selected.type === 'subtask' &&
												selected.id === subtask.id}
											class="subtask-row"
											id={'subtask-' + subtask.id}
											style="cursor:pointer;"
											on:click={() => selectSubtask(subtask.id, task.id)}
											on:dblclick={startEdit}
										>
											<td></td>
											<!-- <td><span class="subtask-indent"></span></td> -->

											<!-- Subtask ID subtask id (only if expanded) -->
											<td class="short-id">{subtask.short_id}</td>

											<!-- --------------- Subtask status dot ----------- -->
											<td style="position: relative;">
												<!-- Subtask status dot (now as button for accessibility) -->
												<button
													type="button"
													class="status-dot status-dot-clickable"
													style="background:{statusDotColor(
														subtask.status,
														isOverdue(subtask.due_date, subtask.status)
													)};
        border-color:{isOverdue(subtask.due_date, subtask.status) ? overdueColor : '#aaa'};"
													title="Click to change status"
													aria-label="Change subtask status"
													on:click|stopPropagation={(e) => openSubtaskStatusMenu(e, subtask)}
													on:keydown={(e) => {
														// Allow keyboard access to open the popover with Enter/Space
														if ((e.key === 'Enter' || e.key === ' ') && !subtaskStatusMenuOpenFor) {
															openSubtaskStatusMenu(e, subtask);
														}
													}}
												></button>

												{#if subtaskStatusMenuOpenFor === subtask.id}
													<div
														class="status-menu-popover"
														role="dialog"
														aria-label="Change subtask status"
														tabindex="0"
														style="
				position: absolute;
				left: 50%;
				bottom: 120%;
				transform: translateX(-50%);
				z-index: 99999;
			"
														bind:this={subtaskStatusMenuPopoverEl}
														on:click|stopPropagation
														on:keydown={(e) => {
															if (e.key === 'Escape') closeSubtaskStatusMenu();
														}}
													>
														{#each Object.entries(statusColors) as [status, color]}
															{#if status !== 'overdue'}
																<button
																	type="button"
																	class="status-menu-dot"
																	style="background:{color}; border-color:{status === subtask.status
																		? '#1976d2'
																		: '#bbb'};"
																	title={status}
																	aria-label={'Set status to ' + status}
																	on:click={() =>
																		setSubtaskStatus(subtask, status as Status, task.id)}
																></button>
															{/if}
														{/each}
													</div>
												{/if}
											</td>

											{#if editingSubtaskId === subtask.id}
												<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
												<td colspan="3" class="subtask-edit-row">
													<!-- svelte-ignore a11y_click_events_have_key_events -->
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

														<select bind:value={editSubtaskAssignedTo} style="margin-right:0.5em;">
															<option value="">Unassigned</option>
															{#each members as m}
																{#if m.user_id}
																	<option value={m.user_id}>{m.email}</option>
																{/if}
															{/each}
														</select>

														<button
															type="submit"
															disabled={savingSubtaskEdit || !editSubtaskContent.trim()}
															>Save</button
														>
														<button type="button" on:click={cancelEdit} disabled={savingSubtaskEdit}
															>Cancel</button
														>
													</form>
												</td>
											{:else}
												<!-- <td></td> -->
												<td>
													{subtask.content}
													{#if subtask.id === recentlyAddedSubtaskId}
														<span class="new-badge">New</span>
													{/if}
												</td>

												<!-- Subtask assigned to -->
												<td>
													{#if subtask.assigned_to}
														{#if userMap[subtask.assigned_to]}
															<span title={userMap[subtask.assigned_to]}>
																{getInitials(userMap[subtask.assigned_to])}
															</span>
														{:else}
															<span title="User not found">{subtask.assigned_to}</span>
														{/if}
													{:else}
														—
													{/if}
												</td>

												<td class="date-cell">
													{#if subtask.due_date}
														{formatDate(subtask.due_date)}
													{/if}
												</td>

												<td class="edited-by">
													{#if subtask.last_edited_by && userMap[subtask.last_edited_by]}
														<span title={userMap[subtask.last_edited_by]}>
															{getInitials(userMap[subtask.last_edited_by])}
														</span>
													{:else}
														—
													{/if}
												</td>
											{/if}
										</tr>
										<!-- Insert form row (Subtask) -->
										{#if insertingSubtaskAt && insertingSubtaskAt.taskId === task.id && insertingSubtaskAt.index === stIdx}
											<tr class="subtask-insert-row" bind:this={insertSubtaskRowEl}>
												<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
												<td colspan="5">
													<!-- svelte-ignore a11y_click_events_have_key_events -->
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

														<select bind:value={newSubtaskAssignedTo} style="margin-right:0.5em;">
															<option value="">Unassigned</option>
															{#each members as m}
																{#if m.user_id}
																	<option value={m.user_id}>{m.email}</option>
																{/if}
															{/each}
														</select>

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

									<!-- Add Subtasks button add subtask -->
									{#if insertingSubtaskAt && insertingSubtaskAt.taskId === task.id && task.subtasks.length === 0}
										<tr class="subtask-insert-row" bind:this={insertSubtaskRowEl}>
											<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
											<td colspan="5">
												<!-- svelte-ignore a11y_click_events_have_key_events -->
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

													<select bind:value={newSubtaskAssignedTo} style="margin-right:0.5em;">
														<option value="">Unassigned</option>
														{#each members as m}
															{#if m.user_id}
																<option value={m.user_id}>{m.email}</option>
															{/if}
														{/each}
													</select>

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
								{/if}
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		</div>

		<!-- -------------------------------------------------------------------------------------------------------- -->
		<!-- --------------------------------- Right side pane right pane ------------------------------------- -->
		<aside class="right-pane">
			{#if selected}
				<div class="right-pane-inner">
					<!-- -------- Section ----------- Header -->
					<div class="details-section">
						<div class="section-header">
							<!-- <span class="section-icon">📝</span> -->
							<span class="section-title">
								{selected.type === 'task' ? 'Task' : 'Subtask'}
							</span>

							<!-- --------------- Edit Name/Content ------ block ------------------- -->
							<!-- -------------------T-Name, ST-Content-------------------------------->
							{#if selected && selected.type === 'task' && selectedTask}
								{#if editingTaskRP}
									<input
										type="text"
										bind:value={editTaskTitleRP}
										placeholder="Task name"
										required
										maxlength="80"
										style="width:100%;font-weight:600;"
									/>
								{:else}
									<span style="margin-left:0.8em;font-weight:bold;font-size:1.1em;">
										{selectedTask.title}
										<button
											class="edit-title-btn"
											title="Edit task name"
											on:click={() => {
												editingTaskRP = true;
												editTaskTitleRP = selectedTask.title;
											}}
											style="margin-left: 0.5em; background: none; border: none; color: #1976d2; cursor: pointer;"
										>
											✏️
										</button>
									</span>
								{/if}
							{:else if selected && selected.type === 'subtask' && selectedSubtask}
								{#if editingSubtaskRP}
									<input
										type="text"
										bind:value={editSubtaskContentRP}
										placeholder="Task name"
										required
										maxlength="80"
										style="width:100%;font-weight:600;"
									/>
								{:else}
									<span style="margin-left:0.8em;font-weight:bold;font-size:1.1em;">
										{selectedSubtask.content}
										<button
											class="edit-title-btn"
											title="Edit task name"
											on:click={() => {
												editingSubtaskRP = true;
												editSubtaskContentRP = selectedSubtask.content;
											}}
											style="margin-left: 0.5em; background: none; border: none; color: #1976d2; cursor: pointer;"
										>
											✏️
										</button>
									</span>
								{/if}
							{/if}

							<!-- ------------------------- Status --------- block ------------- -->
							<!-- ----------------------------------------------------------------->
							{#if selected && selected.type === 'task' && selectedTask}
								<select bind:value={editTaskStatusRP} style="margin-left:0.5em;">
									<option value="open">Open</option>
									<option value="in_progress">In Progress</option>
									<option value="done">Done</option>
								</select>
							{:else if selected && selected.type === 'subtask' && selectedSubtask}
								<select bind:value={editSubtaskStatusRP} style="margin-left:0.5em;">
									<option value="open">Open</option>
									<option value="in_progress">In Progress</option>
									<option value="done">Done</option>
								</select>
							{/if}
							<!-- ----------------------------------------------------------------->
						</div>

						<!-- ----------------------- Created by --------- block ------------- -->
						<!-- ------------------------------------------------------------------->
						{#if selected && selected.type === 'task' && selectedTask}
							<div class="created-by-line">
								<b>Created by:</b>
								{#if selectedTask.created_by_email}
									<span title={selectedTask.created_by_email}>
										{selectedTask.created_by_email === sessionValue?.user?.email
											? 'You'
											: getInitials(selectedTask.created_by_email)}
									</span>
								{:else}
									—
								{/if}
							</div>
						{:else if selected && selected.type === 'subtask' && selectedSubtask}
							<div class="created-by-line">
								Created by:
								{#if selectedSubtask.created_by_email}
									<span title={selectedSubtask.created_by_email}>
										{selectedSubtask.created_by_email === sessionValue?.user?.email
											? 'You'
											: getInitials(selectedSubtask.created_by_email)}
									</span>
								{:else}
									—
								{/if}
							</div>
						{/if}

						<!-- ------------------------- Assigned to ------- block ------------ -->
						<!-- ------------------------------------------------------------------->
						{#if selected && selected.type === 'task' && selectedTask}
							<select bind:value={editTaskAssignedToRP} style="margin-left:0.5em;">
								<option value="">Unassigned</option>
								{#each members as m}
									{#if m.user_id}
										<option value={m.user_id}>{m.email}</option>
									{/if}
								{/each}
							</select>
						{:else if selected && selected.type === 'subtask' && selectedSubtask}
							<select bind:value={editSubtaskAssignedToRP} style="margin-left:0.5em;">
								<option value="">Unassigned</option>
								{#each members as m}
									{#if m.user_id}
										<option value={m.user_id}>{m.email}</option>
									{/if}
								{/each}
							</select>
						{/if}

						<!-- --------------- Due date ------- block -------- -->
						<!-- -------------------------------------------------->
						{#if selected && selected.type === 'task' && selectedTask}
							<input type="date" bind:value={editTaskDueDateRP} style="margin-left:0.5em;" />
						{:else if selected && selected.type === 'subtask' && selectedSubtask}
							<input type="date" bind:value={editSubtaskDueDateRP} style="margin-left:0.5em;" />
						{/if}

						<!-- ------------ Description ------- block -------- -->
						<!-- -------------------------------------------------->
						{#if selected && selected.type === 'task' && selectedTask}
							<div class="task-description-block">
								<b>Description:</b>
								{#if selectedTask.description?.trim()}
									<textarea
										bind:value={editTaskDescriptionRP}
										maxlength="200"
										rows="2"
										placeholder="Description (optional)"
										style="width:100%;margin-top:0.5em;"
									></textarea>
								{:else}
									<span style="color:#888; margin-left:0.5em;">(No description provided)</span>
								{/if}
							</div>
						{/if}

						<!-- ------------- Task Items ------- Block --------- -->
						<!-- --------------------------------------------------->
						{#if selected && selected.type === 'task' && selectedTask}
							<div class="task-items-block">
								<b>Items required for this task:</b>
								{#if items.length === 0}
									<span style="color:#888;">No items defined for this project.</span>
								{:else if showAllItems}
									<ItemChecklist
										{items}
										selectedIds={selectedTaskItemIds}
										disabled={savingItems}
										showStatus={true}
										onChange={handleRightPaneItemsChange}
									/>
									{#if selectedTaskItemIds.length === 0}
										<span style="color:#888; margin-left:0.8em;">
											No items are currently required for this task. Click button below to add
											requirements.
										</span>
									{/if}
									<button class="expand-items-btn" on:click={toggleShowAllItems}
										>Hide details</button
									>
									{#if savingItems}
										<span style="color:#888; margin-left:0.8em;">Saving…</span>
									{/if}
								{:else}
									{#if selectedTaskItemIds.length === 0}
										<span style="color:#888; margin-left:0.8em;">
											No items are currently required for this task. Click button below to add
											requirements.
										</span>
									{:else if missingItemsSummary.length > 0}
										<ul class="task-items-summary-list">
											{#each missingItemsSummary as item}
												<li>
													<span
														class="status-dot"
														style="background:#e74c3c; border-color:#aaa; width:0.9em; height:0.9em; border-radius:50%; display:inline-block; margin-right:0.4em;"
													>
													</span>
													{item.name}
												</li>
											{/each}
										</ul>
										<span style="color:#e74c3c; margin-left:0.4em;">
											{missingItemsSummary.length} required item{missingItemsSummary.length > 1
												? 's are'
												: ' is'} missing.
										</span>
									{:else}
										<span style="color:#47e37a;">✔ All required items are present.</span>
									{/if}
									<button class="expand-items-btn" on:click={toggleShowAllItems}
										>Show all items</button
									>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Section Divider -->
					<!-- <div class="section-divider"></div> -->

					<!-- ----------------- Comments ------ block -------- -->
					<!-- --------------------------------------------------->
					<section class="comments-section">
						<h4>Comments</h4>
						{#if loadingComments}
							<p>Loading…</p>
						{:else if comments.length === 0}
							<p style="color:#888;">No comments yet.</p>
						{:else}
							<ul class="comments-list">
								{#each comments as comment}
									<li class="comment-row">
										<span class="comment-initials">
											{getInitials(userMap[comment.user_id] ?? 'U')}
										</span>
										<span class="comment-meta">
											<!-- <span class="comment-author">{userMap[comment.user_id] ?? 'Unknown'}</span> -->
											<span class="comment-time">{formatDateTime(comment.created_at)}</span>
										</span>
										<div class="comment-text">{comment.content}</div>
									</li>
								{/each}
							</ul>
						{/if}

						<!-- Add Comment Input -->
						<form
							on:submit|preventDefault={addComment}
							style="margin-top: 1em; display:flex; gap:0.7em;"
						>
							<textarea
								bind:value={newCommentText}
								placeholder="Write a comment…"
								required
								rows="2"
								style="flex:1;resize:vertical;"
							>
							</textarea>
							<button type="submit" disabled={addingComment || !newCommentText.trim()}>
								{addingComment ? 'Adding…' : 'Add'}
							</button>
						</form>
					</section>

					<!-- ----------------------- save button and cancel button -------------------------- -->
					<!-- ----------------------------------------------------------------------------->
					<div class="right-pane-actions" style="display: flex; gap: 1em; margin: 2em 0 0 0;">
						{#if selected.type === 'task' && selectedTask}
							<button
								type="button"
								class="toolbar-btn"
								on:click={saveTaskEdit}
								disabled={!isTaskChanged || savingEdit}
							>
								Save
							</button>
						{:else if selected.type === 'subtask' && selectedSubtask}
							<button
								type="button"
								class="toolbar-btn"
								on:click={saveSubtaskEdit}
								disabled={!isSubtaskChanged || savingEdit}
							>
								Save
							</button>
						{/if}

						{#if selected.type === 'task' && selectedTask}
							<button type="button" class="toolbar-btn" on:click={cancelTaskEdit}> Cancel </button>
						{:else if selected.type === 'subtask' && selectedSubtask}
							<button type="button" class="toolbar-btn" on:click={cancelSubtaskEdit}>
								Cancel
							</button>
						{/if}

						<!-- <button type="button" class="toolbar-btn" on:click={cancelTaskEdit}> Cancel </button> -->
					</div>
					<!-- ----------------------------------------------------------------------------->
				</div>
			{/if}
		</aside>

		<!-- -------------------------------------------------------------------------------------------------------- -->

		<!-- Members panel members -->
		{#if showMembersPanel}
			<div
				class="panel-overlay"
				role="button"
				tabindex="0"
				aria-label="Close panel"
				on:click={closePanels}
				on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && closePanels()}
			></div>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- svelte-ignore a11y_interactive_supports_focus -->
			<div
				class="panel-drawer members-drawer"
				role="dialog"
				aria-modal="true"
				aria-label="Project members"
				on:click|stopPropagation
			>
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
												{removingUserId === (m.user_id || m.invited_email) ? 'Removing…' : 'Remove'}
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
						{#if inviteError}<span style="color:#c00; margin-left:0.7em;">{inviteError}</span>{/if}
						{#if inviteSuccess}<span style="color:#080; margin-left:0.7em;">{inviteSuccess}</span
							>{/if}
					</div>
				{/if}

				<button on:click={closePanels} class="close-panel-btn">Close</button>
			</div>
		{/if}

		<!-- Edit panel edit (only creator can see) -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		{#if showEditProjectPanel && isCreator}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div class="panel-overlay" on:click={closePanels}></div>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_interactive_supports_focus -->
			<div
				class="panel-drawer edit-drawer"
				role="dialog"
				aria-modal="true"
				aria-label="Edit project"
				on:click|stopPropagation
			>
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
					<!-- svelte-ignore element_invalid_self_closing_tag -->
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

				<button on:click={closePanels} class="close-panel-btn">Close</button>
			</div>
		{/if}

		<!---------------------- Items panel items ------------------------->
		{#if showItemsPanel}
			<div
				class="panel-overlay"
				role="button"
				tabindex="0"
				aria-label="Close items panel"
				on:click={() => (showItemsPanel = false)}
				on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && (showItemsPanel = false)}
			></div>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				class="panel-drawer items-drawer"
				role="dialog"
				aria-modal="true"
				aria-label="Project items"
				tabindex="0"
				on:click|stopPropagation
			>
				<h3>Items</h3>
				{#if errorItems}
					<div style="color:#c00;">{errorItems}</div>
				{/if}
				{#if loadingItems}
					<p>Loading items…</p>
				{:else}
					<!-- Add new item form -->
					<form
						on:submit|preventDefault={addNewItem}
						style="display:flex; gap:0.8em; align-items:center; margin-bottom:1em;"
					>
						<input
							type="text"
							placeholder="Item name (e.g. ID Card)"
							bind:value={newItemName}
							required
							style="flex:1; min-width:0;"
						/>
						<button
							type="submit"
							style="background:#1976d2;color:#fff;border:none;padding:0.35em 1.5em;border-radius:0.6em;"
							disabled={addingItem || loadingItems}
						>
							{addingItem ? 'Adding…' : 'Add'}
						</button>
					</form>
					<ul style="padding:0;">
						{#each items as item, idx (item.id)}
							<li style="display:flex;align-items:center;gap:1em;padding:0.6em 0;">
								<span>{item.name}</span>

								<button
									type="button"
									aria-label="Toggle status"
									style="
                    width:1.2em;height:1.2em;display:inline-block;border-radius:0.6em;
                    background:{item.status === 'present' ? '#47e37a' : '#e74c3c'};
                    box-shadow:0 1px 4px #0001;vertical-align:middle;cursor:pointer;border:none;
                "
									on:click={() => toggleItemStatus(item.id, item.status)}
									title={item.status === 'present' ? 'Mark as not present' : 'Mark as present'}
								></button>

								<span style="flex:1"></span>
								<!-------- remove item button -------->
								<button
									type="button"
									style="background:#eee;color:#c00;border:none;border-radius:0.5em;padding:0.25em 1.1em;"
									on:click={() => removeItem(item.id)}
									disabled={removingItemId === item.id}
								>
									{removingItemId === item.id ? 'Removing…' : 'Remove'}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
				<button on:click={() => (showItemsPanel = false)} class="close-panel-btn">Close</button>
			</div>
		{/if}

		<!---------------------- add task button ----------------------->
		{#if showAddTaskModal}
			<div
				class="modal-backdrop"
				tabindex="0"
				aria-modal="true"
				role="dialog"
				aria-label="Add Task"
				on:keydown={(e) => e.key === 'Escape' && (showAddTaskModal = false)}
				on:click={() => (showAddTaskModal = false)}
			>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div class="modal" tabindex="0" on:click|stopPropagation role="document">
					<div class="modal-header">
						<h3>Add Task</h3>
						<button
							type="button"
							aria-label="Close"
							class="close-modal-btn"
							on:click={() => (showAddTaskModal = false)}>×</button
						>
					</div>
					<div class="modal-body">
						<!-- ----------------------Form will be added here next-------------------------- -->
						<!-- <p>[Form goes here]</p> -->
						<form autocomplete="off" on:submit|preventDefault={handleModalSave}>
							<div class="form-group">
								<label for="task-title"><b>Title</b> <span style="color:#e74c3c">*</span></label>
								<input
									id="task-title"
									type="text"
									bind:value={modalTaskTitle}
									placeholder="Enter task title"
									required
									maxlength="80"
									style="width:100%;margin-bottom:1em;"
									bind:this={inputEl}
								/>
							</div>
							<div class="form-group">
								<label for="task-desc"><b>Description</b></label>
								<textarea
									bind:value={modalTaskDescription}
									maxlength="200"
									rows="3"
									placeholder="Description (optional)"
								></textarea>
							</div>
							<div class="form-row" style="display:flex;gap:1em;">
								<div>
									<label for="task-status"><b>Status</b></label>
									<select id="task-status" bind:value={modalTaskStatus} style="margin-left:0.5em;">
										<option value="open">Open</option>
										<option value="in_progress">In Progress</option>
										<option value="done">Done</option>
									</select>
								</div>
								<div>
									<label for="task-due-date"><b>Due date</b></label>
									<input id="task-due-date" type="date" bind:value={modalTaskDueDate} />
								</div>
								<div>
									<label for="task-assigned-to"><b>Assign to</b></label>
									<select
										id="task-assigned-to"
										bind:value={newTaskAssignedTo}
										style="margin-left:0.5em;"
									>
										<option value="">Unassigned</option>
										{#each members as m}
											{#if m.user_id}
												<option value={m.user_id}>{m.email}</option>
											{/if}
										{/each}
									</select>
								</div>
							</div>
							<!-- ------------ item group add new task------------ -->
							<div class="form-group">
								<span class="form-label"><b>Items required</b></span>
								<!-- <ItemChecklist
									{items}
									selectedIds={modalTaskSelectedItemIds}
									onChange={(ids) => (modalTaskSelectedItemIds = ids)}
								/> -->
								<ul style="list-style:none;padding:0;margin:0;">
									{#each items as item}
										<li style="display:flex;align-items:center;gap:0.7em;margin-bottom:0.35em;">
											<!-- Status dot: green for present, red for missing -->
											<span
												style="
                        width:1em;
                        height:1em;
                        border-radius:0.5em;
                        background: {item.status === 'present' ? '#47e37a' : '#e74c3c'};
                        border: 1.5px solid #aaa;
                        display:inline-block;
                    "
												title={item.status === 'present' ? 'Present' : 'Missing'}
											></span>

											<!-- The item selection checkbox -->
											<input
												type="checkbox"
												id={'item-' + item.id}
												checked={modalTaskSelectedItemIds.includes(item.id)}
												on:change={() => {
													// Toggle logic
													if (modalTaskSelectedItemIds.includes(item.id)) {
														modalTaskSelectedItemIds = modalTaskSelectedItemIds.filter(
															(i) => i !== item.id
														);
													} else {
														modalTaskSelectedItemIds = [...modalTaskSelectedItemIds, item.id];
													}
												}}
											/>

											<label for={'item-' + item.id} style="flex:1;">
												{item.name}
											</label>

											<span
												style="font-size:0.94em;color:{item.status === 'present'
													? '#47e37a'
													: '#e74c3c'};"
											>
												{item.status === 'present' ? 'Present' : 'Missing'}
											</span>
										</li>
									{/each}
								</ul>
							</div>
							<div style="margin-top:1.2em;display:flex;gap:1em;">
								<button
									type="submit"
									class="toolbar-btn"
									disabled={isSaving || !modalTaskTitle.trim()}>Save</button
								>
								<button
									type="button"
									class="toolbar-btn"
									on:click={handleSaveAndAddAnother}
									disabled={isSaving || !modalTaskTitle.trim()}
								>
									Save and Add Another
								</button>
								<button type="button" class="toolbar-btn" on:click={closeModal}>Cancel</button>
							</div>
						</form>
					</div>
					<div class="modal-footer">
						<button type="button" class="toolbar-btn" on:click={() => (showAddTaskModal = false)}
							>Cancel</button
						>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	:root {
		--app-scale: 0.7;
	}
	.project-page-layout {
		font-size: calc(1.06rem * var(--app-scale));
	}

	/* Main pain, containing all other panes */
	.project-page-layout {
		display: flex;
		flex-direction: row;
		height: calc(100vh - 5.2em); /* account for top bar */
		width: 100vw;
		box-sizing: border-box;
		align-items: stretch;
		justify-content: stretch;
		background: transparent;
		min-height: 0;
		border-radius: 2em;
		box-shadow: 0 6px 36px 0 #0002;
		margin: 0 auto;
		max-width: align-self;
		gap: 0.5em; /* This prevents panes from visually colliding/overlapping */
		overflow: hidden;
	}

	/* Left Pane */
	.left-pane {
		width: 225px;
		min-width: 210px;
		max-width: 340px;
		display: flex;
		flex-direction: column;
		padding: 1em 1.5em 1em 1.5em;
		margin: 1em 0 2em 1em;
		height: calc(100% - 4em);
		position: relative;
		z-index: 2;
		box-sizing: border-box;
		/* Subtle left border glow */
		box-shadow:
			0 4px 28px 0 #0001,
			-2px 0 24px #97cbff22 inset;
		border-radius: 1.2em;
		background: rgba(255, 255, 255, 0.74);
		backdrop-filter: blur(4px) saturate(1.3);
		-webkit-backdrop-filter: blur(4px) saturate(1.3);
		border: 1.5px solid rgba(180, 200, 230, 0.13);
	}

	/* Center Pane */
	.center-pane {
		flex: 1 1 0%;
		/* flex: 1 1 350px; */
		display: flex;
		flex-direction: column;
		min-width: 400px;
		max-width: 4000px;
		padding: 1em 0;
		margin: 1em 0;
		box-sizing: border-box;
		border-radius: 1.2em;
		box-shadow: 0 4px 28px 0 #0001;
		background: rgba(255, 255, 255, 0.74);
		backdrop-filter: blur(8px) saturate(1.3);
		-webkit-backdrop-filter: blur(8px) saturate(1.3);
		border: 1.5px solid rgba(180, 200, 230, 0.13);
		overflow: hidden;
		z-index: 1;
	}

	/* Center Top (Toolbar) */
	.center-top {
		min-height: 0em;
		margin-bottom: 0.7;
		position: sticky;
		top: 0;
		z-index: 5;
		/* background: transparent; */
		display: flex;
		align-items: center;
		/* background: rgba(250, 252, 255, 0.78);
		backdrop-filter: blur(4px); */
		border-radius: 0.7em;
		box-shadow: 0 15px 18px #1976d224;
		padding: 0em 0.3em;
		gap: 0.7em;
	}

	/* Center Main (Task area) */
	.center-main {
		flex: 1 1 auto;
		overflow-y: auto;
		overflow: auto;
		position: relative;
		background: #fff;
		/* background: rgba(255, 255, 255, 0.38); */
		border-radius: 1em;
		/* box-shadow: 0 2px 20px #0001;
		padding: 2em; */
		box-shadow: 0 1px 12px #1976d218;
		padding: 1em 2em 0.8 0.2em;
		min-width: 0;
	}

	.center-main::-webkit-scrollbar,
	.panel-drawer::-webkit-scrollbar {
		width: 9px;
	}
	.center-main::-webkit-scrollbar-thumb,
	.panel-drawer::-webkit-scrollbar-thumb {
		background: rgba(140, 160, 210, 0.18);
		border-radius: 8px;
	}

	/* right pane */
	.right-pane {
		width: 480px; /* doubled from 250px */
		min-width: 340px; /* increased for comfort */
		max-width: 650px; /* so it never gets TOO wide */
		height: calc(100% - 2em);
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		margin: 1em 2em 2em 0;
		background: transparent;
		box-sizing: border-box;
		/* You may want to restore the border, glass, and shadow effects! */
		box-shadow: 0 4px 28px 0 #0001;
		background: rgba(255, 255, 255, 0.74);
		backdrop-filter: blur(4px) saturate(1.3);
		-webkit-backdrop-filter: blur(4px) saturate(1.3);
		border: 1.5px solid rgba(180, 200, 230, 0.13);
		border-radius: 1.2em;
		padding: 1.1em 1.5em; /* Match other panes */
		align-items: stretch;
		overflow: visible;
		position: relative;
		z-index: 2;
	}

	/* Toolbar and button effects */
	.toolbar-btn,
	.delete-project-btn,
	.close-panel-btn {
		box-shadow: 0 1px 8px #1976d211;
		border-radius: 0.7em;
		transition:
			background 0.17s,
			box-shadow 0.13s,
			color 0.12s;
	}
	.toolbar-btn:active,
	.delete-project-btn:active,
	.close-panel-btn:active {
		box-shadow: 0 1.5px 10px #2196f344;
		transform: translateY(1.5px) scale(0.98);
	}

	/* Hover effect for rows */
	.task-table tr:hover:not(.selected-row):not(.insert-form-row):not(.subtask-insert-row) {
		background: rgba(25, 118, 210, 0.07);
		transition: background 0.14s;
	}

	.active-tab {
		background: #1976d2;
		color: #fff;
		box-shadow: 0 2px 8px #1976d288;
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
		gap: 1em;
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

	.task-table thead th {
		position: sticky;
		top: 0;
		z-index: 2;
		background: rgba(245, 250, 255, 0.82);
		backdrop-filter: blur(9px) saturate(1.07);
		-webkit-backdrop-filter: blur(9px) saturate(1.07);
		box-shadow: 0 4px 14px #1976d21b;
		/* Optional: subtle border */
		border-bottom: 2px solid rgba(180, 200, 230, 0.16);
		/* No JS needed! */
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
		border: 2px solid rgba(40, 100, 200, 0.18);
		box-shadow: 0 0 6px #1976d233;
		transition:
			box-shadow 0.18s cubic-bezier(0.43, 1.14, 0.69, 0.93),
			border-color 0.15s,
			transform 0.16s;
	}

	.status-dot-clickable {
		cursor: pointer;
		transition:
			box-shadow 0.18s,
			border-color 0.14s;
	}
	.status-dot-clickable:hover {
		border-color: #1976d2;
		box-shadow: 0 2px 10px #1976d232;
	}

	.status-dot.status-dot-clickable:hover,
	.status-dot.status-dot-clickable:focus {
		border-color: #1976d2;
		box-shadow:
			0 2px 18px #1976d2aa,
			0 0 0 3px #a7c8fa44;
		transform: scale(1.15) rotate(-5deg);
		outline: none;
	}

	/* ------- Pop up dots -------- */
	.status-menu-popover {
		position: relative;
		display: flex;
		gap: 0.5em;
		background: rgba(255, 255, 255, 0.96);
		box-shadow: 0 2px 18px #1976d244;
		border-radius: 0.9em;
		padding: 0.4em 1em;
		z-index: 9999;
		align-items: center;
		animation: fadeIn 0.01s;
		/* Optional: subtle border */
		border: 5.5px solid #d7e2f4;
		/* Glass effect */
		backdrop-filter: blur(10px) saturate(1.08);
		-webkit-backdrop-filter: blur(10px) saturate(1.08);
		margin-top: 1.15em;
		transform: translate(-50%, 0); /* This centers horizontally */

		animation: fadeInPopover 0.03s cubic-bezier(0.43, 1.14, 0.69, 0.93);
		box-shadow:
			0 2px 2px #67696b38,
			0 7.5px 8px #0001;
		padding: 0.5em 1.1em;
	}

	@keyframes fadeInPopover {
		from {
			opacity: 0;
			transform: translateY(-14px) scale(0.94);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.status-menu-dot {
		width: 1.45em;
		height: 1.45em;
		border-radius: 50%;
		display: inline-block;
		border: 2px solid #bbb;
		box-shadow: 0 1px 6px #0001;
		cursor: pointer;
		margin: 0 0.12em;
		transition:
			border-color 0.14s,
			box-shadow 0.16s,
			transform 0.16s;
		outline: none;
	}
	.status-menu-dot:hover,
	.status-menu-dot:focus {
		border-color: #1976d2;
		box-shadow:
			0 2px 16px #1976d244,
			0 0 0 2.5px #a7c8fa66;
		transform: scale(1.16) rotate(4deg);
	}
	.selected-row {
		background: #e3f4fc !important;
		box-shadow: 0 0 3px #2196f344 inset;
	}
	.subtask-row {
		background: #f7faff;
	}
	/* .subtask-indent {
		display: inline-block;
		width: 2em;
	} */
	.date-cell {
		text-align: right;
		font-variant-numeric: tabular-nums;
		font-size: 0.97em;
		color: #2c3566;
		min-width: 6em;
	}
	.insert-form-row td,
	.subtask-insert-row td {
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
	/* .created-by {
		color: #888;
		font-size: 0.97em;
		font-style: italic;
	} */
	.panel-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.12);
		z-index: 100;
		background: rgba(0, 28, 50, 0.12);
		backdrop-filter: blur(5px);
		-webkit-backdrop-filter: blur(5px);
		/* Prevent background scroll: */
		overscroll-behavior: contain;
	}
	.panel-drawer {
		background: rgba(255, 255, 255, 0.94);
		backdrop-filter: blur(28px) saturate(1.2);
		-webkit-backdrop-filter: blur(28px) saturate(1.2);
		box-shadow:
			0 6px 36px #1676d344,
			0 1.5px 8px #ffffff44 inset;
		position: fixed;
		top: 6em;
		left: 50%;
		transform: translateX(-50%);
		border-radius: 1.4em;
		border: 2px solid rgba(180, 200, 230, 0.17);
		padding: 2em;
		z-index: 101;
		min-width: 350px;
		max-width: 90vw;
		max-height: 90vh;
		overflow-y: auto;
		transition:
			box-shadow 0.22s,
			background 0.22s;
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
	.new-badge {
		display: inline-block;
		background: linear-gradient(90deg, #47e37a, #37b6ff);
		color: #fff;
		border-radius: 1em;
		font-size: 0.8em;
		font-weight: bold;
		padding: 0.18em 0.8em;
		margin-left: 0.7em;
		vertical-align: middle;
		animation: badge-pop 0.4s;
		box-shadow: 0 1px 6px #46e37a44;
		letter-spacing: 0.02em;
	}
	@keyframes badge-pop {
		0% {
			transform: scale(0.4);
			opacity: 0;
		}
		80% {
			transform: scale(1.2);
			opacity: 1;
		}
		100% {
			transform: scale(1);
		}
	}

	.highlight-missing-items {
		/* Eye-catching but not too aggressive */
		box-shadow:
			0 0 0 3px #e74c3c99,
			0 0 14px #ff1a1a22;
		border-left: 5px solid #e74c3c;
		background: #fff6f6 !important;
		transition:
			box-shadow 0.13s,
			background 0.11s;
	}

	/* ------- Style for Task/Subtask ID ---------- */
	.short-id {
		font-family: monospace;
		opacity: 0.7;
		color: #555;
		letter-spacing: 0.04em;
	}

	.right-pane-inner {
		/* padding: 2em 1.4em 1.2em 1.7em; */
		padding: 0.1em 0.1em 0.3em 0.3em;
		display: flex;
		flex-direction: column;
		/* gap: 2.1em; */
		gap: 0em; /* Reduced vertical gap between blocks */
		padding-bottom: 56.9em; /* optional, for less bottom white-space */
		height: 100%;
		min-height: 0%;
	}

	/* Section Header */
	.section-header {
		display: flex;
		align-items: center;
		gap: 0.8em;
		margin-bottom: 1em;
		padding-bottom: 0.3em;
		border-bottom: 1px solid #e3e8f8;
		font-size: 1.18em;
		font-weight: 600;
		letter-spacing: 0.01em;
		background: none;
	}

	/* .section-icon {
		font-size: 1.35em;
		margin-right: 0.1em;
		opacity: 0.82;
	} */

	.section-title {
		color: #2b3867;
		font-weight: 700;
		letter-spacing: 0.01em;
		font-size: 1.1em;
	}

	/* Section Divider */
	/* .section-divider {
		height: 0em;
		width: 94%;
		border: none;
		border-bottom: 2.5px dashed #e7eaf5;
		margin: 0em 0 0em 0;
		border-radius: 0.6em;
		opacity: 0.72;
		align-self: center;
	} */

	/* Created By & Description Block */
	.created-by-line {
		font-size: 1em;
		margin-bottom: 0.6em;
		color: #3963b5;
		background: #f5f8fd;
		padding: 0.45em 1.1em;
		border-radius: 1em;
		display: inline-block;
	}

	.task-description-block {
		background: #f6faff;
		padding: 0.7em 1.1em;
		border-radius: 0.9em;
		font-size: 1em;
		color: #444;
		box-shadow: 0 1px 7px #c4e7ff1b;
		margin: 0.8em 0;
	}

	.task-items-block {
		background: #fafcff;
		padding: 0.8em 1.1em;
		border-radius: 1em;
		box-shadow: 0 1px 6px #d6e2fa11;
		margin-bottom: 1.1em;
		font-size: 1em;
	}

	/* Checklist Buttons */
	.expand-items-btn {
		margin-top: 0.7em;
		background: #e3edfc;
		color: #1976d2;
		border: none;
		border-radius: 1.1em;
		padding: 0.35em 1.2em;
		font-size: 1em;
		font-weight: 600;
		box-shadow: 0 1px 5px #0001;
		cursor: pointer;
		transition:
			background 0.13s,
			color 0.12s;
	}
	.expand-items-btn:hover,
	.expand-items-btn:focus {
		background: #1976d2;
		color: #fff;
		outline: none;
	}

	/* Task Items List */
	.task-items-summary-list {
		padding-left: 1.2em;
		margin: 0.7em 0 0.4em 0;
	}
	.task-items-summary-list li {
		margin-bottom: 0.3em;
		font-size: 0.99em;
	}

	.status-dot {
		display: inline-block;
		width: 1.1em;
		height: 1.1em;
		border-radius: 0.6em;
		margin-right: 0.6em;
		vertical-align: middle;
		border: 2px solid #aaa;
		box-sizing: border-box;
		background: #fff;
		border: 2px solid rgba(40, 100, 200, 0.18);
		box-shadow: 0 0 6px #1976d233;
	}

	/* --- Comments --- */
	.comments-section {
		background: #f7fbff;
		border-radius: 1em;
		padding: 0.5em 0.1em 0.1em 0.5em;
		box-shadow: 0 1px 7px #1976d214;
		margin-top: 1.5em;
		flex: 1 1 auto;
		overflow-y: auto;
		min-height: 0;
		max-height: 56vh; /* or: height: 100%; test for best fit */
		margin-bottom: 0.2em;
		padding-bottom: 21.7em;
	}
	.comments-section h4 {
		margin: 0 0 0.7em 0;
		font-size: 1.09em;
		font-weight: 600;
		color: #2260a7;
	}
	.comments-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.comment-row {
		display: flex;
		align-items: flex-start;
		gap: 0.65em;
		margin-bottom: 0.9em;
		background: #fff;
		border-radius: 0.7em;
		padding: 0.55em 1em 0.42em 0.7em;
		box-shadow: 0 0.5px 3.5px #1976d21a;
	}
	.comment-initials {
		width: 2em;
		height: 2em;
		border-radius: 1em;
		background: linear-gradient(135deg, #a9c9ff 0%, #f2fcfe 100%);
		color: #1a3255;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 1.01em;
		margin-right: 0.2em;
	}
	.comment-meta {
		display: flex;
		flex-direction: column;
		gap: 0.18em;
		min-width: 0;
	}
	/* .comment-author {
		font-weight: 600;
		color: #1e355d;
	} */
	.comment-time {
		font-size: 0.91em;
		color: #888;
	}
	.comment-text {
		margin-top: 0.18em;
		font-size: 1em;
		color: #333;
		word-break: break-word;
	}

	.comments-section textarea {
		font-size: 1em;
		border-radius: 0.7em;
		border: 1.5px solid #d7e6f5;
		padding: 0.7em 1em;
		box-shadow: 0 0.5px 2.5px #1976d211;
		background: #fff;
		transition: border 0.16s;
		resize: vertical;
	}
	.comments-section textarea:focus {
		border: 1.5px solid #1976d2;
		outline: none;
	}
	.comments-section button[type='submit'] {
		border-radius: 1.2em;
		padding: 0.48em 1.4em;
		background: #1976d2;
		color: #fff;
		font-weight: 600;
		border: none;
		cursor: pointer;
		box-shadow: 0 1px 4px #1976d233;
		transition: background 0.13s;
	}
	.comments-section button[type='submit']:hover:not(:disabled) {
		background: #145bb5;
	}
	.comments-section button[disabled] {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.details-section {
		flex: 0 0 auto; /* do not grow/shrink, stays top */
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 32, 60, 0.16);
		z-index: 9001;
		display: flex;
		align-items: center;
		justify-content: center;
		backdrop-filter: blur(5px);
	}
	.modal {
		background: #fff;
		border-radius: 1.3em;
		box-shadow:
			0 8px 44px #1976d277,
			0 1.5px 8px #ffffff44 inset;
		padding: 2.4em 2.2em 2em 2.2em;
		min-width: 410px;
		max-width: 92vw;
		min-height: 160px;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 1.1em;
	}
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
		margin-bottom: 0.7em;
	}
	.close-modal-btn {
		background: none;
		border: none;
		font-size: 2em;
		color: #1976d2;
		font-weight: bold;
		cursor: pointer;
		line-height: 1;
		border-radius: 1.1em;
		padding: 0.13em 0.44em;
		transition: background 0.13s;
	}
	.close-modal-btn:hover {
		background: #e3edfc;
	}
	.modal-body {
		margin-bottom: 1.1em;
	}
	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.7em;
	}
</style>
