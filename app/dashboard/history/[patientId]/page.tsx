"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/today";
import { getArrivalTiming } from "@/lib/queuePolicy";

type TimelineEvent = {
  kind: "walk_in" | "appointment";
  ref_id: string;
  happened_at: string;
  queue_number: number | null;
  reason: string | null;
  status: string;
  wait_minutes: number | null;
  service_minutes: number | null;
  arrived_at: string | null;
  reschedule_count: number;
  changed_late: boolean;
  deposit_amount: number;
  deposit_status: string;
  booked_by_staff: boolean;
};

type Timeline = {
  patient: {
    id: string;
    name: string;
    phone: string | null;
    email?: string | null;
    clinic_patient_id: string | null;
    is_minor: boolean;
    guardian_name: string | null;
    has_account: boolean;
    visit_count: number;
    last_visit_at: string | null;
    imported: boolean;
    created_at: string;
  };
  grace_minutes: number;
  events: TimelineEvent[];
};

type FilterKind = "all" | "walk_in" | "appointment";
const PAGE_SIZE = 8;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS: Record<string, { label: string; style: string }> = {
  served: { label: "Completed", style: "bg-emerald-50 text-emerald-700" },
  completed: { label: "Completed", style: "bg-emerald-50 text-emerald-700" },
  no_show: { label: "No-show", style: "bg-red-50 text-red-700" },
  cancelled: { label: "Cancelled", style: "bg-slate-100 text-slate-600" },
  skipped: { label: "Skipped", style: "bg-amber-50 text-amber-800" },
  booked: { label: "Upcoming", style: "bg-[#F2EAFF] text-[#6D3AA8]" },
  confirmed: { label: "Confirmed", style: "bg-[#F2EAFF] text-[#6D3AA8]" },
  arrived: { label: "Checked in", style: "bg-blue-50 text-blue-700" },
  waiting: { label: "In line", style: "bg-blue-50 text-blue-700" },
  called: { label: "Called", style: "bg-blue-50 text-blue-700" },
};

const DEPOSIT: Record<string, string> = {
  required: "Waiting for payment",
  received: "Received",
  refunded: "Refunded",
  forfeited: "Kept by the clinic",
  waived: "Waived",
};

const fieldClass = "min-h-11 w-full rounded-xl border border-[#E4D5F6] bg-white px-3 py-2.5 text-sm font-normal text-[#2E1747] outline-none transition focus:border-[#6D3AA8] focus:ring-4 focus:ring-[#F2EAFF]";

