/* ===================== Rep Log — app logic ===================== */

const DB_NAME = "replog";
const DB_VERSION = 1;
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

let db = null;
let state = {
  tab: "today",
  plans: [],
  activePlan: null,
  selectedDate: todayISO(),
  selectedDayName: null,   // overrides the weekday-derived plan day when set
  openExercise: null,      // name of currently expanded exercise card
  sets: [],                // all logged sets (loaded once, kept in memory, synced to db)
  historyExercise: null,
  importParsed: null,      // parsed plan pending review
  exportRange: null
};

/* ---------- date helpers ---------- */
function todayISO() {
  const d = new Date();
  return isoFromDate(d);
}
function isoFromDate(d) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function weekdayNameFromISO(iso) {
  const [y,m,d] = iso.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  return WEEKDAYS[dt.getDay()];
}
function friendlyDate(iso) {
  const [y,m,d] = iso.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/* ---------- IndexedDB helper ---------- */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const _db = e.target.result;
      if (!_db.objectStoreNames.contains("plans")) {
        _db.createObjectStore("plans", { keyPath: "id" });
      }
      if (!_db.objectStoreNames.contains("sets")) {
        const s = _db.createObjectStore("sets", { keyPath: "id", autoIncrement: true });
        s.createIndex("byDate", "date");
        s.createIndex("byExercise", "exerciseName");
      }
      if (!_db.objectStoreNames.contains("meta")) {
        _db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}
function tx(storeNames, mode) {
  return db.transaction(storeNames, mode);
}
function idbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const req = tx([storeName], "readonly").objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbPut(storeName, value) {
  return new Promise((resolve, reject) => {
    const req = tx([storeName], "readwrite").objectStore(storeName).put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const req = tx([storeName], "readwrite").objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
function idbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const req = tx([storeName], "readonly").objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ---------- init ---------- */
async function init() {
  db = await openDB();
  state.plans = await idbGetAll("plans");

  if (state.plans.length === 0) {
    const seeded = JSON.parse(JSON.stringify(DEFAULT_PLAN));
    seeded.importedAt = todayISO();
    await idbPut("plans", seeded);
    state.plans = [seeded];
    await idbPut("meta", { key: "activePlanId", value: seeded.id });
  }
  const activeMeta = await idbGet("meta", "activePlanId");
  const activeId = activeMeta ? activeMeta.value : state.plans[state.plans.length-1].id;
  state.activePlan = state.plans.find(p => p.id === activeId) || state.plans[state.plans.length-1];

  state.sets = await idbGetAll("sets");

  bindNav();
  window.addEventListener("online", updateOnlineBanner);
  window.addEventListener("offline", updateOnlineBanner);
  updateOnlineBanner();
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  }
}

function updateOnlineBanner() {
  document.getElementById("offline-banner").classList.toggle("hidden", navigator.onLine);
}

/* ---------- nav ---------- */
function bindNav() {
  document.getElementById("tab-bar").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;
    state.tab = btn.dataset.tab;
    render();
  });
}

/* ---------- toast ---------- */
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 1800);
}

/* ---------- render dispatcher ---------- */
function render() {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === state.tab));
  document.getElementById("plan-badge").textContent = state.activePlan ? state.activePlan.name : "No plan";

  const root = document.getElementById("view-root");
  if (state.tab === "today") root.innerHTML = renderToday();
  else if (state.tab === "week") root.innerHTML = renderWeek();
  else if (state.tab === "history") root.innerHTML = renderHistory();
  else if (state.tab === "export") root.innerHTML = renderExport();
  else if (state.tab === "plan") root.innerHTML = renderPlanTab();

  bindViewEvents();
}

/* ================= TODAY ================= */
function currentDayObj() {
  const dayName = state.selectedDayName || weekdayNameFromISO(state.selectedDate);
  return state.activePlan.days.find(d => d.day === dayName) || state.activePlan.days[0];
}

function setsFor(date, exerciseName) {
  return state.sets
    .filter(s => s.date === date && s.exerciseName === exerciseName)
    .sort((a,b) => a.setNumber - b.setNumber);
}

