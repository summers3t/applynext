<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';

  onMount(async () => {
    const { data, error } = await supabase.auth.getSessionFromUrl({ storeSession: true });
    if (error) {
      console.error('Error parsing session from URL:', error);
      return;
    }
    // Session parsed successfully; clean redirect:
    goto('/', { replaceState: true });
  });
</script>

<p>Logging you in…</p>
