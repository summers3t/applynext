import { z as push, S as fallback, O as ensure_array_like, G as attr, Q as attr_style, R as stringify, I as escape_html, M as bind_props, D as pop, E as store_get, K as unsubscribe_stores, P as attr_class, F as maybe_selected } from "../../../../chunks/index.js";
import { s as supabase } from "../../../../chunks/supabaseClient.js";
import { s as session } from "../../../../chunks/session.js";
import { g as get } from "../../../../chunks/index2.js";
import { p as page } from "../../../../chunks/index3.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/state.svelte.js";
import { s as statusFilter, d as dueFilter, a as searchQuery } from "../../../../chunks/filterStore.js";
function ItemChecklist($$payload, $$props) {
  push();
  let items = fallback($$props["items"], () => [], true);
  let selectedIds = fallback($$props["selectedIds"], () => [], true);
  let disabled = fallback($$props["disabled"], false);
  let showStatus = fallback($$props["showStatus"], false);
  let onChange = fallback($$props["onChange"], () => {
  });
  $$payload.out.push(`<div class="item-checklist">`);
  if (items.length === 0) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div style="color:#888;">No items defined for this project.</div>`);
  } else {
    $$payload.out.push("<!--[!-->");
    const each_array = ensure_array_like(items);
    $$payload.out.push(`<ul style="list-style:none;padding:0;margin:0;"><!--[-->`);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let item = each_array[$$index];
      $$payload.out.push(`<li style="margin:0.3em 0; display:flex; align-items:center; gap:0.7em;"><input type="checkbox"${attr("checked", selectedIds.includes(item.id), true)}${attr("disabled", disabled, true)}${attr("id", "itemcheck-" + item.id)}/> <label${attr("for", "itemcheck-" + item.id)}>`);
      if (showStatus) {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<span${attr_style(`display:inline-block; width:1em; height:1em; border-radius:50%; margin-right:0.5em; background:${stringify(item.status === "present" ? "#47e37a" : "#e74c3c")}; border:1px solid #aaa; vertical-align:middle;`)}></span>`);
      } else {
        $$payload.out.push("<!--[!-->");
      }
      $$payload.out.push(`<!--]--> ${escape_html(item.name)}</label></li>`);
    }
    $$payload.out.push(`<!--]--></ul>`);
  }
  $$payload.out.push(`<!--]--></div>`);
  bind_props($$props, { items, selectedIds, disabled, showStatus, onChange });
  pop();
}
function _page($$payload, $$props) {
  push();
  var $$store_subs;
  let selectedTask, selectedTaskItemIds, taskIdToItems, selectedTaskItems, missingItemsSummary, selectedSubtask, isTaskChanged, isSubtaskChanged, filteredTasks;
  let projectId = "";
  let project = null;
  let members = [];
  let myRole = "";
  let loadingProject = false;
  let errorProject = "";
  let recentlyAddedTaskId = null;
  let recentlyAddedSubtaskId = null;
  let comments = [];
  let newCommentText = "";
  let userMap = {};
  let items = [];
  let showItemsPanel = false;
  let editTaskSelectedItemIds = [];
  let newTaskSelectedItemIds = [];
  let savingItems = false;
  let showAllItems = false;
  async function handleRightPaneItemsChange(newIds) {
    if (!selectedTask) return;
    savingItems = true;
    await supabase.from("task_items").delete().eq("task_id", selectedTask.id);
    if (newIds.length > 0) {
      const links = newIds.map((item_id) => ({
        task_id: selectedTask.id,
        item_id,
        project_id: projectId,
        created_by: sessionValue?.user.id
      }));
      const { error: linkError } = await supabase.from("task_items").insert(links);
      if (linkError) {
        alert("Error updating items: " + linkError.message);
      }
    }
    await fetchTaskItems();
    savingItems = false;
  }
  let insertRowEl = null;
  let editTaskTitleRP = "";
  let editTaskDescriptionRP = "";
  let editTaskStatusRP = "open";
  let editTaskDueDateRP = null;
  let editTaskAssignedToRP = "";
  let editSubtaskContentRP = "";
  let editSubtaskStatusRP = "open";
  let editSubtaskDueDateRP = null;
  let editSubtaskAssignedToRP = "";
  let sessionValue = get(session);
  let isCreator = false;
  let showMembersPanel = false;
  let showEditProjectPanel = false;
  let deletingProject = false;
  const statusColors = { open: "#fff", in_progress: "#1976d2", done: "#43a047" };
  const overdueColor = "#e74c3c";
  let tasks = [];
  let loadingTasks = false;
  let errorTasks = "";
  let taskItems = [];
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
  let newTaskAssignedTo = "";
  let editAssignedTo = "";
  let insertingSubtaskAt = null;
  let newSubtaskContent = "";
  let newSubtaskStatus = "open";
  let newSubtaskDueDate = null;
  let editingSubtaskId = null;
  let editSubtaskContent = "";
  let editSubtaskStatus = "open";
  let editSubtaskDueDate = null;
  let savingSubtaskEdit = false;
  let newSubtaskAssignedTo = "";
  let editSubtaskAssignedTo = "";
  let subtaskStatusMenuOpenFor = null;
  let expandedTasks = /* @__PURE__ */ new Set();
  function formatDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.slice(0, 10).split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  function formatDateTime(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const pad = (n) => n.toString().padStart(2, "0");
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
  function getInitials(email) {
    if (!email) return "—";
    const match = email.match(/^([a-zA-Z])[a-zA-Z.]*[._]?([a-zA-Z])?/i);
    if (match) {
      const first = email[0].toUpperCase();
      const afterDot = email.match(/\.?([a-zA-Z])[a-zA-Z]*@/);
      const second = afterDot && afterDot[1] ? afterDot[1].toUpperCase() : "";
      return (first + second).slice(0, 2);
    }
    return email[0].toUpperCase();
  }
  async function loadProject() {
    if (!projectId || projectId.length < 10) {
      project = null;
      members = [];
      loadingProject = false;
      return;
    }
    loadingProject = true;
    errorProject = "";
    const { data: projectData, error: err1 } = await supabase.from("projects").select("id, name, description, deadline, created_by").eq("id", projectId).single();
    if (err1 || !projectData) {
      errorProject = "Project not found";
      loadingProject = false;
      return;
    }
    project = projectData;
    isCreator = !!project && !!sessionValue?.user?.id && project.created_by === sessionValue.user.id;
    const { data: memberRows, error: err2 } = await supabase.from("project_users").select("user_id, role, status, invited_email").eq("project_id", projectId);
    console.log("Member rows from Supabase:", memberRows);
    if (err2) {
      errorProject = err2.message;
      members = [];
      loadingProject = false;
      return;
    }
    const userIds = (memberRows ?? []).filter((r) => r.user_id).map((r) => r.user_id);
    let userEmailMap = {};
    if (userIds.length > 0) {
      const { data: emailRows } = await supabase.from("user_emails").select("id, email").in("id", userIds);
      userEmailMap = (emailRows ?? []).reduce(
        (map, row) => {
          map[row.id] = row.email;
          return map;
        },
        {}
      );
    }
    members = (memberRows ?? []).map((row) => {
      let email = row.invited_email || row.user_id && userEmailMap[row.user_id] || "Unknown";
      if (row.user_id && sessionValue?.user?.id === row.user_id) {
        email = sessionValue?.user?.email ?? "Unknown";
      }
      return {
        user_id: row.user_id,
        email,
        role: row.role,
        status: row.status ?? (row.invited_email ? "Invited" : "Active"),
        invited_email: row.invited_email
      };
    });
    const me = members.find((m) => m.user_id === sessionValue?.user.id);
    myRole = me?.role ?? "";
    loadingProject = false;
  }
  async function fetchTasks() {
    if (!projectId || projectId.length < 10 || !sessionValue) {
      tasks = [];
      loadingTasks = false;
      return;
    }
    loadingTasks = true;
    errorTasks = "";
    if (!sessionValue) {
      tasks = [];
      loadingTasks = false;
      return;
    }
    const { data, error: err } = await supabase.from("tasks").select("*, subtasks(*)").eq("project_id", projectId).order("sort_index", { ascending: true });
    if (err) {
      errorTasks = err.message;
      tasks = [];
      loadingTasks = false;
      return;
    }
    tasks = (data ?? []).map((t) => {
      const subtasks = Array.isArray(t.subtasks) ? t.subtasks.map((st) => ({ ...st, sort_index: st.sort_index ?? 0 })) : [];
      return {
        ...t,
        subtasks: subtasks.sort((a, b) => a.sort_index - b.sort_index)
      };
    });
    const userIdsFromTasks = tasks.map((t) => t.last_edited_by).filter((id) => !!id);
    const userIdsFromSubtasks = tasks.flatMap((t) => Array.isArray(t.subtasks) ? t.subtasks.map((st) => st.last_edited_by).filter((id) => !!id) : []);
    const assigneeIdsFromTasks = tasks.map((t) => t.assigned_to).filter((id) => !!id);
    const assigneeIdsFromSubtasks = tasks.flatMap((t) => Array.isArray(t.subtasks) ? t.subtasks.map((st) => st.assigned_to).filter((id) => !!id) : []);
    const allUserIds = Array.from(/* @__PURE__ */ new Set([
      ...userIdsFromTasks,
      ...userIdsFromSubtasks,
      ...assigneeIdsFromTasks,
      ...assigneeIdsFromSubtasks
    ]));
    if (allUserIds.length > 0) {
      const { data: users, error } = await supabase.from("user_emails").select("id, email").in("id", allUserIds);
      if (error) {
        console.error("Error loading user emails:", error.message);
        userMap = {};
      } else {
        userMap = (users ?? []).reduce(
          (map, u) => {
            map[u.id] = u.email;
            return map;
          },
          {}
        );
      }
    } else {
      userMap = {};
    }
    loadingTasks = false;
    selected = null;
    insertingAtIndex = null;
    editingTaskId = null;
    insertingSubtaskAt = null;
    editingSubtaskId = null;
    expandedTasks = new Set([...expandedTasks].filter((id) => tasks.some((t) => t.id === id && t.subtasks.length > 0)));
  }
  async function fetchTaskItems() {
    if (!projectId) {
      taskItems = [];
      return;
    }
    const { data, error } = await supabase.from("task_items").select("task_id, item_id, item:items(*)").eq("project_id", projectId);
    if (error) {
      error.message;
      taskItems = [];
      return;
    }
    taskItems = (data ?? []).map((link) => ({
      ...link,
      item: Array.isArray(link.item) ? link.item[0] : link.item
    })).filter((link) => link.item);
  }
  function canEditTasks() {
    return myRole === "admin" || myRole === "editor";
  }
  session.subscribe((s) => {
    sessionValue = s;
    if (projectId && projectId.length >= 10) {
      loadProject();
      fetchTasks();
      fetchTaskItems();
    }
  });
  projectId = page.params.projectId;
  selectedTask = selected && selected.type === "task" ? tasks.find((t) => t.id === selected?.id) : null;
  selectedTaskItemIds = selectedTask ? taskItems.filter((link) => link.task_id === selectedTask.id).map((link) => link.item_id) : [];
  taskIdToItems = tasks.reduce(
    (map, task) => {
      map[task.id] = taskItems.filter((link) => link.task_id === task.id).map((link) => link.item);
      return map;
    },
    {}
  );
  selectedTaskItems = selectedTask ? taskIdToItems[selectedTask.id] ?? [] : [];
  selectedTaskItems.filter((item) => item.status === "not_present");
  selectedTaskItems.filter((item) => item.status === "present");
  selectedTask ? taskIdToItems[selectedTask.id] ?? [] : [];
  missingItemsSummary = items.filter((i) => selectedTaskItemIds.includes(i.id) && i.status === "not_present");
  if (selected) {
    showAllItems = false;
  }
  selectedSubtask = selected && selected.type === "subtask" ? (tasks.find((t) => t.id === selected?.parentTaskId)?.subtasks ?? []).find((st) => st.id === selected?.id) : null;
  if (insertingAtIndex !== null && insertRowEl) {
    setTimeout(
      () => {
      },
      0
    );
  }
  if (selectedTask) {
    editTaskTitleRP = selectedTask.title ?? "";
    editTaskDescriptionRP = selectedTask.description ?? "";
    editTaskStatusRP = selectedTask.status ?? "open";
    editTaskDueDateRP = selectedTask.due_date ?? null;
    editTaskAssignedToRP = selectedTask.assigned_to ?? "";
  }
  if (selectedSubtask) {
    editSubtaskContentRP = selectedSubtask.content ?? "";
    editSubtaskStatusRP = selectedSubtask.status ?? "open";
    editSubtaskDueDateRP = selectedSubtask.due_date ?? null;
    editSubtaskAssignedToRP = selectedSubtask.assigned_to ?? "";
  }
  isTaskChanged = editTaskTitleRP.trim() !== (selectedTask?.title ?? "").trim() || editTaskDescriptionRP.trim() !== (selectedTask?.description ?? "").trim() || editTaskStatusRP !== (selectedTask?.status ?? "") || editTaskAssignedToRP !== (selectedTask?.assigned_to ?? "") || (editTaskDueDateRP || "") !== (selectedTask?.due_date || "");
  isSubtaskChanged = editSubtaskContentRP.trim() !== (selectedSubtask?.content ?? "").trim() || editSubtaskStatusRP !== (selectedSubtask?.status ?? "") || editSubtaskAssignedToRP !== (selectedSubtask?.assigned_to ?? "") || (editSubtaskDueDateRP ?? "") !== (selectedSubtask?.due_date ?? "");
  isCreator = !!project && !!sessionValue?.user?.id && project.created_by === sessionValue.user.id;
  {
    {
      document.body.style.overflow = "";
    }
  }
  filteredTasks = tasks.filter((t) => store_get($$store_subs ??= {}, "$statusFilter", statusFilter) === "all" || t.status === store_get($$store_subs ??= {}, "$statusFilter", statusFilter)).filter((t) => {
    if (store_get($$store_subs ??= {}, "$dueFilter", dueFilter) === "all") return true;
    if (store_get($$store_subs ??= {}, "$dueFilter", dueFilter) === "none") return !t.due_date;
    if (!t.due_date) return false;
    const today = /* @__PURE__ */ new Date();
    const due = new Date(t.due_date);
    if (store_get($$store_subs ??= {}, "$dueFilter", dueFilter) === "overdue") {
      return due < new Date(today.getFullYear(), today.getMonth(), today.getDate()) && t.status !== "done";
    }
    if (store_get($$store_subs ??= {}, "$dueFilter", dueFilter) === "today") {
      return due.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
    }
    if (store_get($$store_subs ??= {}, "$dueFilter", dueFilter) === "upcoming") {
      return due > today && t.status !== "done";
    }
    return true;
  }).filter((t) => {
    if (!store_get($$store_subs ??= {}, "$searchQuery", searchQuery).trim()) return true;
    const q = store_get($$store_subs ??= {}, "$searchQuery", searchQuery).trim().toLowerCase();
    return t.title && t.title.toLowerCase().includes(q) || t.description && t.description.toLowerCase().includes(q);
  });
  $$payload.out.push(`<div class="project-page-layout svelte-zjczzm">`);
  if (
    // taskId → [linked item objs...]
    // --- Invite Member UI/Logic ---
    // --- Role Update/Remove ---
    // --- Delete project ---
    // ========== Tasks & Subtasks (Project Scoped) ==========
    // will contain status, name, etc.
    // Task form states
    // Subtask
    // For assignee in "create" form
    // For assignee in "edit" form
    // subtask.id, or null if closed
    // Expanded/collapsed
    // ---- Helpers ----
    // Center horizontally, and place *just above* the dot
    // 8px gap above the dot; menu’s bottom aligns with dot’s top
    // Update in-memory for instant UI
    // If this was a mouse event, use the mouse target's bounding rect
    // For keyboard, use the currently focused element
    // popover above
    // Update in-memory for instant UI
    // Try to find the first letter after "." or before "@" (e.g., "brambashki" in your email)
    // Re-load latest data
    // may need to use the admin API if using Supabase self-hosted, or use a Postgres view
    // Build a map: { userId: email }
    // ---- Project & Members ----
    // Prevent empty/invalid queries!
    // Project info
    // Members
    // For self, always show your own email (cleaner experience)
    // Set my role
    // --- Invite/Change/Remove ---
    // Only admins can do this (already handled in UI)
    // 1. Delete from projects table (will also remove from project_users via FK CASCADE if set)
    // 2. Redirect to /projects
    // ---- Tasks ----
    // Admin sees all, others see tasks for this project only
    // --- 1. Gather all unique last_edited_by user IDs (for both tasks and subtasks) ---
    // const userIdsFromTasks = tasks.map((t) => t.last_edited_by).filter((id) => !!id);
    // const userIdsFromSubtasks = tasks.flatMap((t) =>
    // 	Array.isArray(t.subtasks)
    // 		? t.subtasks.map((st) => st.last_edited_by).filter((id) => !!id)
    // 		: []
    // );
    // const allEditedByIds = Array.from(new Set([...userIdsFromTasks, ...userIdsFromSubtasks]));
    // --- 1. Gather all user IDs for assigned_to and last_edited_by (tasks and subtasks)
    // --- 2. Fetch user emails and build the userMap ---
    // --- 3. Reset UI state as before ---
    // Keep expanded state for still-present tasks
    // JOIN: Get all task_items + item fields
    // Only keep links with loaded item (defensive)
    // ---- Reindex helpers ----
    //await fetchTasks();
    //await fetchTasks();
    // ---- Task CRUD (permission checks) ----
    // --- Ensure userMap includes the assignee for first task ---
    // --- Add links to items for this task ---
    // Optionally: alert('Error linking items: ' + linkError.message);
    // Always fetch tasks after insert to ensure no UI duplication issues
    //await fetchTasks();
    // Reset form state
    // Locally update sort_index
    // <-- THIS triggers a local UI update without refetch
    // Call backend to update indices asynchronously (don't wait for it to finish)
    // Keep selection and pending scroll
    //await fetchTasks();
    // TypeScript: sel is NOT null after this
    // ---------- TASK ----------
    // Find which Task to scroll to after deletion (next or previous, if available)
    // This is the key line: update the local array
    // ---------- SUBTASK ----------
    // Find which Subtask to scroll to after deletion (next or previous, if available)
    // Mutate local array:
    // ---- Inline Edit ----
    // TypeScript: guaranteed not null below
    // --- Update linked items in task_items ---
    // Remove all previous links
    // Insert new links, if any
    // Optionally: alert('Error updating item links: ' + linkError.message);
    // ---- Subtask CRUD/ordering ----
    // Expand the task
    // -------------- Duplicate subtasks ------------------
    // ----------------------------------------------------
    // Create new subtasks order for this task
    // Update only this task's subtasks locally, to avoid reload/flicker
    // Keep the moved subtask selected
    // --- Capture scroll before reload
    // save null if blank/unassigned
    // --- Restore scroll after reload
    // -------------- Comments logic comments --------------
    // Re-fetch comments
    // ---- Expand/collapse logic ----
    // ---- Effect: Load everything on mount or session/project change ----
    // This assures TypeScript: sel is not null
    loadingProject
  ) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<p class="svelte-zjczzm">Loading project...</p>`);
  } else {
    $$payload.out.push("<!--[!-->");
    if (errorProject) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`<p style="color:red;" class="svelte-zjczzm">${escape_html(errorProject)}</p>`);
    } else {
      $$payload.out.push("<!--[!-->");
      if (project) {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<aside class="left-pane svelte-zjczzm"><button class="nav-btn svelte-zjczzm">← All Projects</button> <h2 style="margin:1.2em 0 0.5em 0;" class="svelte-zjczzm">${escape_html(project.name)}</h2> <div class="desc svelte-zjczzm">${escape_html(project.description)}</div> <div class="deadline svelte-zjczzm"><b class="svelte-zjczzm">Deadline:</b> ${escape_html(project.deadline ? formatDate(project.deadline) : "—")}</div> <div class="role-row svelte-zjczzm"><span class="role-badge svelte-zjczzm">${escape_html(myRole && `Role: ${myRole}`)}</span></div> `);
        if (isCreator) {
          $$payload.out.push("<!--[-->");
          $$payload.out.push(`<button${attr_class("toolbar-btn svelte-zjczzm", void 0, { "active-tab": showEditProjectPanel })} style="width:100%; margin:1.3em 0 0.7em 0;">✏️ Edit Project</button>`);
        } else {
          $$payload.out.push("<!--[!-->");
        }
        $$payload.out.push(`<!--]--> <button${attr_class("toolbar-btn svelte-zjczzm", void 0, { "active-tab": showMembersPanel })} style="width:100%; margin-bottom:2em;">👥 Members</button> <button${attr_class("toolbar-btn svelte-zjczzm", void 0, { "active-tab": showItemsPanel })} style="width:100%; margin-bottom:2em;">📦 Items</button> <div style="flex:1" class="svelte-zjczzm"></div> `);
        if (myRole === "admin" || isCreator) {
          $$payload.out.push("<!--[-->");
          $$payload.out.push(`<button class="delete-project-btn svelte-zjczzm"${attr("disabled", deletingProject, true)} style="width:100%; margin-top:auto;">🗑️ Delete Project</button>`);
        } else {
          $$payload.out.push("<!--[!-->");
        }
        $$payload.out.push(`<!--]--></aside> <div class="center-pane svelte-zjczzm"><div class="center-top svelte-zjczzm"><div class="action-toolbar svelte-zjczzm"><button class="toolbar-btn svelte-zjczzm">Add Task</button> <button class="toolbar-btn svelte-zjczzm"${attr("disabled", !canEditTasks() || !selected || selected.type === "task" && editingTaskId !== null || selected.type === "subtask" && editingSubtaskId !== null, true)}>Insert</button> <button class="toolbar-btn svelte-zjczzm"${attr("disabled", !canEditTasks() || !selected || !(selected.type === "task" || selected.type === "subtask") || editingTaskId !== null || editingSubtaskId !== null, true)}>Add Subtask</button> <button class="toolbar-btn svelte-zjczzm"${attr(
          "disabled",
          !canEditTasks() || !selected || selected?.type === "task" && (editingTaskId !== null || filteredTasks.findIndex((t) => t.id === selected?.id) <= 0) || selected?.type === "subtask" && (editingSubtaskId !== null || !selected?.parentTaskId || (() => {
            const task = tasks.find((t) => t.id === selected?.parentTaskId);
            if (!task) return true;
            return task.subtasks.findIndex((st) => st.id === selected?.id) <= 0;
          })()),
          true
        )}>↑</button> <button class="toolbar-btn svelte-zjczzm"${attr(
          "disabled",
          !canEditTasks() || !selected || selected?.type === "task" && (editingTaskId !== null || filteredTasks.findIndex((t) => t.id === selected?.id) === filteredTasks.length - 1) || selected?.type === "subtask" && (editingSubtaskId !== null || !selected?.parentTaskId || (() => {
            const task = tasks.find((t) => t.id === selected?.parentTaskId);
            if (!task) return true;
            return task.subtasks.findIndex((st) => st.id === selected?.id) === task.subtasks.length - 1;
          })()),
          true
        )}>↓</button> <button class="toolbar-btn svelte-zjczzm"${attr("disabled", !canEditTasks() || !selected || selected.type === "task" && editingTaskId !== null || selected.type === "subtask" && editingSubtaskId !== null, true)}>Edit</button> <button class="toolbar-btn delete-btn svelte-zjczzm"${attr("disabled", !canEditTasks() || !selected || selected.type === "task" && editingTaskId !== null || selected.type === "subtask" && editingSubtaskId !== null, true)}>Delete</button></div></div> <div class="center-main svelte-zjczzm">`);
        if (loadingTasks) {
          $$payload.out.push("<!--[-->");
          $$payload.out.push(`<p class="svelte-zjczzm">Loading tasks…</p>`);
        } else {
          $$payload.out.push("<!--[!-->");
          if (errorTasks) {
            $$payload.out.push("<!--[-->");
            $$payload.out.push(`<p style="color:red;" class="svelte-zjczzm">${escape_html(errorTasks)}</p>`);
          } else {
            $$payload.out.push("<!--[!-->");
            if (tasks.length === 0) {
              $$payload.out.push("<!--[-->");
              $$payload.out.push(`<div style="margin:2em 0;" class="svelte-zjczzm"><button class="toolbar-btn svelte-zjczzm"${attr("disabled", !canEditTasks() || editingTaskId !== null, true)}>Add First Task</button> `);
              if (insertingAtIndex === 0) {
                $$payload.out.push("<!--[-->");
                const each_array = ensure_array_like(members);
                $$payload.out.push(`<form style="margin-top:1em;" class="svelte-zjczzm"><input type="text" placeholder="Task title"${attr("value", newTitle)} required style="margin-right:0.5em; width:25%;" class="svelte-zjczzm"/> <input type="text" placeholder="Description (optional)"${attr("value", newDescription)} style="margin-right:0.5em; width:35%;" class="svelte-zjczzm"/> <select style="margin-right:0.5em;" class="svelte-zjczzm">`);
                $$payload.select_value = newStatus;
                $$payload.out.push(`<option value="open"${maybe_selected($$payload, "open")} class="svelte-zjczzm">Open</option><option value="in_progress"${maybe_selected($$payload, "in_progress")} class="svelte-zjczzm">In Progress</option><option value="done"${maybe_selected($$payload, "done")} class="svelte-zjczzm">Done</option>`);
                $$payload.select_value = void 0;
                $$payload.out.push(`</select> <input type="date"${attr("value", newDueDate)} style="margin-right:0.5em;" class="svelte-zjczzm"/> `);
                {
                  $$payload.out.push("<!--[!-->");
                }
                $$payload.out.push(`<!--]--> <select style="margin-right:0.5em;" class="svelte-zjczzm">`);
                $$payload.select_value = newTaskAssignedTo;
                $$payload.out.push(`<option value=""${maybe_selected($$payload, "")} class="svelte-zjczzm">Unassigned</option><!--[-->`);
                for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                  let m = each_array[$$index];
                  if (m.user_id) {
                    $$payload.out.push("<!--[-->");
                    $$payload.out.push(`<option${attr("value", m.user_id)}${maybe_selected($$payload, m.user_id)} class="svelte-zjczzm">${escape_html(m.email)}</option>`);
                  } else {
                    $$payload.out.push("<!--[!-->");
                  }
                  $$payload.out.push(`<!--]-->`);
                }
                $$payload.out.push(`<!--]-->`);
                $$payload.select_value = void 0;
                $$payload.out.push(`</select> `);
                ItemChecklist($$payload, {
                  items,
                  selectedIds: editTaskSelectedItemIds,
                  onChange: (ids) => editTaskSelectedItemIds = ids
                });
                $$payload.out.push(`<!----> <button type="submit"${attr("disabled", !newTitle.trim(), true)} class="svelte-zjczzm">${escape_html("Insert Task")}</button> <button type="button" class="svelte-zjczzm">Cancel</button></form>`);
              } else {
                $$payload.out.push("<!--[!-->");
              }
              $$payload.out.push(`<!--]--></div>`);
            } else {
              $$payload.out.push("<!--[!-->");
              const each_array_1 = ensure_array_like(filteredTasks);
              $$payload.out.push(`<table class="task-table svelte-zjczzm"><thead class="svelte-zjczzm"><tr class="svelte-zjczzm"><th style="width:3em;" class="svelte-zjczzm">ID</th><th style="width:3em;" class="svelte-zjczzm"></th><th style="width:2em;" class="svelte-zjczzm"></th><th style="width:32%;" class="svelte-zjczzm">Task</th><th style="width:18%;" class="svelte-zjczzm">Assigned to</th><th class="date-cell svelte-zjczzm">Due Date</th><th style="width:12%;" class="svelte-zjczzm">Edited by</th></tr></thead><tbody class="svelte-zjczzm"><!--[-->`);
              for (let i = 0, $$length = each_array_1.length; i < $$length; i++) {
                let task = each_array_1[i];
                $$payload.out.push(`<tr${attr("id", "task-" + task.id)} style="cursor:pointer;"${attr_class("svelte-zjczzm", void 0, {
                  "selected-row": selected && selected.type === "task" && selected.id === task.id,
                  "highlight-missing-items": taskIdToItems[task.id]?.some((item) => item.status === "not_present")
                })}><td class="short-id svelte-zjczzm">${escape_html(task.short_id)}</td><td class="svelte-zjczzm"><span class="status-dot status-dot-clickable svelte-zjczzm"${attr_style(`background:${stringify(statusDotColor(task.status, isOverdue(task.due_date, task.status)))}; border-color:${stringify(isOverdue(task.due_date, task.status) ? overdueColor : "#aaa")};`)} title="Click to change status"></span> `);
                {
                  $$payload.out.push("<!--[!-->");
                }
                $$payload.out.push(`<!--]--></td><td class="svelte-zjczzm">`);
                if (task.subtasks.length > 0) {
                  $$payload.out.push("<!--[-->");
                  $$payload.out.push(`<button class="expander svelte-zjczzm"${attr("aria-label", expandedTasks.has(task.id) ? "Collapse subtasks" : "Expand subtasks")}>${escape_html(expandedTasks.has(task.id) ? "➖" : "➕")}</button>`);
                } else {
                  $$payload.out.push("<!--[!-->");
                }
                $$payload.out.push(`<!--]--></td>`);
                if (editingTaskId === task.id) {
                  $$payload.out.push("<!--[-->");
                  const each_array_3 = ensure_array_like(members);
                  $$payload.out.push(`<td colspan="4" class="edit-form-row svelte-zjczzm"><form style="display:flex;align-items:center;gap:0.7em;" class="svelte-zjczzm"><input type="text"${attr("value", editTitle)} required style="width:28%;" class="svelte-zjczzm"/> <input type="text"${attr("value", editDescription)} placeholder="Description (optional)" style="width:38%;" class="svelte-zjczzm"/> <select class="svelte-zjczzm">`);
                  $$payload.select_value = editStatus;
                  $$payload.out.push(`<option value="open"${maybe_selected($$payload, "open")} class="svelte-zjczzm">Open</option><option value="in_progress"${maybe_selected($$payload, "in_progress")} class="svelte-zjczzm">In Progress</option><option value="done"${maybe_selected($$payload, "done")} class="svelte-zjczzm">Done</option>`);
                  $$payload.select_value = void 0;
                  $$payload.out.push(`</select> <input type="date"${attr("value", editDueDate)} style="width:25%;" class="svelte-zjczzm"/> `);
                  {
                    $$payload.out.push("<!--[!-->");
                  }
                  $$payload.out.push(`<!--]--> <select style="margin-right:0.5em;" class="svelte-zjczzm">`);
                  $$payload.select_value = editAssignedTo;
                  $$payload.out.push(`<option value=""${maybe_selected($$payload, "")} class="svelte-zjczzm">Unassigned</option><!--[-->`);
                  for (let $$index_2 = 0, $$length2 = each_array_3.length; $$index_2 < $$length2; $$index_2++) {
                    let m = each_array_3[$$index_2];
                    if (m.user_id) {
                      $$payload.out.push("<!--[-->");
                      $$payload.out.push(`<option${attr("value", m.user_id)}${maybe_selected($$payload, m.user_id)} class="svelte-zjczzm">${escape_html(m.email)}</option>`);
                    } else {
                      $$payload.out.push("<!--[!-->");
                    }
                    $$payload.out.push(`<!--]-->`);
                  }
                  $$payload.out.push(`<!--]-->`);
                  $$payload.select_value = void 0;
                  $$payload.out.push(`</select>  <button type="submit"${attr("disabled", !editTitle.trim(), true)} class="svelte-zjczzm">Save</button> <button type="button"${attr("disabled", savingEdit, true)} class="svelte-zjczzm">Cancel</button></form></td>`);
                } else {
                  $$payload.out.push("<!--[!-->");
                  $$payload.out.push(`<td class="svelte-zjczzm">${escape_html(task.title)} `);
                  if (recentlyAddedTaskId === task.id) {
                    $$payload.out.push("<!--[-->");
                    $$payload.out.push(`<span class="new-badge svelte-zjczzm">New</span>`);
                  } else {
                    $$payload.out.push("<!--[!-->");
                  }
                  $$payload.out.push(`<!--]--></td> <td class="svelte-zjczzm">`);
                  if (task.assigned_to) {
                    $$payload.out.push("<!--[-->");
                    if (userMap[task.assigned_to]) {
                      $$payload.out.push("<!--[-->");
                      $$payload.out.push(`<span${attr("title", userMap[task.assigned_to])} class="svelte-zjczzm">${escape_html(getInitials(userMap[task.assigned_to]))}</span>`);
                    } else {
                      $$payload.out.push("<!--[!-->");
                      $$payload.out.push(`<span title="User not found" class="svelte-zjczzm">${escape_html(task.assigned_to)}</span>`);
                    }
                    $$payload.out.push(`<!--]-->`);
                  } else {
                    $$payload.out.push("<!--[!-->");
                    $$payload.out.push(`—`);
                  }
                  $$payload.out.push(`<!--]--></td>  <td class="date-cell svelte-zjczzm">`);
                  if (task.due_date) {
                    $$payload.out.push("<!--[-->");
                    $$payload.out.push(`${escape_html(formatDate(task.due_date))}`);
                  } else {
                    $$payload.out.push("<!--[!-->");
                  }
                  $$payload.out.push(`<!--]--></td> <td class="edited-by svelte-zjczzm">`);
                  if (task.last_edited_by && userMap[task.last_edited_by]) {
                    $$payload.out.push("<!--[-->");
                    $$payload.out.push(`<span${attr("title", userMap[task.last_edited_by])} class="svelte-zjczzm">${escape_html(getInitials(userMap[task.last_edited_by]))}</span>`);
                  } else {
                    $$payload.out.push("<!--[!-->");
                    $$payload.out.push(`—`);
                  }
                  $$payload.out.push(`<!--]--></td>`);
                }
                $$payload.out.push(`<!--]--></tr> `);
                if (insertingAtIndex === i) {
                  $$payload.out.push("<!--[-->");
                  const each_array_4 = ensure_array_like(members);
                  $$payload.out.push(`<tr class="insert-form-row svelte-zjczzm"><td colspan="5" class="svelte-zjczzm"><form class="svelte-zjczzm"><input type="text" placeholder="Task title"${attr("value", newTitle)} required style="margin-right:0.5em; width:25%;" class="svelte-zjczzm"/> <input type="text" placeholder="Description (optional)"${attr("value", newDescription)} style="margin-right:0.5em; width:35%;" class="svelte-zjczzm"/> <select style="margin-right:0.5em;" class="svelte-zjczzm">`);
                  $$payload.select_value = newStatus;
                  $$payload.out.push(`<option value="open"${maybe_selected($$payload, "open")} class="svelte-zjczzm">Open</option><option value="in_progress"${maybe_selected($$payload, "in_progress")} class="svelte-zjczzm">In Progress</option><option value="done"${maybe_selected($$payload, "done")} class="svelte-zjczzm">Done</option>`);
                  $$payload.select_value = void 0;
                  $$payload.out.push(`</select> <input type="date"${attr("value", newDueDate)} style="margin-right:0.5em;" class="svelte-zjczzm"/> `);
                  {
                    $$payload.out.push("<!--[!-->");
                  }
                  $$payload.out.push(`<!--]--> <select style="margin-right:0.5em;" class="svelte-zjczzm">`);
                  $$payload.select_value = newTaskAssignedTo;
                  $$payload.out.push(`<option value=""${maybe_selected($$payload, "")} class="svelte-zjczzm">Unassigned</option><!--[-->`);
                  for (let $$index_3 = 0, $$length2 = each_array_4.length; $$index_3 < $$length2; $$index_3++) {
                    let m = each_array_4[$$index_3];
                    if (m.user_id) {
                      $$payload.out.push("<!--[-->");
                      $$payload.out.push(`<option${attr("value", m.user_id)}${maybe_selected($$payload, m.user_id)} class="svelte-zjczzm">${escape_html(m.email)}</option>`);
                    } else {
                      $$payload.out.push("<!--[!-->");
                    }
                    $$payload.out.push(`<!--]-->`);
                  }
                  $$payload.out.push(`<!--]-->`);
                  $$payload.select_value = void 0;
                  $$payload.out.push(`</select> `);
                  ItemChecklist($$payload, {
                    items,
                    selectedIds: newTaskSelectedItemIds,
                    onChange: (ids) => newTaskSelectedItemIds = ids
                  });
                  $$payload.out.push(`<!----> <button type="submit"${attr("disabled", !newTitle.trim(), true)} class="svelte-zjczzm">${escape_html("Insert Task")}</button> <button type="button" class="svelte-zjczzm">Cancel</button></form></td></tr>`);
                } else {
                  $$payload.out.push("<!--[!-->");
                }
                $$payload.out.push(`<!--]--> `);
                if (expandedTasks.has(task.id)) {
                  $$payload.out.push("<!--[-->");
                  const each_array_5 = ensure_array_like(task.subtasks);
                  $$payload.out.push(`<!--[-->`);
                  for (let stIdx = 0, $$length2 = each_array_5.length; stIdx < $$length2; stIdx++) {
                    let subtask = each_array_5[stIdx];
                    $$payload.out.push(`<tr${attr_class("subtask-row svelte-zjczzm", void 0, {
                      "selected-row": selected && selected.type === "subtask" && selected.id === subtask.id
                    })}${attr("id", "subtask-" + subtask.id)} style="cursor:pointer;"><td class="svelte-zjczzm"></td><td class="short-id svelte-zjczzm">${escape_html(subtask.short_id)}</td><td style="position: relative;" class="svelte-zjczzm"><button type="button" class="status-dot status-dot-clickable svelte-zjczzm"${attr_style(`background:${stringify(statusDotColor(subtask.status, isOverdue(subtask.due_date, subtask.status)))}; border-color:${stringify(isOverdue(subtask.due_date, subtask.status) ? overdueColor : "#aaa")};`)} title="Click to change status" aria-label="Change subtask status"></button> `);
                    if (subtaskStatusMenuOpenFor === subtask.id) {
                      $$payload.out.push("<!--[-->");
                      const each_array_6 = ensure_array_like(Object.entries(statusColors));
                      $$payload.out.push(`<div class="status-menu-popover svelte-zjczzm" role="dialog" aria-label="Change subtask status" tabindex="0" style="position: absolute; left: 50%; bottom: 120%; transform: translateX(-50%); z-index: 99999;"><!--[-->`);
                      for (let $$index_4 = 0, $$length3 = each_array_6.length; $$index_4 < $$length3; $$index_4++) {
                        let [status, color] = each_array_6[$$index_4];
                        if (status !== "overdue") {
                          $$payload.out.push("<!--[-->");
                          $$payload.out.push(`<button type="button" class="status-menu-dot svelte-zjczzm"${attr_style(`background:${stringify(color)}; border-color:${stringify(status === subtask.status ? "#1976d2" : "#bbb")};`)}${attr("title", status)}${attr("aria-label", "Set status to " + status)}></button>`);
                        } else {
                          $$payload.out.push("<!--[!-->");
                        }
                        $$payload.out.push(`<!--]-->`);
                      }
                      $$payload.out.push(`<!--]--></div>`);
                    } else {
                      $$payload.out.push("<!--[!-->");
                    }
                    $$payload.out.push(`<!--]--></td>`);
                    if (editingSubtaskId === subtask.id) {
                      $$payload.out.push("<!--[-->");
                      const each_array_7 = ensure_array_like(members);
                      $$payload.out.push(`<td colspan="3" class="subtask-edit-row svelte-zjczzm"><form style="display:flex;align-items:center;gap:0.7em;" class="svelte-zjczzm"><input type="text"${attr("value", editSubtaskContent)} required style="width:38%;" class="svelte-zjczzm"/> <select class="svelte-zjczzm">`);
                      $$payload.select_value = editSubtaskStatus;
                      $$payload.out.push(`<option value="open"${maybe_selected($$payload, "open")} class="svelte-zjczzm">Open</option><option value="in_progress"${maybe_selected($$payload, "in_progress")} class="svelte-zjczzm">In Progress</option><option value="done"${maybe_selected($$payload, "done")} class="svelte-zjczzm">Done</option>`);
                      $$payload.select_value = void 0;
                      $$payload.out.push(`</select> <input type="date"${attr("value", editSubtaskDueDate)} style="width:25%;" class="svelte-zjczzm"/> `);
                      {
                        $$payload.out.push("<!--[!-->");
                      }
                      $$payload.out.push(`<!--]--> <select style="margin-right:0.5em;" class="svelte-zjczzm">`);
                      $$payload.select_value = editSubtaskAssignedTo;
                      $$payload.out.push(`<option value=""${maybe_selected($$payload, "")} class="svelte-zjczzm">Unassigned</option><!--[-->`);
                      for (let $$index_5 = 0, $$length3 = each_array_7.length; $$index_5 < $$length3; $$index_5++) {
                        let m = each_array_7[$$index_5];
                        if (m.user_id) {
                          $$payload.out.push("<!--[-->");
                          $$payload.out.push(`<option${attr("value", m.user_id)}${maybe_selected($$payload, m.user_id)} class="svelte-zjczzm">${escape_html(m.email)}</option>`);
                        } else {
                          $$payload.out.push("<!--[!-->");
                        }
                        $$payload.out.push(`<!--]-->`);
                      }
                      $$payload.out.push(`<!--]-->`);
                      $$payload.select_value = void 0;
                      $$payload.out.push(`</select> <button type="submit"${attr("disabled", !editSubtaskContent.trim(), true)} class="svelte-zjczzm">Save</button> <button type="button"${attr("disabled", savingSubtaskEdit, true)} class="svelte-zjczzm">Cancel</button></form></td>`);
                    } else {
                      $$payload.out.push("<!--[!-->");
                      $$payload.out.push(`<td class="svelte-zjczzm">${escape_html(subtask.content)} `);
                      if (subtask.id === recentlyAddedSubtaskId) {
                        $$payload.out.push("<!--[-->");
                        $$payload.out.push(`<span class="new-badge svelte-zjczzm">New</span>`);
                      } else {
                        $$payload.out.push("<!--[!-->");
                      }
                      $$payload.out.push(`<!--]--></td> <td class="svelte-zjczzm">`);
                      if (subtask.assigned_to) {
                        $$payload.out.push("<!--[-->");
                        if (userMap[subtask.assigned_to]) {
                          $$payload.out.push("<!--[-->");
                          $$payload.out.push(`<span${attr("title", userMap[subtask.assigned_to])} class="svelte-zjczzm">${escape_html(getInitials(userMap[subtask.assigned_to]))}</span>`);
                        } else {
                          $$payload.out.push("<!--[!-->");
                          $$payload.out.push(`<span title="User not found" class="svelte-zjczzm">${escape_html(subtask.assigned_to)}</span>`);
                        }
                        $$payload.out.push(`<!--]-->`);
                      } else {
                        $$payload.out.push("<!--[!-->");
                        $$payload.out.push(`—`);
                      }
                      $$payload.out.push(`<!--]--></td> <td class="date-cell svelte-zjczzm">`);
                      if (subtask.due_date) {
                        $$payload.out.push("<!--[-->");
                        $$payload.out.push(`${escape_html(formatDate(subtask.due_date))}`);
                      } else {
                        $$payload.out.push("<!--[!-->");
                      }
                      $$payload.out.push(`<!--]--></td> <td class="edited-by svelte-zjczzm">`);
                      if (subtask.last_edited_by && userMap[subtask.last_edited_by]) {
                        $$payload.out.push("<!--[-->");
                        $$payload.out.push(`<span${attr("title", userMap[subtask.last_edited_by])} class="svelte-zjczzm">${escape_html(getInitials(userMap[subtask.last_edited_by]))}</span>`);
                      } else {
                        $$payload.out.push("<!--[!-->");
                        $$payload.out.push(`—`);
                      }
                      $$payload.out.push(`<!--]--></td>`);
                    }
                    $$payload.out.push(`<!--]--></tr> `);
                    if (insertingSubtaskAt && insertingSubtaskAt.taskId === task.id && insertingSubtaskAt.index === stIdx) {
                      $$payload.out.push("<!--[-->");
                      const each_array_8 = ensure_array_like(members);
                      $$payload.out.push(`<tr class="subtask-insert-row svelte-zjczzm"><td colspan="5" class="svelte-zjczzm"><form class="svelte-zjczzm"><input type="text" placeholder="Subtask content"${attr("value", newSubtaskContent)} required style="margin-right:0.5em; width:32%;" class="svelte-zjczzm"/> <select style="margin-right:0.5em;" class="svelte-zjczzm">`);
                      $$payload.select_value = newSubtaskStatus;
                      $$payload.out.push(`<option value="open"${maybe_selected($$payload, "open")} class="svelte-zjczzm">Open</option><option value="in_progress"${maybe_selected($$payload, "in_progress")} class="svelte-zjczzm">In Progress</option><option value="done"${maybe_selected($$payload, "done")} class="svelte-zjczzm">Done</option>`);
                      $$payload.select_value = void 0;
                      $$payload.out.push(`</select> <input type="date"${attr("value", newSubtaskDueDate)} style="margin-right:0.5em;" class="svelte-zjczzm"/> `);
                      {
                        $$payload.out.push("<!--[!-->");
                      }
                      $$payload.out.push(`<!--]--> <select style="margin-right:0.5em;" class="svelte-zjczzm">`);
                      $$payload.select_value = newSubtaskAssignedTo;
                      $$payload.out.push(`<option value=""${maybe_selected($$payload, "")} class="svelte-zjczzm">Unassigned</option><!--[-->`);
                      for (let $$index_6 = 0, $$length3 = each_array_8.length; $$index_6 < $$length3; $$index_6++) {
                        let m = each_array_8[$$index_6];
                        if (m.user_id) {
                          $$payload.out.push("<!--[-->");
                          $$payload.out.push(`<option${attr("value", m.user_id)}${maybe_selected($$payload, m.user_id)} class="svelte-zjczzm">${escape_html(m.email)}</option>`);
                        } else {
                          $$payload.out.push("<!--[!-->");
                        }
                        $$payload.out.push(`<!--]-->`);
                      }
                      $$payload.out.push(`<!--]-->`);
                      $$payload.select_value = void 0;
                      $$payload.out.push(`</select> <button type="submit"${attr("disabled", !newSubtaskContent.trim(), true)} class="svelte-zjczzm">${escape_html("Insert Subtask")}</button> <button type="button" class="svelte-zjczzm">Cancel</button></form></td></tr>`);
                    } else {
                      $$payload.out.push("<!--[!-->");
                    }
                    $$payload.out.push(`<!--]-->`);
                  }
                  $$payload.out.push(`<!--]--> `);
                  if (insertingSubtaskAt && insertingSubtaskAt.taskId === task.id && task.subtasks.length === 0) {
                    $$payload.out.push("<!--[-->");
                    const each_array_9 = ensure_array_like(members);
                    $$payload.out.push(`<tr class="subtask-insert-row svelte-zjczzm"><td colspan="5" class="svelte-zjczzm"><form class="svelte-zjczzm"><input type="text" placeholder="Subtask content"${attr("value", newSubtaskContent)} required style="margin-right:0.5em; width:32%;" class="svelte-zjczzm"/> <select style="margin-right:0.5em;" class="svelte-zjczzm">`);
                    $$payload.select_value = newSubtaskStatus;
                    $$payload.out.push(`<option value="open"${maybe_selected($$payload, "open")} class="svelte-zjczzm">Open</option><option value="in_progress"${maybe_selected($$payload, "in_progress")} class="svelte-zjczzm">In Progress</option><option value="done"${maybe_selected($$payload, "done")} class="svelte-zjczzm">Done</option>`);
                    $$payload.select_value = void 0;
                    $$payload.out.push(`</select> <input type="date"${attr("value", newSubtaskDueDate)} style="margin-right:0.5em;" class="svelte-zjczzm"/> `);
                    {
                      $$payload.out.push("<!--[!-->");
                    }
                    $$payload.out.push(`<!--]--> <select style="margin-right:0.5em;" class="svelte-zjczzm">`);
                    $$payload.select_value = newSubtaskAssignedTo;
                    $$payload.out.push(`<option value=""${maybe_selected($$payload, "")} class="svelte-zjczzm">Unassigned</option><!--[-->`);
                    for (let $$index_8 = 0, $$length2 = each_array_9.length; $$index_8 < $$length2; $$index_8++) {
                      let m = each_array_9[$$index_8];
                      if (m.user_id) {
                        $$payload.out.push("<!--[-->");
                        $$payload.out.push(`<option${attr("value", m.user_id)}${maybe_selected($$payload, m.user_id)} class="svelte-zjczzm">${escape_html(m.email)}</option>`);
                      } else {
                        $$payload.out.push("<!--[!-->");
                      }
                      $$payload.out.push(`<!--]-->`);
                    }
                    $$payload.out.push(`<!--]-->`);
                    $$payload.select_value = void 0;
                    $$payload.out.push(`</select> <button type="submit"${attr("disabled", !newSubtaskContent.trim(), true)} class="svelte-zjczzm">${escape_html("Insert Subtask")}</button> <button type="button" class="svelte-zjczzm">Cancel</button></form></td></tr>`);
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
        $$payload.out.push(`<!--]--></div></div>  <aside class="right-pane svelte-zjczzm">`);
        if (selected) {
          $$payload.out.push("<!--[-->");
          $$payload.out.push(`<div class="right-pane-inner svelte-zjczzm"><div class="details-section svelte-zjczzm"><div class="section-header svelte-zjczzm"><span class="section-title svelte-zjczzm">${escape_html(selected.type === "task" ? "Task" : "Subtask")}</span>  `);
          if (selected && selected.type === "task" && selectedTask) {
            $$payload.out.push("<!--[-->");
            {
              $$payload.out.push("<!--[!-->");
              $$payload.out.push(`<span style="margin-left:0.8em;font-weight:bold;font-size:1.1em;" class="svelte-zjczzm">${escape_html(selectedTask.title)} <button class="edit-title-btn svelte-zjczzm" title="Edit task name" style="margin-left: 0.5em; background: none; border: none; color: #1976d2; cursor: pointer;">✏️</button></span>`);
            }
            $$payload.out.push(`<!--]-->`);
          } else {
            $$payload.out.push("<!--[!-->");
            if (selected && selected.type === "subtask" && selectedSubtask) {
              $$payload.out.push("<!--[-->");
              {
                $$payload.out.push("<!--[!-->");
                $$payload.out.push(`<span style="margin-left:0.8em;font-weight:bold;font-size:1.1em;" class="svelte-zjczzm">${escape_html(selectedSubtask.content)} <button class="edit-title-btn svelte-zjczzm" title="Edit task name" style="margin-left: 0.5em; background: none; border: none; color: #1976d2; cursor: pointer;">✏️</button></span>`);
              }
              $$payload.out.push(`<!--]-->`);
            } else {
              $$payload.out.push("<!--[!-->");
            }
            $$payload.out.push(`<!--]-->`);
          }
          $$payload.out.push(`<!--]-->  `);
          if (selected && selected.type === "task" && selectedTask) {
            $$payload.out.push("<!--[-->");
            $$payload.out.push(`<select style="margin-left:0.5em;" class="svelte-zjczzm">`);
            $$payload.select_value = editTaskStatusRP;
            $$payload.out.push(`<option value="open"${maybe_selected($$payload, "open")} class="svelte-zjczzm">Open</option><option value="in_progress"${maybe_selected($$payload, "in_progress")} class="svelte-zjczzm">In Progress</option><option value="done"${maybe_selected($$payload, "done")} class="svelte-zjczzm">Done</option>`);
            $$payload.select_value = void 0;
            $$payload.out.push(`</select>`);
          } else {
            $$payload.out.push("<!--[!-->");
            if (selected && selected.type === "subtask" && selectedSubtask) {
              $$payload.out.push("<!--[-->");
              $$payload.out.push(`<select style="margin-left:0.5em;" class="svelte-zjczzm">`);
              $$payload.select_value = editSubtaskStatusRP;
              $$payload.out.push(`<option value="open"${maybe_selected($$payload, "open")} class="svelte-zjczzm">Open</option><option value="in_progress"${maybe_selected($$payload, "in_progress")} class="svelte-zjczzm">In Progress</option><option value="done"${maybe_selected($$payload, "done")} class="svelte-zjczzm">Done</option>`);
              $$payload.select_value = void 0;
              $$payload.out.push(`</select>`);
            } else {
              $$payload.out.push("<!--[!-->");
            }
            $$payload.out.push(`<!--]-->`);
          }
          $$payload.out.push(`<!--]--></div>  `);
          if (selected && selected.type === "task" && selectedTask) {
            $$payload.out.push("<!--[-->");
            $$payload.out.push(`<div class="created-by-line svelte-zjczzm"><b class="svelte-zjczzm">Created by:</b> `);
            if (selectedTask.created_by_email) {
              $$payload.out.push("<!--[-->");
              $$payload.out.push(`<span${attr("title", selectedTask.created_by_email)} class="svelte-zjczzm">${escape_html(selectedTask.created_by_email === sessionValue?.user?.email ? "You" : getInitials(selectedTask.created_by_email))}</span>`);
            } else {
              $$payload.out.push("<!--[!-->");
              $$payload.out.push(`—`);
            }
            $$payload.out.push(`<!--]--></div>`);
          } else {
            $$payload.out.push("<!--[!-->");
            if (selected && selected.type === "subtask" && selectedSubtask) {
              $$payload.out.push("<!--[-->");
              $$payload.out.push(`<div class="created-by-line svelte-zjczzm">Created by: `);
              if (selectedSubtask.created_by_email) {
                $$payload.out.push("<!--[-->");
                $$payload.out.push(`<span${attr("title", selectedSubtask.created_by_email)} class="svelte-zjczzm">${escape_html(selectedSubtask.created_by_email === sessionValue?.user?.email ? "You" : getInitials(selectedSubtask.created_by_email))}</span>`);
              } else {
                $$payload.out.push("<!--[!-->");
                $$payload.out.push(`—`);
              }
              $$payload.out.push(`<!--]--></div>`);
            } else {
              $$payload.out.push("<!--[!-->");
            }
            $$payload.out.push(`<!--]-->`);
          }
          $$payload.out.push(`<!--]-->  `);
          if (selected && selected.type === "task" && selectedTask) {
            $$payload.out.push("<!--[-->");
            const each_array_10 = ensure_array_like(members);
            $$payload.out.push(`<select style="margin-left:0.5em;" class="svelte-zjczzm">`);
            $$payload.select_value = editTaskAssignedToRP;
            $$payload.out.push(`<option value=""${maybe_selected($$payload, "")} class="svelte-zjczzm">Unassigned</option><!--[-->`);
            for (let $$index_10 = 0, $$length = each_array_10.length; $$index_10 < $$length; $$index_10++) {
              let m = each_array_10[$$index_10];
              if (m.user_id) {
                $$payload.out.push("<!--[-->");
                $$payload.out.push(`<option${attr("value", m.user_id)}${maybe_selected($$payload, m.user_id)} class="svelte-zjczzm">${escape_html(m.email)}</option>`);
              } else {
                $$payload.out.push("<!--[!-->");
              }
              $$payload.out.push(`<!--]-->`);
            }
            $$payload.out.push(`<!--]-->`);
            $$payload.select_value = void 0;
            $$payload.out.push(`</select>`);
          } else {
            $$payload.out.push("<!--[!-->");
            if (selected && selected.type === "subtask" && selectedSubtask) {
              $$payload.out.push("<!--[-->");
              const each_array_11 = ensure_array_like(members);
              $$payload.out.push(`<select style="margin-left:0.5em;" class="svelte-zjczzm">`);
              $$payload.select_value = editSubtaskAssignedToRP;
              $$payload.out.push(`<option value=""${maybe_selected($$payload, "")} class="svelte-zjczzm">Unassigned</option><!--[-->`);
              for (let $$index_11 = 0, $$length = each_array_11.length; $$index_11 < $$length; $$index_11++) {
                let m = each_array_11[$$index_11];
                if (m.user_id) {
                  $$payload.out.push("<!--[-->");
                  $$payload.out.push(`<option${attr("value", m.user_id)}${maybe_selected($$payload, m.user_id)} class="svelte-zjczzm">${escape_html(m.email)}</option>`);
                } else {
                  $$payload.out.push("<!--[!-->");
                }
                $$payload.out.push(`<!--]-->`);
              }
              $$payload.out.push(`<!--]-->`);
              $$payload.select_value = void 0;
              $$payload.out.push(`</select>`);
            } else {
              $$payload.out.push("<!--[!-->");
            }
            $$payload.out.push(`<!--]-->`);
          }
          $$payload.out.push(`<!--]-->  `);
          if (selected && selected.type === "task" && selectedTask) {
            $$payload.out.push("<!--[-->");
            $$payload.out.push(`<input type="date"${attr("value", editTaskDueDateRP)} style="margin-left:0.5em;" class="svelte-zjczzm"/>`);
          } else {
            $$payload.out.push("<!--[!-->");
            if (selected && selected.type === "subtask" && selectedSubtask) {
              $$payload.out.push("<!--[-->");
              $$payload.out.push(`<input type="date"${attr("value", editSubtaskDueDateRP)} style="margin-left:0.5em;" class="svelte-zjczzm"/>`);
            } else {
              $$payload.out.push("<!--[!-->");
            }
            $$payload.out.push(`<!--]-->`);
          }
          $$payload.out.push(`<!--]-->  `);
          if (selected && selected.type === "task" && selectedTask) {
            $$payload.out.push("<!--[-->");
            $$payload.out.push(`<div class="task-description-block svelte-zjczzm"><b class="svelte-zjczzm">Description:</b> `);
            if (selectedTask.description?.trim()) {
              $$payload.out.push("<!--[-->");
              $$payload.out.push(`<textarea maxlength="200" rows="2" placeholder="Description (optional)" style="width:100%;margin-top:0.5em;" class="svelte-zjczzm">`);
              const $$body = escape_html(editTaskDescriptionRP);
              if ($$body) {
                $$payload.out.push(`${$$body}`);
              }
              $$payload.out.push(`</textarea>`);
            } else {
              $$payload.out.push("<!--[!-->");
              $$payload.out.push(`<span style="color:#888; margin-left:0.5em;" class="svelte-zjczzm">(No description provided)</span>`);
            }
            $$payload.out.push(`<!--]--></div>`);
          } else {
            $$payload.out.push("<!--[!-->");
          }
          $$payload.out.push(`<!--]-->  `);
          if (selected && selected.type === "task" && selectedTask) {
            $$payload.out.push("<!--[-->");
            $$payload.out.push(`<div class="task-items-block svelte-zjczzm"><b class="svelte-zjczzm">Items required for this task:</b> `);
            if (items.length === 0) {
              $$payload.out.push("<!--[-->");
              $$payload.out.push(`<span style="color:#888;" class="svelte-zjczzm">No items defined for this project.</span>`);
            } else {
              $$payload.out.push("<!--[!-->");
              if (showAllItems) {
                $$payload.out.push("<!--[-->");
                ItemChecklist($$payload, {
                  items,
                  selectedIds: selectedTaskItemIds,
                  disabled: savingItems,
                  showStatus: true,
                  onChange: handleRightPaneItemsChange
                });
                $$payload.out.push(`<!----> `);
                if (selectedTaskItemIds.length === 0) {
                  $$payload.out.push("<!--[-->");
                  $$payload.out.push(`<span style="color:#888; margin-left:0.8em;" class="svelte-zjczzm">No items are currently required for this task. Click button below to add
											requirements.</span>`);
                } else {
                  $$payload.out.push("<!--[!-->");
                }
                $$payload.out.push(`<!--]--> <button class="expand-items-btn svelte-zjczzm">Hide details</button> `);
                if (savingItems) {
                  $$payload.out.push("<!--[-->");
                  $$payload.out.push(`<span style="color:#888; margin-left:0.8em;" class="svelte-zjczzm">Saving…</span>`);
                } else {
                  $$payload.out.push("<!--[!-->");
                }
                $$payload.out.push(`<!--]-->`);
              } else {
                $$payload.out.push("<!--[!-->");
                if (selectedTaskItemIds.length === 0) {
                  $$payload.out.push("<!--[-->");
                  $$payload.out.push(`<span style="color:#888; margin-left:0.8em;" class="svelte-zjczzm">No items are currently required for this task. Click button below to add
											requirements.</span>`);
                } else {
                  $$payload.out.push("<!--[!-->");
                  if (missingItemsSummary.length > 0) {
                    $$payload.out.push("<!--[-->");
                    const each_array_12 = ensure_array_like(missingItemsSummary);
                    $$payload.out.push(`<ul class="task-items-summary-list svelte-zjczzm"><!--[-->`);
                    for (let $$index_12 = 0, $$length = each_array_12.length; $$index_12 < $$length; $$index_12++) {
                      let item = each_array_12[$$index_12];
                      $$payload.out.push(`<li class="svelte-zjczzm"><span class="status-dot svelte-zjczzm" style="background:#e74c3c; border-color:#aaa; width:0.9em; height:0.9em; border-radius:50%; display:inline-block; margin-right:0.4em;"></span> ${escape_html(item.name)}</li>`);
                    }
                    $$payload.out.push(`<!--]--></ul> <span style="color:#e74c3c; margin-left:0.4em;" class="svelte-zjczzm">${escape_html(missingItemsSummary.length)} required item${escape_html(missingItemsSummary.length > 1 ? "s are" : " is")} missing.</span>`);
                  } else {
                    $$payload.out.push("<!--[!-->");
                    $$payload.out.push(`<span style="color:#47e37a;" class="svelte-zjczzm">✔ All required items are present.</span>`);
                  }
                  $$payload.out.push(`<!--]-->`);
                }
                $$payload.out.push(`<!--]--> <button class="expand-items-btn svelte-zjczzm">Show all items</button>`);
              }
              $$payload.out.push(`<!--]-->`);
            }
            $$payload.out.push(`<!--]--></div>`);
          } else {
            $$payload.out.push("<!--[!-->");
          }
          $$payload.out.push(`<!--]--></div>   <section class="comments-section svelte-zjczzm"><h4 class="svelte-zjczzm">Comments</h4> `);
          {
            $$payload.out.push("<!--[!-->");
            if (comments.length === 0) {
              $$payload.out.push("<!--[-->");
              $$payload.out.push(`<p style="color:#888;" class="svelte-zjczzm">No comments yet.</p>`);
            } else {
              $$payload.out.push("<!--[!-->");
              const each_array_13 = ensure_array_like(comments);
              $$payload.out.push(`<ul class="comments-list svelte-zjczzm"><!--[-->`);
              for (let $$index_13 = 0, $$length = each_array_13.length; $$index_13 < $$length; $$index_13++) {
                let comment = each_array_13[$$index_13];
                $$payload.out.push(`<li class="comment-row svelte-zjczzm"><span class="comment-initials svelte-zjczzm">${escape_html(getInitials(userMap[comment.user_id] ?? "U"))}</span> <span class="comment-meta svelte-zjczzm"><span class="comment-time svelte-zjczzm">${escape_html(formatDateTime(comment.created_at))}</span></span> <div class="comment-text svelte-zjczzm">${escape_html(comment.content)}</div></li>`);
              }
              $$payload.out.push(`<!--]--></ul>`);
            }
            $$payload.out.push(`<!--]-->`);
          }
          $$payload.out.push(`<!--]--> <form style="margin-top: 1em; display:flex; gap:0.7em;" class="svelte-zjczzm"><textarea placeholder="Write a comment…" required rows="2" style="flex:1;resize:vertical;" class="svelte-zjczzm">`);
          const $$body_1 = escape_html(newCommentText);
          if ($$body_1) {
            $$payload.out.push(`${$$body_1}`);
          } else {
            $$payload.out.push(`
							`);
          }
          $$payload.out.push(`</textarea> <button type="submit"${attr("disabled", !newCommentText.trim(), true)} class="svelte-zjczzm">${escape_html("Add")}</button></form></section>  <div class="right-pane-actions svelte-zjczzm" style="display: flex; gap: 1em; margin: 2em 0 0 0;">`);
          if (selected.type === "task" && selectedTask) {
            $$payload.out.push("<!--[-->");
            $$payload.out.push(`<button type="button" class="toolbar-btn svelte-zjczzm"${attr("disabled", !isTaskChanged || savingEdit, true)}>Save</button>`);
          } else {
            $$payload.out.push("<!--[!-->");
            if (selected.type === "subtask" && selectedSubtask) {
              $$payload.out.push("<!--[-->");
              $$payload.out.push(`<button type="button" class="toolbar-btn svelte-zjczzm"${attr("disabled", !isSubtaskChanged || savingEdit, true)}>Save</button>`);
            } else {
              $$payload.out.push("<!--[!-->");
            }
            $$payload.out.push(`<!--]-->`);
          }
          $$payload.out.push(`<!--]--> `);
          if (selected.type === "task" && selectedTask) {
            $$payload.out.push("<!--[-->");
            $$payload.out.push(`<button type="button" class="toolbar-btn svelte-zjczzm">Cancel</button>`);
          } else {
            $$payload.out.push("<!--[!-->");
            if (selected.type === "subtask" && selectedSubtask) {
              $$payload.out.push("<!--[-->");
              $$payload.out.push(`<button type="button" class="toolbar-btn svelte-zjczzm">Cancel</button>`);
            } else {
              $$payload.out.push("<!--[!-->");
            }
            $$payload.out.push(`<!--]-->`);
          }
          $$payload.out.push(`<!--]--></div></div>`);
        } else {
          $$payload.out.push("<!--[!-->");
        }
        $$payload.out.push(`<!--]--></aside>  `);
        {
          $$payload.out.push("<!--[!-->");
        }
        $$payload.out.push(`<!--]-->  `);
        {
          $$payload.out.push("<!--[!-->");
        }
        $$payload.out.push(`<!--]--> `);
        {
          $$payload.out.push("<!--[!-->");
        }
        $$payload.out.push(`<!--]--> `);
        {
          $$payload.out.push("<!--[!-->");
        }
        $$payload.out.push(`<!--]-->`);
      } else {
        $$payload.out.push("<!--[!-->");
      }
      $$payload.out.push(`<!--]-->`);
    }
    $$payload.out.push(`<!--]-->`);
  }
  $$payload.out.push(`<!--]--></div>`);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
export {
  _page as default
};