function lastLogged(exerciseName, beforeDate) {
  const entries = state.sets
    .filter(s => s.exerciseName === exerciseName && s.date < beforeDate)
    .sort((a,b) => b.date.localeCompare(a.date));
  return entries.length ? entries[0] : null;
}

function renderToday() {
  const day = currentDayObj();
  const dayOptions = state.activePlan.days.map(d =>
    `<option value="${escAttr(d.day)}" ${d.day === (state.selectedDayName||weekdayNameFromISO(state.selectedDate)) ? "selected":""}>${d.day} — ${escHtml(d.title)}</option>`
  ).join("");

  let body;
  if (day.type === "rest" || day.exercises.length === 0) {
    body = `<div class="rest-card">
      <div class="rest-title">Rest Day</div>
      <div>${escHtml(state.activePlan.notes?.steps || "Recovery day — keep steps up.")}</div>
    </div>`;
  } else {
    body = day.exercises.map((ex, i) => renderExerciseCard(ex, i, state.selectedDate)).join("");
  }

  return `
    <div class="day-switch">
      <div class="day-switch-main">
        <div class="day-switch-date">${friendlyDate(state.selectedDate)}</div>
        <div class="day-switch-title">${escHtml(day.title)}</div>
      </div>
      <input type="date" id="date-picker" value="${state.selectedDate}">
    </div>
    <div class="section-label">Logging as: </div>
    <div class="day-switch" style="margin-top:-8px;">
      <select id="day-override" style="width:100%;">${dayOptions}</select>
    </div>
    ${body}
  `;
}

