<script lang="ts">
  import { session } from '$lib/session';
</script>

{#if $session}
  <h1>Welcome to ApplyNext If 1</h1>
  <p>Logged in as {$session.user.email}</p>
{:else}
  <h1>Welcome to ApplyNext If 2</h1>
  <p>Please sign in.</p>
{/if}