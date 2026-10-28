"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePathname } from "next/navigation";

import Link from "next/link";

import { createClient } from "@/lib/supabase/client";

import SlotPicker from "@/components/SlotPicker";

import type { Settings } from "./BookingSettings";

import { BackLink } from "./AppointmentNavigation";

import { dayRangeManila, formatTime, todayManila } from "@/lib/today";

import { getArrivalTiming } from "@/lib/queuePolicy";

import { useVisitReasons } from "@/lib/useVisitReasons";

import ConfirmationModal from "@/components/ConfirmationModal";

import RequiredMark from "@/components/RequiredMark";
import PendingBookingsPanel from "./PendingBookingsPanel";

type Status = "booked" | "confirmed" | "cancelled" | "arrived" | "completed" | "no_show";

type Appt = {

  id: string; name: string; phone: string | null; reason: string | null;

  is_minor: boolean; guardian_name: string | null; starts_at: string; status: Status;

  changed_late: boolean; reschedule_count: number;

};

type Wait = { id: string; name: string; phone: string | null; reason: string | null; wanted_day: string | null };

const FIELD_CLASS = "min-h-12 w-full rounded-xl border border-[#E4D5F6] bg-white px-4 py-3 text-base text-[#2E1747] outline-none transition placeholder:text-[#9B8FA6] focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]";

const SMALL_BUTTON = "min-h-11 rounded-xl border border-[#D8C5EC] bg-white px-3 py-2 text-xs font-semibold text-[#5A2E8A] transition hover:bg-[#F8F3FF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCAF4]";

type ConfirmationTarget =

  | { kind: "late-arrival"; appointment: Appt; minutesAfterStart: number; grace: number }

  | { kind: "status"; appointment: Appt; status: "cancelled" | "no_show" }

  | { kind: "waitlist"; patient: Wait };

function confirmationCopy(target: ConfirmationTarget) {

  if (target.kind === "late-arrival") {

    return {

      title: `Check in ${target.appointment.name} late?`,

      description: `${target.appointment.name} is ${target.minutesAfterStart} minutes late; the grace period is ${target.grace} minutes. They will be added at the back of the live queue, where staff can reposition them.`,

      confirmLabel: "Check in at queue end",

      cancelLabel: "Not yet",

      busyLabel: "Checking in…",

      tone: "warning" as const,

    };

  }

  if (target.kind === "status") {

    return target.status === "cancelled"

      ? {

          title: `Cancel ${target.appointment.name}’s appointment?`,

          description: "The appointment will be closed as cancelled and will no longer appear as an upcoming visit.",

          confirmLabel: "Cancel appointment",

          cancelLabel: "Keep appointment",

          busyLabel: "Cancelling…",

          tone: "danger" as const,

        }

      : {

          title: `Mark ${target.appointment.name} as a no-show?`,

          description: "This closes the appointment as a no-show. Confirm only after checking that the patient did not arrive.",

          confirmLabel: "Mark no-show",

          cancelLabel: "Keep appointment",

          busyLabel: "Updating…",

          tone: "danger" as const,

        };

  }

  if (target.kind === "waitlist") {

    return {

      title: `Remove ${target.patient.name} from the waitlist?`,

      description: "They will no longer appear when staff look for patients to call about an open appointment time.",

      confirmLabel: "Remove from waitlist",

      cancelLabel: "Keep on waitlist",

      busyLabel: "Removing…",

      tone: "danger" as const,

    };

  }


  throw new Error("Unsupported confirmation action");
}

