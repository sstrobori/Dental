"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ConfirmationModal from "@/components/ConfirmationModal";
import RequiredMark from "@/components/RequiredMark";

type Reason = {
  id: string;
  name: string;
  note: string | null;
  active: boolean;
  allow_walk_in: boolean;
  allow_online: boolean;
  sort_order: number;
};

const FIELD_CLASS = "min-h-11 w-full rounded-xl border border-[#E4D5F6] bg-white px-3 py-2 text-sm text-[#2E1747] outline-none transition placeholder:text-[#9B8FA6] focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]";
const SMALL_BUTTON = "min-h-10 rounded-xl border border-[#D8C5EC] bg-white px-3 py-2 text-xs font-semibold text-[#5A2E8A] transition hover:bg-[#F8F3FF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCAF4] disabled:opacity-40";

// Common dental reasons a clinic can add with one click.
const SUGGESTIONS = [
  "Oral prophylaxis (cleaning)", "Tooth extraction", "Filling", "Root canal", "Crown or bridge", "Dentures",
  "Teeth whitening", "Braces adjustment", "Orthodontic consultation", "Dental X-ray", "Follow-up", "Emergency",
];

export default function VisitReasonSettings({ clinicId, isOwner }: { clinicId: string; isOwner: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [requireReason, setRequireReason] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  // form: "" = closed, "new" = adding, otherwise the id being edited
  const [editing, setEditing] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [walkIn, setWalkIn] = useState(true);
  const [online, setOnline] = useState(true);
  const [active, setActive] = useState(true);
  const [reasonToDelete, setReasonToDelete] = useState<Reason | null>(null);

  const load = useCallback(async () => {
    const [r, c] = await Promise.all([
      supabase.from("visit_reasons").select("*").eq("clinic_id", clinicId).order("sort_order"),
      supabase.from("clinics").select("require_visit_reason").eq("id", clinicId).single(),
    ]);
    if (r.error) setError(r.error.message);
    setReasons((r.data ?? []) as Reason[]);
    setRequireReason(Boolean(c.data?.require_visit_reason));
    setLoaded(true);
  }, [supabase, clinicId]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(kickoff);
  }, [load]);

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>, success?: string) {
    if (!isOwner || busy) return false;
    setError(""); setMsg(""); setBusy(true);
    try {
      const { error } = await action();
      if (error) { setError(error.message); return false; }
      if (success) setMsg(success);
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  function openNew() {
    setEditing("new"); setName(""); setNote(""); setWalkIn(true); setOnline(true); setActive(true);
  }

  function openEdit(r: Reason) {
    setEditing(r.id); setName(r.name); setNote(r.note ?? ""); setWalkIn(r.allow_walk_in); setOnline(r.allow_online); setActive(r.active);
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter a name for the reason.");
    const ok = await run(
      () => supabase.rpc("save_visit_reason", {
        p_clinic_id: clinicId, p_id: editing === "new" ? null : editing, p_name: name, p_note: note,
        p_allow_walk_in: walkIn, p_allow_online: online, p_active: active,
      }),
      editing === "new" ? "Reason added." : "Reason saved.",
    );
    if (ok) setEditing("");
  }

  function quickAdd(label: string) {
    return run(
      () => supabase.rpc("save_visit_reason", {
        p_clinic_id: clinicId, p_id: null, p_name: label, p_note: "",
        p_allow_walk_in: true, p_allow_online: true, p_active: true,
      }),
      `"${label}" added.`,
    );
  }

  function toggleActive(r: Reason) {
    return run(
      () => supabase.rpc("save_visit_reason", {
        p_clinic_id: clinicId, p_id: r.id, p_name: r.name, p_note: r.note ?? "",
        p_allow_walk_in: r.allow_walk_in, p_allow_online: r.allow_online, p_active: !r.active,
      }),
      r.active ? `"${r.name}" is now hidden from patients.` : `"${r.name}" is visible again.`,
    );
  }

  async function remove() {
    if (!reasonToDelete) return;
    const reason = reasonToDelete;
    const ok = await run(() => supabase.rpc("delete_visit_reason", { p_id: reason.id }), `"${reason.name}" deleted.`);
    if (ok) setReasonToDelete(null);
  }

  function saveRequire(next: boolean) {
    setRequireReason(next);
    return run(
      () => supabase.rpc("update_intake_settings", { p_clinic_id: clinicId, p_require_reason: next }),
      next ? "Patients must now choose a reason." : "Choosing a reason is now optional.",
    );
  }

  const existing = new Set(reasons.map((r) => r.name.toLowerCase()));
  const suggestions = SUGGESTIONS.filter((s) => !existing.has(s.toLowerCase()));

  if (!loaded) return <p role="status" className="rounded-2xl border border-[#E4D5F6] bg-white p-5 text-sm text-[#6F647A]">Loading visit reasons...</p>;

  return (
    <div className="flex flex-col gap-5">
      {!isOwner && <p className="rounded-xl bg-[#FAF8FF] p-3 text-sm text-[#6F647A]">Only the clinic owner can change visit reasons. You can see the current list below.</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
      {msg && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{msg}</p>}

      <section className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">
        <label className="flex items-start gap-3 text-sm font-semibold text-[#49365E]">
          <input className="mt-0.5 size-5 accent-[#6D3AA8]" type="checkbox" checked={requireReason} disabled={!isOwner || busy}
            onChange={(e) => saveRequire(e.target.checked)} />
          <span>
            Patients must choose a reason
            <span className="mt-1 block text-xs font-normal text-[#80748B]">
              When on, joining the queue or booking online is not possible without picking a reason. Staff forms are not affected.
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#2E1747]">Your visit reasons</h2>
            <p className="mt-1 text-sm text-[#6F647A]">Patients see these in the order shown. Use the arrows to reorder.</p>
          </div>
          <button type="button" onClick={openNew} disabled={!isOwner || busy}
            className="min-h-11 rounded-xl bg-[#6D3AA8] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#572C87] disabled:opacity-50">
            Add a reason
          </button>
        </div>

        {editing && (
          <form onSubmit={saveForm} className="mt-5 flex flex-col gap-4 rounded-2xl border border-[#CDB8E5] bg-[#FCFAFF] p-4">
            <h3 className="font-bold text-[#2E1747]">{editing === "new" ? "New reason" : "Edit reason"}</h3>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#49365E]"><span>Name <RequiredMark /></span>
              <input required className={FIELD_CLASS} maxLength={40} placeholder="Example: Tooth extraction" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#49365E]">Note for patients <span className="text-xs font-normal text-[#80748B]">Optional, shown when they pick this reason</span>
              <textarea className={`${FIELD_CLASS} min-h-24 resize-y`} rows={3} maxLength={200}
                placeholder="Example: Please avoid eating for 2 hours before this visit."
                value={note} onChange={(e) => setNote(e.target.value)} />
              <span className="text-xs font-normal text-[#80748B]">{note.length}/200</span>
            </label>
            <fieldset className="flex flex-col gap-2 text-sm font-semibold text-[#49365E]">
              <legend className="mb-1">Where patients can choose it</legend>
              <label className="flex items-center gap-3"><input className="size-5 accent-[#6D3AA8]" type="checkbox" checked={walkIn} onChange={(e) => setWalkIn(e.target.checked)} />Walk-in queue</label>
              <label className="flex items-center gap-3"><input className="size-5 accent-[#6D3AA8]" type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} />Online booking</label>
              <p className="text-xs font-normal text-[#80748B]">Front desk staff can always use any visible reason.</p>
            </fieldset>
            <label className="flex items-center gap-3 text-sm font-semibold text-[#49365E]">
              <input className="size-5 accent-[#6D3AA8]" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Visible (turn off to hide it without deleting)
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button disabled={busy} className="min-h-11 rounded-xl bg-[#6D3AA8] px-5 py-2 font-bold text-white hover:bg-[#572C87] disabled:opacity-50">{busy ? "Saving..." : "Save reason"}</button>
              <button type="button" onClick={() => setEditing("")} className="min-h-11 rounded-xl border border-[#D8C5EC] bg-white px-5 py-2 font-semibold text-[#5A2E8A]">Cancel</button>
            </div>
          </form>
        )}

        <ul className="mt-5 flex flex-col gap-3">
          {reasons.length === 0 && (
            <li className="rounded-xl bg-[#FAF8FF] p-5 text-center text-sm text-[#6F647A]">
              No reasons yet. Patients will not be asked for a reason. Add one above or pick from the suggestions below.
            </li>
          )}
          {reasons.map((r, i) => {
            const staffOnly = !r.allow_walk_in && !r.allow_online;
            return (
              <li key={r.id} className={`rounded-2xl border p-4 text-sm ${r.active ? "border-[#E4D5F6] bg-[#FCFAFF]" : "border-[#E9E4EF] bg-[#F7F5F9] opacity-80"}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-[#2E1747]">{r.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold">
                      {!r.active && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-700">Hidden</span>}
                      {r.active && staffOnly && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">Staff only</span>}
                      {r.active && r.allow_walk_in && <span className="rounded-full bg-[#F2EAFF] px-2 py-0.5 text-[#6D3AA8]">Walk-in</span>}
                      {r.active && r.allow_online && <span className="rounded-full bg-[#F2EAFF] px-2 py-0.5 text-[#6D3AA8]">Online</span>}
                    </div>
                    {r.note && <p className="mt-2 break-words text-[#6F647A]">{r.note}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" aria-label={`Move ${r.name} up`} disabled={!isOwner || busy || i === 0}
                      onClick={() => run(() => supabase.rpc("move_visit_reason", { p_id: r.id, p_direction: "up" }))} className={SMALL_BUTTON}>↑</button>
                    <button type="button" aria-label={`Move ${r.name} down`} disabled={!isOwner || busy || i === reasons.length - 1}
                      onClick={() => run(() => supabase.rpc("move_visit_reason", { p_id: r.id, p_direction: "down" }))} className={SMALL_BUTTON}>↓</button>
                    <button type="button" disabled={!isOwner || busy} onClick={() => openEdit(r)} className={SMALL_BUTTON}>Edit</button>
                    <button type="button" disabled={!isOwner || busy} onClick={() => toggleActive(r)} className={SMALL_BUTTON}>{r.active ? "Hide" : "Show"}</button>
                    <button type="button" disabled={!isOwner || busy} onClick={() => { setError(""); setReasonToDelete(r); }}
                      className="min-h-10 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-40">Delete</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {suggestions.length > 0 && (
        <section className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-[#2E1747]">Common dental reasons</h2>
          <p className="mt-1 text-sm text-[#6F647A]">Tap one to add it. You can edit or hide it afterward.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} type="button" disabled={!isOwner || busy} onClick={() => quickAdd(s)}
                className="min-h-10 rounded-full border border-[#D8C5EC] bg-white px-4 py-2 text-xs font-semibold text-[#5A2E8A] transition hover:bg-[#F8F3FF] disabled:opacity-40">
                + {s}
              </button>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs leading-5 text-[#80748B]">
        Renaming a reason updates the deposit rule that uses it. Past visits and appointments keep the reason they were saved with.
      </p>
      <ConfirmationModal
        open={!!reasonToDelete}
        title={`Delete “${reasonToDelete?.name ?? "this reason"}”?`}
        description="Past visits and appointments will keep the saved text, but this reason will be removed from the clinic’s list. If you only want to stop offering it, choose Hide instead."
        confirmLabel="Delete reason"
        cancelLabel="Keep reason"
        busy={busy}
        busyLabel="Deleting…"
        tone="danger"
        error={reasonToDelete ? error : ""}
        onCancel={() => {
          if (!busy) setReasonToDelete(null);
        }}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
