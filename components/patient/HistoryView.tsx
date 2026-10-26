"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/today";

type Row = { kind: string; happened_at: string; clinic: string; person: string; reason: string | null; status: string };
type Profile = {
  patient_id: string; clinic: string; person: string; visit_count: number;
  last_visit_at: string | null; link_status: "linked" | "pending";
};

const STATUS: Record<string, string> = {
  served: "Seen", completed: "Seen", no_show: "Missed", cancelled: "Cancelled", skipped: "Skipped",
  waiting: "In line", called: "Called", booked: "Booked", confirmed: "Confirmed", arrived: "Checked in",
};

function statusClass(status: string): string {
  if (status === "served" || status === "completed" || status === "confirmed") return "bg-emerald-50 text-emerald-700";
  if (status === "no_show" || status === "cancelled") return "bg-red-50 text-red-700";
  if (status === "waiting" || status === "called" || status === "arrived") return "bg-[#EDE3F8] text-[#5C327F]";
  return "bg-slate-100 text-slate-600";
}

export default function HistoryView({
  name, email, onSignOut,
}: { name: string | null; email: string | null; onSignOut: () => void }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [h, p] = await Promise.all([supabase.rpc("my_history"), supabase.rpc("my_profiles")]);
    if (h.error) setError(h.error.message);
    setRows((h.data ?? []) as Row[]);
    setProfiles((p.data ?? []) as Profile[]);
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(kickoff);
  }, [load]);

  async function unlink(id: string, pending: boolean) {
    const text = pending ? "Cancel this request?" : "Remove this person from your account? Their visits stop appearing in your history.";
    if (!window.confirm(text)) return;
    await supabase.rpc("unlink_profile", { p_patient_id: id });
    load();
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8B5CB5]">Your account</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#2E1747] sm:text-3xl">Hi, {name ?? "there"}</h2>
          <p className="mt-1 break-all text-sm text-[#6F647A]">{email}</p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="min-h-11 w-full rounded-xl border border-[#D7C4EA] bg-white px-4 py-2.5 text-sm font-semibold text-[#5C327F] transition hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCDEF] sm:w-auto"
        >
          Sign out
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <section aria-labelledby="people-heading" className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B5CB5]">Profiles</p>
          <h3 id="people-heading" className="mt-1 text-lg font-bold text-[#2E1747]">People on your account</h3>
          <p className="mt-1 text-sm text-[#6F647A]">Family members linked to this clinic account.</p>

          {!loaded && <p className="mt-4 rounded-xl bg-[#FAF8FF] p-4 text-sm text-[#6F647A]">Loading profiles…</p>}
          {loaded && profiles.length === 0 && (
            <p className="mt-4 rounded-xl bg-[#FAF8FF] p-4 text-sm text-[#6F647A]">
              No one yet. Join the queue or book a visit while signed in, and it will be saved here.
            </p>
          )}
          <ul className="mt-4 flex flex-col gap-3">
            {profiles.map((p) => (
              <li key={`${p.patient_id}-${p.link_status}`} className="flex flex-col gap-3 rounded-xl border border-[#E4D5F6] bg-[#FCFAFF] p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-bold text-[#2E1747]">{p.person}</p>
                  <p className="mt-0.5 text-[#6F647A]">{p.clinic}</p>
                  {p.link_status === "pending" ? (
                    <p className="mt-2 text-sm font-medium text-amber-700">Waiting for front desk verification</p>
                  ) : (
                    <p className="mt-2 text-xs text-[#80748B]">{p.visit_count} visits{p.last_visit_at ? ` · Last visit ${new Date(p.last_visit_at).toLocaleDateString("en-PH")}` : ""}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => unlink(p.patient_id, p.link_status === "pending")}
                  className="min-h-11 w-full shrink-0 rounded-xl border border-[#D7C4EA] bg-white px-4 py-2 text-sm font-semibold text-[#5C327F] transition hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCDEF] sm:w-auto"
                >
                  {p.link_status === "pending" ? "Cancel request" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="history-heading" className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B5CB5]">Records</p>
          <h3 id="history-heading" className="mt-1 text-lg font-bold text-[#2E1747]">Visit history</h3>
          <p className="mt-1 text-sm text-[#6F647A]">Your recent appointments and walk-in visits.</p>

          {!loaded && <p className="mt-4 rounded-xl bg-[#FAF8FF] p-4 text-sm text-[#6F647A]">Loading visit history…</p>}
          {loaded && rows.length === 0 && <p className="mt-4 rounded-xl bg-[#FAF8FF] p-4 text-sm text-[#6F647A]">Nothing here yet.</p>}
          <ul className="mt-4 flex flex-col gap-3">
            {rows.map((r, i) => (
              <li key={i} className="rounded-xl border border-[#E4D5F6] bg-[#FCFAFF] p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-[#2E1747]">{r.kind === "appointment" ? "Appointment" : "Walk-in visit"}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(r.status)}`}>{STATUS[r.status] ?? r.status}</span>
                </div>
                <p className="mt-2 font-medium text-[#5C327F]">{formatDateTime(r.happened_at)}</p>
                <p className="mt-1 text-[#6F647A]">{r.clinic}</p>
                <p className="mt-1 text-[#6F647A]">{r.person}{r.reason ? ` · ${r.reason}` : ""}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
