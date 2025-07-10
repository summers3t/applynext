<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { session } from '$lib/session';
  import { get } from 'svelte/store';

  // Types
  type Subtask = {
    id: string;
    task_id: string;
    owner_id: string;
    content: string;
    created_at: string;
    updated_at: string;
  };
  type Task = {
    id: string;
    owner_id: string;
    title: string;
    description: string;
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
  let creating = false;

  // Inline edit for tasks
  let editingId: string | null = null;
  let editTitle = '';
  let editDescription = '';
  let saving = false;

  // Subtask state
  let newSubtaskContent: { [taskId: string]: string } = {};
  let editingSubtaskId: string | null = null;
  let editSubtaskContent = '';
  let savingSubtask = false;

  $: $session = get(session);

  // Fetch all subtasks for a task
  async function fetchSubtasksForTask(taskId: string): Promise<Subtask[]> {
    const { data, error } = await supabase
      .from('subtasks')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    if (error) return [];
    return data ?? [];
  }

  // Helper to force Svelte to update after subtask changes
  async function refreshTaskSubtasks(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.subtasks = await fetchSubtasksForTask(taskId);
      // Force Svelte to notice the update:
      tasks = tasks.map(t => t.id === taskId ? { ...t, subtasks: task.subtasks } : t);
    }
  }

  // Fetch tasks, and fetch subtasks for each
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

    // Fetch subtasks for each task
    const tasksWithSubtasks = await Promise.all(
      (data ?? []).map(async (task: Task) => {
        const subtasks = await fetchSubtasksForTask(task.id);
        return { ...task, subtasks };
      })
    );
    tasks = tasksWithSubtasks;
    loading = false;
  }

  // CRUD for tasks
  async function createTask() {
    if (!newTitle.trim() || !$session) return;
    creating = true;
    const { data, error: err } = await supabase
      .from('tasks')
      .insert([
        {
          title: newTitle.trim(),
          description: newDescription.trim(),
          owner_id: $session.user.id,
        }
      ])
      .select();

    if (err) {
      alert('Error creating task: ' + err.message);
    } else if (data && data.length) {
      // Fetch subtasks for new task (should be empty)
      data[0].subtasks = [];
      tasks = [data[0], ...tasks];
      newTitle = '';
      newDescription = '';
    }
    creating = false;
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
    }
  }

  function startEdit(task: Task) {
    editingId = task.id;
    editTitle = task.title;
    editDescription = task.description || '';
  }

  function cancelEdit() {
    editingId = null;
    editTitle = '';
    editDescription = '';
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim() || !$session) return;
    saving = true;
    const { data, error: err } = await supabase
      .from('tasks')
      .update({
        title: editTitle.trim(),
        description: editDescription.trim()
      })
      .eq('id', id)
      .eq('owner_id', $session.user.id)
      .select();

    if (err) {
      alert('Error saving task: ' + err.message);
    } else if (data && data.length) {
      tasks = tasks.map(t => t.id === id ? { ...data[0], subtasks: t.subtasks } : t);
    }
    editingId = null;
    saving = false;
    editTitle = '';
    editDescription = '';
  }

  // CRUD for subtasks
  async function addSubtask(taskId: string) {
    if (!newSubtaskContent[taskId]?.trim() || !$session) return;
    const { data, error } = await supabase
      .from('subtasks')
      .insert([{
        task_id: taskId,
        owner_id: $session.user.id,
        content: newSubtaskContent[taskId].trim()
      }])
      .select();

    if (error) {
      alert('Error adding subtask: ' + error.message);
      return;
    }
    if (data && data.length) {
      newSubtaskContent[taskId] = '';
      await refreshTaskSubtasks(taskId);
    }
  }

  function startEditSubtask(subtask: Subtask) {
    editingSubtaskId = subtask.id;
    editSubtaskContent = subtask.content;
  }

  function cancelEditSubtask() {
    editingSubtaskId = null;
    editSubtaskContent = '';
  }

  async function saveEditSubtask(subtask: Subtask) {
    if (!editSubtaskContent.trim() || !$session) return;
    savingSubtask = true;
    const { data, error } = await supabase
      .from('subtasks')
      .update({ content: editSubtaskContent.trim() })
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
    }
  }

  // Watch session for changes, refetch
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
  .task-table td button {
    margin-right: 0.5em;
  }
  .task-table td input[type="text"] {
    width: 96%;
    padding: 0.25em 0.5em;
    margin: 0;
    box-sizing: border-box;
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
  .subtask-actions button {
    margin-left: 0.5em;
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
      autofocus
    />
    <input
      type="text"
      placeholder="Description (optional)"
      bind:value={newDescription}
      style="margin-right:0.5em;"
    />
    <button type="submit" disabled={creating || !newTitle.trim()}>
      {creating ? 'Adding…' : 'Add Task'}
    </button>
  </form>

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
          <tr>
            {#if editingId === task.id}
              <td>
                <input
                  type="text"
                  bind:value={editTitle}
                  required
                />
              </td>
              <td>
                <input
                  type="text"
                  bind:value={editDescription}
                  placeholder="Description (optional)"
                />
              </td>
              <td>
                <button on:click={() => saveEdit(task.id)} disabled={saving || !editTitle.trim()}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button on:click={cancelEdit} disabled={saving}>Cancel</button>
              </td>
            {:else}
              <td>
                <strong>{task.title}</strong>
              </td>
              <td>
                {task.description}
              </td>
              <td>
                <button on:click={() => startEdit(task)}>Edit</button>
                <button on:click={() => deleteTask(task.id)}>Delete</button>
              </td>
            {/if}
          </tr>
          <!-- Subtasks row -->
          <tr>
            <td colspan="3" style="padding:0;">
              <div style="background:#fcfcfc; padding:0.5em 1em;">
                <div style="font-size:0.98em; font-weight:600; margin-bottom:0.3em;">
                  Subtasks:
                </div>
                <ul class="subtask-list">
                  {#each task.subtasks ?? [] as subtask}
                    <li>
                      {#if editingSubtaskId === subtask.id}
                        <input
                          type="text"
                          bind:value={editSubtaskContent}
                          required
                          style="margin-right:0.5em; width:55%;"
                        />
                        <span class="subtask-actions">
                          <button on:click={() => saveEditSubtask(subtask)} disabled={savingSubtask || !editSubtaskContent.trim()}>Save</button>
                          <button on:click={cancelEditSubtask} disabled={savingSubtask}>Cancel</button>
                        </span>
                      {:else}
                        <span>{subtask.content}</span>
                        {#if subtask.owner_id === $session.user.id}
                          <span class="subtask-actions">
                            <button on:click={() => startEditSubtask(subtask)} style="margin-left:1em;">Edit</button>
                            <button on:click={() => deleteSubtask(subtask)} style="margin-left:0.5em;">Delete</button>
                          </span>
                        {/if}
                      {/if}
                    </li>
                  {/each}
                </ul>
                <!-- Add subtask input (for any user) -->
                {#if $session}
                  <form on:submit|preventDefault={() => addSubtask(task.id)} style="margin-top:0.3em;">
                    <input
                      type="text"
                      placeholder="Add subtask…"
                      bind:value={newSubtaskContent[task.id]}
                      style="margin-right:0.5em; width:55%;"
                    />
                    <button type="submit" disabled={!newSubtaskContent[task.id]?.trim()}>Add</button>
                  </form>
                {/if}
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
{:else}
  <p>Not signed in</p>
{/if}
