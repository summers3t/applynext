<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { session } from '$lib/session';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  type Task = {
    id: number;
    title: string;
    description?: string;
    created_at: string;
    // Add more fields from your 'tasks' table if needed
  };

  let tasks = writable<Task[]>([]);
  let error = '';
  let newTitle = '';
  let newDesc = '';

  async function fetchTasks() {
    error = '';
    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (fetchError) {
      error = fetchError.message;
      tasks.set([]);
    } else {
      tasks.set((data as Task[]) || []);
    }
  }

  async function addTask() {
  error = '';
  if (!newTitle.trim()) {
    error = 'Title is required';
    return;
  }
  if (!$session) {
    error = 'Not signed in!';
    return;
  }
  const { data, error: insertError } = await supabase
    .from('tasks')
    .insert([
      {
        title: newTitle,
        description: newDesc,
        owner_id: $session.user.id
      }
    ])
    .select();
  if (insertError) {
    error = insertError.message;
  } else {
    newTitle = '';
    newDesc = '';
    await fetchTasks();
  }
}


  $: if ($session) fetchTasks();
</script>

{#if $session}
  <h1>Welcome to ApplyNext</h1>
  <p>Logged in as {$session.user.email}</p>

  <form on:submit|preventDefault={addTask} style="margin: 2em 0;">
    <input
      type="text"
      placeholder="Task title"
      bind:value={newTitle}
      required
      style="padding:0.5em; margin-right:0.5em;"
    />
    <input
      type="text"
      placeholder="Task description"
      bind:value={newDesc}
      style="padding:0.5em; margin-right:0.5em;"
    />
    <button type="submit" style="padding:0.5em 1em;">Add Task</button>
  </form>

  {#if error}
    <div style="color:red">{error}</div>
  {/if}

  <h2>Your Tasks</h2>
  {#if $tasks.length === 0}
    <p>No tasks yet.</p>
  {:else}
    <ul>
      {#each $tasks as task}
        <li>
          <strong>{task.title}</strong>
          {#if task.description}
            : {task.description}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
{:else}
  <h1>Welcome to ApplyNext</h1>
  <p>Please sign in.</p>
{/if}
