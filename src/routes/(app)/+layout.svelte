<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { session } from '$lib/session';
  import { onMount } from 'svelte';
  import '../../app.css';

  async function signIn() {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  }
  async function signOut() {
    await supabase.auth.signOut();
    session.set(null); // Reset Svelte store
  }

  // Keep session store up to date
  onMount(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      session.set(sess);
    });
    supabase.auth.getSession().then(({ data }) => {
      session.set(data.session);
    });
    return () => subscription.unsubscribe();
  });
</script>

<nav>
  {#if $session}
    <button on:click={signOut}>Sign out</button>
  {:else}
    <button on:click={signIn}>Sign in with Google</button>
  {/if}
</nav>

<slot />
