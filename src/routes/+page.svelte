<script lang="ts">
  import { supabase } from '$lib/supabaseClient';

  async function signIn() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:5173/auth/callback'
      }
    });
    if (error) {
      console.error('OAuth error', error);
    } else {
      console.log('Redirecting to Google...', data);
    }
  }
</script>

<button on:click={signIn}>
  Sign in with Google
</button>
