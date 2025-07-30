create table public.projects (
    id uuid not null default gen_random_uuid (),
    name text not null,
    description text null,
    created_by uuid not null,
    created_at timestamp with time zone not null default timezone ('utc' :: text, now()),
    deadline date null,
    constraint projects_pkey primary key (id),
    constraint projects_created_by_fkey foreign KEY (created_by) references auth.users (id)
) TABLESPACE pg_default;

ALTER TABLE
    projects ENABLE ROW LEVEL SECURITY;

create policy "Allow project creator" on "public"."projects" to public with check ((created_by = auth.uid()));

ALTER TABLE
    projects ENABLE ROW LEVEL SECURITY;

create policy "Allow project creator select" on "public"."projects" to public using ((created_by = auth.uid()));

ALTER TABLE
    projects ENABLE ROW LEVEL SECURITY;

create policy "Any logged-in user can insert project" on "public"."projects" to public with check ((auth.uid() = created_by));

ALTER TABLE
    projects ENABLE ROW LEVEL SECURITY;

create policy "Only admins can delete project" on "public"."projects" to public using (
    (
        EXISTS (
            SELECT
                1
            FROM
                project_users
            WHERE
                (
                    (project_users.project_id = projects.id)
                    AND (project_users.user_id = auth.uid())
                    AND (project_users.role = 'admin' :: text)
                )
        )
    )
);

ALTER TABLE
    projects ENABLE ROW LEVEL SECURITY;

create policy "Only admins can update project" on "public"."projects" to public using (
    (
        EXISTS (
            SELECT
                1
            FROM
                project_users
            WHERE
                (
                    (project_users.project_id = projects.id)
                    AND (project_users.user_id = auth.uid())
                    AND (project_users.role = 'admin' :: text)
                )
        )
    )
);

ALTER TABLE
    projects ENABLE ROW LEVEL SECURITY;

create policy "Project members can select project" on "public"."projects" to public using (
    (
        EXISTS (
            SELECT
                1
            FROM
                project_users
            WHERE
                (
                    (project_users.project_id = projects.id)
                    AND (project_users.user_id = auth.uid())
                )
        )
    )
);

ALTER TABLE
    projects ENABLE ROW LEVEL SECURITY;

create policy "Users can view projects they are a member of" on "public"."projects" to public using (
    (
        EXISTS (
            SELECT
                1
            FROM
                project_users
            WHERE
                (
                    (project_users.project_id = projects.id)
                    AND (
                        (project_users.user_id = auth.uid())
                        OR (project_users.invited_email = auth.email())
                    )
                )
        )
    )
);

create table public.project_users (
    id uuid not null default gen_random_uuid (),
    project_id uuid not null,
    user_id uuid null,
    role text not null,
    added_at timestamp with time zone not null default timezone ('utc' :: text, now()),
    invited_email text null,
    status text null default 'active' :: text,
    is_owner boolean null default false,
    constraint project_users_pkey primary key (id),
    constraint project_users_project_id_user_id_key unique (project_id, user_id),
    constraint project_users_project_id_fkey foreign KEY (project_id) references projects (id) on delete CASCADE,
    constraint fk_user_id foreign KEY (user_id) references auth.users (id) on delete
    set
        null,
        constraint project_users_role_check check (
            (
                role = any (
                    array ['admin'::text, 'editor'::text, 'viewer'::text]
                )
            )
        )
) TABLESPACE pg_default;

ALTER TABLE
    project_users ENABLE ROW LEVEL SECURITY;

alter policy "Admin can remove editor/viewer" on "public"."project_users" to public using (
    (
        (
            EXISTS (
                SELECT
                    1
                FROM
                    project_users pu2
                WHERE
                    (
                        (pu2.project_id = project_users.project_id)
                        AND (pu2.user_id = auth.uid())
                        AND (pu2.role = 'admin' :: text)
                    )
            )
        )
        AND (
            (
                SELECT
                    projects.created_by
                FROM
                    projects
                WHERE
                    (projects.id = project_users.project_id)
            ) <> auth.uid()
        )
        AND (
            role = ANY (ARRAY ['editor'::text, 'viewer'::text])
        )
    )
);

ALTER TABLE
    project_users ENABLE ROW LEVEL SECURITY;

