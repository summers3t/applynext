-- Users Table (mirrors Supabase auth.users, but allows extension)
CREATE TABLE public.users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text UNIQUE,
    full_name text,
    created_at timestamptz DEFAULT now()
);

-- Roles Table
CREATE TABLE public.roles (
    id serial PRIMARY KEY,
    role_name text UNIQUE NOT NULL  -- e.g., 'admin', 'user'
);

-- User Roles Mapping (many-to-many)
CREATE TABLE public.user_roles (
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    role_id int REFERENCES public.roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Tasks Table
CREATE TABLE public.tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'pending',  -- e.g., 'pending', 'in_progress', 'done'
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Comments Table
CREATE TABLE public.comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
    author_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Attachments Table
CREATE TABLE public.attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
    uploader_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    file_url text NOT NULL,
    file_name text,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- ========== RLS POLICIES ==========

-- Users: User can see/update only themselves
CREATE POLICY "Users: Self access"
  ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users: Self update"
  ON public.users FOR UPDATE USING (id = auth.uid());

-- Roles: Only admins can view/modify
CREATE POLICY "Roles: Admin only"
  ON public.roles FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.role_name = 'admin'
    )
  );

-- User_Roles: Only admins manage roles
CREATE POLICY "UserRoles: Admin only"
  ON public.user_roles FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.role_name = 'admin'
    )
  );
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

-- Tasks: Owner or admin access
CREATE POLICY "Tasks: Owner or admin read"
  ON public.tasks FOR SELECT USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.role_name = 'admin'
    )
  );
CREATE POLICY "Tasks: Owner or admin update"
  ON public.tasks FOR UPDATE USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.role_name = 'admin'
    )
  );
CREATE POLICY "Tasks: Owner or admin delete"
  ON public.tasks FOR DELETE USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.role_name = 'admin'
    )
  );
CREATE POLICY "Tasks: Any logged in user can create"
  ON public.tasks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Comments: Author, task owner, or admin access
CREATE POLICY "Comments: Author, task owner, or admin read"
  ON public.comments FOR SELECT USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.role_name = 'admin'
    )
  );
CREATE POLICY "Comments: Author, admin update"
  ON public.comments FOR UPDATE USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.role_name = 'admin'
    )
  );
CREATE POLICY "Comments: Author, admin delete"
  ON public.comments FOR DELETE USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.role_name = 'admin'
    )
  );
CREATE POLICY "Comments: Any logged in user can create"
  ON public.comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Attachments: Task owner, uploader, or admin access
CREATE POLICY "Attachments: Owner, uploader, or admin read"
  ON public.attachments FOR SELECT USING (
    uploader_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.role_name = 'admin'
    )
  );
CREATE POLICY "Attachments: Uploader or admin update"
  ON public.attachments FOR UPDATE USING (
    uploader_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.role_name = 'admin'
    )
  );
CREATE POLICY "Attachments: Uploader or admin delete"
  ON public.attachments FOR DELETE USING (
    uploader_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.role_name = 'admin'
    )
  );
CREATE POLICY "Attachments: Any logged in user can create"
  ON public.attachments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ========== INDEXES ==========

CREATE INDEX IF NOT EXISTS idx_tasks_owner_id ON public.tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_comments_task_id ON public.comments(task_id);
CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON public.attachments(task_id);

-- ========== TRIGGERS ==========

-- Auto-update updated_at on tasks
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();
