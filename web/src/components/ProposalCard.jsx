import { useState } from "react";
import { api } from "../api.js";
import { useT } from "../i18n/index.jsx";
import { errorText } from "../ui.js";
import { flushAll } from "../useAutosave.js";
import ChangesPreview from "./ChangesPreview.jsx";

export default function ProposalCard({ proposal, action, discarded, onUpdate, onChanged }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function apply(undo = false) {
    setBusy(true); setError("");
    try {
      await flushAll();
      if (undo) { await api.undoAction(proposal.slug, action.id); onUpdate({ action: { ...action, undone: true } }); }
      else { const r = await api.applyProposal(proposal.slug, proposal.id); onUpdate({ action: r.action }); }
      await onChanged?.();
    } catch (e) { setError(errorText(e, t)); } finally { setBusy(false); }
  }
  return <div className="proposal-card action-card"><strong>{t("qol.preview")}</strong><ChangesPreview changes={proposal.changes} />
    {error && <div className="error" role="alert">{error}</div>}
    {discarded ? <small className="muted">{t("qol.discard")}</small> : action ? <div className="toolbar"><small>{t(`qol.${action.undone ? "undone" : "applied"}`)}</small>{!action.undone && <button className="btn" disabled={busy} onClick={() => apply(true)}>{t("qol.undo")}</button>}</div> : <div className="toolbar"><button className="btn btn-primary" disabled={busy} onClick={() => apply()}>{t("qol.apply")}</button><button className="btn btn-ghost" disabled={busy} onClick={() => onUpdate({ discarded: true })}>{t("qol.discard")}</button></div>}
  </div>;
}