alter policy "Admin can update editor/viewer only" on "public"."project_users" to public using (
    (
        (
            EXISTS (
                SELECT
                    1
                FROM
                    project_users pu2
                WHERE
                    (
                        (pu2.project_id = project_users.project_id)
                        AND (pu2.user_id = auth.uid())
                        AND (pu2.role = 'admin' :: text)
                    )
            )
        )
        AND (
            (
                SELECT
                    projects.created_by
                FROM
                    projects
                WHERE
                    (projects.id = project_users.project_id)
            ) <> auth.uid()
        )
        AND (role <> 'admin' :: text)
    )
);

ALTER TABLE
    project_users ENABLE ROW LEVEL SECURITY;

alter policy "Allow insert for invites" on "public"."project_users" to public with check (
    (
        (user_id = auth.uid())
        OR (
            (user_id IS NULL)
            AND (invited_email IS NOT NULL)
        )
    )
);

ALTER TABLE
    project_users ENABLE ROW LEVEL SECURITY;

alter policy "Any logged-in user can INSERT" on "public"."project_users" to public with check ((auth.uid() IS NOT NULL));

ALTER TABLE
    project_users ENABLE ROW LEVEL SECURITY;

alter policy "Anyone logged in can see project_users" on "public"."project_users" to public using ((auth.uid() IS NOT NULL));

ALTER TABLE
    project_users ENABLE ROW LEVEL SECURITY;

alter policy "Invited user can claim invitation" on "public"."project_users" to public using (
    (
        (invited_email = auth.email())
        AND (user_id IS NULL)
    )
);

ALTER TABLE
    project_users ENABLE ROW LEVEL SECURITY;

alter policy "Members can DELETE own membership" on "public"."project_users" to public using ((user_id = auth.uid()));

ALTER TABLE
    project_users ENABLE ROW LEVEL SECURITY;

alter policy "Members can UPDATE own membership" on "public"."project_users" to public using ((user_id = auth.uid()));

ALTER TABLE
    project_users ENABLE ROW LEVEL SECURITY;

alter policy "Owner can remove any member" on "public"."project_users" to public using (
    (
        (
            SELECT
                projects.created_by
            FROM
                projects
            WHERE
                (projects.id = project_users.project_id)
        ) = auth.uid()
    )
);

ALTER TABLE
    project_users ENABLE ROW LEVEL SECURITY;

alter policy "Owner can update any role" on "public"."project_users" to public using (
    (
        (
            SELECT
                projects.created_by
            FROM
                projects
            WHERE
                (projects.id = project_users.project_id)
        ) = auth.uid()
    )
);

ALTER TABLE
    project_users ENABLE ROW LEVEL SECURITY;

alter policy "Users and invited can SELECT project_users" on "public"."project_users" to public using (
    (
        (user_id = auth.uid())
        OR (invited_email = auth.email())
    )
);

create table public.roles (
    id serial not null,
    role_name text not null,
    constraint roles_pkey primary key (id),
    constraint roles_role_name_key unique (role_name)
) TABLESPACE pg_default;

ALTER TABLE
    roles ENABLE ROW LEVEL SECURITY;

alter policy "Any logged in user can read" on "public"."roles" to public using ((auth.uid() IS NOT NULL));

create table public.user_roles (
    user_id uuid not null,
    role_id integer not null,
    constraint user_roles_pkey primary key (user_id, role_id),
    constraint user_roles_role_id_fkey foreign KEY (role_id) references roles (id) on delete CASCADE
) TABLESPACE pg_default;

ALTER TABLE
    user_roles ENABLE ROW LEVEL SECURITY;

alter policy "Any logged in user can read" on "public"."user_roles" to public using ((auth.uid() IS NOT NULL));

ALTER TABLE
    user_roles ENABLE ROW LEVEL SECURITY;

alter policy "UserRoles: Admin delete" on "public"."user_roles" to public using (
    (
        EXISTS (
            SELECT
                1
            FROM
                (
                    user_roles ur
                    JOIN roles r ON ((r.id = ur.role_id))
                )
            WHERE
                (
                    (ur.user_id = auth.uid())
                    AND (r.role_name = 'admin' :: text)
                )
        )
    )
);

ALTER TABLE
    user_roles ENABLE ROW LEVEL SECURITY;

