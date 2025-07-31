import { I as escape_html, O as ensure_array_like, D as pop, z as push } from "../../../chunks/index.js";
import { s as supabase } from "../../../chunks/supabaseClient.js";
import { s as session } from "../../../chunks/session.js";
import { g as get } from "../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/state.svelte.js";
function _page($$payload, $$props) {
  push();
  let projects = [];
  let loading = false;
  let sessionValue = get(session);
  session.subscribe((s) => {
    sessionValue = s;
    if (sessionValue?.user?.id) {
      loadProjects();
    }
  });
  async function loadProjects() {
    if (!sessionValue) {
      projects = [];
      return;
    }
    loading = true;
    const { data, error: err } = await supabase.from("project_users").select("role, projects(id, name, description, deadline)").eq("user_id", sessionValue.user.id);
    if (err) {
      err.message;
      loading = false;
      return;
    }
    console.log("Project Users Result:", data);
    projects = (data ?? []).map((row) => {
      const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
      return project && { ...project, role: row.role };
    }).filter(Boolean);
    console.log("Projects found:", projects);
    loading = false;
  }
  function formatDate(date) {
    if (!date) return "";
    const parts = date.split("-");
    if (parts.length !== 3) return date;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  session.subscribe((s) => {
    sessionValue = s;
    if (sessionValue?.user?.id) {
      loadProjects();
    }
  });
  $$payload.out.push(`<div class="project-list-container svelte-tr34vb"><div class="header-row svelte-tr34vb"><h1>ApplyNext Projects</h1> <button class="create-btn svelte-tr34vb">${escape_html("Create Project")}</button></div> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> `);
  if (loading) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<p>Loading projects…</p>`);
  } else {
    $$payload.out.push("<!--[!-->");
    if (projects.length === 0) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`<p>You have no projects yet. Create one to get started!</p>`);
    } else {
      $$payload.out.push("<!--[!-->");
      const each_array = ensure_array_like(projects);
      $$payload.out.push(`<div><!--[-->`);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let p = each_array[$$index];
        $$payload.out.push(`<div class="project-row svelte-tr34vb"><span style="min-width:13em;"><b>Project:</b> ${escape_html(p.name)}</span> <span>${escape_html(p.description)}</span> <span class="deadline svelte-tr34vb">${escape_html(p.deadline ? formatDate(p.deadline) : "")}</span> <span class="role-badge svelte-tr34vb">${escape_html(p.role[0].toUpperCase() + p.role.slice(1))}</span></div>`);
      }
      $$payload.out.push(`<!--]--></div>`);
    }
    $$payload.out.push(`<!--]-->`);
  }
  $$payload.out.push(`<!--]--></div>`);
  pop();
}
export {
  _page as default
};
