<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';

  let message = 'Logging you in…';

  onMount(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN') {
          message = 'Logged in! Redirecting…';
          subscription.unsubscribe();
          goto('/', { replaceState: true });
        } else if (event === 'SIGNED_OUT') {
          message = 'Not signed in';
        }
      }
    );
  });
</script>

<p>{message}</p>
