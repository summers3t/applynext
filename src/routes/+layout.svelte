<script lang="ts">
	export let data;

	import { supabase } from '$lib/supabaseClient';
	import { session } from '$lib/session';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	// Svelte store auto-subscription
	$: userSession = $session; // $session is Svelte magic for "current value of the store"

	// --- Claim invitations for current session ---
	async function claimInvitations() {
		if (!userSession?.user?.email || !userSession?.user?.id) return;

		// Find all pending invitations for this email
		const { data, error } = await supabase
			.from('project_users')
			.select('id')
			.eq('invited_email', userSession.user.email)
			.is('user_id', null);

		if (error || !data || data.length === 0) return;

		// Claim each invitation
		await Promise.all(
			data.map((row) =>
				supabase
					.from('project_users')
					.update({
						user_id: userSession.user.id,
						invited_email: null,
						status: 'active'
					})
					.eq('id', row.id)
			)
		);
	}

	// --- Auth actions ---
	async function login() {
		// Use Google for now
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'google'
		});
		if (error) {
			alert('Login error: ' + error.message);
		}
	}

	async function logout() {
		await supabase.auth.signOut();
		goto('/');
	}

	// Run on mount & session change
	onMount(() => {
		if ($session?.user) claimInvitations();
	});

	$: if ($session?.user) claimInvitations();

	$: if ($session?.user && $page.url.pathname === '/') {
		goto('/projects');
	}
</script>

<!-- Simple top bar for login status and navigation -->
<div class="top-bar">
	<div class="left">
		<b>ApplyNext</b>
	</div>
	<div class="right">
		{#if $session?.user}
			<span style="margin-right:1em;">Logged in as {$session.user.email}</span>
			<button on:click={logout}>Log out</button>
		{:else}
			<button on:click={login}>Log in with Google</button>
		{/if}
	</div>
</div>

<!-- If not logged in, show welcome message and prevent using app -->
{#if !$session?.user}
	<div class="welcome">
		<h2>Welcome to ApplyNext</h2>
		<p>Sign in with Google to start managing your projects.</p>
	</div>
{:else}
	<slot />
{/if}

<style>
	.top-bar {
		width: 100vw;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1em 2em;
		background: #f5f7fc;
		border-bottom: 1px solid #e1e3ec;
		position: sticky;
		top: 0;
		z-index: 2;
		box-sizing: border-box;
		min-height: 3.2em;
	}
	.top-bar .left {
		font-size: 1.22em;
		font-weight: bold;
		color: #1976d2;
	}
	.top-bar .right {
		display: flex;
		align-items: center;
		gap: 1em;
	}
	.top-bar button {
		font-size: 1em;
		padding: 0.4em 1.4em;
		border-radius: 2em;
		border: none;
		background: #1976d2;
		color: #fff;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.14s;
	}
	.top-bar button:hover {
		background: #0c57b3;
	}
	.welcome {
		margin: 7em auto 0 auto;
		max-width: 430px;
		text-align: center;
		background: #fafcff;
		border-radius: 1.5em;
		box-shadow: 0 2px 24px #0001;
		padding: 3em 2em 2em 2em;
		font-size: 1.25em;
	}
</style>
