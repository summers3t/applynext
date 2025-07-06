// src/app.d.ts
import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Database } from '$lib/database.types';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient<Database>;
    }
  }
}
