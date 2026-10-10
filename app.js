// ---------- 1. SETTINGS ----------
const CATEGORIES = ["Study", "Personal", "Event", "Work", "Other"];
const STORAGE_KEY = "duely-deadlines-v1";

// ---------- 2. STATE ----------
// Each deadline looks like:
// { id: "k3j2...", title: "Submit ERD", category: "Study", due: "2026-10-12", note: "", done: false }
let deadlines = load();
let activeFilter = "All";
let editingId = null;     // null = adding a new one, otherwise the id being edited

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deadlines));
  } catch {
    // Storage may be blocked (private mode). The app still works, it just can't save.
  }
}

// ---------- 3. SMALL HELPERS ----------
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;   // textContent is safe: it never runs user input as HTML
  return node;
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);                      // local time, so no timezone surprises
}

function daysUntil(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parseISODate(iso) - today) / 86400000);
}

function describeDue(iso) {
  const days = daysUntil(iso);
  const date = parseISODate(iso).toLocaleDateString("en-PH", {
    weekday: "short", month: "short", day: "numeric",
  });
  if (days < 0)   return { text: `Overdue, was ${date}`, level: "late" };
  if (days === 0) return { text: "Due today", level: "soon" };
  if (days === 1) return { text: `Due tomorrow, ${date}`, level: "soon" };
  return { text: `Due ${date}`, level: "normal" };
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function addDays(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return toISODate(d);                               // e.g. "2026-10-11"
}

function countdownText(iso) {
  const days = daysUntil(iso);
  if (days < 0)   return `${-days} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

const byDate = (a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title);

// ---------- 4. RENDER ----------
const listEl = document.getElementById("deadline-list");
const emptyEl = document.getElementById("empty-state");
const emptyTitleEl = document.getElementById("empty-title");
const emptyTextEl = document.getElementById("empty-text");
const summaryEl = document.getElementById("summary");
const filtersEl = document.getElementById("filters");
const nextUpEl = document.getElementById("next-up");

// "Move to: Tomorrow | Next week" buttons, reused on the card and on overdue items
function rescheduleGroup(item) {
  const group = el("div", "reschedule");
  group.append(el("span", "", "Move to"));
  [["Tomorrow", 1], ["Next week", 7]].forEach(([label, days]) => {
    const btn = el("button", "mini-btn", label);
    btn.type = "button";
    btn.setAttribute("aria-label", `Move "${item.title}" to ${label.toLowerCase()}`);
    btn.addEventListener("click", () => reschedule(item.id, days));
    group.append(btn);
  });
  return group;
}

function renderNextUp() {
  nextUpEl.innerHTML = "";

  if (deadlines.length === 0) {
    nextUpEl.hidden = true;
    return;
  }
  nextUpEl.hidden = false;

  // The most urgent unfinished item, ignoring the category filter
  const item = deadlines.filter((d) => !d.done).sort(byDate)[0];

  if (!item) {
    nextUpEl.className = "next-up is-clear";
    nextUpEl.append(el("p", "next-up-title", "All done. Take a break."));
    return;
  }

  const due = describeDue(item.due);
  nextUpEl.className = "next-up " + due.level;

  nextUpEl.append(el("p", "next-up-label", "Next up"));
  nextUpEl.append(el("p", "next-up-title", item.title));
  nextUpEl.append(el("p", "next-up-when", countdownText(item.due)));
  nextUpEl.append(el("p", "next-up-meta", `${item.category}, ${due.text.replace(/^(Due|Overdue, was) /, "")}`));

  const actions = el("div", "next-up-actions");
  const doneBtn = el("button", "btn btn-primary", "Mark done");
  doneBtn.type = "button";
  doneBtn.addEventListener("click", () => toggleDone(item.id));
  actions.append(doneBtn, rescheduleGroup(item));
  nextUpEl.append(actions);
}

function renderFilters() {
  filtersEl.innerHTML = "";
  ["All", ...CATEGORIES].forEach((name) => {
    const chip = el("button", "chip", name);
    chip.type = "button";
    chip.setAttribute("aria-pressed", String(name === activeFilter));
    chip.addEventListener("click", () => {
      activeFilter = name;
      render();
    });
    filtersEl.append(chip);
  });
}

function render() {
  renderFilters();
  renderNextUp();
  listEl.innerHTML = "";

  const remaining = deadlines.filter((d) => !d.done).length;
  summaryEl.textContent = deadlines.length === 0 ? "" : `${remaining} left`;

  // Filter, then sort: unfinished first, then by date (soonest first)
  const visible = deadlines
    .filter((d) => activeFilter === "All" || d.category === activeFilter)
    .sort((a, b) => (a.done - b.done) || a.due.localeCompare(b.due));

  if (visible.length === 0) {
    emptyEl.hidden = false;
    if (deadlines.length === 0) {
      emptyTitleEl.textContent = "Nothing due yet";
      emptyTextEl.textContent = "Tap Add to create your first deadline or event.";
    } else {
      emptyTitleEl.textContent = `No ${activeFilter} deadlines`;
      emptyTextEl.textContent = "Pick another category, or tap Add.";
    }
    return;
  }
  emptyEl.hidden = true;

  visible.forEach((item) => {
    const due = describeDue(item.due);

    const li = el("li", "deadline" + (item.done ? " is-done" : ""));

    // Checkbox
    const check = el("label", "check");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = item.done;
    box.setAttribute("aria-label", `Mark "${item.title}" as done`);
    box.addEventListener("change", () => toggleDone(item.id));
    check.append(box);

    // Text
    const body = el("div", "deadline-body");
    body.append(el("div", "deadline-meta", item.category));
    body.append(el("div", "deadline-title", item.title));
    if (item.note) body.append(el("div", "deadline-note", item.note));
    body.append(el("span", "badge " + (item.done ? "" : due.level), item.done ? "Done" : due.text));

    if (!item.done && daysUntil(item.due) < 0) body.append(rescheduleGroup(item));

    // Edit button
    const edit = el("button", "edit-btn", "Edit");
    edit.type = "button";
    edit.setAttribute("aria-label", `Edit "${item.title}"`);
    edit.addEventListener("click", () => openEditor(item.id));

    li.append(check, body, edit);
    listEl.append(li);
  });
}

// ---------- 5. ACTIONS ----------
function toggleDone(id) {
  const item = deadlines.find((d) => d.id === id);
  if (!item) return;
  item.done = !item.done;
  persist();
  render();
}

function reschedule(id, daysFromToday) {
  const item = deadlines.find((d) => d.id === id);
  if (!item) return;
  item.due = addDays(daysFromToday);                 // counted from today, not from the old date
  persist();
  render();
}

// ---------- 6. ADD / EDIT FORM ----------
const dialog = document.getElementById("editor");
const form = document.getElementById("form");
const dialogTitle = document.getElementById("dialog-title");
const titleInput = document.getElementById("title");
const categoryInput = document.getElementById("category");
const dueInput = document.getElementById("due");
const noteInput = document.getElementById("note");
const errorEl = document.getElementById("error");
const deleteBtn = document.getElementById("delete-btn");

CATEGORIES.forEach((name) => {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  categoryInput.append(option);
});

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = !message;
}

function openEditor(id = null) {
  editingId = id;
  showError("");

  if (id) {
    const item = deadlines.find((d) => d.id === id);
    dialogTitle.textContent = "Edit deadline";
    titleInput.value = item.title;
    categoryInput.value = item.category;
    dueInput.value = item.due;
    noteInput.value = item.note;
    deleteBtn.hidden = false;
  } else {
    dialogTitle.textContent = "Add deadline";
    form.reset();
    categoryInput.value = activeFilter === "All" ? CATEGORIES[0] : activeFilter;
    dueInput.value = toISODate(new Date());
    deleteBtn.hidden = true;
  }

  dialog.showModal();
  titleInput.focus();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();                            // stop the page from reloading

  const title = titleInput.value.trim();
  if (!title) {
    showError("Add a title so you know what this is.");
    titleInput.focus();
    return;
  }
  if (!dueInput.value) {
    showError("Choose a due date.");
    dueInput.focus();
    return;
  }

  const data = {
    title,
    category: categoryInput.value,
    due: dueInput.value,
    note: noteInput.value.trim(),
  };

  if (editingId) {
    Object.assign(deadlines.find((d) => d.id === editingId), data);
  } else {
    deadlines.push({ id: newId(), done: false, ...data });
  }

  persist();
  dialog.close();
  render();
});

deleteBtn.addEventListener("click", () => {
  if (!confirm("Delete this deadline? This cannot be undone.")) return;
  deadlines = deadlines.filter((d) => d.id !== editingId);
  persist();
  dialog.close();
  render();
});

document.getElementById("cancel-btn").addEventListener("click", () => dialog.close());
document.getElementById("add-btn").addEventListener("click", () => openEditor());

// ---------- 7. START ----------
render();
