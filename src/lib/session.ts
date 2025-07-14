import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';

export const session = writable<Session | null>(null);

if (browser) {
  // On first load: get the latest session (e.g. after OAuth redirect)
  supabase.auth.getSession().then(({ data: { session: s } }) => {
    session.set(s);
  });

  // Listen to any changes (sign in, sign out, refresh, OAuth, etc)
  supabase.auth.onAuthStateChange((_event, s) => {
    session.set(s);
  });
}
