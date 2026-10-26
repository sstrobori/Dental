"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayManila } from "@/lib/today";
import Analytics from "./Analytics";

type Report = {
  served: number; walk_in_served: number; appointment_served: number; returning_served: number;
  left_queue: number; avg_wait_minutes: number | null;
  appts_scheduled: number; appts_completed: number; appts_no_show: number; appts_cancelled: number;
  appts_confirmed: number; appts_late_changes: number;
  waitlist_filled: number;
  deposits_held: number; deposits_kept: number; deposits_refunded: number; deposits_unpaid: number;
  avg_visit_fee: number;
};

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[#e4d5f6] bg-white p-4 shadow-sm sm:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b5b98]">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#2e1747] sm:text-3xl">{value}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 mt-7 text-lg font-bold text-[#2e1747] sm:text-xl">{children}</h2>;
}

const peso = (n: number) => `₱${Number(n).toLocaleString("en-PH")}`;

export default function ReportsPage() {
  const supabase = createClient();
  const [clinicId, setClinicId] = useState("");
  const [month, setMonth] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const kickoff = window.setTimeout(async () => {
      setMonth(todayManila().slice(0, 7));
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoaded(true); return; }
      const { data } = await supabase
        .from("clinic_staff").select("clinic_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (data) setClinicId(data.clinic_id);
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(kickoff);
  }, [supabase]);

  const load = useCallback(async () => {
    if (!clinicId || !month) return;
    setError("");
    const { data, error } = await supabase.rpc("monthly_report", { p_clinic_id: clinicId, p_month: `${month}-01` });
    if (error) { setReport(null); return setError(error.message); }
    setReport(data as Report);
  }, [supabase, clinicId, month]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(kickoff);
  }, [load]);

  const estimate = report ? report.waitlist_filled * report.avg_visit_fee + Number(report.deposits_kept) : 0;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7b4bb3]">Performance</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#2e1747] sm:text-3xl">Reports and analytics</h1>
        </div>
        <label className="flex w-full flex-col gap-1.5 text-sm font-semibold text-[#49355f] sm:w-48">
          Report month
          <input
            type="month"
            className="min-h-12 rounded-xl border border-[#d9c8ed] bg-white px-3 text-base text-[#2e1747] outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#eee5f8]"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </header>

      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}
      {!loaded && <p role="status" className="mt-5 rounded-2xl border border-[#e4d5f6] bg-white p-5 text-sm text-[#756581]">Loading report…</p>}

      {report && (
        <>
          <SectionTitle>Queue</SectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Card label="Patients served" value={report.served} />
            <Card label="Walk-ins served" value={report.walk_in_served} />
            <Card label="From appointments" value={report.appointment_served} />
            <Card label="Returning patients" value={report.returning_served} />
            <Card label="Left the queue" value={report.left_queue} />
            <Card label="Average wait" value={report.avg_wait_minutes === null ? "—" : `${report.avg_wait_minutes} min`} />
          </div>

          <SectionTitle>Appointments</SectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Card label="Scheduled" value={report.appts_scheduled} />
            <Card label="Completed" value={report.appts_completed} />
            <Card label="No-shows" value={report.appts_no_show} />
            <Card label="Cancelled" value={report.appts_cancelled} />
            <Card label="Confirmed" value={report.appts_confirmed} />
            <Card label="Late changes" value={report.appts_late_changes} />
          </div>

          <SectionTitle>Waitlist and deposits</SectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Card label="Waitlist slots filled" value={report.waitlist_filled} />
            <Card label="Deposits held" value={peso(report.deposits_held)} />
            <Card label="Deposits kept" value={peso(report.deposits_kept)} />
            <Card label="Deposits refunded" value={peso(report.deposits_refunded)} />
            <Card label="Deposits unpaid" value={report.deposits_unpaid} />
          </div>

          <section className="mt-6 overflow-hidden rounded-2xl border border-[#d8c5ed] bg-gradient-to-br from-[#6d3aa8] to-[#4c246f] p-5 text-white shadow-[0_18px_40px_rgba(76,36,111,0.18)] sm:p-6">
            <p className="text-sm font-semibold text-white/80">Estimated money protected this month</p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{peso(estimate)}</p>
            <p className="mt-3 max-w-3xl text-xs leading-5 text-white/75">
              {report.waitlist_filled} refilled slots × {peso(report.avg_visit_fee)} average fee + {peso(report.deposits_kept)} deposits kept.
              This counts only what the app can measure and does not claim no-shows were prevented. Set the average fee under Appointments.
            </p>
          </section>
        </>
      )}

      {clinicId && <Analytics clinicId={clinicId} />}
    </div>
  );
}