function renderExerciseCard(ex, index, date) {
  const isOpen = state.openExercise === ex.name;
  const logged = setsFor(date, ex.name);
  const last = lastLogged(ex.name, date);

  const setRows = logged.map(s => `
    <div class="set-row" data-set-id="${s.id}">
      <div class="set-num">${s.setNumber}</div>
      <div class="set-main">
        <span class="val">${s.reps} reps × ${s.weight} lb</span>
        ${s.rpe ? `<span class="val-sub"> · RPE ${s.rpe}</span>` : ""}
        ${s.notes ? `<div class="set-note">${escHtml(s.notes)}</div>` : ""}
      </div>
      <button class="set-del" data-del-set="${s.id}" aria-label="Delete set">✕</button>
    </div>
  `).join("");

  return `
    <div class="ex-card ${isOpen ? "open" : ""}" data-exercise="${escAttr(ex.name)}">
      <div class="ex-head" data-toggle-ex="${escAttr(ex.name)}">
        <div class="ex-index ${logged.length ? "logged" : ""}">${index+1}</div>
        <div class="ex-main">
          <div class="ex-name">${escHtml(ex.name)}</div>
          <div class="ex-scheme">${escHtml(ex.scheme || "")}</div>
        </div>
        ${logged.length ? `<div class="ex-count">${logged.length} set${logged.length>1?"s":""}</div>` : ""}
        <svg class="ex-chevron" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="ex-body">
        ${ex.notes ? `<div class="ex-note">${escHtml(ex.notes)}</div>` : ""}
        ${last ? `<div class="prev-log"><span class="prev-label">Last (${friendlyDate(last.date)})</span><span class="prev-val">${last.reps} × ${last.weight} lb${last.rpe ? " @ RPE "+last.rpe : ""}</span></div>` : `<div class="prev-log"><span class="prev-label">No history yet</span></div>`}
        ${setRows}
        <form class="add-set-form" data-add-set="${escAttr(ex.name)}">
          <div class="field-grid">
            <div class="field"><label>Reps</label><input type="number" inputmode="numeric" min="0" name="reps" required></div>
            <div class="field"><label>Weight (lb)</label><input type="number" inputmode="decimal" min="0" step="0.5" name="weight" required></div>
            <div class="field"><label>RPE</label>
              <select name="rpe">
                <option value="">—</option>
                ${[6,6.5,7,7.5,8,8.5,9,9.5,10].map(v=>`<option value="${v}">${v}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="field" style="margin-bottom:8px;">
            <label>Notes (optional)</label>
            <textarea name="notes" rows="1" placeholder="form cue, how it felt..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary">+ Add Set</button>
        </form>
      </div>
    </div>
  `;
}

/* ================= WEEK ================= */
function renderWeek() {
  return `<div class="section-label">${escHtml(state.activePlan.name)}</div>` +
    state.activePlan.days.map(d => {
      const isRest = d.type === "rest" || d.exercises.length === 0;
      const list = isRest ? "Rest day" : d.exercises.map(e => e.name).join(" · ");
      return `<div class="week-day ${isRest?"rest":""}" data-jump-day="${escAttr(d.day)}">
        <div class="week-day-top">
          <div>
            <div class="week-day-name">${d.day}</div>
            <div class="week-day-title">${escHtml(d.title)}</div>
          </div>
        </div>
        <div class="week-day-list">${escHtml(list)}</div>
      </div>`;
    }).join("");
}

/* ================= HISTORY ================= */
function allExerciseNames() {
  const names = new Set();
  state.sets.forEach(s => names.add(s.exerciseName));
  state.plans.forEach(p => p.days.forEach(d => d.exercises.forEach(e => names.add(e.name))));
  return Array.from(names).sort();
}

function renderHistory() {
  const names = allExerciseNames();
  if (!state.historyExercise && names.length) state.historyExercise = names[0];

  const options = names.map(n => `<option value="${escAttr(n)}" ${n===state.historyExercise?"selected":""}>${escHtml(n)}</option>`).join("");

  const entries = state.sets
    .filter(s => s.exerciseName === state.historyExercise)
    .reduce((acc, s) => {
      (acc[s.date] = acc[s.date] || []).push(s);
      return acc;
    }, {});
  const dates = Object.keys(entries).sort().reverse();

  let list;
  if (!dates.length) {
    list = `<div class="empty-state">No logged sets yet for this exercise.<br>Log one from the Today tab and it'll show up here.</div>`;
  } else {
    list = dates.map(date => {
      const sets = entries[date].sort((a,b)=>a.setNumber-b.setNumber);
      const best = sets.reduce((m,s) => s.weight > m ? s.weight : m, 0);
      return `<div class="hist-day">
        <div class="hist-day-date"><span>${friendlyDate(date)}</span><span class="best">top ${best} lb</span></div>
        ${sets.map(s => `<div class="hist-set-line"><span class="n">${s.setNumber}</span><span>${s.reps} × ${s.weight} lb${s.rpe?` @ RPE ${s.rpe}`:""}</span>${s.notes?`<span class="note">— ${escHtml(s.notes)}</span>`:""}</div>`).join("")}
      </div>`;
    }).join("");
  }

  return `
    <div class="section-label">Progression</div>
    <div class="history-controls">
      <select id="history-exercise-select">${options}</select>
    </div>
    ${list}
  `;
}

/* ================= EXPORT ================= */
function defaultExportRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return { start: isoFromDate(start), end: isoFromDate(end) };
}

function buildExportText(startISO, endISO) {
  const inRange = state.sets.filter(s => s.date >= startISO && s.date <= endISO)
    .sort((a,b) => (a.date+String(a.setNumber).padStart(3,"0")).localeCompare(b.date+String(b.setNumber).padStart(3,"0")));
  const byDate = inRange.reduce((acc,s)=>{ (acc[s.date]=acc[s.date]||[]).push(s); return acc; }, {});
  const dates = Object.keys(byDate).sort();

  if (!dates.length) return "";

  let out = `${state.activePlan.name}\n${friendlyDate(startISO)} – ${friendlyDate(endISO)}\n\n`;
  dates.forEach(date => {
    const dayName = weekdayNameFromISO(date);
    out += `${friendlyDate(date)} (${dayName})\n`;
    const byExercise = byDate[date].reduce((acc,s)=>{ (acc[s.exerciseName]=acc[s.exerciseName]||[]).push(s); return acc; }, {});
    Object.keys(byExercise).forEach(exName => {
      const sets = byExercise[exName].sort((a,b)=>a.setNumber-b.setNumber);
      const setsStr = sets.map(s => `${s.reps}x${s.weight}${s.rpe?`@${s.rpe}`:""}`).join(", ");
      out += `  ${exName}: ${setsStr}\n`;
      sets.filter(s=>s.notes).forEach(s => out += `    note: ${s.notes}\n`);
    });
    out += "\n";
  });
  return out.trim();
}

