<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { session } from '$lib/session';
  import { get } from 'svelte/store';

  // Types
  type Status = 'open' | 'in_progress' | 'done';
  const statusOptions = [
    { value: 'open', label: 'Open', color: '#1976d2' },
    { value: 'in_progress', label: 'In Progress', color: '#f4a300' },
    { value: 'done', label: 'Done', color: '#43a047' }
  ];

  type Subtask = {
    id: string;
    task_id: string;
    owner_id: string;
    content: string;
    status: Status;
    created_at: string;
    updated_at: string;
  };
  type Task = {
    id: string;
    owner_id: string;
    title: string;
    description: string;
    status: Status;
    created_at: string;
    updated_at: string;
    subtasks?: Subtask[];
  };

  // State
  let tasks: Task[] = [];
  let loading = false;
  let error = '';

  let newTitle = '';
  let newDescription = '';
  let newStatus: Status = 'open';
  let creating = false;

  // Inline edit for tasks and subtasks
  let editingTaskId: string | null = null;
  let editTitle = '';
  let editDescription = '';
  let editTaskStatus: Status = 'open';
  let savingTask = false;

  let editingSubtaskId: string | null = null;
  let editSubtaskContent = '';
  let editSubtaskStatus: Status = 'open';
  let savingSubtask = false;

  // Add subtask state
  let newSubtaskContent: { [taskId: string]: string } = {};
  let newSubtaskStatus: { [taskId: string]: Status } = {};

  // Expanded/collapsed state
  let expanded: Set<string> = new Set();

  // Selection state
  let selected: { type: 'task' | 'subtask'; id: string; parentTaskId?: string } | null = null;

  $: $session = get(session);

  async function fetchSubtasksForTask(taskId: string): Promise<Subtask[]> {
    const { data, error } = await supabase
      .from('subtasks')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    if (error) return [];
    return data ?? [];
  }

  async function refreshTaskSubtasks(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.subtasks = await fetchSubtasksForTask(taskId);
      tasks = tasks.map(t => t.id === taskId ? { ...t, subtasks: task.subtasks } : t);
    }
  }

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
      .select('*')
      .eq('owner_id', $session.user.id)
      .order('created_at', { ascending: false });

    if (err) {
      error = err.message;
      tasks = [];
      loading = false;
      return;
    }
    const tasksWithSubtasks = await Promise.all(
      (data ?? []).map(async (task: Task) => {
        const subtasks = await fetchSubtasksForTask(task.id);
        return { ...task, subtasks };
      })
    );
    tasks = tasksWithSubtasks;
    loading = false;
    expanded = new Set();
    selected = null;
  }

  async function createTask() {
    if (!newTitle.trim() || !$session) return;
    creating = true;
    const { data, error: err } = await supabase
      .from('tasks')
      .insert([{
        title: newTitle.trim(),
        description: newDescription.trim(),
        status: newStatus,
        owner_id: $session.user.id,
      }])
      .select();
    if (err) {
      alert('Error creating task: ' + err.message);
    } else if (data && data.length) {
      data[0].subtasks = [];
      tasks = [data[0], ...tasks];
      newTitle = '';
      newDescription = '';
      newStatus = 'open';
    }
    creating = false;
  }

  function toggleExpand(taskId: string) {
    if (expanded.has(taskId)) {
      expanded.delete(taskId);
      if (selected && selected.type === 'subtask' && selected.parentTaskId === taskId) {
        selected = null;
      }
    } else {
      expanded.add(taskId);
    }
    expanded = new Set(expanded);
  }

  function expandAndAddSubtask(taskId: string) {
    expanded.add(taskId);
    expanded = new Set(expanded);
  }

  function selectTask(taskId: string) {
    selected = { type: 'task', id: taskId };
  }

  function selectSubtask(subtaskId: string, parentTaskId: string) {
    selected = { type: 'subtask', id: subtaskId, parentTaskId };
  }

  // Toolbar actions
  function startEditSelection() {
    if (!selected) return;
    if (selected.type === 'task') {
      const task = tasks.find(t => t.id === selected?.id);
      if (!task) return;
      editingTaskId = task.id;
      editTitle = task.title;
      editDescription = task.description || '';
      editTaskStatus = task.status;
    } else if (selected.type === 'subtask') {
      const task = tasks.find(t => t.id === selected?.parentTaskId);
      const subtask = task?.subtasks?.find(st => st.id === selected?.id);
      if (!subtask) return;
      editingSubtaskId = subtask.id;
      editSubtaskContent = subtask.content;
      editSubtaskStatus = subtask.status;
    }
  }

  async function deleteSelection() {
    if (!selected) return;
    if (selected.type === 'task') {
      await deleteTask(selected.id);
    } else if (selected.type === 'subtask' && selected.parentTaskId) {
      const subtask = tasks
        .find(t => t.id === selected.parentTaskId)
        ?.subtasks?.find(st => st.id === selected.id);
      if (subtask) {
        await deleteSubtask(subtask);
      }
    }
    selected = null;
  }

  async function deleteTask(id: string) {
    if (!$session) return;
    const { error: err } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('owner_id', $session.user.id);
    if (err) {
      alert('Error deleting task: ' + err.message);
    } else {
      tasks = tasks.filter(t => t.id !== id);
      expanded.delete(id);
      expanded = new Set(expanded);
    }
    selected = null;
  }

  // Task editing
  function cancelEditTask() {
    editingTaskId = null;
    editTitle = '';
    editDescription = '';
    selected = null;
  }

  async function saveEditTask(id: string) {
    if (!editTitle.trim() || !$session) return;
    savingTask = true;
    const { data, error: err } = await supabase
      .from('tasks')
      .update({
        title: editTitle.trim(),
        description: editDescription.trim(),
        status: editTaskStatus
      })
      .eq('id', id)
      .eq('owner_id', $session.user.id)
      .select();
    if (err) {
      alert('Error saving task: ' + err.message);
    } else if (data && data.length) {
      tasks = tasks.map(t => t.id === id ? { ...data[0], subtasks: t.subtasks } : t);
    }
    editingTaskId = null;
    savingTask = false;
    editTitle = '';
    editDescription = '';
    selected = null;
  }

  async function updateTaskStatus(id: string, newStatus: Status) {
    if (!$session) return;
    const { data, error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('owner_id', $session.user.id)
      .select();
    if (!error && data && data.length) {
      tasks = tasks.map(t => t.id === id ? { ...t, status: newStatus } : t);
    }
  }

  // Subtask CRUD
  async function addSubtask(taskId: string) {
    const status = newSubtaskStatus[taskId] || 'open';
    if (!newSubtaskContent[taskId]?.trim() || !$session) return;
    const { data, error } = await supabase
      .from('subtasks')
      .insert([{
        task_id: taskId,
        owner_id: $session.user.id,
        content: newSubtaskContent[taskId].trim(),
        status
      }])
      .select();
    if (error) {
      alert('Error adding subtask: ' + error.message);
      return;
    }
    if (data && data.length) {
      newSubtaskContent[taskId] = '';
      newSubtaskStatus[taskId] = 'open';
      await refreshTaskSubtasks(taskId);
    }
  }

  function cancelEditSubtask() {
    editingSubtaskId = null;
    editSubtaskContent = '';
    selected = null;
  }

  async function saveEditSubtask(subtask: Subtask) {
    if (!editSubtaskContent.trim() || !$session) return;
    savingSubtask = true;
    const { data, error } = await supabase
      .from('subtasks')
      .update({ content: editSubtaskContent.trim(), status: editSubtaskStatus })
      .eq('id', subtask.id)
      .eq('owner_id', $session.user.id)
      .select();
    if (error) {
      alert('Error saving subtask: ' + error.message);
    } else if (data && data.length) {
      await refreshTaskSubtasks(subtask.task_id);
    }
    editingSubtaskId = null;
    editSubtaskContent = '';
    savingSubtask = false;
    selected = null;
  }

  async function updateSubtaskStatus(subtask: Subtask, newStatus: Status) {
    if (!$session) return;
    const { data, error } = await supabase
      .from('subtasks')
      .update({ status: newStatus })
      .eq('id', subtask.id)
      .eq('owner_id', $session.user.id)
      .select();
    if (!error && data && data.length) {
      const task = tasks.find(t => t.id === subtask.task_id);
      if (task) {
        task.subtasks = task.subtasks?.map(st => st.id === subtask.id ? { ...st, status: newStatus } : st);
        tasks = tasks.map(t => t.id === subtask.task_id ? { ...task } : t);
      }
    }
  }

  async function deleteSubtask(subtask: Subtask) {
    if (!$session) return;
    const { error } = await supabase
      .from('subtasks')
      .delete()
      .eq('id', subtask.id)
      .eq('owner_id', $session.user.id);
    if (error) {
      alert('Error deleting subtask: ' + error.message);
    } else {
      await refreshTaskSubtasks(subtask.task_id);
      // Collapse if no more subtasks
      const parentTask = tasks.find(t => t.id === subtask.task_id);
      if (parentTask && (!parentTask.subtasks || parentTask.subtasks.length === 0)) {
        expanded.delete(subtask.task_id);
        expanded = new Set(expanded);
      }
    }
    selected = null;
  }


  $: $session, fetchTasks();

  // Helper for badge style
  function statusStyle(status: Status): string {
    const opt = statusOptions.find(o => o.value === status);
    return `background:${opt?.color ?? '#aaa'}; color:#fff; font-weight:600; font-size:0.92em; border-radius:0.6em; padding:0.18em 0.65em; margin-right:0.3em;`;
  }
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
  .task-table td input[type="text"] {
    width: 96%;
    padding: 0.25em 0.5em;
    margin: 0;
    box-sizing: border-box;
  }
  .selected-row {
    background: #e3f4fc !important;
    box-shadow: 0 0 3px #2196f344 inset;
  }
  .subtask-list {
    margin: 0.4em 0 0 0;
    padding: 0;
    list-style: disc inside;
    font-size: 0.98em;
  }
  .subtask-list li {
    margin-bottom: 0.25em;
  }
  .expand-btn {
    background: none;
    border: none;
    font-size: 1.1em;
    vertical-align: middle;
    cursor: pointer;
    margin-right: 0.25em;
    outline: none;
  }
  .add-subtask-btn {
    background: none;
    border: 1px solid #bbb;
    padding: 0.25em 0.75em;
    border-radius: 1em;
    color: #2196f3;
    font-weight: 600;
    cursor: pointer;
    font-size: 1em;
    margin-right: 0.4em;
  }
  .done {
    text-decoration: line-through;
    opacity: 0.7;
  }
</style>

<h1>Welcome to ApplyNext</h1>
{#if $session}
  <p>Logged in as {$session.user.email}</p>
  <h2>Your Tasks</h2>

  <!-- Create Task Form -->
  <form on:submit|preventDefault={createTask} style="margin-bottom:1em;">
    <input
      type="text"
      placeholder="Task title"
      bind:value={newTitle}
      required
      style="margin-right:0.5em;"
    />
    <input
      type="text"
      placeholder="Description (optional)"
      bind:value={newDescription}
      style="margin-right:0.5em;"
    />
    <select bind:value={newStatus} style="margin-right:0.5em;">
      {#each statusOptions as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
    <button type="submit" disabled={creating || !newTitle.trim()}>
      {creating ? 'Adding…' : 'Add Task'}
    </button>
  </form>

  <!-- Toolbar for Edit/Delete -->
  <div style="margin-bottom:0.7em;">
    <button on:click={startEditSelection} disabled={!selected}>Edit</button>
    <button on:click={deleteSelection} disabled={!selected}>Delete</button>
    {#if selected}
      <span style="color:#2196f3; margin-left:1em;">
        Selected:
        {selected && selected.type === 'task'
          ? `Task: ${(tasks.find(t => t.id === selected.id)?.title) ?? ''}`
          : selected && selected.type === 'subtask'
            ? `Subtask: ${(tasks.find(t => t.id === selected.parentTaskId)?.subtasks?.find(st => st.id === selected.id)?.content) ?? ''}`
            : ''
        }
      </span>
    {/if}
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
          <th style="width: 30%;">Task</th>
          <th style="width: 45%;">Description</th>
          <th style="width: 25%;">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each tasks as task}
          <tr
            class:selected-row={selected && selected.type === 'task' && selected.id === task.id}
            on:click={() => selectTask(task.id)}
            style="cursor:pointer;"
          >
            {#if editingTaskId === task.id}
              <td>
                <button class="expand-btn" disabled>➖</button>
                <input type="text" bind:value={editTitle} required />
              </td>
              <td>
                <input type="text" bind:value={editDescription} placeholder="Description (optional)" />
              </td>
              <td>
                <select bind:value={editTaskStatus} style="margin-right:0.5em;">
                  {#each statusOptions as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
                </select>
                <button on:click={() => saveEditTask(task.id)} disabled={savingTask || !editTitle.trim()}>
                  {savingTask ? 'Saving…' : 'Save'}
                </button>
                <button on:click={cancelEditTask} disabled={savingTask}>Cancel</button>
              </td>
            {:else}
              <td>
                {#if task.subtasks && task.subtasks.length > 0}
                  <button class="expand-btn" type="button" on:click|stopPropagation={() => toggleExpand(task.id)} aria-label={expanded.has(task.id) ? 'Collapse subtasks' : 'Expand subtasks'}>
                    {expanded.has(task.id) ? '➖' : '➕'}
                  </button>
                {:else}
                  <button class="add-subtask-btn" type="button" on:click|stopPropagation={() => expandAndAddSubtask(task.id)} aria-label="Add subtask">
                    Add subtask
                  </button>
                {/if}
                <span class:done={task.status === 'done'}>
                  <span style={statusStyle(task.status)}>{statusOptions.find(o => o.value === task.status)?.label}</span>
                  <strong>{task.title}</strong>
                </span>
              </td>
              <td>
                <span class:done={task.status === 'done'}>
                  {task.description}
                </span>
              </td>
              <td>
                <select bind:value={task.status} on:change={(e) => updateTaskStatus(task.id, e.target.value)} style="margin-right:0.7em;">
                  {#each statusOptions as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
                </select>
              </td>
            {/if}
          </tr>
          {#if expanded.has(task.id)}
            <tr>
              <td colspan="3" style="padding:0;">
                <div style="background:#fcfcfc; padding:0.5em 1em;">
                  <div style="font-size:0.98em; font-weight:600; margin-bottom:0.3em;">
                    Subtasks:
                  </div>
                  <ul class="subtask-list">
                    {#each task.subtasks ?? [] as subtask}
                      <li
                        class:selected-row={selected && selected.type === 'subtask' && selected.id === subtask.id}
                        on:click={() => selectSubtask(subtask.id, task.id)}
                        style="cursor:pointer;"
                      >
                        {#if editingSubtaskId === subtask.id}
                          <input
                            type="text"
                            bind:value={editSubtaskContent}
                            required
                            style="margin-right:0.5em; width:44%;"
                          />
                          <select bind:value={editSubtaskStatus} style="margin-right:0.5em;">
                            {#each statusOptions as opt}
                              <option value={opt.value}>{opt.label}</option>
                            {/each}
                          </select>
                          <span>
                            <button type="button" on:click={() => saveEditSubtask(subtask)} disabled={savingSubtask || !editSubtaskContent.trim()}>Save</button>
                            <button type="button" on:click={cancelEditSubtask} disabled={savingSubtask}>Cancel</button>
                          </span>
                        {:else}
                          <span class:done={subtask.status === 'done'}>
                            <span style={statusStyle(subtask.status)}>{statusOptions.find(o => o.value === subtask.status)?.label}</span>
                            {subtask.content}
                          </span>
                          <select bind:value={subtask.status} on:change={(e) => updateSubtaskStatus(subtask, e.target.value)} style="margin-left:1em;">
                            {#each statusOptions as opt}
                              <option value={opt.value}>{opt.label}</option>
                            {/each}
                          </select>
                        {/if}
                      </li>
                    {/each}
                  </ul>
                  {#if $session}
                    <form on:submit|preventDefault={() => addSubtask(task.id)} style="margin-top:0.3em;">
                      <input
                        type="text"
                        placeholder="Add subtask…"
                        bind:value={newSubtaskContent[task.id]}
                        style="margin-right:0.5em; width:44%;"
                      />
                      <select bind:value={newSubtaskStatus[task.id]} style="margin-right:0.5em;">
                        {#each statusOptions as opt}
                          <option value={opt.value}>{opt.label}</option>
                        {/each}
                      </select>
                      <button type="submit" disabled={!newSubtaskContent[task.id]?.trim()}>Add</button>
                    </form>
                  {/if}
                </div>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  {/if}
{:else}
  <p>Not signed in</p>
{/if}
