"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { estimateLabel, formatDateTime } from "@/lib/today";
import AppointmentView from "@/components/patient/AppointmentView";

type Active = {
  entry_id: string; clinic_id: string; clinic: string; person: string; queue_number: number;
  status: "waiting" | "called"; people_ahead: number; est_minutes: number | null; now_serving: number | null;
};
type Profile = { patient_id: string; clinic_id: string; person: string };
type HistRow = {
  kind: string; happened_at: string; person: string; reason: string | null;
  status: string; ref_id: string; clinic_id: string;
};

const REASONS = ["Checkup", "Toothache", "Cleaning", "Braces", "Other"];

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function PatientDashboard({ clinicId, name }: { clinicId: string; name: string | null }) {
  const supabase = createClient();
  const [active, setActive] = useState<Active[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [upcoming, setUpcoming] = useState<HistRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [who, setWho] = useState("");
  const [reason, setReason] = useState("");
  const [openAppt, setOpenAppt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadActive = useCallback(async () => {
    const { data, error } = await supabase.rpc("my_active_visits");
    if (error) return;
    setActive(((data ?? []) as Active[]).filter((v) => v.clinic_id === clinicId));
  }, [supabase, clinicId]);

  const loadAll = useCallback(async () => {
    const [p, h] = await Promise.all([supabase.rpc("my_profiles"), supabase.rpc("my_history")]);
    const mine = ((p.data ?? []) as Profile[]).filter((x) => x.clinic_id === clinicId);
    setProfiles(mine);
    setWho((cur) => cur || mine[0]?.patient_id || "");
    const soon = ((h.data ?? []) as HistRow[])
      .filter((r) => r.clinic_id === clinicId && r.kind === "appointment"
        && (r.status === "booked" || r.status === "confirmed") && new Date(r.happened_at).getTime() > Date.now())
      .reverse();
    setUpcoming(soon);
    await loadActive();
    setLoaded(true);
  }, [supabase, clinicId, loadActive]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void loadAll(), 0);
    const channel = supabase
      .channel(`patient-queue-${clinicId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries", filter: `clinic_id=eq.${clinicId}` },
        () => loadActive(),
      )
      .subscribe();
    const timer = window.setInterval(loadActive, 5000);
    const onOnline = () => { void loadActive(); };
    const onVisibility = () => { if (document.visibilityState === "visible") loadActive(); };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [supabase, clinicId, loadAll, loadActive]);

  async function join() {
    setError("");
    if (!who) return;
    setBusy(true);
    const { error } = await supabase.rpc("join_queue_as_profile", { p_patient_id: who, p_reason: reason });
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    await loadAll();
    setBusy(false);
  }

  async function leave(entryId: string) {
    if (!window.confirm("Leave the queue? You will lose your place.")) return;
    await supabase.rpc("leave_queue", { p_entry_id: entryId });
    loadActive();
  }

  if (!loaded) {
    return (
      <div className="rounded-2xl border border-[#E4D5F6] bg-white p-6 text-center shadow-sm" role="status">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-[#E4D5F6] border-t-[#6D3AA8]" />
        <p className="font-medium text-[#6F647A]">Loading your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8B5CB5]">Patient dashboard</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#2E1747] sm:text-3xl">Welcome, {name ?? "there"}</h2>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-5">
          <section aria-labelledby="queue-heading" className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B5CB5]">Live status</p>
                <h3 id="queue-heading" className="mt-1 text-lg font-bold text-[#2E1747]">Your queue</h3>
              </div>
              {active.length > 0 && <span className="rounded-full bg-[#F2EAFF] px-3 py-1 text-xs font-semibold text-[#6D3AA8]">In line</span>}
            </div>

            {active.length === 0 && (
              <div className="rounded-xl bg-[#FAF8FF] p-4 text-sm text-[#6F647A]">
                You are not in the queue at the moment.
              </div>
            )}

            <div className="flex flex-col gap-3" aria-live="polite">
              {active.map((v) => {
                const called = v.status === "called";
                return (
                  <div
                    key={v.entry_id}
                    className={`flex flex-col items-center gap-2 rounded-2xl border p-5 text-center sm:p-7 ${
                      called
                        ? "border-[#6D3AA8] bg-[#6D3AA8] text-white shadow-lg shadow-purple-900/10"
                        : "border-[#DDCDEF] bg-gradient-to-br from-[#F8F3FF] to-white text-[#2E1747]"
                    }`}
                  >
                    <p className={`text-sm font-medium ${called ? "text-white/85" : "text-[#6F647A]"}`}>{v.person}</p>
                    <p className={`text-xs font-bold uppercase tracking-[0.16em] ${called ? "text-white/80" : "text-[#8B5CB5]"}`}>Your queue number</p>
                    <p className="text-[clamp(4rem,22vw,7rem)] font-extrabold leading-none tracking-tight">#{v.queue_number}</p>
                    {called ? (
                      <p className="max-w-sm text-xl font-bold">It is your turn. Please go to the front desk.</p>
                    ) : (
                      <>
                        <p className="text-lg font-bold">You are {ordinal(v.people_ahead + 1)} in line</p>
                        <p className="text-sm text-[#6F647A]">{v.people_ahead === 0 ? "No one is ahead of you." : `${v.people_ahead} ${v.people_ahead === 1 ? "person is" : "people are"} ahead of you.`}</p>
                        {v.est_minutes !== null && <p className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-[#6D3AA8] shadow-sm">{estimateLabel(v.est_minutes)}</p>}
                        <p className="max-w-sm text-xs text-[#80748B]">The estimate uses the clinic&apos;s average visit time and can change.</p>
                      </>
                    )}
                    {v.now_serving !== null && !called && <p className="text-sm font-semibold text-[#6D3AA8]">Now serving #{v.now_serving}</p>}
                    {!called && (
                      <button
                        type="button"
                        onClick={() => leave(v.entry_id)}
                        className="mt-2 min-h-11 rounded-xl border border-[#D7C4EA] bg-white px-5 py-2.5 text-sm font-semibold text-[#5C327F] transition hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCDEF]"
                      >
                        Leave the queue
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {active.length === 0 && (
            <section aria-labelledby="join-heading" className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B5CB5]">Walk-in visit</p>
              <h3 id="join-heading" className="mt-1 text-lg font-bold text-[#2E1747]">Join the queue</h3>
              <p className="mt-1 text-sm text-[#6F647A]">Choose the patient and tell the clinic what you need today.</p>

              {profiles.length === 0 ? (
                <p className="mt-4 rounded-xl bg-[#FAF8FF] p-4 text-sm text-[#6F647A]">
                  No one on your account is linked to this clinic yet. Ask the front desk for help.
                </p>
              ) : (
                <div className="mt-4 flex flex-col gap-4">
                  {profiles.length > 1 && (
                    <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#3E2854]">
                      Patient
                      <select
                        className="min-h-12 rounded-xl border border-[#DCCBED] bg-white px-3 text-base font-normal text-[#2E1747] outline-none transition focus:border-[#8B5CB5] focus:ring-4 focus:ring-[#EDE3F8]"
                        value={who}
                        onChange={(e) => setWho(e.target.value)}
                      >
                        {profiles.map((p) => <option key={p.patient_id} value={p.patient_id}>{p.person}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#3E2854]">
                    Reason for visit <span className="font-normal text-[#80748B]">(optional)</span>
                    <select
                      className="min-h-12 rounded-xl border border-[#DCCBED] bg-white px-3 text-base font-normal text-[#2E1747] outline-none transition focus:border-[#8B5CB5] focus:ring-4 focus:ring-[#EDE3F8]"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    >
                      <option value="">Select a reason</option>
                      {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={join}
                    disabled={busy}
                    aria-busy={busy}
                    className="min-h-12 rounded-xl bg-[#6D3AA8] px-5 py-3 font-bold text-white shadow-sm transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCDEF] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Joining…" : `Join as ${profiles.find((p) => p.patient_id === who)?.person ?? "me"}`}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>

        <section aria-labelledby="appointments-heading" className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B5CB5]">Your schedule</p>
          <h3 id="appointments-heading" className="mt-1 text-lg font-bold text-[#2E1747]">Upcoming appointments</h3>

          {upcoming.length === 0 ? (
            <p className="mt-4 rounded-xl bg-[#FAF8FF] p-4 text-sm text-[#6F647A]">You have no upcoming appointments.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {upcoming.map((r) => (
                <article key={r.ref_id} className="rounded-xl border border-[#E4D5F6] bg-[#FCFAFF] p-4 text-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-[#2E1747]">{formatDateTime(r.happened_at)}</p>
                      <p className="mt-1 text-[#6F647A]">{r.person}{r.reason ? ` · ${r.reason}` : ""}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenAppt(openAppt === r.ref_id ? "" : r.ref_id)}
                      aria-expanded={openAppt === r.ref_id}
                      className="min-h-11 w-full shrink-0 rounded-xl border border-[#D7C4EA] bg-white px-4 py-2 text-sm font-semibold text-[#5C327F] transition hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCDEF] sm:w-auto"
                    >
                      {openAppt === r.ref_id ? "Close details" : "View or change"}
                    </button>
                  </div>
                  {openAppt === r.ref_id && (
                    <div className="mt-4 border-t border-[#E4D5F6] pt-4">
                      <AppointmentView appointmentId={r.ref_id} />
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