function buildExportCSV(startISO, endISO) {
  const inRange = state.sets.filter(s => s.date >= startISO && s.date <= endISO)
    .sort((a,b) => (a.date+String(a.setNumber).padStart(3,"0")).localeCompare(b.date+String(b.setNumber).padStart(3,"0")));
  const rows = [["Date","Day","Exercise","Set","Reps","Weight (lb)","RPE","Notes"]];
  inRange.forEach(s => rows.push([s.date, weekdayNameFromISO(s.date), s.exerciseName, s.setNumber, s.reps, s.weight, s.rpe||"", s.notes||""]));
  return rows.map(r => r.map(csvEscape).join(",")).join("\n");
}
function csvEscape(v) {
  const str = String(v ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g,'""')}"` : str;
}

function renderExport() {
  const range = state.exportRange || defaultExportRange();
  state.exportRange = range;
  const preview = buildExportText(range.start, range.end);

  return `
    <div class="section-label">Export to send to coach</div>
    <div class="export-card">
      <div class="export-range">
        <div class="field"><label>From</label><input type="date" id="export-start" value="${range.start}"></div>
        <div class="field"><label>To</label><input type="date" id="export-end" value="${range.end}"></div>
      </div>
      <div class="export-preview">${preview ? escHtml(preview) : "No sets logged in this range yet."}</div>
      <div class="btn-row">
        <button class="btn btn-secondary" id="export-share">Share</button>
        <button class="btn btn-secondary" id="export-csv">CSV</button>
        <button class="btn btn-secondary" id="export-txt">Text file</button>
      </div>
    </div>
  `;
}

/* ================= PLAN / IMPORT ================= */
function renderPlanTab() {
  if (state.importParsed) return renderImportReview();

  const p = state.activePlan;
  const liftDays = p.days.filter(d => d.type !== "rest").length;
  return `
    <div class="section-label">Current plan</div>
    <div class="plan-meta">
      <strong>${escHtml(p.name)}</strong><br>
      ${liftDays} training days / week · imported ${p.importedAt ? friendlyDate(p.importedAt) : "—"}
    </div>

    <div class="section-label">Import new plan from PDF</div>
    <label class="import-dropzone" for="pdf-input">
      Tap to choose a training PDF from your coach.<br>You'll review and edit before it replaces your current plan.
      <input type="file" id="pdf-input" accept="application/pdf">
    </label>
    <div id="import-status"></div>

    <div class="section-label">Plan history</div>
    <div class="plan-meta">${state.plans.map(pl => `${escHtml(pl.name)} — ${pl.importedAt?friendlyDate(pl.importedAt):"—"}${pl.id===p.id?" (active)":""}`).join("<br>")}</div>
  `;
}

function renderImportReview() {
  const plan = state.importParsed;
  return `
    <div class="section-label">Review imported plan</div>
    <div class="plan-meta">Parsing a PDF is best-effort — check every day and exercise below before saving. Edit anything that's wrong.</div>
    <div class="field" style="margin-bottom:14px;">
      <label>Plan name</label>
      <input type="text" id="import-plan-name" value="${escAttr(plan.name)}">
    </div>
    ${plan.days.map((d, di) => `
      <div class="import-day-block" data-day-idx="${di}">
        <div class="import-day-header">
          <input type="text" value="${escAttr(d.day)}" data-field="day" placeholder="Day name" style="max-width:110px;">
          <input type="text" value="${escAttr(d.title)}" data-field="title" placeholder="Title (e.g. Legs)">
        </div>
        ${d.exercises.map((ex, ei) => `
          <div class="import-ex-row" data-ex-idx="${ei}">
            <div class="import-ex-grid">
              <input type="text" value="${escAttr(ex.name)}" data-field="name" placeholder="Exercise name">
              <input type="text" value="${escAttr(ex.scheme)}" data-field="scheme" placeholder="Scheme (e.g. 3 working · 10-12)">
              <textarea rows="1" data-field="notes" placeholder="Notes">${escHtml(ex.notes||"")}</textarea>
            </div>
            <button type="button" class="btn btn-danger btn-sm import-remove" data-remove-ex="${di}:${ei}">Remove exercise</button>
          </div>
        `).join("")}
        <div class="btn-row" style="margin-top:10px;">
          <button type="button" class="btn btn-ghost btn-sm" data-add-ex="${di}">+ Add exercise</button>
          <button type="button" class="btn btn-danger btn-sm" data-remove-day="${di}">Remove day</button>
        </div>
      </div>
    `).join("")}
    <div class="btn-row" style="margin: 4px 0 16px;">
      <button type="button" class="btn btn-ghost" id="import-cancel">Discard</button>
      <button type="button" class="btn btn-primary" id="import-save">Save as active plan</button>
    </div>
  `;
}

