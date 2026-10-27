"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/today";
import { getArrivalTiming } from "@/lib/queuePolicy";

const UUID = /^[0-9a-f-]{36}$/i;

type Patient = {
  id: string;
  name: string;
  phone: string | null;
  clinic_patient_id: string | null;
  is_minor: boolean;
  visit_count: number;
  last_visit_at: string | null;
};

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

const fieldClass =
  "min-h-11 w-full rounded-xl border border-[#E4D5F6] bg-white px-3 py-2.5 text-sm font-normal text-[#2E1747] outline-none transition focus:border-[#6D3AA8] focus:ring-4 focus:ring-[#F2EAFF]";

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

function arrivalText(event: TimelineEvent, grace: number): string {
  if (event.kind !== "appointment" || !event.arrived_at) return "";
  const timing = getArrivalTiming(event.happened_at, event.arrived_at, grace);
  if (timing.window === "early") return "Arrived on time or early";
  if (timing.window === "grace") {
    return `Arrived ${timing.minutesAfterStart} min after the start, within the grace period`;
  }
  return `Arrived ${timing.minutesAfterStart} min after the start, ${timing.minutesPastGrace} min past the grace period`;
}

function Icon({ name, className = "h-4 w-4" }: { name: "search" | "user" | "mail" | "phone" | "calendar" | "clock" | "list"; className?: string }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true as const,
  };
  if (name === "search") return <svg {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
  if (name === "mail") return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
  if (name === "phone") return <svg {...props}><path d="M7 3h3l1.4 4.5-2 1.5a16 16 0 0 0 5.6 5.6l1.5-2L21 14v3a4 4 0 0 1-4 4C9.3 21 3 14.7 3 7a4 4 0 0 1 4-4Z" /></svg>;
  if (name === "calendar") return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4m8-4v4M3 10h18" /></svg>;
  if (name === "clock") return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === "list") return <svg {...props}><path d="M9 6h12M9 12h12M9 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></svg>;
  return <svg {...props}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
}

