import { E as store_get, F as maybe_selected, G as attr, I as escape_html, J as slot, K as unsubscribe_stores, M as bind_props, D as pop, z as push } from "../../chunks/index.js";
/* empty css               */
import { s as supabase } from "../../chunks/supabaseClient.js";
import { s as session } from "../../chunks/session.js";
import { p as page, g as goto } from "../../chunks/index3.js";
import { s as statusFilter, d as dueFilter, a as searchQuery } from "../../chunks/filterStore.js";
function _layout($$payload, $$props) {
  push();
  var $$store_subs;
  let userSession;
  let data = $$props["data"];
  async function claimInvitations() {
    if (!userSession?.user?.email || !userSession?.user?.id) return;
    const { data: data2, error } = await supabase.from("project_users").select("id").eq("invited_email", userSession.user.email).is("user_id", null);
    if (error || !data2 || data2.length === 0) return;
    await Promise.all(data2.map((row) => supabase.from("project_users").update({
      user_id: userSession.user.id,
      invited_email: null,
      status: "active"
    }).eq("id", row.id)));
  }
  userSession = store_get($$store_subs ??= {}, "$session", session);
  if (store_get($$store_subs ??= {}, "$session", session)?.user) claimInvitations();
  if (store_get($$store_subs ??= {}, "$session", session)?.user && page.url.pathname === "/") {
    goto();
  }
  $$payload.out.push(`<div class="top-bar svelte-m8an6f"><div class="left svelte-m8an6f"><b>ApplyNext</b></div> `);
  if (store_get($$store_subs ??= {}, "$session", session)?.user && page.url.pathname.startsWith("/projects/")) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="center"><div class="task-filters" style="display:flex; gap:1em; align-items:center; margin-bottom:1.5em;"><label>Status: <select>`);
    $$payload.select_value = store_get($$store_subs ??= {}, "$statusFilter", statusFilter);
    $$payload.out.push(`<option value="all"${maybe_selected($$payload, "all")}>All</option><option value="open"${maybe_selected($$payload, "open")}>Open</option><option value="in_progress"${maybe_selected($$payload, "in_progress")}>In Progress</option><option value="done"${maybe_selected($$payload, "done")}>Done</option>`);
    $$payload.select_value = void 0;
    $$payload.out.push(`</select></label> <label>Due: <select>`);
    $$payload.select_value = store_get($$store_subs ??= {}, "$dueFilter", dueFilter);
    $$payload.out.push(`<option value="all"${maybe_selected($$payload, "all")}>All</option><option value="overdue"${maybe_selected($$payload, "overdue")}>Overdue</option><option value="today"${maybe_selected($$payload, "today")}>Today</option><option value="upcoming"${maybe_selected($$payload, "upcoming")}>Upcoming</option><option value="none"${maybe_selected($$payload, "none")}>No Due Date</option>`);
    $$payload.select_value = void 0;
    $$payload.out.push(`</select></label> <input type="text" placeholder="Search tasks…"${attr("value", store_get($$store_subs ??= {}, "$searchQuery", searchQuery))} style="min-width: 12em;"/> <button${attr("disabled", store_get($$store_subs ??= {}, "$statusFilter", statusFilter) === "all" && store_get($$store_subs ??= {}, "$dueFilter", dueFilter) === "all" && !store_get($$store_subs ??= {}, "$searchQuery", searchQuery).trim(), true)} style="margin-left:1em;" class="svelte-m8an6f">Clear filters</button></div></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> <div class="right svelte-m8an6f">`);
  if (store_get($$store_subs ??= {}, "$session", session)?.user) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<span style="margin-right:1em;">Logged in as ${escape_html(store_get($$store_subs ??= {}, "$session", session).user.email)}</span> <button class="svelte-m8an6f">Log out</button>`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<button class="svelte-m8an6f">Log in with Google</button>`);
  }
  $$payload.out.push(`<!--]--></div></div> `);
  if (!store_get($$store_subs ??= {}, "$session", session)?.user) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="welcome svelte-m8an6f"><h2>Welcome to ApplyNext</h2> <p>Sign in with Google to start managing your projects.</p></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<!---->`);
    slot($$payload, $$props, "default", {});
    $$payload.out.push(`<!---->`);
  }
  $$payload.out.push(`<!--]-->`);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  bind_props($$props, { data });
  pop();
}
export {
  _layout as default
};