/* ---------- escaping ---------- */
function escHtml(s) {
  return String(s ?? "").replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
}
function escAttr(s) {
  return String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
}

/* ================= EVENT BINDING ================= */
function bindViewEvents() {
  const root = document.getElementById("view-root");

  // ---- TODAY ----
  const datePicker = document.getElementById("date-picker");
  if (datePicker) datePicker.addEventListener("change", (e) => {
    state.selectedDate = e.target.value;
    state.selectedDayName = null;
    render();
  });
  const dayOverride = document.getElementById("day-override");
  if (dayOverride) dayOverride.addEventListener("change", (e) => {
    state.selectedDayName = e.target.value;
    render();
  });

  root.querySelectorAll("[data-toggle-ex]").forEach(el => {
    el.addEventListener("click", () => {
      const name = el.dataset.toggleEx;
      state.openExercise = state.openExercise === name ? null : name;
      render();
    });
  });

  root.querySelectorAll("[data-add-set]").forEach(form => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const exerciseName = form.dataset.addSet;
      const fd = new FormData(form);
      const existing = setsFor(state.selectedDate, exerciseName);
      const entry = {
        date: state.selectedDate,
        exerciseName,
        setNumber: existing.length + 1,
        reps: Number(fd.get("reps")),
        weight: Number(fd.get("weight")),
        rpe: fd.get("rpe") || null,
        notes: (fd.get("notes")||"").trim(),
        timestamp: Date.now()
      };
      const id = await idbPut("sets", entry);
      entry.id = id;
      state.sets.push(entry);
      state.openExercise = exerciseName;
      render();
      toast("Set logged");
    });
  });

  root.querySelectorAll("[data-del-set]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.delSet);
      await idbDelete("sets", id);
      state.sets = state.sets.filter(s => s.id !== id);
      render();
    });
  });

  // ---- WEEK ----
  root.querySelectorAll("[data-jump-day]").forEach(el => {
    el.addEventListener("click", () => {
      state.selectedDayName = el.dataset.jumpDay;
      state.tab = "today";
      render();
    });
  });

  // ---- HISTORY ----
  const histSelect = document.getElementById("history-exercise-select");
  if (histSelect) histSelect.addEventListener("change", (e) => {
    state.historyExercise = e.target.value;
    render();
  });

  // ---- EXPORT ----
  const expStart = document.getElementById("export-start");
  const expEnd = document.getElementById("export-end");
  if (expStart) expStart.addEventListener("change", (e) => { state.exportRange.start = e.target.value; render(); });
  if (expEnd) expEnd.addEventListener("change", (e) => { state.exportRange.end = e.target.value; render(); });

  const shareBtn = document.getElementById("export-share");
  if (shareBtn) shareBtn.addEventListener("click", async () => {
    const text = buildExportText(state.exportRange.start, state.exportRange.end);
    if (!text) { toast("Nothing to export in this range"); return; }
    if (navigator.share) {
      try { await navigator.share({ title: "Training log", text }); }
      catch(err) { /* user cancelled */ }
    } else {
      await copyToClipboard(text);
      toast("Copied to clipboard");
    }
  });
  const csvBtn = document.getElementById("export-csv");
  if (csvBtn) csvBtn.addEventListener("click", () => {
    const csv = buildExportCSV(state.exportRange.start, state.exportRange.end);
    downloadFile(`training-log-${state.exportRange.start}_to_${state.exportRange.end}.csv`, csv, "text/csv");
  });
  const txtBtn = document.getElementById("export-txt");
  if (txtBtn) txtBtn.addEventListener("click", () => {
    const text = buildExportText(state.exportRange.start, state.exportRange.end);
    if (!text) { toast("Nothing to export in this range"); return; }
    downloadFile(`training-log-${state.exportRange.start}_to_${state.exportRange.end}.txt`, text, "text/plain");
  });

  // ---- PLAN / IMPORT ----
  const pdfInput = document.getElementById("pdf-input");
  if (pdfInput) pdfInput.addEventListener("change", handlePdfSelected);

  const importCancel = document.getElementById("import-cancel");
  if (importCancel) importCancel.addEventListener("click", () => { state.importParsed = null; render(); });

  const importSave = document.getElementById("import-save");
  if (importSave) importSave.addEventListener("click", saveImportedPlan);

  root.querySelectorAll("[data-remove-ex]").forEach(btn => {
    btn.addEventListener("click", () => {
      const [di, ei] = btn.dataset.removeEx.split(":").map(Number);
      state.importParsed.days[di].exercises.splice(ei, 1);
      render();
    });
  });
  root.querySelectorAll("[data-remove-day]").forEach(btn => {
    btn.addEventListener("click", () => {
      const di = Number(btn.dataset.removeDay);
      state.importParsed.days.splice(di, 1);
      render();
    });
  });
  root.querySelectorAll("[data-add-ex]").forEach(btn => {
    btn.addEventListener("click", () => {
      const di = Number(btn.dataset.addEx);
      state.importParsed.days[di].exercises.push({ name: "New exercise", scheme: "", notes: "" });
      render();
    });
  });

  // sync edits in import review inputs back into state.importParsed on blur
  root.querySelectorAll(".import-day-block").forEach(block => {
    const di = Number(block.dataset.dayIdx);
    block.querySelectorAll("[data-field]").forEach(input => {
      input.addEventListener("input", () => {
        const field = input.dataset.field;
        const exRow = input.closest("[data-ex-idx]");
        if (exRow) {
          const ei = Number(exRow.dataset.exIdx);
          state.importParsed.days[di].exercises[ei][field] = input.value;
        } else {
          state.importParsed.days[di][field] = input.value;
        }
      });
    });
  });
  const planNameInput = document.getElementById("import-plan-name");
  if (planNameInput) planNameInput.addEventListener("input", () => { state.importParsed.name = planNameInput.value; });
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) { /* ignore */ }
}