alter policy "UserRoles: Admin insert" on "public"."user_roles" to public with check (
    (
        EXISTS (
            SELECT
                1
            FROM
                (
                    user_roles ur
                    JOIN roles r ON ((r.id = ur.role_id))
                )
            WHERE
                (
                    (ur.user_id = auth.uid())
                    AND (r.role_name = 'admin' :: text)
                )
        )
    )
);

ALTER TABLE
    user_roles ENABLE ROW LEVEL SECURITY;

alter policy "UserRoles: Admin update" on "public"."user_roles" to public using (
    (
        EXISTS (
            SELECT
                1
            FROM
                (
                    user_roles ur
                    JOIN roles r ON ((r.id = ur.role_id))
                )
            WHERE
                (
                    (ur.user_id = auth.uid())
                    AND (r.role_name = 'admin' :: text)
                )
        )
    )
);

create view public.user_emails as
select
    id,
    email
from
    auth.users;

create table public.tasks (
    id uuid not null default gen_random_uuid (),
    owner_id uuid null,
    title text not null,
    description text null,
    status text null default 'pending' :: text,
    created_at timestamp with time zone null default now(),
    updated_at timestamp with time zone null default now(),
    due_date date null,
    sort_index integer not null default 0,
    project_id uuid null,
    created_by_email text null,
    short_id text not null,
    last_edited_by uuid null,
    assigned_to uuid null,
    constraint tasks_pkey primary key (id),
    constraint tasks_project_id_fkey foreign KEY (project_id) references projects (id) on delete CASCADE,
    constraint tasks_owner_id_fkey foreign KEY (owner_id) references auth.users (id) on delete
    set
        null,
        constraint tasks_last_edited_by_fkey foreign KEY (last_edited_by) references auth.users (id) on delete
    set
        null,
        constraint tasks_assigned_to_fkey foreign KEY (assigned_to) references auth.users (id) on delete
    set
        null
) TABLESPACE pg_default;

create index IF not exists idx_tasks_owner_id on public.tasks using btree (owner_id) TABLESPACE pg_default;

create unique INDEX IF not exists tasks_short_id_key on public.tasks using btree (short_id) TABLESPACE pg_default;

create trigger trigger_update_updated_at BEFORE
update
    on tasks for EACH row execute FUNCTION update_updated_at_column ();

create trigger set_short_id BEFORE
INSERT
    on tasks for EACH row execute FUNCTION generate_short_id ();

ALTER TABLE
    tasks ENABLE ROW LEVEL SECURITY;

alter policy "Admins and editors can insert tasks" on "public"."tasks" to public with check (
    (
        EXISTS (
            SELECT
                1
            FROM
                project_users
            WHERE
                (
                    (project_users.project_id = tasks.project_id)
                    AND (project_users.user_id = auth.uid())
                    AND (
                        project_users.role = ANY (ARRAY ['admin'::text, 'editor'::text])
                    )
                )
        )
    )
);

ALTER TABLE
    tasks ENABLE ROW LEVEL SECURITY;

alter policy "Admins and Editors can insert tasks" on "public"."tasks" to public with check (
    (
        project_id IN (
            SELECT
                project_users.project_id
            FROM
                project_users
            WHERE
                (
                    (project_users.user_id = auth.uid())
                    AND (
                        project_users.role = ANY (ARRAY ['admin'::text, 'editor'::text])
                    )
                )
        )
    )
);

ALTER TABLE
    tasks ENABLE ROW LEVEL SECURITY;

alter policy "Admins can delete any; editors only their own" on "public"."tasks" to public using (
    (
        EXISTS (
            SELECT
                1
            FROM
                project_users
            WHERE
                (
                    (project_users.project_id = tasks.project_id)
                    AND (project_users.user_id = auth.uid())
                    AND (
                        (project_users.role = 'admin' :: text)
                        OR (
                            (project_users.role = 'editor' :: text)
                            AND (tasks.owner_id = auth.uid())
                        )
                    )
                )
        )
    )
);

ALTER TABLE
    tasks ENABLE ROW LEVEL SECURITY;