function dayKey(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (key: string) => parts.find((part) => part.type === key)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dateLabel(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric" })
    : "Not available";
}

function arrivalText(event: TimelineEvent, grace: number): string {
  if (event.kind !== "appointment" || !event.arrived_at) return "";
  const timing = getArrivalTiming(event.happened_at, event.arrived_at, grace);
  if (timing.window === "early") return "Arrived on time or early";
  if (timing.window === "grace") {
    return `Arrived ${timing.minutesAfterStart} min after the start, within the grace period`;
  }
  return `Arrived ${timing.minutesAfterStart} min after the start, ${timing.minutesPastGrace} min past the grace period`;
}

export default function StaffPatientHistoryPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [patientEmail, setPatientEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<FilterKind>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      setTimeline(null);
      setPatientEmail(null);

      if (!UUID.test(patientId)) {
        if (active) { setError("Invalid patient link."); setLoading(false); }
        return;
      }
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !user) {
        setError("Please sign in to view clinic patient records.");
        setLoading(false);
        return;
      }
      const { data: staff, error: staffError } = await supabase
        .from("clinic_staff")
        .select("clinic_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (staffError || !staff?.clinic_id) {
        setError(staffError?.message ?? "No clinic is linked to this staff account.");
        setLoading(false);
        return;
      }

      // Verify this patient belongs to the signed-in staff member's clinic.
      const { data: allowedPatient, error: accessError } = await supabase
        .from("patients")
        .select("id")
        .eq("id", patientId)
        .eq("clinic_id", staff.clinic_id)
        .maybeSingle();
      if (!active) return;
      if (accessError || !allowedPatient) {
        setError(accessError?.message ?? "This patient was not found in your clinic.");
        setLoading(false);
        return;
      }

      const [timelineResult, emailResult] = await Promise.all([
        supabase.rpc("patient_timeline", { p_patient_id: patientId }),
        supabase.from("patients")
          .select("email")
          .eq("id", patientId)
          .eq("clinic_id", staff.clinic_id)
          .maybeSingle(),
      ]);
      if (!active) return;
      if (timelineResult.error) {
        setError(timelineResult.error.message);
      } else {
        const data = timelineResult.data as Timeline | null;
        if (!data?.patient || data.patient.id !== patientId) {
          setError("This patient's history could not be found or accessed.");
        } else {
          setTimeline(data);
          // Some older schemas do not have patients.email; the page still works.
          setPatientEmail(emailResult.error ? null : (emailResult.data?.email ?? null));
        }
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [supabase, patientId]);

  const patient = timeline?.patient;
  const events = useMemo(
    () => [...(timeline?.events ?? [])].sort((a, b) => new Date(b.happened_at).getTime() - new Date(a.happened_at).getTime()),
    [timeline]
  );
  const shown = useMemo(() => events.filter((event) =>
    (kind === "all" || event.kind === kind) &&
    (!from || dayKey(event.happened_at) >= from) &&
    (!to || dayKey(event.happened_at) <= to)
  ), [events, kind, from, to]);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = shown.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const hasFilters = kind !== "all" || from !== "" || to !== "";

  const completed = events.filter((event) => ["served", "completed"].includes(event.status)).length;
  const appointments = events.filter((event) => event.kind === "appointment").length;
  const noShows = events.filter((event) => event.status === "no_show").length;
  const cancelled = events.filter((event) => event.status === "cancelled").length;
  const lateChanges = events.filter((event) => event.changed_late).length;
  const waits = events.flatMap((event) => event.wait_minutes !== null ? [event.wait_minutes] : []);
  const avgWait = waits.length ? Math.round(waits.reduce((sum, mins) => sum + mins, 0) / waits.length) : null;
  const stats = [
    { label: "Completed", value: completed },
    { label: "Appointments", value: appointments },
    { label: "No-shows", value: noShows },
    { label: "Cancelled", value: cancelled },
    { label: "Late changes", value: lateChanges },
    { label: "Average wait", value: avgWait === null ? "—" : `${avgWait} min` },
  ];

  return (
    <main className="w-full px-4 pb-10 pt-6 text-[#2E1747] sm:px-6 sm:pt-8 lg:px-8">
      <Link href="/dashboard/history" className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[#6D3AA8] hover:underline">
        <span aria-hidden="true">←</span> Back to visit history
      </Link>

      {loading && <p role="status" className="rounded-xl border border-[#E4D5F6] bg-white p-6 text-sm text-[#756581]">Loading patient history…</p>}
      {!loading && error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>}

      {!loading && !error && patient && timeline && (
        <div className="space-y-4">
          {/* COMPACT PROFILE */}
          <section className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8B5CB5]">Patient visit history</p>
                <h1 className="mt-1 break-words text-2xl font-extrabold sm:text-3xl">{patient.name}</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                {patient.is_minor && <span className="rounded-full bg-[#F2EAFF] px-3 py-1 text-xs font-semibold text-[#6D3AA8]">Minor</span>}
                {patient.has_account && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Portal account active</span>}
              </div>
            </div>
            <dl className="mt-4 grid gap-x-5 gap-y-3 border-t border-[#F0EAF7] pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div className="min-w-0"><dt className="text-xs font-semibold text-[#756581]">Patient ID</dt><dd className="mt-1 break-all font-semibold">{patient.clinic_patient_id || "Not assigned"}</dd></div>
              <div className="min-w-0"><dt className="text-xs font-semibold text-[#756581]">Phone</dt><dd className="mt-1 break-all font-semibold">{patient.phone || "Not provided"}</dd></div>
              <div className="min-w-0"><dt className="text-xs font-semibold text-[#756581]">Email</dt><dd className="mt-1 break-all font-semibold">{patient.email || patientEmail ? <a className="text-[#6D3AA8] hover:underline" href={`mailto:${patient.email || patientEmail}`}>{patient.email || patientEmail}</a> : "Not provided"}</dd></div>
              <div><dt className="text-xs font-semibold text-[#756581]">Registered</dt><dd className="mt-1 font-semibold">{dateLabel(patient.created_at)}</dd></div>
              <div><dt className="text-xs font-semibold text-[#756581]">Last visit</dt><dd className="mt-1 font-semibold">{dateLabel(patient.last_visit_at)}</dd></div>
              {patient.is_minor && <div><dt className="text-xs font-semibold text-[#756581]">Guardian</dt><dd className="mt-1 font-semibold">{patient.guardian_name || "Not provided"}</dd></div>}
            </dl>
            {patient.imported && <p className="mt-3 rounded-xl bg-[#FAF8FF] p-3 text-xs text-[#756581]">Imported patient: visits from before the import may not appear here.</p>}
          </section>

          {/* SUMMARY STATS */}
          <section aria-label="Patient visit statistics" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-[#E4D5F6] bg-white p-3 shadow-sm">
                <p className="text-xs text-[#756581]">{stat.label}</p>
                <p className="mt-1 text-xl font-extrabold tabular-nums">{stat.value}</p>
              </div>
            ))}
          </section>

          {/* FILTERS AND EVENT LIST */}
          <section aria-label="Visit records" className="overflow-hidden rounded-2xl border border-[#E4D5F6] bg-white shadow-sm">
            <div className="border-b border-[#EEE7F6] p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">Visit records</h2>
                <span className="rounded-full bg-[#F2EAFF] px-3 py-1 text-xs font-bold text-[#6D3AA8]">{shown.length} {shown.length === 1 ? "record" : "records"}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[1.1fr_1fr_1fr_auto] xl:items-end">
                <label className="text-xs font-semibold text-[#49355F]">Visit type
                  <select className={`${fieldClass} mt-1.5`} value={kind} onChange={(event) => { setKind(event.target.value as FilterKind); setPage(1); }}>
                    <option value="all">All visits</option><option value="walk_in">Walk-in visits</option><option value="appointment">Appointments</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-[#49355F]">From
                  <input type="date" className={`${fieldClass} mt-1.5`} value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
                </label>
                <label className="text-xs font-semibold text-[#49355F]">To
                  <input type="date" className={`${fieldClass} mt-1.5`} value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
                </label>
                <button type="button" disabled={!hasFilters} onClick={() => { setKind("all"); setFrom(""); setTo(""); setPage(1); }} className="min-h-11 rounded-xl border border-[#D7C4EA] px-4 text-sm font-semibold text-[#6D3AA8] hover:bg-[#F2EAFF] disabled:opacity-40">Clear</button>
              </div>
            </div>

            {shown.length === 0 ? (
              <p className="p-8 text-center text-sm text-[#756581]">{events.length === 0 ? "No visits or appointments recorded for this patient." : "No records match the selected filters."}</p>
            ) : (
              <ul className="divide-y divide-[#EEE7F6]">
                {visible.map((event) => {
                  const status = STATUS[event.status] ?? { label: event.status.replace(/_/g, " "), style: "bg-slate-100 text-slate-600" };
                  const arrival = arrivalText(event, timeline.grace_minutes);
                  const extra = [
                    event.wait_minutes !== null ? `Waited ${event.wait_minutes} min` : null,
                    event.service_minutes !== null ? `Visit took ${event.service_minutes} min` : null,
                    arrival || null,
                    event.kind === "appointment" && event.booked_by_staff ? "Booked by staff" : null,
                    event.reschedule_count > 0 ? `Rescheduled ${event.reschedule_count} ${event.reschedule_count === 1 ? "time" : "times"}` : null,
                    event.changed_late ? "Changed or cancelled less than 24 hours before the appointment" : null,
                    event.deposit_amount > 0 && event.deposit_status !== "none" ? `Deposit ₱${event.deposit_amount.toLocaleString("en-PH")}: ${DEPOSIT[event.deposit_status] ?? event.deposit_status}` : null,
                  ].filter((detail): detail is string => Boolean(detail));
                  return (
                    <li key={`${event.kind}-${event.ref_id}`} className="p-3 sm:px-5 sm:py-4">
                      <details className="group">
                        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6] [&::-webkit-details-marker]:hidden">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold">{event.kind === "appointment" ? "Appointment" : "Walk-in visit"}{event.queue_number !== null ? ` · Queue #${event.queue_number}` : ""}</p>
                            <p className="mt-1 text-xs text-[#756581]">{formatDateTime(event.happened_at)} · {event.reason || "Reason not specified"}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.style}`}>{status.label}</span>
                          <span className="text-xs font-semibold text-[#6D3AA8] group-open:underline">Details <span aria-hidden="true">⌄</span></span>
                        </summary>
                        <div className="mt-3 rounded-xl bg-[#FAF8FF] p-3 text-xs leading-6 text-[#5F526B]">
                          <p><strong>Reason:</strong> {event.reason || "Not specified"}</p>
                          {extra.length > 0 ? extra.map((detail, index) => <p key={index}>{detail}</p>) : <p>No additional information recorded.</p>}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}

            {shown.length > PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEE7F6] bg-[#FCFAFF] px-4 py-3 text-xs text-[#756581] sm:px-5">
                <span>Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, shown.length)} of {shown.length}</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="min-h-9 rounded-lg border border-[#E4D5F6] bg-white px-3 font-semibold text-[#6D3AA8] disabled:opacity-40">Previous</button>
                  <span>{safePage} / {pageCount}</span>
                  <button type="button" disabled={safePage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="min-h-9 rounded-lg border border-[#E4D5F6] bg-white px-3 font-semibold text-[#6D3AA8] disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
            {events.length >= 500 && <p className="border-t border-[#EEE7F6] px-5 py-3 text-xs text-[#756581]">Showing up to 500 recent records.</p>}
          </section>
        </div>
      )}
    </main>
  );
}