/* ================= PDF IMPORT ================= */
let pdfjsLoadPromise = null;
function ensurePdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  if (pdfjsLoadPromise) return pdfjsLoadPromise;
  pdfjsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve();
    };
    script.onerror = () => reject(new Error("Could not load PDF reader — check your connection and try again."));
    document.head.appendChild(script);
  });
  return pdfjsLoadPromise;
}

async function handlePdfSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  const status = document.getElementById("import-status");
  status.innerHTML = `<div class="plan-meta">Reading PDF…</div>`;
  try {
    await ensurePdfJs();
    const buf = await file.arrayBuffer();
    const doc = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const lines = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      lines.push(...linesFromTextContent(content));
    }
    const parsed = parsePlanFromLines(lines);
    if (!parsed.days.some(d => d.exercises.length)) {
      status.innerHTML = `<div class="plan-meta">Couldn't confidently detect exercises in this PDF. You can still build the plan manually below.</div>`;
      parsed.name = file.name.replace(/\.pdf$/i, "");
      state.importParsed = parsed;
    } else {
      status.innerHTML = "";
      state.importParsed = parsed;
    }
    render();
  } catch (err) {
    status.innerHTML = `<div class="plan-meta" style="color:var(--red);">${escHtml(err.message || "Couldn't read that PDF.")}</div>`;
  }
}