alter policy "Admins can update any; editors only their own" on "public"."tasks" to public using (
    (
        EXISTS (
            SELECT
                1
            FROM
                project_users
            WHERE
                (
                    (project_users.project_id = tasks.project_id)
                    AND (project_users.user_id = auth.uid())
                    AND (
                        (project_users.role = 'admin' :: text)
                        OR (
                            (project_users.role = 'editor' :: text)
                            AND (tasks.owner_id = auth.uid())
                        )
                    )
                )
        )
    )
);

ALTER TABLE
    tasks ENABLE ROW LEVEL SECURITY;

alter policy "Project members can insert" on "public"."tasks" to public with check (
    (
        (
            project_id IN (
                SELECT
                    project_users.project_id
                FROM
                    project_users
                WHERE
                    (project_users.user_id = auth.uid())
            )
        )
        AND (owner_id = auth.uid())
    )
);

ALTER TABLE
    tasks ENABLE ROW LEVEL SECURITY;

alter policy "Project members can read tasks" on "public"."tasks" to public using (
    (
        project_id IN (
            SELECT
                project_users.project_id
            FROM
                project_users
            WHERE
                (project_users.user_id = auth.uid())
        )
    )
);

ALTER TABLE
    tasks ENABLE ROW LEVEL SECURITY;

alter policy "Project members can select tasks" on "public"."tasks" to public using (
    (
        EXISTS (
            SELECT
                1
            FROM
                project_users
            WHERE
                (
                    (project_users.project_id = tasks.project_id)
                    AND (project_users.user_id = auth.uid())
                )
        )
    )
);

ALTER TABLE
    tasks ENABLE ROW LEVEL SECURITY;

alter policy "Task owner or admin can delete" on "public"."tasks" to public using (
    (
        (owner_id = auth.uid())
        OR (
            project_id IN (
                SELECT
                    project_users.project_id
                FROM
                    project_users
                WHERE
                    (
                        (project_users.user_id = auth.uid())
                        AND (project_users.role = 'admin' :: text)
                    )
            )
        )
    )
);

ALTER TABLE
    tasks ENABLE ROW LEVEL SECURITY;

alter policy "Task owner or admin can modify" on "public"."tasks" to public using (
    (
        (owner_id = auth.uid())
        OR (
            project_id IN (
                SELECT
                    project_users.project_id
                FROM
                    project_users
                WHERE
                    (
                        (project_users.user_id = auth.uid())
                        AND (project_users.role = 'admin' :: text)
                    )
            )
        )
    )
);

ALTER TABLE
    tasks ENABLE ROW LEVEL SECURITY;

alter policy "Tasks: Any logged in user can create" on "public"."tasks" to public with check ((auth.uid() IS NOT NULL));

ALTER TABLE
    tasks ENABLE ROW LEVEL SECURITY;

alter policy "Tasks: Owner or admin delete" on "public"."tasks" to public using (
    (
        (owner_id = auth.uid())
        OR (
            EXISTS (
                SELECT
                    1
                FROM
                    (
                        user_roles ur
                        JOIN roles r ON ((r.id = ur.role_id))
                    )
                WHERE
                    (
                        (ur.user_id = auth.uid())
                        AND (r.role_name = 'admin' :: text)
                    )
            )
        )
    )
);

ALTER TABLE
    tasks ENABLE ROW LEVEL SECURITY;

alter policy "Tasks: Owner or admin read" on "public"."tasks" to public using (
    (
        (owner_id = auth.uid())
        OR (
            EXISTS (
                SELECT
                    1
                FROM
                    (
                        user_roles ur
                        JOIN roles r ON ((r.id = ur.role_id))
                    )
                WHERE
                    (
                        (ur.user_id = auth.uid())
                        AND (r.role_name = 'admin' :: text)
                    )
            )
        )
    )
);

ALTER TABLE
    tasks ENABLE ROW LEVEL SECURITY;

alter policy "Tasks: Owner or admin update" on "public"."tasks" to public using (
    (
        (owner_id = auth.uid())
        OR (
            EXISTS (
                SELECT
                    1
                FROM
                    (
                        user_roles ur
                        JOIN roles r ON ((r.id = ur.role_id))
                    )
                WHERE
                    (
                        (ur.user_id = auth.uid())
                        AND (r.role_name = 'admin' :: text)
                    )
            )
        )
    )
);

