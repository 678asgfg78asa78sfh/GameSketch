import { useRef, useState } from "react";
import { api } from "../api.js";
import { useT } from "../i18n/index.jsx";
import { trackingProgress } from "../../../shared/tracking.js";
import ProgressMeter from "./ProgressMeter.jsx";
import Dialog from "./Dialog.jsx";

export function TrackingSummary({ node }) {
  const { t } = useT(), p = trackingProgress(node);
  if (!p.enabled) return null;
  return <div className="tracking-summary">
    <ProgressMeter percent={p.percent} label={t("tracker.nodeProgress", { title: node.title })} />
    {!!p.total && <small>{t("tracker.taskCount", { done: p.done, total: p.total })}</small>}
    {node.tracking?.completed && <small>{t("tracker.manuallyClosed")}</small>}
    <ul>{p.tasks.map((task) => <li key={task.id}>{task.done ? "☑" : "☐"} {task.kind === "milestone" && `${t("tracker.milestone")}: `}{task.title}</li>)}</ul>
  </div>;
}

export default function NodeTracker({ slug, node, project, busy, error, runAction, onNavigate }) {
  const { t } = useT(), p = trackingProgress(node);
  const [taskTitle, setTaskTitle] = useState(""), [kind, setKind] = useState("task");
  const [editing, setEditing] = useState(null), [editTitle, setEditTitle] = useState("");
  const [continuing, setContinuing] = useState(false), [versionTitle, setVersionTitle] = useState("");
  const [carryTasks, setCarryTasks] = useState(false);
  const [pendingTask, setPendingTask] = useState(null);
  const addId = useRef(null), addInput = useRef(null);
  const enabled = node.tracking?.enabled, closed = node.tracking?.completed;
  const previous = project.nodes.find((n) => n.id === node.continued_from);
  const next = project.nodes.find((n) => n.continued_from === node.id);
  const change = (operation) => runAction(() => api.updateTracking(slug, node.id, operation));
  async function checkTask(taskId, done) {
    setPendingTask({ id: taskId, done });
    try { await change({ operation: "edit", taskId, patch: { done } }); }
    finally { setPendingTask(null); }
  }

  async function addTask(e) {
    e.preventDefault();
    if (!taskTitle.trim() || busy) return;
    addId.current ||= crypto.randomUUID();
    const result = await change({ operation: "add", task: { id: addId.current, title: taskTitle.trim(), kind } });
    if (result) { setTaskTitle(""); addId.current = null; requestAnimationFrame(() => addInput.current?.focus()); }
  }
  async function renameTask(e) {
    e.preventDefault();
    if (await change({ operation: "edit", taskId: editing, patch: { title: editTitle.trim() } })) setEditing(null);
  }
  function openContinue() {
    const base = node.version ? node.title.replace(/ · v\d+$/, "") : node.title;
    setVersionTitle(`${base} · v${(node.version || 1) + 1}`); setCarryTasks(false); setContinuing(true);
  }
  async function continueVersion(e) {
    e.preventDefault();
    const result = await runAction(() => api.continueNode(slug, node.id, { title: versionTitle.trim(), carryTasks }));
    if (result) {
      try { localStorage.setItem(`gs_collapsed_${slug}_${node.id}`, "0"); } catch { /* optional browser preference */ }
      setContinuing(false); await onNavigate(result.id);
    }
  }
  return <section className="node-tracker" aria-label={t("tracker.heading")} aria-busy={busy}>
    {(previous || node.continued_from || next) && <div className="toolbar version-links">
      <strong>{t("tracker.version", { n: node.version || 1 })}</strong>
      {previous ? <button className="btn btn-ghost" onClick={() => onNavigate(previous.id)}>{t("tracker.previous")}: {previous.title}</button>
        : node.continued_from && <small>{t("tracker.previousUnavailable")}</small>}
      {next && <button className="btn btn-ghost" onClick={() => onNavigate(next.id)}>{t("tracker.next")}: {next.title}</button>}
    </div>}
    <div className="toolbar">
      <strong>{t("tracker.heading")}</strong>
      {p.enabled && <ProgressMeter percent={p.percent} label={t("tracker.nodeProgress", { title: node.title })} />}
      {!enabled ? <button className="btn btn-ghost" disabled={busy} onClick={() => change({ operation: "enable" })}>{t("tracker.enable")}</button>
        : <button className="btn btn-ghost" disabled={busy} onClick={() => change({ operation: "disable" })} title={t("tracker.disableHint")}>{t("tracker.disable")}</button>}
    </div>
    {!enabled && <small className="muted">{t("tracker.optionalHint")}</small>}
    {enabled && <>
      <p className="muted tracker-hint">{closed ? t("tracker.manuallyClosed") : p.total ? t("tracker.taskCount", { done: p.done, total: p.total }) : t("tracker.empty")}</p>
      {p.total > 0 && <ul className="tracker-tasks">{p.tasks.map((task) => <li key={task.id} className={task.done ? "is-done" : ""}>
        <label><input type="checkbox" checked={pendingTask?.id === task.id ? pendingTask.done : task.done} disabled={busy || closed} onChange={(e) => checkTask(task.id, e.target.checked)} />
          <span>{task.kind === "milestone" && <small className="milestone-tag">◆ {t("tracker.milestone")}</small>}{task.title}</span></label>
        {!closed && <><button className="btn btn-ghost" disabled={busy} aria-label={`${t("tracker.rename")}: ${task.title}`} onClick={() => { setEditing(task.id); setEditTitle(task.title); }}>✎</button>
          <button className="btn btn-ghost" disabled={busy} aria-label={`${t("tracker.remove")}: ${task.title}`} onClick={() => change({ operation: "remove", taskId: task.id })}>×</button></>}
      </li>)}</ul>}
      {!closed && <form className="toolbar tracker-add" onSubmit={addTask}>
        <input ref={addInput} className="field" value={taskTitle} onChange={(e) => { setTaskTitle(e.target.value); addId.current = null; }} placeholder={t("tracker.newTask")} aria-label={t("tracker.newTask")} maxLength={500} disabled={busy} required />
        <select className="field" aria-label={t("tracker.taskKind")} value={kind} disabled={busy} onChange={(e) => { setKind(e.target.value); addId.current = null; }}><option value="task">{t("tracker.task")}</option><option value="milestone">{t("tracker.milestone")}</option></select>
        <button className="btn" disabled={busy || !taskTitle.trim() || p.total >= 200}>{t("tracker.add")}</button>
        {p.total >= 200 && <small>{t("tracker.limit")}</small>}
      </form>}
      <div className="toolbar tracker-actions">
        <button className="btn" disabled={busy} onClick={() => change({ operation: closed ? "reopen" : "complete" })}>{closed ? t("tracker.reopen") : t("tracker.complete")}</button>
        {p.complete && !next && <button className="btn btn-primary" disabled={busy} onClick={openContinue}>{t("tracker.continue")}</button>}
        {!closed && p.complete && <small>{t("tracker.allDone")}</small>}
      </div>
    </>}
    {!enabled && p.complete && !next && <button className="btn" disabled={busy} onClick={openContinue}>{t("tracker.continue")}</button>}
    {editing && <Dialog title={t("tracker.rename")} onClose={() => { if (!busy) setEditing(null); }}><form onSubmit={renameTask}>
      {error && <p role="alert" className="error">{error}</p>}
      <label>{t("tracker.taskTitle")}<input className="field" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={500} required disabled={busy} autoFocus /></label>
      <button className="btn btn-primary" disabled={busy || !editTitle.trim()}>{t("qol.save")}</button>
    </form></Dialog>}
    {continuing && <Dialog title={t("tracker.continue")} onClose={() => { if (!busy) setContinuing(false); }}><form onSubmit={continueVersion}>
      {error && <p role="alert" className="error">{error}</p>}
      <p>{t("tracker.continueHint")}</p>
      <label>{t("tracker.versionTitle")}<input className="field" value={versionTitle} onChange={(e) => setVersionTitle(e.target.value)} maxLength={500} required disabled={busy} autoFocus /></label>
      {!!p.total && <label className="tracker-copy"><input type="checkbox" checked={carryTasks} onChange={(e) => setCarryTasks(e.target.checked)} disabled={busy} />{t("tracker.carryTasks")}</label>}
      <button className="btn btn-primary" disabled={busy || !versionTitle.trim()}>{t("tracker.createVersion")}</button>
    </form></Dialog>}
  </section>;
}