export default function AppointmentsWorkspace({ view }: { view: "scheduled" | "book" | "all" }) {

  const supabase = useMemo(() => createClient(), []);


  const pathname = usePathname();

  const rootPath = pathname.replace(/\/(scheduled|book)\/?$/, "");

  const waitlistFilled = useRef(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const bookingCloseRef = useRef<HTMLButtonElement | null>(null);
  const bookingDialogRef = useRef<HTMLDivElement | null>(null);
  const bookingTriggerRef = useRef<HTMLButtonElement | null>(null);

  function closeBooking() {
    if (bookingBusy) return;
    setBookingOpen(false);
    setBookingError("");
    bookingTriggerRef.current?.focus();
  }

  function openBooking() {
    setBookingError("");
    setName("");
    setPhone("");
    setReason("");
    setIsMinor(false);
    setGuardian("");
    setSlot("");
    setFromWaitlist("");
    setPickerKey((n) => n + 1);
    setBookingOpen(true);
  }

  useEffect(() => {
    if (!bookingOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    bookingCloseRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!bookingBusy) {
          setBookingOpen(false);
          setBookingError("");
          bookingTriggerRef.current?.focus();
        }
      }
      if (e.key !== "Tab" || !bookingDialogRef.current) return;
      const elements = Array.from(bookingDialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
      ));
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [bookingOpen, bookingBusy]);

  const [clinicId, setClinicId] = useState("");

  const [settings, setSettings] = useState<Settings | null>(null);

  const [today, setToday] = useState("");

  const [day, setDay] = useState("");

  const [appts, setAppts] = useState<Appt[]>([]);

  const [waitlist, setWaitlist] = useState<Wait[]>([]);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [clock, setClock] = useState(0);

  const [confirmation, setConfirmation] = useState<ConfirmationTarget | null>(null);

  const [confirmBusy, setConfirmBusy] = useState(false);

  // staff booking form

  const [name, setName] = useState("");

  const [phone, setPhone] = useState("");

  const [reason, setReason] = useState("");

  const [isMinor, setIsMinor] = useState(false);

  const [guardian, setGuardian] = useState("");

  const [slot, setSlot] = useState("");

  const [fromWaitlist, setFromWaitlist] = useState("");

  const [pickerKey, setPickerKey] = useState(0);

  const { names: REASONS } = useVisitReasons(clinicId, "staff");

  useEffect(() => {

    (async () => {

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data: staff } = await supabase

        .from("clinic_staff").select("clinic_id, role").eq("user_id", user.id).limit(1).maybeSingle();

      if (!staff) return;

      setClinicId(staff.clinic_id);

      const { data: c } = await supabase

        .from("clinics")

        .select("accepting_bookings, open_time, close_time, slot_minutes, chairs, open_days, grace_minutes, min_notice_hours")

        .eq("id", staff.clinic_id).single();

      if (c) setSettings(c as Settings);

    })();

  }, [supabase]);

  useEffect(() => {

    const kickoff = window.setTimeout(() => {

      const currentDay = todayManila();

      setToday(currentDay);

      setDay((value) => value || currentDay);

      setClock(Date.now());

    }, 0);

    const timer = window.setInterval(() => setClock(Date.now()), 30000);

    return () => {

      window.clearTimeout(kickoff);

      window.clearInterval(timer);

    };

  }, []);

  // A day selected on the calendar opens the same date here.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("date");
    if (!requested || !/^\d{4}-\d{2}-\d{2}$/.test(requested)) return;
    const [y, m, d] = requested.split("-").map(Number);
    const valid = new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === requested;
    if (valid) setDay(requested);
  }, []);

  const load = useCallback(async () => {

    if (!clinicId || !day) return;

    const [start, end] = dayRangeManila(day);

    const allAppointments: Appt[] = [];
    const pageSize = 200;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error: fetchError } = await supabase
        .from("appointments")
        .select("*")
        .eq("clinic_id", clinicId)
        .gte("starts_at", start)
        .lt("starts_at", end)
        .order("starts_at")
        .order("id")
        .range(offset, offset + pageSize - 1);
      if (fetchError) {
        setError(`Could not load scheduled patients: ${fetchError.message}`);
        return;
      }
      allAppointments.push(...((data ?? []) as Appt[]));
      if ((data ?? []).length < pageSize) break;
    }
    setAppts(allAppointments);

    const { data: w } = await supabase

      .from("waitlist").select("*").eq("clinic_id", clinicId).eq("status", "waiting").order("created_at");

    setWaitlist((w ?? []) as Wait[]);

  }, [supabase, clinicId, day]);

  useEffect(() => {

    const kickoff = window.setTimeout(() => void load(), 0);

    return () => window.clearTimeout(kickoff);

  }, [load]);

  useEffect(() => {

    if (!clinicId) return;

    const channel = supabase

      .channel(`appts-${clinicId}`)

      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `clinic_id=eq.${clinicId}` }, () => load())

      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist", filter: `clinic_id=eq.${clinicId}` }, () => load())

      .subscribe();

    return () => { supabase.removeChannel(channel); };

  }, [supabase, clinicId, load]);

  async function setStatus(id: string, status: Status) {

    setError("");

    const patch: Record<string, string> = { status };

    if (status === "confirmed") patch.confirmed_at = new Date().toISOString();

    if (status === "cancelled") patch.cancelled_at = new Date().toISOString();

    const { error } = await supabase.from("appointments").update(patch).eq("id", id);

    if (error) {

      setError(error.message);

      return false;

    }

    await load();

    return true;

  }

  async function performArrival(appointment: Appt) {

    setError(""); setNotice("");

    const grace = settings?.grace_minutes ?? 15;

    const timing = getArrivalTiming(appointment.starts_at, clock, grace);

    const { data, error } = await supabase.rpc("mark_arrived", { p_appointment_id: appointment.id });

    if (error) {

      setError(error.message);

      return false;

    }

    setNotice(

      timing.window === "late"

        ? `Late arrival checked in as #${data.queue_number} at the back of the queue. Use the live queue to put them next or move them later.`

        : `Checked in and added to the queue as #${data.queue_number}.`,

    );

    await load();

    return true;

  }

  async function arrived(appointment: Appt) {

    setError(""); setNotice("");

    const grace = settings?.grace_minutes ?? 15;

    const timing = getArrivalTiming(appointment.starts_at, clock, grace);

    if (timing.window === "late") {

      setConfirmation({

        kind: "late-arrival",

        appointment,

        minutesAfterStart: timing.minutesAfterStart,

        grace,

      });

      return;

    }

    await performArrival(appointment);

  }

  async function copyLink(id: string) {

    await navigator.clipboard.writeText(`${window.location.origin}/guest/${clinicId}/appointments/${id}`);

    setNotice("Patient appointment details link copied. Send it so they can view, reschedule, or cancel.");

  }

  async function bookForPatient(e: React.FormEvent) {
    e.preventDefault();
    if (bookingBusy) return;
    setBookingError("");
    setNotice("");

    if (!name.trim()) return setBookingError("Enter the patient's name.");
    if (!slot) return setBookingError("Pick a date and a time.");
    if (isMinor && !guardian.trim()) return setBookingError("Enter the guardian's name.");
    if (!reason.trim()) return setBookingError("Please select a reason for visit.");

    setBookingBusy(true);
    try {
      const { data, error: bookError } = await supabase.rpc("book_appointment", {
        p_clinic_id: clinicId,
        p_name: name,
        p_phone: phone,
        p_reason: reason,
        p_starts_at: slot,
        p_is_minor: isMinor,
        p_guardian: isMinor ? guardian : null,
        p_by_staff: true,
      });
      if (bookError) { setBookingError(bookError.message); return; }
      if (!data?.id) { setBookingError("The clinic did not return an appointment ID. Please check the booking list before trying again."); return; }

      if (fromWaitlist) {
        const { error: waitError } = await supabase.from("waitlist")
          .update({ status: "booked", booked_at: new Date().toISOString() })
          .eq("id", fromWaitlist);
        if (waitError) {
          setNotice("Appointment created, but the waitlist could not be updated automatically.");
        }
      }
      const link = `${window.location.origin}/guest/${clinicId}/appointments/${data.id}`;
      const linkCopied = await navigator.clipboard.writeText(link).then(() => true).catch(() => false);
      setNotice(`Booked for ${formatTime(slot)}.${linkCopied ? " Patient details link copied to clipboard." : " The patient details link is: " + link}`);
      setName(""); setPhone(""); setReason(""); setIsMinor(false);
      setGuardian(""); setSlot(""); setFromWaitlist("");
      setPickerKey((n) => n + 1);
      setBookingOpen(false);
      await load();
    } catch {
      setBookingError("Unable to complete this booking. Please try again.");
    } finally {
      setBookingBusy(false);
    }
  }

  function fillFromWaitlist(w: Wait) {
    setName(w.name);
    setPhone(w.phone ?? "");
    setReason(w.reason ?? "");
    setFromWaitlist(w.id);
    setSlot("");
    setPickerKey((n) => n + 1);
    setBookingError("");
    setBookingOpen(true);
  }

  function requestConfirmation(target: ConfirmationTarget) {

    setError("");

    setConfirmation(target);

  }

  useEffect(() => {
    if (view !== "book") return;
    const kickoff = window.setTimeout(() => setBookingOpen(true), 0);
    return () => window.clearTimeout(kickoff);
  }, [view]);

  useEffect(() => {
    if (!clinicId || waitlistFilled.current) return;
    const search = new URLSearchParams(window.location.search);
    const shouldOpen = search.get("book") === "1" || search.has("waitlist");
    if (!shouldOpen) return;
    setBookingOpen(true);

    const waitId = search.get("waitlist");
    if (waitId) {
      const person = waitlist.find((w) => w.id === waitId);
      if (!person) return; // Wait for the waitlist request to finish.
      setName(person.name);
      setPhone(person.phone ?? "");
      setReason(person.reason ?? "");
      setFromWaitlist(person.id);
    }

    waitlistFilled.current = true;
    setBookingOpen(true);
    search.delete("book");
    search.delete("waitlist");
    const remaining = search.toString();
    window.history.replaceState(null, "", window.location.pathname + (remaining ? `?${remaining}` : ""));
  }, [clinicId, waitlist]);

  async function removeWait(id: string) {

    setError("");

    const { error } = await supabase.from("waitlist").update({ status: "removed" }).eq("id", id);

    if (error) {

      setError(error.message);

      return false;

    }

    await load();

    return true;

  }

  async function confirmAction() {

    const target = confirmation;

    if (!target || confirmBusy) return;

    setConfirmBusy(true);

    setError("");

    let succeeded = false;

    try {

      if (target.kind === "late-arrival") succeeded = await performArrival(target.appointment);

      else if (target.kind === "status") succeeded = await setStatus(target.appointment.id, target.status);

      else succeeded = await removeWait(target.patient.id);

      if (succeeded) setConfirmation(null);

    } finally {

      setConfirmBusy(false);

    }

  }

  const [scheduleSearch, setScheduleSearch] = useState("");
  const [scheduleFilter, setScheduleFilter] = useState("active");
  const scheduled = appts.filter((a) => {
    if (view === "all" && a.status === "booked") return false;
    if (scheduleFilter === "active" && (a.status === "cancelled" || a.status === "no_show")) return false;
    if (scheduleFilter !== "all" && scheduleFilter !== "active" && a.status !== scheduleFilter) return false;
    const q = scheduleSearch.trim().toLocaleLowerCase();
    return !q || [a.name, a.phone ?? "", a.reason ?? "", a.guardian_name ?? ""].some((v) => v.toLocaleLowerCase().includes(q));
  });

  const isToday = !!today && day === today;

  const badge: Record<Status, string> = {

    booked: "bg-amber-50 text-amber-800 ring-amber-200", confirmed: "bg-emerald-50 text-emerald-800 ring-emerald-200",

    cancelled: "bg-slate-100 text-slate-600 ring-slate-200", arrived: "bg-[#F2EAFF] text-[#5A2E8A] ring-[#E4D5F6]",

    completed: "bg-slate-100 text-slate-600 ring-slate-200", no_show: "bg-red-50 text-red-700 ring-red-200",

  };

  const label: Record<Status, string> = {

    booked: "Pending", confirmed: "Confirmed", cancelled: "Cancelled",

    arrived: "Checked in", completed: "Done", no_show: "No-show",

  };

  return (

    <div className="w-full px-4 py-5 text-[#2E1747] sm:px-6 sm:py-7 lg:px-8">

      {view !== "all" && <BackLink label="Back to Appointments" />}

      <header className={`${view === "all" ? "" : "mt-4 "}flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between`}>

        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">

            {view === "all" ? "Appointments" : view === "scheduled" ? "Scheduled patients" : "Book for a patient"}

          </h1>

        </div>

        <div className="flex flex-wrap items-center gap-3">
          {view === "all" && (
            <>
              <button
                ref={bookingTriggerRef}
                type="button"
                onClick={openBooking}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#6D3AA8] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#572C87]"
              >
                <span aria-hidden="true" className="text-lg leading-none">+</span>
                Book for a patient
              </button>
            </>
          )}

        </div>

      </header>

      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}

      {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{notice}</p>}

      <div className={view === "all" ? "mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:items-start" : "mt-6"}>
        {view === "all" && (
          <div className="min-w-0">
            {clinicId ? (
              <PendingBookingsPanel clinicId={clinicId} embedded onConfirmed={() => void load()} />
            ) : (
              <div className="rounded-2xl border border-[#E4D5F6] bg-white p-6 text-sm text-[#6F647A]">Loading pending bookings...</div>
            )}
          </div>
        )}

        {(view === "scheduled" || view === "all") && (

        <section aria-labelledby="schedule-heading" className="min-w-0 rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B5CB5]">Daily list</p>

              <h2 id="schedule-heading" className="mt-1 text-xl font-bold">Scheduled patients</h2>

            </div>

            <div className="flex w-full items-end gap-2 sm:w-auto">

              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-semibold text-[#49365E] sm:w-48">Schedule date

                <input type="date" className="min-h-11 rounded-xl border border-[#E4D5F6] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />

              </label>

              <button type="button" onClick={() => today && setDay(today)} className={SMALL_BUTTON}>Today</button>

            </div>

          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex-1">
              <span className="sr-only">Search scheduled patients</span>
              <input
                type="search"
                value={scheduleSearch}
                onChange={(e) => setScheduleSearch(e.target.value)}
                placeholder="Search patient, reason, or phone"
                className="min-h-10 w-full rounded-xl border border-[#E4D5F6] bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-[#F2EAFF]"
              />
            </label>
            <label>
              <span className="sr-only">Filter scheduled patient status</span>
              <select value={scheduleFilter} onChange={(e) => setScheduleFilter(e.target.value)} className="min-h-10 w-full rounded-xl border border-[#E4D5F6] bg-white px-3 py-2 text-sm text-[#49365E] outline-none focus:ring-4 focus:ring-[#F2EAFF] sm:w-auto">
                <option value="active">Active &amp; completed</option>
                <option value="all">All statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="arrived">Checked in</option>
                <option value="completed">Completed</option>
                {view === "scheduled" && <option value="booked">Pending</option>}
                <option value="no_show">No-show</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[#756581]" aria-live="polite">{scheduled.length} patient{scheduled.length === 1 ? "" : "s"} shown</p>
            <Link href="/dashboard/calendar" className="text-xs font-semibold text-[#6D3AA8] hover:underline">Open calendar</Link>
          </div>

          <div className="mt-3 rounded-xl border border-[#E9DDF7]">
            <div className="hidden grid-cols-[minmax(4.8rem,0.7fr)_minmax(0,2fr)_minmax(5.2rem,0.9fr)_minmax(6rem,0.8fr)] gap-2 border-b border-[#E4D5F6] bg-[#FAF8FF] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#756581] md:grid">
              <span>Time</span><span>Patient / visit</span><span>Status</span><span className="text-right">Actions</span>
            </div>
            {scheduled.length === 0 ? (
              <p className="p-5 text-center text-sm text-[#6F647A]">No patients match this date or filter.</p>
            ) : (
              <ul className="divide-y divide-[#EFE8F5]">
                {scheduled.map((a) => {
                  const open = a.status === "booked" || a.status === "confirmed";
                  const past = clock > 0 && new Date(a.starts_at).getTime() < clock;
                  const arrivalTiming = open && clock > 0 ? getArrivalTiming(a.starts_at, clock, settings?.grace_minutes ?? 15) : null;
                  return (
                    <li key={a.id} className="bg-white px-3 py-3 transition hover:bg-[#FCFAFF]">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(4.8rem,0.7fr)_minmax(0,2fr)_minmax(5.2rem,0.9fr)_minmax(6rem,0.8fr)] md:items-center">
                        <p className="font-bold tabular-nums text-[#49365E]">{formatTime(a.starts_at)}</p>
                        <div className="min-w-0">
                          <p className="break-words font-semibold text-[#2E1747]">{a.name}</p>
                          <p className="mt-0.5 truncate text-xs text-[#756581]" title={`${a.reason ?? "No reason"}${a.phone ? ` · ${a.phone}` : ""}`}>{a.reason ?? "No reason"}{a.phone ? ` · ${a.phone}` : ""}</p>
                          {a.is_minor && <p className="mt-0.5 text-xs text-[#756581]">Guardian: {a.guardian_name ?? "not given"}</p>}
                          {(a.changed_late || a.reschedule_count > 0) && <p className="mt-0.5 text-xs font-medium text-amber-700">{a.changed_late ? "Late change. " : ""}{a.reschedule_count > 0 ? `Moved ${a.reschedule_count}x.` : ""}</p>}
                          {isToday && open && arrivalTiming?.window === "grace" && <p className="mt-0.5 text-xs text-amber-700">{arrivalTiming.minutesAfterStart} min late · within grace period</p>}
                          {isToday && open && arrivalTiming?.window === "late" && <p className="mt-0.5 text-xs text-red-700">Late arrival · {arrivalTiming.minutesAfterStart} min past scheduled time</p>}
                        </div>
                        <span className={`w-fit whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${badge[a.status]}`}>{label[a.status]}</span>
                        <div className="md:justify-self-end">
                          {open ? (
                            <details className="group relative open:z-20">
                              <summary className="inline-flex min-h-10 cursor-pointer list-none items-center rounded-lg border border-[#D8C5EC] bg-white px-3 py-2 text-xs font-bold text-[#5A2E8A] hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCAF4] [&::-webkit-details-marker]:hidden">Actions <span aria-hidden="true" className="ml-1">⌄</span></summary>
                              <div className="mt-2 flex flex-col gap-2 rounded-xl border border-[#E4D5F6] bg-[#FAF8FF] p-2 md:absolute md:right-0 md:top-full md:z-20 md:w-44 md:shadow-lg">
                                {isToday && <button type="button" onClick={() => arrived(a)} className="min-h-9 rounded-lg bg-[#6D3AA8] px-3 py-2 text-left text-xs font-bold text-white hover:bg-[#572C87]">{arrivalTiming?.window === "late" ? "Check in late" : "Arrived"}</button>}
                                {a.status === "booked" && <button type="button" onClick={() => void setStatus(a.id, "confirmed")} className={SMALL_BUTTON}>Mark confirmed</button>}
                                {past && <button type="button" onClick={() => requestConfirmation({ kind: "status", appointment: a, status: "no_show" })} className={SMALL_BUTTON}>No-show</button>}
                                <button type="button" onClick={() => copyLink(a.id)} className={SMALL_BUTTON}>Copy patient link</button>
                                <button type="button" onClick={() => requestConfirmation({ kind: "status", appointment: a, status: "cancelled" })} className="min-h-9 rounded-lg border border-red-200 bg-white px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50">Cancel</button>
                              </div>
                            </details>
                          ) : <span className="text-xs text-[#9587A5]">—</span>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {waitlist.length > 0 && (

            <div className="mt-8 border-t border-[#E4D5F6] pt-6">

              <div className="mb-3 flex items-center justify-between gap-3">

                <h2 className="text-lg font-bold">Waitlist</h2>

                <span className="rounded-full bg-[#F2EAFF] px-3 py-1 text-xs font-semibold text-[#6D3AA8]">{waitlist.length} waiting</span>

              </div>

              <ul className="flex flex-col gap-3">

                {waitlist.map((w) => (

                  <li key={w.id} className="flex flex-col gap-3 rounded-xl bg-[#FAF8FF] p-4 text-sm sm:flex-row sm:items-center sm:justify-between">

                    <span className="min-w-0 text-[#6F647A]">

                      <b className="text-[#2E1747]">{w.name}</b> · {w.phone ?? "no phone"} · {w.reason ?? "no reason"}

                      {w.wanted_day && ` · wants ${new Date(`${w.wanted_day}T00:00:00+08:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`}

                    </span>

                    <span className="flex flex-col gap-2 sm:flex-row">

                      <button type="button" onClick={() => fillFromWaitlist(w)} className={SMALL_BUTTON}>Book</button>

                      <button type="button" onClick={() => requestConfirmation({ kind: "waitlist", patient: w })} className={SMALL_BUTTON}>Remove</button>

                    </span>

                  </li>

                ))}

              </ul>

              <p className="mt-3 text-xs text-[#80748B]">Call these patients when a slot opens up.</p>

            </div>

          )}

        </section>

        )}

      </div>

      {bookingOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            aria-label="Close booking dialog"
            disabled={bookingBusy}
            onClick={closeBooking}
            className="absolute inset-0 cursor-default bg-[#1F122F]/60"
          />
          <div
            ref={bookingDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-booking-heading"
            className="relative z-10 flex max-h-[min(92dvh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#E4D5F6] bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E4D5F6] bg-[#FCFAFF] px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B5CB5]">Front desk</p>
                <h2 id="staff-booking-heading" className="mt-1 text-xl font-bold text-[#2E1747]">Book for a patient</h2>
                <p className="mt-1 text-sm text-[#6F647A]">Choose an available time and enter the patient details.</p>
              </div>
              <button
                ref={bookingCloseRef}
                type="button"
                onClick={closeBooking}
                disabled={bookingBusy}
                aria-label="Close booking dialog"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#E4D5F6] bg-white text-xl text-[#6D3AA8] hover:bg-[#F2EAFF] disabled:opacity-60"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
              {clinicId && (
            <form onSubmit={bookForPatient} className="mt-5 flex flex-col gap-4">

              <fieldset aria-required="true">

                <legend className="mb-2 text-sm font-semibold text-[#49365E]">Appointment time <RequiredMark /></legend>

                <SlotPicker key={pickerKey} clinicId={clinicId} value={slot} onChange={setSlot} ignoreNotice />

              </fieldset>

              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#49365E]"><span>Patient name <RequiredMark /></span>

                <input required className={FIELD_CLASS} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />

              </label>

              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#49365E]"><span>Mobile number <span className="text-xs font-normal text-[#80748B]">(optional)</span></span>

                <input className={FIELD_CLASS} placeholder="e.g. 0917 123 4567" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />

              </label>

<label className="flex flex-col gap-1.5 text-sm font-semibold text-[#49365E]">
  <span>
    Reason for visit <RequiredMark />
  </span>

  <select
    className={FIELD_CLASS}
    value={reason}
    onChange={(e) => setReason(e.target.value)}
    required
  >
    <option value="">Select a reason</option>
    {REASONS.map((r) => (
      <option key={r} value={r}>{r}</option>
    ))}
  </select>
</label>

              <label className="flex min-h-12 items-center gap-3 rounded-xl bg-[#FAF8FF] px-4 py-3 text-sm font-semibold text-[#49365E]">

                <input className="size-5 accent-[#6D3AA8]" type="checkbox" checked={isMinor} onChange={(e) => setIsMinor(e.target.checked)} />

                Patient is a child under 18

              </label>

              {isMinor && (

                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#49365E]"><span>Parent or guardian <RequiredMark /></span>

                  <input required className={FIELD_CLASS} placeholder="Full name" value={guardian} onChange={(e) => setGuardian(e.target.value)} />

                </label>

              )}

              {bookingError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{bookingError}</p>}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeBooking} disabled={bookingBusy} className="min-h-12 rounded-xl border border-[#D8C5EC] bg-white px-5 py-3 font-semibold text-[#5A2E8A] disabled:opacity-60">Cancel</button>
                <button type="submit" disabled={bookingBusy || !clinicId} aria-busy={bookingBusy} className="min-h-12 rounded-xl bg-[#6D3AA8] px-5 py-3 font-bold text-white shadow-sm transition hover:bg-[#572C87] disabled:cursor-not-allowed disabled:opacity-60">{bookingBusy ? "Booking..." : "Book appointment"}</button>
              </div>

            </form>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmation && (() => {

        const copy = confirmationCopy(confirmation);

        return (

          <ConfirmationModal

            open

            title={copy.title}

            description={copy.description}

            confirmLabel={copy.confirmLabel}

            cancelLabel={copy.cancelLabel}

            busy={confirmBusy}

            busyLabel={copy.busyLabel}

            tone={copy.tone}

            error={error}

            onCancel={() => {

              if (confirmBusy) return;

              setConfirmation(null);

              setError("");

            }}

            onConfirm={() => void confirmAction()}

          />

        );

      })()}

    </div>

  );

}