// Group pdf.js text items into visual lines by y-position, left-to-right by x.
function linesFromTextContent(content) {
  const items = content.items.filter(it => it.str && it.str.trim().length);
  const byY = new Map();
  items.forEach(it => {
    const y = Math.round(it.transform[5] / 2) * 2; // bucket nearby y values together
    if (!byY.has(y)) byY.set(y, []);
    byY.get(y).push(it);
  });
  const ys = Array.from(byY.keys()).sort((a,b) => b - a); // top to bottom
  return ys.map(y => byY.get(y).sort((a,b) => a.transform[4]-b.transform[4]).map(it => it.str).join(" ").replace(/\s+/g," ").trim())
    .filter(Boolean);
}

const DAY_NAMES = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];
const SCHEME_TRIGGER = /((?:\d+[–-]\d+|\d+)\s*(?:working|straight sets)|top set|see scheme|working\s*\+)/i;
const EX_LINE = /^(\d{1,2})\s+([A-Z(].*)$/;

function parsePlanFromLines(lines) {
  const days = [];
  let current = null;
  let lastExercise = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const dayMatch = DAY_NAMES.find(dn => line.toUpperCase().startsWith(dn));
    if (dayMatch && (line.length < 90)) {
      // e.g. "MONDAY — LEGS quad + adductor dominant" or just "MONDAY"
      let title = line.slice(dayMatch.length).replace(/^[\s—\-–]+/, "").trim();
      const properDay = dayMatch[0] + dayMatch.slice(1).toLowerCase();
      // Reuse existing day block if we've seen this day before (doc repeats headers)
      current = days.find(d => d.day === properDay);
      if (!current) {
        current = { day: properDay, title: title || properDay, type: "lift", exercises: [] };
        days.push(current);
      } else if (title && (current.title === current.day || current.title.length < title.length)) {
        current.title = title;
      }
      if (/\brest\b/i.test(title) || /\brest\b/i.test(line)) current.type = "rest";
      lastExercise = null;
      continue;
    }

    if (!current) continue;

    const exMatch = line.match(EX_LINE);
    if (exMatch) {
      const rest = exMatch[2];
      const trigMatch = rest.match(SCHEME_TRIGGER);
      let name, scheme;
      if (trigMatch) {
        name = rest.slice(0, trigMatch.index).trim();
        scheme = rest.slice(trigMatch.index).trim();
      } else {
        // fall back: split on 2+ spaces if present, else whole thing is name
        const parts = rest.split(/\s{2,}/);
        name = parts[0].trim();
        scheme = parts.slice(1).join(" ").trim();
      }
      if (name) {
        const ex = { name, scheme, notes: "" };
        current.exercises.push(ex);
        lastExercise = ex;
      }
      continue;
    }

    if (/^(training notes|warm-up|rest between|cardio|steps|after every session)/i.test(line)) {
      lastExercise = null;
      continue;
    }

    // continuation / notes line for the previous exercise
    if (lastExercise && line.length < 200) {
      lastExercise.notes = (lastExercise.notes ? lastExercise.notes + " " : "") + line;
    }
  }

  // ensure all 7 days present, in order, filling missing as rest
  const ordered = DAY_NAMES.map(dn => {
    const proper = dn[0] + dn.slice(1).toLowerCase();
    return days.find(d => d.day === proper) || { day: proper, title: "Rest", type: "rest", exercises: [] };
  });

  return {
    id: "imported-" + Date.now(),
    name: "Imported Plan " + new Date().toLocaleDateString(),
    importedAt: todayISO(),
    notes: {},
    days: ordered
  };
}

async function saveImportedPlan() {
  const plan = state.importParsed;
  plan.importedAt = todayISO();
  await idbPut("plans", plan);
  await idbPut("meta", { key: "activePlanId", value: plan.id });
  state.plans.push(plan);
  state.activePlan = plan;
  state.importParsed = null;
  state.selectedDayName = null;
  toast("Plan saved");
  state.tab = "today";
  render();
}

/* ================= boot ================= */
init();