create table public.task_items (
    id uuid not null default gen_random_uuid (),
    task_id uuid not null,
    item_id uuid not null,
    project_id uuid not null,
    created_at timestamp with time zone not null default timezone ('utc' :: text, now()),
    created_by uuid null,
    constraint task_items_pkey primary key (id),
    constraint task_items_project_id_fkey foreign KEY (project_id) references projects (id) on delete CASCADE,
    constraint task_items_created_by_fkey foreign KEY (created_by) references auth.users (id),
    constraint task_items_task_id_fkey foreign KEY (task_id) references tasks (id) on delete CASCADE,
    constraint task_items_item_id_fkey foreign KEY (item_id) references items (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists uniq_task_item on public.task_items using btree (task_id, item_id) TABLESPACE pg_default;

create table public.subtasks (
    id uuid not null default gen_random_uuid (),
    task_id uuid not null,
    owner_id uuid not null,
    content text not null,
    created_at timestamp with time zone not null default timezone ('utc' :: text, now()),
    updated_at timestamp with time zone not null default timezone ('utc' :: text, now()),
    status text not null default 'open' :: text,
    due_date date null,
    sort_index integer not null default 0,
    project_id uuid null,
    short_id text not null default upper(substr(md5((random()) :: text), 1, 4)),
    last_edited_by uuid null,
    assigned_to uuid null,
    created_by_email text not null default '' :: text,
    constraint subtasks_pkey primary key (id),
    constraint subtasks_task_id_fkey foreign KEY (task_id) references tasks (id) on delete CASCADE,
    constraint subtasks_owner_id_fkey foreign KEY (owner_id) references auth.users (id),
    constraint subtasks_project_id_fkey foreign KEY (project_id) references projects (id) on delete CASCADE,
    constraint subtasks_assigned_to_fkey foreign KEY (assigned_to) references auth.users (id) on delete
    set
        null
) TABLESPACE pg_default;

create unique INDEX IF not exists subtasks_short_id_key on public.subtasks using btree (short_id) TABLESPACE pg_default;

create unique INDEX IF not exists unique_subtask_per_task on public.subtasks using btree (
    task_id,
    lower(
        TRIM(
            both
            from
                content
        )
    )
) TABLESPACE pg_default;

ALTER TABLE
    subtasks ENABLE ROW LEVEL SECURITY;

alter policy "Admins and editors can insert subtasks" on "public"."subtasks" to public with check (
    (
        EXISTS (
            SELECT
                1
            FROM
                project_users
            WHERE
                (
                    (project_users.project_id = subtasks.project_id)
                    AND (project_users.user_id = auth.uid())
                    AND (
                        project_users.role = ANY (ARRAY ['admin'::text, 'editor'::text])
                    )
                )
        )
    )
);

ALTER TABLE
    subtasks ENABLE ROW LEVEL SECURITY;

alter policy "Admins can delete any; editors only their own" on "public"."subtasks" to public using (
    (
        EXISTS (
            SELECT
                1
            FROM
                project_users
            WHERE
                (
                    (project_users.project_id = subtasks.project_id)
                    AND (project_users.user_id = auth.uid())
                    AND (
                        (project_users.role = 'admin' :: text)
                        OR (
                            (project_users.role = 'editor' :: text)
                            AND (subtasks.owner_id = auth.uid())
                        )
                    )
                )
        )
    )
);

ALTER TABLE
    subtasks ENABLE ROW LEVEL SECURITY;

alter policy "Admins can update any; editors only their own" on "public"."subtasks" to public using (
    (
        EXISTS (
            SELECT
                1
            FROM
                project_users
            WHERE
                (
                    (project_users.project_id = subtasks.project_id)
                    AND (project_users.user_id = auth.uid())
                    AND (
                        (project_users.role = 'admin' :: text)
                        OR (
                            (project_users.role = 'editor' :: text)
                            AND (subtasks.owner_id = auth.uid())
                        )
                    )
                )
        )
    )
);

ALTER TABLE
    subtasks ENABLE ROW LEVEL SECURITY;

alter policy "Project members can select subtasks" on "public"."subtasks" to public using (
    (
        EXISTS (
            SELECT
                1
            FROM
                project_users
            WHERE
                (
                    (project_users.project_id = subtasks.project_id)
                    AND (project_users.user_id = auth.uid())
                )
        )
    )
);

ALTER TABLE
    subtasks ENABLE ROW LEVEL SECURITY;

alter policy "Users can manage their own subtasks" on "public"."subtasks" to public using ((auth.uid() = owner_id));

create table public.items (
    id uuid not null default gen_random_uuid (),
    project_id uuid not null,
    name text not null,
    status text not null,
    created_by uuid not null,
    created_at timestamp with time zone null default now(),
    constraint items_pkey primary key (id),
    constraint items_created_by_fkey foreign KEY (created_by) references auth.users (id),
    constraint items_project_id_fkey foreign KEY (project_id) references projects (id) on delete CASCADE,
    constraint items_status_check check (
        (
            status = any (array ['present'::text, 'not_present'::text])
        )
    )
) TABLESPACE pg_default;

create table public.comments (
    id uuid not null default gen_random_uuid (),
    project_id uuid not null,
    task_id uuid null,
    subtask_id uuid null,
    user_id uuid not null,
    content text not null,
    created_at timestamp with time zone null default now(),
    updated_at timestamp with time zone null default now(),
    constraint comments_pkey primary key (id),
    constraint comments_project_id_fkey foreign KEY (project_id) references projects (id) on delete CASCADE,
    constraint comments_task_id_fkey foreign KEY (task_id) references tasks (id) on delete CASCADE,
    constraint comments_subtask_id_fkey foreign KEY (subtask_id) references subtasks (id) on delete CASCADE,
    constraint comments_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete
    set
        null
) TABLESPACE pg_default;

create index IF not exists idx_comments_task_id on public.comments using btree (task_id) TABLESPACE pg_default;

create index IF not exists idx_comments_subtask_id on public.comments using btree (subtask_id) TABLESPACE pg_default;

create index IF not exists idx_comments_project_id on public.comments using btree (project_id) TABLESPACE pg_default;

create table public.attachments (
    id uuid not null default gen_random_uuid (),
    task_id uuid null,
    uploader_id uuid null,
    file_url text not null,
    file_name text null,
    created_at timestamp with time zone null default now(),
    constraint attachments_pkey primary key (id),
    constraint attachments_task_id_fkey foreign KEY (task_id) references tasks (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_attachments_task_id on public.attachments using btree (task_id) TABLESPACE pg_default;

ALTER TABLE
    attachments ENABLE ROW LEVEL SECURITY;

alter policy "Attachments: Any logged in user can create" on "public"."attachments" to public with check ((auth.uid() IS NOT NULL));

ALTER TABLE
    attachments ENABLE ROW LEVEL SECURITY;

alter policy "Attachments: Owner, uploader, or admin read" on "public"."attachments" to public using (
    (
        (uploader_id = auth.uid())
        OR (
            EXISTS (
                SELECT
                    1
                FROM
                    tasks t
                WHERE
                    (
                        (t.id = attachments.task_id)
                        AND (t.owner_id = auth.uid())
                    )
            )
        )
        OR (
            EXISTS (
                SELECT
                    1
                FROM
                    (
                        user_roles ur
                        JOIN roles r ON ((r.id = ur.role_id))
                    )
                WHERE
                    (
                        (ur.user_id = auth.uid())
                        AND (r.role_name = 'admin' :: text)
                    )
            )
        )
    )
);

ALTER TABLE
    attachments ENABLE ROW LEVEL SECURITY;

alter policy "Attachments: Uploader or admin delete" on "public"."attachments" to public using (
    (
        (uploader_id = auth.uid())
        OR (
            EXISTS (
                SELECT
                    1
                FROM
                    (
                        user_roles ur
                        JOIN roles r ON ((r.id = ur.role_id))
                    )
                WHERE
                    (
                        (ur.user_id = auth.uid())
                        AND (r.role_name = 'admin' :: text)
                    )
            )
        )
    )
);

ALTER TABLE
    attachments ENABLE ROW LEVEL SECURITY;

alter policy "Attachments: Uploader or admin update" on "public"."attachments" to public using (
    (
        (uploader_id = auth.uid())
        OR (
            EXISTS (
                SELECT
                    1
                FROM
                    (
                        user_roles ur
                        JOIN roles r ON ((r.id = ur.role_id))
                    )
                WHERE
                    (
                        (ur.user_id = auth.uid())
                        AND (r.role_name = 'admin' :: text)
                    )
            )
        )
    )
);