import { N as store_set, E as store_get, I as escape_html, G as attr, O as ensure_array_like, P as attr_class, Q as attr_style, R as stringify, F as maybe_selected, K as unsubscribe_stores, D as pop, z as push } from "../../../../chunks/index.js";
import { s as supabase } from "../../../../chunks/supabaseClient.js";
import { s as session } from "../../../../chunks/session.js";
import { g as get } from "../../../../chunks/index2.js";
function _page($$payload, $$props) {
  push();
  var $$store_subs;
  const statusColors = { open: "#fff", in_progress: "#1976d2", done: "#43a047" };
  const overdueColor = "#e74c3c";
  let tasks = [];
  let loading = false;
  let error = "";
  let newTitle = "";
  let newDescription = "";
  let newStatus = "open";
  let newDueDate = null;
  let insertingAtIndex = null;
  let selected = null;
  let editingTaskId = null;
  let editTitle = "";
  let editDescription = "";
  let editStatus = "open";
  let editDueDate = null;
  let savingEdit = false;
  let insertingSubtaskAt = null;
  let newSubtaskContent = "";
  let newSubtaskStatus = "open";
  let newSubtaskDueDate = null;
  let editingSubtaskId = null;
  let editSubtaskContent = "";
  let editSubtaskStatus = "open";
  let editSubtaskDueDate = null;
  let savingSubtaskEdit = false;
  let expandedTasks = /* @__PURE__ */ new Set();
  function formatDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.slice(0, 10).split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  function isOverdue(due_date, status) {
    if (!due_date || status === "done") return false;
    const today = /* @__PURE__ */ new Date();
    const d = new Date(due_date);
    return d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }
  function statusDotColor(status, overdue) {
    if (overdue) return overdueColor;
    return statusColors[status];
  }
  async function fetchTasks() {
    loading = true;
    error = "";
    if (!store_get($$store_subs ??= {}, "$session", session)) {
      tasks = [];
      loading = false;
      return;
    }
    const { data, error: err } = await supabase.from("tasks").select("*, subtasks(*)").eq("owner_id", store_get($$store_subs ??= {}, "$session", session).user.id).order("sort_index", { ascending: true });
    if (err) {
      error = err.message;
      tasks = [];
      loading = false;
      return;
    }
    tasks = (data ?? []).map((t) => {
      const subtasks = Array.isArray(t.subtasks) ? t.subtasks.map((st) => ({ ...st, sort_index: st.sort_index ?? 0 })) : [];
      return {
        ...t,
        subtasks: subtasks.sort((a, b) => a.sort_index - b.sort_index)
      };
    });
    loading = false;
    selected = null;
    insertingAtIndex = null;
    editingTaskId = null;
    insertingSubtaskAt = null;
    editingSubtaskId = null;
    expandedTasks = new Set([...expandedTasks].filter((id) => tasks.some((t) => t.id === id && t.subtasks.length > 0)));
  }
  store_set(session, get(session));
  store_get($$store_subs ??= {}, "$session", session), fetchTasks();
  $$payload.out.push(`<h1>Welcome to ApplyNext</h1> `);
  if (store_get($$store_subs ??= {}, "$session", session)) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<p>Logged in as ${escape_html(store_get($$store_subs ??= {}, "$session", session).user.email)}</p> <h2>Your Tasks</h2> <div class="action-toolbar svelte-1d8c2g"><button class="toolbar-btn svelte-1d8c2g"${attr("disabled", !selected || selected.type === "task" && editingTaskId !== null || selected.type === "subtask" && editingSubtaskId !== null, true)}>Insert</button> <button class="toolbar-btn svelte-1d8c2g"${attr("disabled", !selected || selected.type !== "task" || editingTaskId !== null || editingSubtaskId !== null, true)}>Add Subtask</button> <button class="toolbar-btn svelte-1d8c2g"${attr(
      "disabled",
      !selected || selected.type === "task" && (editingTaskId !== null || tasks.findIndex((t) => t.id === selected?.id) <= 0) || selected.type === "subtask" && (editingSubtaskId !== null || !selected.parentTaskId || (() => {
        const task = tasks.find((t) => t.id === selected.parentTaskId);
        if (!task) return true;
        return task.subtasks.findIndex((st) => st.id === selected.id) <= 0;
      })()),
      true
    )}>↑</button> <button class="toolbar-btn svelte-1d8c2g"${attr(
      "disabled",
      !selected || selected.type === "task" && (editingTaskId !== null || tasks.findIndex((t) => t.id === selected?.id) === tasks.length - 1) || selected.type === "subtask" && (editingSubtaskId !== null || !selected.parentTaskId || (() => {
        const task = tasks.find((t) => t.id === selected.parentTaskId);
        if (!task) return true;
        return task.subtasks.findIndex((st) => st.id === selected.id) === task.subtasks.length - 1;
      })()),
      true
    )}>↓</button> <button class="toolbar-btn svelte-1d8c2g"${attr("disabled", !selected || selected.type === "task" && editingTaskId !== null || selected.type === "subtask" && editingSubtaskId !== null, true)}>Edit</button> <button class="toolbar-btn delete-btn svelte-1d8c2g"${attr("disabled", !selected || selected.type === "task" && editingTaskId !== null || selected.type === "subtask" && editingSubtaskId !== null, true)}>Delete</button></div> `);
    if (loading) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`<p>Loading...</p>`);
    } else {
      $$payload.out.push("<!--[!-->");
      if (error) {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<p style="color:red;">${escape_html(error)}</p>`);
      } else {
        $$payload.out.push("<!--[!-->");
        if (tasks.length === 0) {
          $$payload.out.push("<!--[-->");
          $$payload.out.push(`<p>No tasks yet.</p>`);
        } else {
          $$payload.out.push("<!--[!-->");
          const each_array = ensure_array_like(tasks);
          $$payload.out.push(`<table class="task-table svelte-1d8c2g"><thead><tr><th style="width:3em;" class="svelte-1d8c2g"></th><th style="width:2em;" class="svelte-1d8c2g"></th><th style="width:40%;" class="svelte-1d8c2g">Task</th><th style="width:35%;" class="svelte-1d8c2g">Description / Subtask</th><th class="date-cell svelte-1d8c2g">Due Date</th></tr></thead><tbody><!--[-->`);
          for (let i = 0, $$length = each_array.length; i < $$length; i++) {
            let task = each_array[i];
            $$payload.out.push(`<tr style="cursor:pointer;"${attr_class("svelte-1d8c2g", void 0, {
              "selected-row": selected && selected.type === "task" && selected.id === task.id
            })}><td class="svelte-1d8c2g">`);
            if (task.subtasks.length > 0) {
              $$payload.out.push("<!--[-->");
              $$payload.out.push(`<button class="expander svelte-1d8c2g"${attr("aria-label", expandedTasks.has(task.id) ? "Collapse subtasks" : "Expand subtasks")}>${escape_html(expandedTasks.has(task.id) ? "➖" : "➕")}</button>`);
            } else {
              $$payload.out.push("<!--[!-->");
            }
            $$payload.out.push(`<!--]--></td><td class="svelte-1d8c2g"><span class="status-dot svelte-1d8c2g"${attr_style(`background:${stringify(statusDotColor(task.status, isOverdue(task.due_date, task.status)))}; border-color:${stringify(isOverdue(task.due_date, task.status) ? overdueColor : "#aaa")};`)}${attr("title", task.status === "done" ? "Done" : isOverdue(task.due_date, task.status) ? "Overdue" : task.status === "open" ? "Open" : "In Progress")}></span></td>`);
            if (editingTaskId === task.id) {
              $$payload.out.push("<!--[-->");
              $$payload.out.push(`<td colspan="3" class="edit-form-row svelte-1d8c2g"><form style="display:flex;align-items:center;gap:0.7em;"><input type="text"${attr("value", editTitle)} required style="width:28%;"/> <input type="text"${attr("value", editDescription)} placeholder="Description (optional)" style="width:38%;"/> <select>`);
              $$payload.select_value = editStatus;
              $$payload.out.push(`<option value="open"${maybe_selected($$payload, "open")}>Open</option><option value="in_progress"${maybe_selected($$payload, "in_progress")}>In Progress</option><option value="done"${maybe_selected($$payload, "done")}>Done</option>`);
              $$payload.select_value = void 0;
              $$payload.out.push(`</select> <input type="date"${attr("value", editDueDate)} style="width:25%;"/> `);
              {
                $$payload.out.push("<!--[!-->");
              }
              $$payload.out.push(`<!--]--> <button type="submit"${attr("disabled", !editTitle.trim(), true)}>Save</button> <button type="button"${attr("disabled", savingEdit, true)}>Cancel</button></form></td>`);
            } else {
              $$payload.out.push("<!--[!-->");
              $$payload.out.push(`<td class="svelte-1d8c2g">${escape_html(task.title)}</td> <td class="svelte-1d8c2g">${escape_html(task.description)}</td> <td class="date-cell svelte-1d8c2g">`);
              if (task.due_date) {
                $$payload.out.push("<!--[-->");
                $$payload.out.push(`${escape_html(formatDate(task.due_date))}`);
              } else {
                $$payload.out.push("<!--[!-->");
              }
              $$payload.out.push(`<!--]--></td>`);
            }
            $$payload.out.push(`<!--]--></tr> `);
            if (insertingAtIndex === i) {
              $$payload.out.push("<!--[-->");
              $$payload.out.push(`<tr class="insert-form-row svelte-1d8c2g"><td colspan="5" class="svelte-1d8c2g"><form><input type="text" placeholder="Task title"${attr("value", newTitle)} required style="margin-right:0.5em; width:25%;"/> <input type="text" placeholder="Description (optional)"${attr("value", newDescription)} style="margin-right:0.5em; width:35%;"/> <select style="margin-right:0.5em;">`);
              $$payload.select_value = newStatus;
              $$payload.out.push(`<option value="open"${maybe_selected($$payload, "open")}>Open</option><option value="in_progress"${maybe_selected($$payload, "in_progress")}>In Progress</option><option value="done"${maybe_selected($$payload, "done")}>Done</option>`);
              $$payload.select_value = void 0;
              $$payload.out.push(`</select> <input type="date"${attr("value", newDueDate)} style="margin-right:0.5em;"/> `);
              {
                $$payload.out.push("<!--[!-->");
              }
              $$payload.out.push(`<!--]--> <button type="submit"${attr("disabled", !newTitle.trim(), true)}>${escape_html("Insert Task")}</button> <button type="button">Cancel</button></form></td></tr>`);
            } else {
              $$payload.out.push("<!--[!-->");
            }
            $$payload.out.push(`<!--]--> `);
            if (expandedTasks.has(task.id)) {
              $$payload.out.push("<!--[-->");
              const each_array_1 = ensure_array_like(task.subtasks);
              $$payload.out.push(`<!--[-->`);
              for (let stIdx = 0, $$length2 = each_array_1.length; stIdx < $$length2; stIdx++) {
                let subtask = each_array_1[stIdx];
                $$payload.out.push(`<tr${attr_class("subtask-row svelte-1d8c2g", void 0, {
                  "selected-row": selected && selected.type === "subtask" && selected.id === subtask.id
                })} style="cursor:pointer;"><td class="svelte-1d8c2g"><span class="subtask-indent svelte-1d8c2g"></span></td><td class="svelte-1d8c2g"><span class="status-dot svelte-1d8c2g"${attr_style(`background:${stringify(statusDotColor(subtask.status, isOverdue(subtask.due_date, subtask.status)))}; border-color:${stringify(isOverdue(subtask.due_date, subtask.status) ? overdueColor : "#aaa")};`)}${attr("title", subtask.status === "done" ? "Done" : isOverdue(subtask.due_date, subtask.status) ? "Overdue" : subtask.status === "open" ? "Open" : "In Progress")}></span></td>`);
                if (editingSubtaskId === subtask.id) {
                  $$payload.out.push("<!--[-->");
                  $$payload.out.push(`<td colspan="3" class="subtask-edit-row svelte-1d8c2g"><form style="display:flex;align-items:center;gap:0.7em;"><input type="text"${attr("value", editSubtaskContent)} required style="width:38%;"/> <select>`);
                  $$payload.select_value = editSubtaskStatus;
                  $$payload.out.push(`<option value="open"${maybe_selected($$payload, "open")}>Open</option><option value="in_progress"${maybe_selected($$payload, "in_progress")}>In Progress</option><option value="done"${maybe_selected($$payload, "done")}>Done</option>`);
                  $$payload.select_value = void 0;
                  $$payload.out.push(`</select> <input type="date"${attr("value", editSubtaskDueDate)} style="width:25%;"/> `);
                  {
                    $$payload.out.push("<!--[!-->");
                  }
                  $$payload.out.push(`<!--]--> <button type="submit"${attr("disabled", !editSubtaskContent.trim(), true)}>Save</button> <button type="button"${attr("disabled", savingSubtaskEdit, true)}>Cancel</button></form></td>`);
                } else {
                  $$payload.out.push("<!--[!-->");
                  $$payload.out.push(`<td class="svelte-1d8c2g"></td> <td class="svelte-1d8c2g">${escape_html(subtask.content)}</td> <td class="date-cell svelte-1d8c2g">`);
                  if (subtask.due_date) {
                    $$payload.out.push("<!--[-->");
                    $$payload.out.push(`${escape_html(formatDate(subtask.due_date))}`);
                  } else {
                    $$payload.out.push("<!--[!-->");
                  }
                  $$payload.out.push(`<!--]--></td>`);
                }
                $$payload.out.push(`<!--]--></tr> `);
                if (insertingSubtaskAt && insertingSubtaskAt.taskId === task.id && insertingSubtaskAt.index === stIdx) {
                  $$payload.out.push("<!--[-->");
                  $$payload.out.push(`<tr class="subtask-insert-row svelte-1d8c2g"><td colspan="5" class="svelte-1d8c2g"><form><input type="text" placeholder="Subtask content"${attr("value", newSubtaskContent)} required style="margin-right:0.5em; width:32%;"/> <select style="margin-right:0.5em;">`);
                  $$payload.select_value = newSubtaskStatus;
                  $$payload.out.push(`<option value="open"${maybe_selected($$payload, "open")}>Open</option><option value="in_progress"${maybe_selected($$payload, "in_progress")}>In Progress</option><option value="done"${maybe_selected($$payload, "done")}>Done</option>`);
                  $$payload.select_value = void 0;
                  $$payload.out.push(`</select> <input type="date"${attr("value", newSubtaskDueDate)} style="margin-right:0.5em;"/> `);
                  {
                    $$payload.out.push("<!--[!-->");
                  }
                  $$payload.out.push(`<!--]--> <button type="submit"${attr("disabled", !newSubtaskContent.trim(), true)}>${escape_html("Insert Subtask")}</button> <button type="button">Cancel</button></form></td></tr>`);
                } else {
                  $$payload.out.push("<!--[!-->");
                }
                $$payload.out.push(`<!--]-->`);
              }
              $$payload.out.push(`<!--]--> `);
              if (insertingSubtaskAt && insertingSubtaskAt.taskId === task.id && task.subtasks.length === 0) {
                $$payload.out.push("<!--[-->");
                $$payload.out.push(`<tr class="subtask-insert-row svelte-1d8c2g"><td colspan="5" class="svelte-1d8c2g"><form><input type="text" placeholder="Subtask content"${attr("value", newSubtaskContent)} required style="margin-right:0.5em; width:32%;"/> <select style="margin-right:0.5em;">`);
                $$payload.select_value = newSubtaskStatus;
                $$payload.out.push(`<option value="open"${maybe_selected($$payload, "open")}>Open</option><option value="in_progress"${maybe_selected($$payload, "in_progress")}>In Progress</option><option value="done"${maybe_selected($$payload, "done")}>Done</option>`);
                $$payload.select_value = void 0;
                $$payload.out.push(`</select> <input type="date"${attr("value", newSubtaskDueDate)} style="margin-right:0.5em;"/> `);
                {
                  $$payload.out.push("<!--[!-->");
                }
                $$payload.out.push(`<!--]--> <button type="submit"${attr("disabled", !newSubtaskContent.trim(), true)}>${escape_html("Insert Subtask")}</button> <button type="button">Cancel</button></form></td></tr>`);
              } else {
                $$payload.out.push("<!--[!-->");
              }
              $$payload.out.push(`<!--]-->`);
            } else {
              $$payload.out.push("<!--[!-->");
            }
            $$payload.out.push(`<!--]-->`);
          }
          $$payload.out.push(`<!--]--></tbody></table>`);
        }
        $$payload.out.push(`<!--]-->`);
      }
      $$payload.out.push(`<!--]-->`);
    }
    $$payload.out.push(`<!--]-->`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<p>Not signed in</p>`);
  }
  $$payload.out.push(`<!--]-->`);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
export {
  _page as default
};
