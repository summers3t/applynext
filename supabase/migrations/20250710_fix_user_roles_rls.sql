-- Drop all SELECT policies on user_roles (to be sure)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT polname FROM pg_policy WHERE polrelid = 'user_roles'::regclass AND polcmd = 's'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%I" ON public.user_roles;', r.polname);
  END LOOP;
END $$;

-- Now create the safe policy (no recursion!)
CREATE POLICY "UserRoles: Any logged in user can read"
  ON public.user_roles FOR SELECT USING (auth.uid() IS NOT NULL);

-- Re-add admin-only write policies (safe to drop and recreate)
DROP POLICY IF EXISTS "UserRoles: Admin insert" ON public.user_roles;
DROP POLICY IF EXISTS "UserRoles: Admin update" ON public.user_roles;
DROP POLICY IF EXISTS "UserRoles: Admin delete" ON public.user_roles;

CREATE POLICY "UserRoles: Admin insert"
  ON public.user_roles FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.role_name = 'admin'
    )
  );
CREATE POLICY "UserRoles: Admin update"
  ON public.user_roles FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.role_name = 'admin'
    )
  );
CREATE POLICY "UserRoles: Admin delete"
  ON public.user_roles FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.role_name = 'admin'
    )
  );
