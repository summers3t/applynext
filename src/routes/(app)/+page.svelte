<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { session } from '$lib/session';
  import { get } from 'svelte/store';

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
    owner_id: string;
    content: string;
    status: Status;
    due_date: string | null;
    sort_index: number;
    created_at: string;
    updated_at: string;
  };

  type Task = {
    id: string;
    owner_id: string;
    title: string;
    description: string;
    status: Status;
    due_date: string | null;
    sort_index: number;
    created_at: string;
    updated_at: string;
    subtasks: Subtask[];
  };

  let tasks: Task[] = [];
  let loading = false;
  let error = '';

  let newTitle = '';
  let newDescription = '';
  let newStatus: Status = 'open';
  let newDueDate: string | null = null;
  let creating = false;
  let insertingAtIndex: number | null = null;

  let selected: { type: 'task' | 'subtask'; id: string; parentTaskId?: string } | null = null;

  // Edit state
  let editingTaskId: string | null = null;
  let editTitle = '';
  let editDescription = '';
  let editStatus: Status = 'open';
  let editDueDate: string | null = null;
  let savingEdit = false;

  // Subtask add/insert
  let insertingSubtaskAt: { taskId: string; index: number } | null = null;
  let newSubtaskContent = '';
  let newSubtaskStatus: Status = 'open';
  let newSubtaskDueDate: string | null = null;
  let creatingSubtask = false;

  // Subtask edit
  let editingSubtaskId: string | null = null;
  let editSubtaskContent = '';
  let editSubtaskStatus: Status = 'open';
  let editSubtaskDueDate: string | null = null;
  let savingSubtaskEdit = false;

  // Expanded/collapsed state for tasks with subtasks
  let expandedTasks: Set<string> = new Set();

  $: $session = get(session);

  // ---- Helper functions ----

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

  // ---- SvelteKit logic ----

  async function fetchTasks() {
    loading = true;
    error = '';
    if (!$session) {
      tasks = [];
      loading = false;
      return;
    }
    const { data, error: err } = await supabase
      .from('tasks')
      .select('*, subtasks(*)')
      .eq('owner_id', $session.user.id)
      .order('sort_index', { ascending: true });

    if (err) {
      error = err.message;
      tasks = [];
      loading = false;
      return;
    }
    tasks = (data ?? []).map(t => {
      const subtasks = Array.isArray(t.subtasks)
        ? t.subtasks.map(st => ({ ...st, sort_index: st.sort_index ?? 0 }))
        : [];
      return {
        ...t,
        subtasks: subtasks.sort((a, b) => a.sort_index - b.sort_index)
      };
    });
    loading = false;
    selected = null;
    insertingAtIndex = null;
    editingTaskId = null;
    insertingSubtaskAt = null;
    editingSubtaskId = null;

    // Keep expanded state for still-present tasks
    expandedTasks = new Set(
      [...expandedTasks].filter(id => tasks.some(t => t.id === id && t.subtasks.length > 0))
    );
  }

  // ---- Reindex helpers ----
  async function reindexTasks(newOrder: Task[]) {
    await Promise.all(
      newOrder.map((task, idx) =>
        supabase
          .from('tasks')
          .update({ sort_index: idx })
          .eq('id', task.id)
      )
    );
    await fetchTasks();
  }

  async function reindexSubtasks(taskId: string, newOrder: Subtask[]) {
    await Promise.all(
      newOrder.map((st, idx) =>
        supabase
          .from('subtasks')
          .update({ sort_index: idx })
          .eq('id', st.id)
      )
    );
    await fetchTasks();
  }

  // ---- Task CRUD ----

  async function createTask(atIndex: number | null = null) {
    if (!newTitle.trim() || !$session) return;
    creating = true;
    let sort_index = tasks.length;
    if (atIndex !== null) {
      sort_index = atIndex + 1;
      const before = tasks.slice(0, sort_index);
      const after = tasks.slice(sort_index);
      const { data, error: err } = await supabase
        .from('tasks')
        .insert([{
          title: newTitle.trim(),
          description: newDescription.trim(),
          status: newStatus,
          due_date: newDueDate,
          owner_id: $session.user.id,
          sort_index
        }])
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
        .insert([{
          title: newTitle.trim(),
          description: newDescription.trim(),
          status: newStatus,
          due_date: newDueDate,
          owner_id: $session.user.id,
          sort_index
        }])
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
    if (!selected || selected.type !== 'task') return;
    const idx = tasks.findIndex(t => t.id === selected?.id);
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
    if (!selected) return;
    if (selected.type === 'task') {
      await supabase
        .from('tasks')
        .delete()
        .eq('id', selected.id)
        .eq('owner_id', $session.user.id);
      const newTasks = tasks.filter(t => t.id !== selected.id);
      await reindexTasks(newTasks);
      selected = null;
    } else if (selected.type === 'subtask' && selected.parentTaskId) {
      const task = tasks.find(t => t.id === selected.parentTaskId);
      if (!task) return;
      await supabase
        .from('subtasks')
        .delete()
        .eq('id', selected.id)
        .eq('owner_id', $session.user.id);
      const newSubtasks = task.subtasks.filter(st => st.id !== selected.id);
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
    if (!selected) return;
    if (selected.type === 'task') {
      const task = tasks.find(t => t.id === selected?.id);
      if (!task) return;
      editingTaskId = task.id;
      editTitle = task.title;
      editDescription = task.description ?? '';
      editStatus = task.status;
      editDueDate = task.due_date;
      insertingAtIndex = null;
      insertingSubtaskAt = null;
      editingSubtaskId = null;
    } else if (selected.type === 'subtask' && selected.parentTaskId) {
      const task = tasks.find(t => t.id === selected.parentTaskId);
      const subtask = task?.subtasks.find(st => st.id === selected.id);
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
    if (!editingTaskId || !editTitle.trim() || !$session) return;
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
      .eq('owner_id', $session.user.id);
    savingEdit = false;
    if (err) {
      alert('Error saving task: ' + err.message);
    }
    await fetchTasks();
    editingTaskId = null;
  }

  // ---- Subtask CRUD/ordering ----
  function showInsertSubtaskForm(taskId: string, idx: number) {
    insertingSubtaskAt = { taskId, index: idx };
    newSubtaskContent = '';
    newSubtaskStatus = 'open';
    newSubtaskDueDate = null;
    editingTaskId = null;
    editingSubtaskId = null;
    insertingAtIndex = null;
    // Expand the task (user intends to add a subtask)
    expandedTasks = new Set([...expandedTasks, taskId]);
  }
  async function createSubtask(taskId: string, atIndex: number | null = null) {
    if (!newSubtaskContent.trim() || !$session) return;
    creatingSubtask = true;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    let sort_index = task.subtasks.length;
    if (atIndex !== null) {
      sort_index = atIndex + 1;
      const before = task.subtasks.slice(0, sort_index);
      const after = task.subtasks.slice(sort_index);
      const { data, error: err } = await supabase
        .from('subtasks')
        .insert([{
          task_id: taskId,
          owner_id: $session.user.id,
          content: newSubtaskContent.trim(),
          status: newSubtaskStatus,
          due_date: newSubtaskDueDate,
          sort_index
        }])
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
        .insert([{
          task_id: taskId,
          owner_id: $session.user.id,
          content: newSubtaskContent.trim(),
          status: newSubtaskStatus,
          due_date: newSubtaskDueDate,
          sort_index
        }])
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
    if (!selected || selected.type !== 'subtask' || !selected.parentTaskId) return;
    const task = tasks.find(t => t.id === selected.parentTaskId);
    if (!task) return;
    const idx = task.subtasks.findIndex(st => st.id === selected.id);
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
    if (!editingSubtaskId || !editSubtaskContent.trim() || !$session) return;
    savingSubtaskEdit = true;
    const { error: err } = await supabase
      .from('subtasks')
      .update({
        content: editSubtaskContent.trim(),
        status: editSubtaskStatus,
        due_date: editSubtaskDueDate
      })
      .eq('id', editingSubtaskId)
      .eq('owner_id', $session.user.id);
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
      expandedTasks = new Set([...expandedTasks].filter(id => id !== taskId));
    } else {
      expandedTasks = new Set([...expandedTasks, taskId]);
    }
  }

  $: $session, fetchTasks();
</script>

<style>
  .task-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1em;
  }
  .task-table th, .task-table td {
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
  .delete-btn {
    color: #fff;
    background: #e74c3c;
    border: 1px solid #e74c3c;
  }
  .date-cell {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: 0.97em;
    color: #2c3566;
    min-width: 8em;
  }
  .insert-form-row td, .edit-form-row td, .subtask-insert-row td, .subtask-edit-row td {
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
</style>

<h1>Welcome to ApplyNext</h1>
{#if $session}
  <p>Logged in as {$session.user.email}</p>
  <h2>Your Tasks</h2>

  <!-- Toolbar -->
  <div class="action-toolbar">
    <button class="toolbar-btn"
      on:click={() =>
        selected && selected.type === 'task'
          ? showInsertFormAt(tasks.findIndex(t => t.id === selected?.id))
          : selected && selected.type === 'subtask' && selected.parentTaskId
            ? showInsertSubtaskForm(selected.parentTaskId, tasks.find(t => t.id === selected.parentTaskId)?.subtasks.findIndex(st => st.id === selected.id) ?? -1)
            : undefined
      }
      disabled={!selected || (selected.type === 'task' && editingTaskId !== null) || (selected.type === 'subtask' && editingSubtaskId !== null)}
    >Insert</button>
    <button class="toolbar-btn"
      on:click={() => {
        if (selected && selected.type === 'task') {
          showInsertSubtaskForm(selected.id, tasks.find(t => t.id === selected.id)?.subtasks.length - 1 ?? -1);
        }
      }}
      disabled={!selected || selected.type !== 'task' || editingTaskId !== null || editingSubtaskId !== null}
    >Add Subtask</button>
    <button class="toolbar-btn"
      on:click={() =>
        selected && selected.type === 'task'
          ? moveSelectedTask(-1)
          : selected && selected.type === 'subtask'
            ? moveSelectedSubtask(-1)
            : undefined
      }
      disabled={
        !selected
        || (selected.type === 'task' && (editingTaskId !== null || tasks.findIndex(t => t.id === selected?.id) <= 0))
        || (selected.type === 'subtask' && (
          editingSubtaskId !== null
          || !selected.parentTaskId
          || (() => {
            const task = tasks.find(t => t.id === selected.parentTaskId);
            if (!task) return true;
            return task.subtasks.findIndex(st => st.id === selected.id) <= 0;
          })()
        ))
      }
    >↑</button>
    <button class="toolbar-btn"
      on:click={() =>
        selected && selected.type === 'task'
          ? moveSelectedTask(1)
          : selected && selected.type === 'subtask'
            ? moveSelectedSubtask(1)
            : undefined
      }
      disabled={
        !selected
        || (selected.type === 'task' && (editingTaskId !== null || tasks.findIndex(t => t.id === selected?.id) === tasks.length - 1))
        || (selected.type === 'subtask' && (
          editingSubtaskId !== null
          || !selected.parentTaskId
          || (() => {
            const task = tasks.find(t => t.id === selected.parentTaskId);
            if (!task) return true;
            return task.subtasks.findIndex(st => st.id === selected.id) === (task.subtasks.length - 1);
          })()
        ))
      }
    >↓</button>
    <button class="toolbar-btn"
      on:click={startEdit}
      disabled={!selected || (selected.type === 'task' && editingTaskId !== null) || (selected.type === 'subtask' && editingSubtaskId !== null)}
    >Edit</button>
    <button class="toolbar-btn delete-btn"
      on:click={deleteSelected}
      disabled={!selected || (selected.type === 'task' && editingTaskId !== null) || (selected.type === 'subtask' && editingSubtaskId !== null)}
    >Delete</button>
  </div>

  {#if loading}
    <p>Loading...</p>
  {:else if error}
    <p style="color:red;">{error}</p>
  {:else if tasks.length === 0}
    <p>No tasks yet.</p>
  {:else}
    <table class="task-table">
      <thead>
        <tr>
          <th style="width:3em;"></th>
          <th style="width:2em;"></th>
          <th style="width:40%;">Task</th>
          <th style="width:35%;">Description / Subtask</th>
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
                  aria-label={expandedTasks.has(task.id) ? "Collapse subtasks" : "Expand subtasks"}
                >
                  {expandedTasks.has(task.id) ? "➖" : "➕"}
                </button>
              {/if}
            </td>
            <td>
              <span
                class="status-dot"
                style="background:{statusDotColor(task.status, isOverdue(task.due_date, task.status))};
                border-color:{isOverdue(task.due_date, task.status) ? overdueColor : '#aaa'};"
                title={task.status === 'done'
                  ? 'Done'
                  : isOverdue(task.due_date, task.status)
                  ? 'Overdue'
                  : (task.status === 'open' ? 'Open' : 'In Progress')
                }
              ></span>
            </td>
            {#if editingTaskId === task.id}
              <td colspan="3" class="edit-form-row">
                <form on:submit|preventDefault={saveEditTask} on:click|stopPropagation style="display:flex;align-items:center;gap:0.7em;">
                  <input
                    type="text"
                    bind:value={editTitle}
                    required
                    style="width:28%;"
                  />
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
                    <button type="button" on:click={() => (editDueDate = null)} style="margin-right:0.3em;">❌</button>
                  {/if}
                  <button type="submit" disabled={savingEdit || !editTitle.trim()}>Save</button>
                  <button type="button" on:click={cancelEdit} disabled={savingEdit}>Cancel</button>
                </form>
              </td>
            {:else}
              <td>{task.title}</td>
              <td>{task.description}</td>
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
                    <button type="button" on:click={() => (newDueDate = null)} style="margin-right:0.3em;">❌</button>
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
                class:selected-row={selected && selected.type === 'subtask' && selected.id === subtask.id}
                class="subtask-row"
                style="cursor:pointer;"
                on:click={() => selectSubtask(subtask.id, task.id)}
              >
                <td><span class="subtask-indent"></span></td>
                <td>
                  <span
                    class="status-dot"
                    style="background:{statusDotColor(subtask.status, isOverdue(subtask.due_date, subtask.status))};
                    border-color:{isOverdue(subtask.due_date, subtask.status) ? overdueColor : '#aaa'};"
                    title={subtask.status === 'done'
                      ? 'Done'
                      : isOverdue(subtask.due_date, subtask.status)
                      ? 'Overdue'
                      : (subtask.status === 'open' ? 'Open' : 'In Progress')
                    }
                  ></span>
                </td>
                {#if editingSubtaskId === subtask.id}
                  <td colspan="3" class="subtask-edit-row">
                    <form on:submit|preventDefault={saveEditSubtask} on:click|stopPropagation style="display:flex;align-items:center;gap:0.7em;">
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
                        <button type="button" on:click={() => (editSubtaskDueDate = null)} style="margin-right:0.3em;">❌</button>
                      {/if}
                      <button type="submit" disabled={savingSubtaskEdit || !editSubtaskContent.trim()}>Save</button>
                      <button type="button" on:click={cancelEdit} disabled={savingSubtaskEdit}>Cancel</button>
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
                    <form on:submit|preventDefault={() => createSubtask(task.id, stIdx)} on:click|stopPropagation>
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
                      <input type="date" bind:value={newSubtaskDueDate} style="margin-right:0.5em;" />
                      {#if newSubtaskDueDate}
                        <button type="button" on:click={() => (newSubtaskDueDate = null)} style="margin-right:0.3em;">❌</button>
                      {/if}
                      <button type="submit" disabled={creatingSubtask || !newSubtaskContent.trim()}>
                        {creatingSubtask ? 'Adding…' : 'Insert Subtask'}
                      </button>
                      <button type="button" on:click={() => (insertingSubtaskAt = null)}>Cancel</button>
                    </form>
                  </td>
                </tr>
              {/if}
            {/each}
            <!-- Insert subtask at end if user clicks + on task row -->
            {#if insertingSubtaskAt && insertingSubtaskAt.taskId === task.id && task.subtasks.length === 0}
              <tr class="subtask-insert-row">
                <td colspan="5">
                  <form on:submit|preventDefault={() => createSubtask(task.id, task.subtasks.length - 1)} on:click|stopPropagation>
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
                    <input type="date" bind:value={newSubtaskDueDate} style="margin-right:0.5em;" />
                    {#if newSubtaskDueDate}
                      <button type="button" on:click={() => (newSubtaskDueDate = null)} style="margin-right:0.3em;">❌</button>
                    {/if}
                    <button type="submit" disabled={creatingSubtask || !newSubtaskContent.trim()}>
                      {creatingSubtask ? 'Adding…' : 'Insert Subtask'}
                    </button>
                    <button type="button" on:click={() => (insertingSubtaskAt = null)}>Cancel</button>
                  </form>
                </td>
              </tr>
            {/if}
          {/if}
        {/each}
      </tbody>
    </table>
  {/if}
{:else}
  <p>Not signed in</p>
{/if}
