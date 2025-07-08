<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { session } from '$lib/session';
  import { onMount } from 'svelte';

  // Always check session on client mount
  onMount(async () => {
    const { data } = await supabase.auth.getSession();
    session.set(data.session);
  });

  // Subscribe to session changes for reactivity
  $: $session = $session;

  function signIn() {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'http://localhost:5173/auth/callback' }
    });
  }

  function signOut() {
    supabase.auth.signOut();
    session.set(null);
  }
</script>

{#if !$session}
  <button on:click={signIn}>Sign in with Google</button>
{:else}
  <button on:click={signOut}>Sign out</button>
{/if}

<slot />
