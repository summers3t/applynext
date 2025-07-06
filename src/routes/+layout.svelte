<script lang="ts">
  import '../app.css';
  import { supabase } from '$lib/supabaseClient';
  import { page } from '$app/stores';
  import { derived } from 'svelte/store';

  // Create a session store from the server-loaded data
  const session = derived(page, ($p) => $p.data.session);

  // Trigger Google OAuth sign-in
  function signIn() {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'http://localhost:5173/auth/callback' }
    });
  }

  // Sign out and clear session
  async function signOut() {
    await supabase.auth.signOut();
  }
</script>

<nav>
  {#if $session}
    <span>Welcome, {$session.user.email}</span>
    <button on:click={signOut}>Sign out</button>
  {:else}
    <button on:click={signIn}>Sign in with Google</button>
  {/if}
</nav>

<slot />
