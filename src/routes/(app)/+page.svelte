<script lang="ts">
  import { session } from '$lib/session';
</script>

{#if $session}
  <h1>Welcome to ApplyNext</h1>
  <p>Logged in as {$session.user.email}</p>
{:else}
  <h1>Welcome to ApplyNext</h1>
  <p>Please sign in.</p>
{/if}
