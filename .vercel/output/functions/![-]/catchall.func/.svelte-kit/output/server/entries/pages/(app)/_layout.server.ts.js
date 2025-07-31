const load = async ({ locals: { supabase } }) => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.error("Session loading error:", error);
  return { session };
};
export {
  load
};
