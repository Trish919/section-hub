// ---------- 1. DATA ----------
// Fake data for now. In Milestone 3 this will come from a database.
// "daysFromNow" keeps the demo dates fresh no matter when you open the page.
const deadlines = [
  { id: 1, subject: "IS 201",  title: "Database ERD activity",  daysFromNow: 1 },
  { id: 2, subject: "GE Math", title: "Problem set 3",          daysFromNow: 3 },
  { id: 3, subject: "IS 202",  title: "System analysis report", daysFromNow: 7 },
  { id: 4, subject: "NSTP",    title: "Community project form", daysFromNow: -1 },
];

// ---------- 2. SAVED STATE ----------
// localStorage remembers which tasks you ticked, even after refresh.
// It lives only in YOUR browser. Shared "done" counts come later with a database.
const STORAGE_KEY = "sectionhub-done";

function loadDone() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveDone(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage can be blocked (private mode). The app still works, just without saving.
  }
}

let doneIds = loadDone();

// ---------- 3. HELPERS ----------
function dueDate(daysFromNow) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

function describeDue(daysFromNow) {
  const date = dueDate(daysFromNow).toLocaleDateString("en-PH", {
    weekday: "short", month: "short", day: "numeric",
  });
  if (daysFromNow < 0)   return { text: `Overdue, was ${date}`, level: "late" };
  if (daysFromNow === 0) return { text: `Due today`, level: "soon" };
  if (daysFromNow === 1) return { text: `Due tomorrow, ${date}`, level: "soon" };
  return { text: `Due ${date}`, level: "normal" };
}

// ---------- 4. RENDER ----------
const listEl = document.getElementById("deadline-list");
const emptyEl = document.getElementById("empty-state");
const summaryEl = document.getElementById("summary");

function render() {
  listEl.innerHTML = "";

  if (deadlines.length === 0) {
    emptyEl.hidden = false;
    summaryEl.textContent = "";
    return;
  }
  emptyEl.hidden = true;

  // Sort: soonest first (copy the array so we don't change the original)
  const sorted = [...deadlines].sort((a, b) => a.daysFromNow - b.daysFromNow);

  sorted.forEach((item) => {
    const isDone = doneIds.includes(item.id);
    const due = describeDue(item.daysFromNow);

    const li = document.createElement("li");
    li.className = "deadline" + (isDone ? " is-done" : "");

    const label = document.createElement("label");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isDone;
    checkbox.addEventListener("change", () => toggleDone(item.id));

    const body = document.createElement("div");
    body.className = "deadline-body";

    const subject = document.createElement("div");
    subject.className = "deadline-subject";
    subject.textContent = item.subject;

    const title = document.createElement("div");
    title.className = "deadline-title";
    title.textContent = item.title;

    const badge = document.createElement("span");
    badge.className = "badge " + (isDone ? "" : due.level);
    badge.textContent = isDone ? "Done" : due.text;

    body.append(subject, title, badge);
    label.append(checkbox, body);
    li.append(label);
    listEl.append(li);
  });

  const remaining = deadlines.length - doneIds.filter((id) =>
    deadlines.some((d) => d.id === id)).length;
  summaryEl.textContent = remaining === 0 ? "All done" : `${remaining} left`;
}

// ---------- 5. ACTIONS ----------
function toggleDone(id) {
  doneIds = doneIds.includes(id)
    ? doneIds.filter((x) => x !== id)
    : [...doneIds, id];
  saveDone(doneIds);
  render();
}

// ---------- 6. START ----------
render();
