"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ConfirmationModal from "@/components/ConfirmationModal";

type Patient = {
  id: string;
  name: string;
  phone: string | null;
  is_minor: boolean;
  guardian_name: string | null;
  visit_count: number;
  last_visit_at: string;
  recall_contacted_at: string | null;
};

export default function FollowUpsPage() {
  const supabase = createClient();
  const [clinicId, setClinicId] = useState("");
  const [months, setMonths] = useState(6);
  const [showContacted, setShowContacted] = useState(false);
  const [rows, setRows] = useState<Patient[]>([]);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(0);
  const [patientToMark, setPatientToMark] = useState<Patient | null>(null);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState("");

  useEffect(() => {
    const kickoff = window.setTimeout(() => setClock(Date.now()), 0);
    const timer = window.setInterval(() => setClock(Date.now()), 60000);
    return () => { window.clearTimeout(kickoff); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("clinic_staff").select("clinic_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (data) setClinicId(data.clinic_id);
    })();
  }, [supabase]);

  const load = useCallback(async () => {
    if (!clinicId) return;
    const cutoff = new Date(Date.now() - months * 30.44 * 86400000).toISOString();
    const { data, error } = await supabase
      .from("patients").select("*").eq("clinic_id", clinicId)
      .not("last_visit_at", "is", null).lt("last_visit_at", cutoff)
      .order("last_visit_at", { ascending: true }).limit(300);
    if (error) return setError(error.message);
    setRows((data ?? []) as Patient[]);
  }, [supabase, clinicId, months]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(kickoff);
  }, [load]);

  async function markContacted() {
    if (!patientToMark || marking) return;
    setMarking(true);
    setMarkError("");
    const { error } = await supabase.rpc("mark_contacted", { p_patient_id: patientToMark.id });
    setMarking(false);
    if (error) return setMarkError(error.message);
    setPatientToMark(null);
    await load();
  }

  function recentlyContacted(p: Patient) {
    return clock > 0 && !!p.recall_contacted_at && clock - new Date(p.recall_contacted_at).getTime() < 30 * 86400000;
  }

  const shown = rows.filter((p) => showContacted || !recentlyContacted(p));

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b5cb5]">Patient recall</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Due for a visit</h1>
      </header>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#756581]">
        Patients who have not been seen for a while. Call them and press Mark contacted so they are not listed again for 30 days.
      </p>

      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}

      <div className="admin-card mt-5 grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
        <label className="flex flex-col gap-2 text-sm font-semibold text-[#49355f]">Not seen for
          <select className="min-h-11 border px-3 py-2 font-normal" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[3, 6, 9, 12].map((m) => <option key={m} value={m}>{m} months</option>)}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-3 rounded-xl bg-[#faf8ff] px-4 text-sm font-semibold text-[#49355f]">
          <input type="checkbox" className="h-5 w-5" checked={showContacted} onChange={(e) => setShowContacted(e.target.checked)} />
          Show recently contacted
        </label>
        <span className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#f2eaff] px-4 text-sm font-bold text-[#6d3aa8]">{shown.length} patients</span>
      </div>

      <ul className="mt-5 flex flex-col gap-3">
        {shown.length === 0 && <li className="admin-card p-6 text-center text-sm text-[#756581]">No one is due. Patients appear here after their first completed visit.</li>}
        {shown.map((p) => (
          <li key={p.id} className="admin-card flex flex-col gap-4 p-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <span className="min-w-0">
              <span className="font-bold text-base">{p.name}</span>{p.is_minor && <span className="ml-2 rounded-full bg-[#f2eaff] px-2 py-0.5 text-xs font-semibold text-[#6d3aa8]">Child</span>}<br />
              <span className="mt-1 block break-words leading-6 text-[#756581]">
                {p.is_minor && `Guardian: ${p.guardian_name ?? "not given"} · `}
                {p.phone ? <a href={`tel:${p.phone}`} className="font-semibold text-[#6d3aa8] underline underline-offset-2">{p.phone}</a> : "no phone"}
                {` · last visit ${new Date(p.last_visit_at).toLocaleDateString("en-PH")} · ${p.visit_count} visits`}
                {p.recall_contacted_at && ` · contacted ${new Date(p.recall_contacted_at).toLocaleDateString("en-PH")}`}
              </span>
            </span>
            <button type="button" onClick={() => { setMarkError(""); setPatientToMark(p); }} className="min-h-11 w-full shrink-0 rounded-xl bg-[#6d3aa8] px-4 py-2 text-sm font-bold text-white hover:bg-[#572c87] sm:w-auto">Mark contacted</button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-5 text-[#756581]">
        Imported patients appear here only after their first visit through this app, because their earlier visit dates are not known.
      </p>
      <ConfirmationModal
        open={!!patientToMark}
        title="Mark this patient as contacted?"
        description={
          <>
            Confirm only after reaching out to <strong className="text-[#2E1747]">{patientToMark?.name}</strong>. They will be hidden from this follow-up list for 30 days.
          </>
        }
        confirmLabel="Mark contacted"
        cancelLabel="Not yet"
        busy={marking}
        busyLabel="Saving…"
        tone="primary"
        error={markError}
        onCancel={() => {
          if (marking) return;
          setPatientToMark(null);
          setMarkError("");
        }}
        onConfirm={() => void markContacted()}
      />
    </div>
  );
}