export default function HistoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [clinicId, setClinicId] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [patientEmail, setPatientEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<FilterKind>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Match the signed-in staff member to their own clinic.
  useEffect(() => {
    let cancelled = false;
    async function identifyClinic() {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (cancelled) return;
      if (authError || !user) {
        setError("Please sign in to see clinic patient records.");
        return;
      }
      const { data, error: staffError } = await supabase
        .from("clinic_staff")
        .select("clinic_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (staffError || !data?.clinic_id) {
        setError(staffError?.message ?? "No clinic is linked to this staff account.");
        return;
      }
      setClinicId(data.clinic_id);
    }
    void identifyClinic();
    return () => { cancelled = true; };
  }, [supabase]);

  // Support links such as /dashboard/history?patient=<uuid>.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("patient");
    if (id && UUID.test(id)) setSelectedId(id);
  }, []);

  useEffect(() => {
    if (!clinicId) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const clean = search.replace(/[,()%*\\]/g, "").trim();
      let query = supabase
        .from("patients")
        .select("id, name, phone, clinic_patient_id, is_minor, visit_count, last_visit_at")
        .eq("clinic_id", clinicId)
        .order("last_visit_at", { ascending: false, nullsFirst: false })
        .limit(20);
      if (clean) {
        query = query.or(
          `name.ilike.%${clean}%,phone.ilike.%${clean}%,clinic_patient_id.ilike.%${clean}%`
        );
      }
      const { data, error: queryError } = await query;
      if (cancelled) return;
      setSearching(false);
      if (queryError) setError(queryError.message);
      else setResults((data ?? []) as Patient[]);
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [supabase, clinicId, search]);

  useEffect(() => {
    if (!clinicId || !selectedId) return;
    let cancelled = false;
    async function loadPatient() {
      setLoading(true);
      setPatientEmail(null);
      setError("");

      // Email is not currently included in patient_timeline's supplied output.
      // Read from patients.email when available; older schemas may not have it.
      const [timelineResult, emailResult] = await Promise.all([
        supabase.rpc("patient_timeline", { p_patient_id: selectedId }),
        supabase.from("patients")
          .select("email")
          .eq("id", selectedId)
          .eq("clinic_id", clinicId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setLoading(false);
      if (timelineResult.error) {
        setTimeline(null);
        setError(timelineResult.error.message);
        return;
      }
      const data = timelineResult.data as Timeline | null;
      if (!data?.patient || data.patient.id !== selectedId) {
        setTimeline(null);
        setError("This patient could not be found or accessed.");
        return;
      }
      setTimeline(data);
      // If the optional email field is absent, retain the rest of the page.
      setPatientEmail(emailResult.error ? null : (emailResult.data?.email ?? null));
    }
    void loadPatient();
    return () => { cancelled = true; };
  }, [supabase, clinicId, selectedId]);

  function choose(id: string) {
    setSelectedId(id);
    setKind("all");
    setFrom("");
    setTo("");
    const url = new URL(window.location.href);
    url.searchParams.set("patient", id);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  const ready = timeline?.patient.id === selectedId ? timeline : null;
  const patient = ready?.patient;
  const events = ready?.events ?? [];
  const email = patient?.email || patientEmail;

  const completed = events.filter((event) => ["served", "completed"].includes(event.status)).length;
  const appointments = events.filter((event) => event.kind === "appointment").length;
  const noShows = events.filter((event) => event.status === "no_show").length;
  const cancelled = events.filter((event) => event.status === "cancelled").length;
  const lateChanges = events.filter((event) => event.changed_late).length;
  const waits = events.flatMap((event) => event.wait_minutes !== null ? [event.wait_minutes] : []);
  const avgWait = waits.length
    ? Math.round(waits.reduce((sum, minutes) => sum + minutes, 0) / waits.length)
    : null;

  const shown = events.filter((event) =>
    (kind === "all" || event.kind === kind) &&
    (!from || dayKey(event.happened_at) >= from) &&
    (!to || dayKey(event.happened_at) <= to)
  );
  const hasFilters = kind !== "all" || from !== "" || to !== "";

  const stats = [
    { label: "Completed", value: completed },
    { label: "Appointments", value: appointments },
    { label: "No-shows", value: noShows },
    { label: "Cancelled", value: cancelled },
    { label: "Late changes", value: lateChanges },
    { label: "Average wait", value: avgWait === null ? "—" : `${avgWait} min` },
  ];

  return (
    <div className="w-full px-4 pb-12 pt-6 text-[#2E1747] sm:px-6 sm:pt-8 lg:px-8">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B5CB5]">Patient records</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Visit history</h1>
        <p className="mt-2 text-sm leading-6 text-[#756581]">
          Find a patient, review their visits, and check appointment history.
        </p>
      </header>

      {error && (
        <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start xl:grid-cols-[21rem_minmax(0,1fr)]">
        {/* PATIENT FINDER */}
        <section aria-label="Patient search" className="min-w-0 rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">Patients</h2>
              <p className="mt-1 text-xs text-[#756581]">Select a patient to view their records.</p>
            </div>
            <span className="rounded-full bg-[#F2EAFF] px-2.5 py-1 text-xs font-semibold text-[#6D3AA8]">
              {results.length}
            </span>
          </div>

          <label htmlFor="history-search" className="mb-2 block text-xs font-semibold text-[#49355F]">
            Search patients
          </label>
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-[#8B7C96]" />
            <input
              id="history-search"
              type="search"
              autoComplete="off"
              className={`${fieldClass} pl-10`}
              placeholder="Name, phone or patient ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <ul className="mt-4 flex max-h-[34rem] flex-col gap-2 overflow-y-auto pr-1" aria-label="Patient search results">
            {searching && <li className="px-3 py-4 text-sm text-[#756581]">Searching…</li>}
            {!searching && results.length === 0 && (
              <li className="rounded-xl border border-dashed border-[#E4D5F6] px-3 py-6 text-center text-sm text-[#756581]">
                No patients found.
              </li>
            )}
            {!searching && results.map((result) => {
              const selected = selectedId === result.id;
              return (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => choose(result.id)}
                    aria-current={selected ? "true" : undefined}
                    className={`w-full rounded-xl border px-3.5 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6] ${
                      selected
                        ? "border-[#6D3AA8] bg-[#F4ECFF]"
                        : "border-[#EEE7F5] bg-white hover:border-[#D7C4EA] hover:bg-[#FAF8FF]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words font-semibold text-[#2E1747]">{result.name}</span>
                      {result.is_minor && (
                        <span className="rounded-full bg-[#EFE5FF] px-2 py-0.5 text-[10px] font-bold text-[#6D3AA8]">Minor</span>
                      )}
                    </div>
                    <p className="mt-1 break-all text-xs text-[#756581]">
                      {result.clinic_patient_id ? `ID: ${result.clinic_patient_id} · ` : ""}
                      {result.phone ?? "No phone"}
                    </p>
                    <p className="mt-1 text-xs text-[#8B7C96]">
                      {result.visit_count} {result.visit_count === 1 ? "visit" : "visits"}
                      {result.last_visit_at && ` · Last: ${new Date(result.last_visit_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}`}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* PATIENT DETAILS */}
        <section aria-label="Selected patient history" className="min-w-0">
          {!selectedId && (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-[#E4D5F6] bg-white px-6 py-12 text-center shadow-sm">
              <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#F2EAFF] text-[#6D3AA8]"><Icon name="user" className="h-7 w-7" /></span>
              <h2 className="text-lg font-bold">Select a patient</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[#756581]">Choose a patient from the list to view their contact information, visit summary, and timeline.</p>
            </div>
          )}
          {selectedId && loading && !ready && (
            <div role="status" className="rounded-2xl border border-[#E4D5F6] bg-white p-10 text-center text-sm text-[#756581] shadow-sm">
              Loading patient history…
            </div>
          )}
          {ready && patient && (
            <div className="flex flex-col gap-5">
              {/* PATIENT INFORMATION */}
              <section className="rounded-2xl border border-[#E4D5F6] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CB5]">Patient profile</p>
                    <h2 className="mt-1 break-words text-xl font-extrabold sm:text-2xl">{patient.name}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {patient.is_minor && <span className="rounded-full bg-[#F2EAFF] px-3 py-1 text-xs font-semibold text-[#6D3AA8]">Minor</span>}
                    {patient.has_account && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Portal account active</span>}
                  </div>
                </div>

                <div className="mt-5 grid gap-x-6 gap-y-4 border-t border-[#F0EAF7] pt-5 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-semibold text-[#756581]"><Icon name="mail" />Email address</p>
                    {email ? (
                      <a href={`mailto:${email}`} className="mt-1 block break-all text-sm font-semibold text-[#6D3AA8] underline-offset-2 hover:underline">{email}</a>
                    ) : (
                      <p className="mt-1 text-sm text-[#8B7C96]">Not provided</p>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-semibold text-[#756581]"><Icon name="phone" />Phone number</p>
                    <p className="mt-1 break-all text-sm font-semibold">{patient.phone || "Not provided"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-semibold text-[#756581]"><Icon name="user" />Patient ID</p>
                    <p className="mt-1 break-all text-sm font-semibold">{patient.clinic_patient_id || "Not assigned"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-semibold text-[#756581]"><Icon name="calendar" />Registered on</p>
                    <p className="mt-1 text-sm font-semibold">{new Date(patient.created_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}</p>
                  </div>
                  {patient.last_visit_at && (
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-xs font-semibold text-[#756581]"><Icon name="clock" />Last visit</p>
                      <p className="mt-1 text-sm font-semibold">{new Date(patient.last_visit_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}</p>
                    </div>
                  )}
                  {patient.is_minor && (
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-xs font-semibold text-[#756581]"><Icon name="user" />Guardian</p>
                      <p className="mt-1 text-sm font-semibold">{patient.guardian_name || "Not provided"}</p>
                    </div>
                  )}
                </div>
                {patient.imported && (
                  <p className="mt-5 rounded-xl bg-[#FAF8FF] px-3 py-2 text-xs text-[#756581]">
                    Imported patient: records from before the import may not appear in this timeline.
                  </p>
                )}
              </section>

              {/* SIX WHITE KPI CARDS */}
              <section aria-label="Patient visit statistics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {stats.map((stat) => (
                  <div key={stat.label} className="min-w-0 rounded-2xl border border-[#E4D5F6] bg-white p-3.5 shadow-sm sm:p-4">
                    <p className="text-xs font-medium leading-5 text-[#756581]">{stat.label}</p>
                    <p className="mt-2 break-words text-xl font-extrabold tabular-nums text-[#2E1747] sm:text-2xl">{stat.value}</p>
                  </div>
                ))}
              </section>

              {/* FILTERS */}
              <section aria-label="Filter patient records" className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold">Visit records</h3>
                    <p className="mt-1 text-xs text-[#756581]">Filter visits by type or date.</p>
                  </div>
                  <span className="text-xs font-medium text-[#756581]" aria-live="polite">
                    {shown.length} {shown.length === 1 ? "record" : "records"}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
                  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-[#49355F]">
                    Visit type
                    <select className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value as FilterKind)}>
                      <option value="all">All visits</option>
                      <option value="walk_in">Walk-in visits</option>
                      <option value="appointment">Appointments</option>
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-[#49355F]">
                    From
                    <input type="date" className={fieldClass} value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-[#49355F]">
                    To
                    <input type="date" className={fieldClass} value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
                  </label>
                  <button
                    type="button"
                    onClick={() => { setKind("all"); setFrom(""); setTo(""); }}
                    disabled={!hasFilters}
                    className="min-h-11 rounded-xl border border-[#D7C4EA] bg-white px-4 py-2.5 text-sm font-semibold text-[#6D3AA8] transition hover:bg-[#F2EAFF] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Clear filters
                  </button>
                </div>
              </section>

              {/* VISIT TIMELINE */}
              <section aria-label="Patient visit timeline">
                <div className="mb-3 flex items-center gap-2">
                  <Icon name="list" className="h-5 w-5 text-[#6D3AA8]" />
                  <h3 className="text-base font-bold">History</h3>
                </div>
                <ul className="flex flex-col gap-3">
                  {shown.length === 0 && (
                    <li className="rounded-2xl border border-[#E4D5F6] bg-white p-6 text-center text-sm text-[#756581] shadow-sm">
                      {events.length === 0
                        ? "No visits or appointments have been recorded for this patient."
                        : "No records match the selected filters."}
                    </li>
                  )}
                  {shown.map((event) => {
                    const status = STATUS[event.status] ?? {
                      label: event.status.replace(/_/g, " "),
                      style: "bg-slate-100 text-slate-600",
                    };
                    const arrival = arrivalText(event, ready.grace_minutes);
                    const details = [
                      event.wait_minutes !== null ? `Waited ${event.wait_minutes} min` : null,
                      event.service_minutes !== null ? `Visit took ${event.service_minutes} min` : null,
                    ].filter(Boolean).join(" · ");
                    return (
                      <li key={`${event.kind}-${event.ref_id}`} className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#2E1747]">
                              {event.kind === "appointment" ? "Appointment" : "Walk-in visit"}
                              {event.queue_number !== null ? ` · Queue #${event.queue_number}` : ""}
                            </p>
                            <p className="mt-1 text-xs text-[#756581]">{formatDateTime(event.happened_at)}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${status.style}`}>
                            {status.label}
                          </span>
                        </div>
                        <div className="mt-3 border-t border-[#F2EDF8] pt-3 text-sm text-[#5F526B]">
                          <p><span className="font-semibold text-[#49355F]">Reason:</span> {event.reason || "Not specified"}</p>
                          {details && <p className="mt-1 text-xs leading-5">{details}</p>}
                          {arrival && <p className="mt-1 text-xs leading-5">{arrival}</p>}
                          {event.kind === "appointment" && event.booked_by_staff && <p className="mt-1 text-xs">Booked by staff</p>}
                          {event.reschedule_count > 0 && (
                            <p className="mt-1 text-xs">Rescheduled {event.reschedule_count} {event.reschedule_count === 1 ? "time" : "times"}</p>
                          )}
                          {event.changed_late && (
                            <p className="mt-1 text-xs font-semibold text-amber-700">Changed or cancelled less than 24 hours before the appointment</p>
                          )}
                          {event.deposit_amount > 0 && event.deposit_status !== "none" && (
                            <p className="mt-1 text-xs">Deposit ₱{event.deposit_amount.toLocaleString("en-PH")}: {DEPOSIT[event.deposit_status] ?? event.deposit_status}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {events.length >= 500 && (
                  <p className="mt-3 text-xs text-[#756581]">Showing up to 500 recent records.</p>
                )}
              </section>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
