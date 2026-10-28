"use client";

import { useEffect, useMemo, useState } from "react";
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

type ReportRow = { label: string; value: string };

const count = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("en-PH");
const FIELD_CLASS =
  "min-h-11 w-full rounded-xl border border-[#E4D5F6] bg-white px-3 py-2 text-sm font-medium text-[#2E1747] outline-none transition focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]";

function DetailGroup({ title, rows }: { title: string; rows: ReportRow[] }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-2 text-sm font-bold text-[#49365E]">{title}</h3>
      <dl className="divide-y divide-[#F0EAF7] overflow-hidden rounded-xl border border-[#F0EAF7] bg-[#FCFAFF] px-3 sm:px-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <dt className="min-w-0 text-[#6F647A]">{row.label}</dt>
            <dd className="shrink-0 font-semibold tabular-nums text-[#2E1747]">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SummaryMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[#E4D5F6] bg-[#FCFAFF] px-4 py-3.5">
      <p className="text-xs font-semibold text-[#756581]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-[#5B2E8A]">{value}</p>
      <p className="mt-0.5 text-xs text-[#80748B]">{detail}</p>
    </div>
  );
}

export default function ReportsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [clinicId, setClinicId] = useState("");
  const [month, setMonth] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [accessLoading, setAccessLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const kickoff = window.setTimeout(async () => {
      setMonth(todayManila().slice(0, 7));
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !user) {
        setError("Sign in to view clinic reports.");
        setAccessLoading(false);
        return;
      }
      const { data, error: staffError } = await supabase
        .from("clinic_staff")
        .select("clinic_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (staffError || !data?.clinic_id) {
        setError(staffError?.message ?? "No clinic is linked to your account.");
      } else {
        setClinicId(data.clinic_id);
      }
      setAccessLoading(false);
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(kickoff);
    };
  }, [supabase]);

  useEffect(() => {
    if (!clinicId || !month) return;
    let active = true;
    const kickoff = window.setTimeout(async () => {
      setReportLoading(true);
      setError("");
      const { data, error: queryError } = await supabase.rpc("monthly_report", {
        p_clinic_id: clinicId,
        p_month: `${month}-01`,
      });
      if (!active) return;
      if (queryError) {
        setReport(null);
        setError(queryError.message);
      } else {
        setReport(data as Report | null);
      }
      setReportLoading(false);
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(kickoff);
    };
  }, [supabase, clinicId, month]);

  const monthLabel = month
    ? new Date(`${month}-01T12:00:00+08:00`).toLocaleDateString("en-PH", {
        month: "long",
        year: "numeric",
        timeZone: "Asia/Manila",
      })
    : "Selected month";

  const waitLabel = report?.avg_wait_minutes == null
    ? "--"
    : `${report.avg_wait_minutes} min`;

  return (
    <main className="w-full px-4 pb-10 pt-6 text-[#2E1747] sm:px-6 sm:pt-8 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-[#756581]">View patient visits, queue performance, and appointment reports.</p>
        </div>
        <label className="flex w-full flex-col gap-1.5 text-xs font-bold text-[#49365E] sm:w-56">
          Report month
          <input
            type="month"
            className={FIELD_CLASS}
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
      </header>

      {error && (
        <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {(accessLoading || (clinicId && reportLoading)) && (
        <p role="status" className="mt-5 rounded-2xl border border-[#E4D5F6] bg-white p-4 text-sm text-[#756581]">
          Loading monthly report...
        </p>
      )}

      {report && !reportLoading && (
        <section aria-label={`${monthLabel} report summary`} className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryMetric label="Patients served" value={count(report.served)} detail="Completed queue visits" />
          <SummaryMetric label="Appointments completed" value={count(report.appts_completed)} detail="Completed appointments" />
          <SummaryMetric label="Average wait" value={waitLabel} detail="Time until called" />
        </section>
      )}

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,1fr)] xl:items-start">
        <div className="min-w-0">
          {clinicId && <Analytics clinicId={clinicId} />}
        </div>

        <aside className="min-w-0" aria-label="Monthly activity">
          {report && !reportLoading ? (
            <section className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-5">
              <div className="border-b border-[#EEE7F6] pb-4">
                <h2 className="text-lg font-bold">Monthly activity</h2>
                <p className="mt-1 text-xs text-[#756581]">{monthLabel} - detailed breakdown</p>
              </div>
              <div className="mt-4 grid gap-5">
                <DetailGroup title="Patient visits and queue" rows={[
                  { label: "Patients served", value: count(report.served) },
                  { label: "Walk-ins served", value: count(report.walk_in_served) },
                  { label: "From appointments", value: count(report.appointment_served) },
                  { label: "Returning patients", value: count(report.returning_served) },
                  { label: "Left the queue", value: count(report.left_queue) },
                  { label: "Average wait", value: waitLabel === "--" ? "--" : waitLabel },
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
          ) : (
            !accessLoading && !reportLoading && !error && (
              <div className="rounded-2xl border border-[#E4D5F6] bg-white p-5 text-sm text-[#756581]">
                No monthly activity is available for {monthLabel}.
              </div>
            )
          )}
        </aside>
      </div>
    </main>
  );
}
