<script>
  // This page only exists to redirect after login!
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  onMount(() => {
    goto('/projects');
  });
</script>
