"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayManila } from "@/lib/today";
import Analytics from "./Analytics";

type Report = {
  served: number;
  walk_in_served: number;
  appointment_served: number;
  returning_served: number;
  left_queue: number;
  avg_wait_minutes: number | null;
  appts_scheduled: number;
  appts_completed: number;
  appts_no_show: number;
  appts_cancelled: number;
  appts_confirmed: number;
  appts_late_changes: number;
};

type ReportRow = { label: string; value: string | number };

const count = (n: number) => Number(n).toLocaleString("en-PH");
const FIELD_CLASS = "min-h-11 w-full rounded-xl border border-[#E4D5F6] bg-white px-3 py-2 text-sm font-medium text-[#2E1747] outline-none transition focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]";

function DetailGroup({ title, rows }: { title: string; rows: ReportRow[] }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-2 text-sm font-bold text-[#49365E]">{title}</h3>
      <dl className="divide-y divide-[#F0EAF7] rounded-xl border border-[#F0EAF7] bg-[#FCFAFF] px-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-3 text-sm">
            <dt className="min-w-0 text-[#6F647A]">{row.label}</dt>
            <dd className="shrink-0 font-semibold tabular-nums text-[#2E1747]">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function ReportsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [clinicId, setClinicId] = useState("");
  const [month, setMonth] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const kickoff = window.setTimeout(async () => {
      setMonth(todayManila().slice(0, 7));
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) { setLoaded(true); return; }
      const { data, error: staffError } = await supabase
        .from("clinic_staff").select("clinic_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (cancelled) return;
      if (staffError) setError(staffError.message);
      if (data) setClinicId(data.clinic_id);
      setLoaded(true);
    }, 0);
    return () => { cancelled = true; window.clearTimeout(kickoff); };
  }, [supabase]);

  const load = useCallback(async () => {
    if (!clinicId || !month) return;
    setError("");
    setReportLoading(true);
    const { data, error: queryError } = await supabase.rpc("monthly_report", {
      p_clinic_id: clinicId,
      p_month: `${month}-01`,
    });
    if (queryError) {
      setReport(null);
      setError(queryError.message);
    } else {
      setReport(data as Report);
    }
    setReportLoading(false);
  }, [supabase, clinicId, month]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(kickoff);
  }, [load]);

  const monthLabel = month
    ? new Date(`${month}-01T12:00:00+08:00`).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" })
    : "Selected month";

  return (
    <main className="w-full px-4 pb-10 text-[#2E1747] sm:px-6 lg:px-8">

      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}
      {!loaded && <p role="status" className="mt-5 rounded-2xl border border-[#E4D5F6] bg-white p-5 text-sm text-[#756581]">Loading report…</p>}

      {/* Visit trends on the left; monthly snapshot and detailed activity on the right. */}
      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,1fr)] xl:items-start">
        <div className="min-w-0">
          {clinicId && <Analytics clinicId={clinicId} />}
        </div>

        <aside className="min-w-0 space-y-5" aria-label="Monthly report">

          {/* Same outer dimensions and input styling as the Visit trends filters. */}
          <div className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-5 xl:min-h-[126px]">
            <label className="flex w-full flex-col gap-1.5 text-xs font-bold text-[#49365E]">
              Report month
              <input type="month" className={FIELD_CLASS} value={month} onChange={(e) => setMonth(e.target.value)} />
            </label>
          </div>

          {reportLoading && <p role="status" className="rounded-2xl border border-[#E4D5F6] bg-white p-5 text-sm text-[#756581]">Loading monthly snapshot…</p>}

          {report && !reportLoading && (
            <>
              <section aria-labelledby="monthly-overview-heading" className="overflow-hidden rounded-2xl border border-[#E4D5F6] bg-white p-5 shadow-sm sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#8B5CB5]">Monthly overview</p>
                <h3 id="monthly-overview-heading" className="mt-1 text-xl font-bold">{monthLabel}</h3>
                <p className="mt-3 text-sm leading-7 text-[#6F647A]">
                  The clinic served <strong className="font-bold text-[#2E1747]">{count(report.served)} patients</strong>,
                  completed <strong className="font-bold text-[#2E1747]">{count(report.appts_completed)} appointments</strong>, and
                  recorded an average wait of <strong className="font-bold text-[#2E1747]">{report.avg_wait_minutes === null ? "no available data" : `${report.avg_wait_minutes} minutes`}</strong>.
                </p>
              </section>

              {/* Details are always shown: no drawer, accordion, or extra click. */}
              <section aria-labelledby="activity-heading" className="overflow-hidden rounded-2xl border border-[#E4D5F6] bg-white p-5 shadow-sm sm:p-6">
                <h3 id="activity-heading" className="text-lg font-bold tracking-tight">Detailed monthly activity</h3>
                <p className="mt-1 text-xs leading-5 text-[#80748B]">Patient visits, wait times, and appointment outcomes for {monthLabel}.</p>
                <div className="mt-5 grid gap-5">
                  <DetailGroup title="Patient visits and queue" rows={[
                    { label: "Patients served", value: count(report.served) },
                    { label: "Walk-ins served", value: count(report.walk_in_served) },
                    { label: "From appointments", value: count(report.appointment_served) },
                    { label: "Returning patients", value: count(report.returning_served) },
                    { label: "Left the queue", value: count(report.left_queue) },
                    { label: "Average wait", value: report.avg_wait_minutes === null ? "—" : `${report.avg_wait_minutes} min` },
                  ]} />
                  <DetailGroup title="Appointment outcomes" rows={[
                    { label: "Scheduled", value: count(report.appts_scheduled) },
                    { label: "Completed", value: count(report.appts_completed) },
                    { label: "No-shows", value: count(report.appts_no_show) },
                    { label: "Cancelled", value: count(report.appts_cancelled) },
                    { label: "Confirmed", value: count(report.appts_confirmed) },
                    { label: "Late changes", value: count(report.appts_late_changes) },
                  ]} />
                </div>
              </section>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
