// @ts-nocheck
import type { LayoutServerLoad } from './$types';

export const load = async ({ locals: { supabase } }: Parameters<LayoutServerLoad>[0]) => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.error('Session loading error:', error);
  return { session };
};
