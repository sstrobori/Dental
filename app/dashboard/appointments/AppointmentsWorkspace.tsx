"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SlotPicker from "@/components/SlotPicker";
import type { Settings } from "./BookingSettings";
import { BackLink } from "./AppointmentNavigation";
import { dayRangeManila, formatTime, todayManila } from "@/lib/today";
import { getArrivalTiming } from "@/lib/queuePolicy";
import { useVisitReasons } from "@/lib/useVisitReasons";


type Status = "booked" | "confirmed" | "cancelled" | "arrived" | "completed" | "no_show";
type Appt = {
  id: string; name: string; phone: string | null; reason: string | null;
  is_minor: boolean; guardian_name: string | null; starts_at: string; status: Status;
  changed_late: boolean; reschedule_count: number;
  deposit_amount: number; deposit_status: DepositStatus;
};
type Wait = { id: string; name: string; phone: string | null; reason: string | null; wanted_day: string | null };

const FIELD_CLASS = "min-h-12 w-full rounded-xl border border-[#E4D5F6] bg-white px-4 py-3 text-base text-[#2E1747] outline-none transition placeholder:text-[#9B8FA6] focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]";
const SMALL_BUTTON = "min-h-11 rounded-xl border border-[#D8C5EC] bg-white px-3 py-2 text-xs font-semibold text-[#5A2E8A] transition hover:bg-[#F8F3FF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCAF4]";

type DepositStatus = "none" | "required" | "received" | "refunded" | "forfeited" | "waived";
const DEPOSIT_LABEL: Record<DepositStatus, string> = {
  none: "", required: "waiting for payment", received: "received", refunded: "refunded", forfeited: "kept", waived: "waived",
};

function depositHint(a: { deposit_status: DepositStatus; status: string; changed_late: boolean }): string {
  if (a.deposit_status !== "received") return "";
  if (a.status === "no_show") return "No-show: the clinic may keep the deposit.";
  if (a.changed_late) return "Changed late: the clinic may keep the deposit.";
  if (a.status === "completed") return "Visit done: refund it or apply it to the bill.";
  if (a.status === "cancelled") return "Cancelled early: refund the deposit.";
  return "";
}

export default function AppointmentsWorkspace({ view }: { view: "scheduled" | "book" | "all" }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const rootPath = pathname.replace(/\/(scheduled|book)\/?$/, "");
  const waitlistFilled = useRef(false);
  const [clinicId, setClinicId] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [today, setToday] = useState("");
  const [day, setDay] = useState("");
  const [appts, setAppts] = useState<Appt[]>([]);
  const [waitlist, setWaitlist] = useState<Wait[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [clock, setClock] = useState(0);

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

  const load = useCallback(async () => {
    if (!clinicId || !day) return;
    const [start, end] = dayRangeManila(day);
    const { data } = await supabase
      .from("appointments").select("*").eq("clinic_id", clinicId)
      .gte("starts_at", start).lt("starts_at", end).order("starts_at");
    setAppts((data ?? []) as Appt[]);
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
    if (error) setError(error.message);
    load();
  }

  async function setDeposit(id: string, deposit_status: DepositStatus) {
    setError("");
    const { error } = await supabase.from("appointments").update({ deposit_status }).eq("id", id);
    if (error) setError(error.message);
    load();
  }

  async function arrived(appointment: Appt) {
    setError(""); setNotice("");
    const grace = settings?.grace_minutes ?? 15;
    const timing = getArrivalTiming(appointment.starts_at, clock, grace);
    if (timing.window === "late" && !window.confirm(
      `${appointment.name} is ${timing.minutesAfterStart} minutes late (the grace period is ${grace} minutes). ` +
      "Check them in at the back of the live queue? You can reposition them from the queue board.",
    )) return;
    const { data, error } = await supabase.rpc("mark_arrived", { p_appointment_id: appointment.id });
    if (error) return setError(error.message);
    setNotice(
      timing.window === "late"
        ? `Late arrival checked in as #${data.queue_number} at the back of the queue. Use the live queue to put them next or move them later.`
        : `Checked in and added to the queue as #${data.queue_number}.`,
    );
    load();
  }

  async function copyLink(id: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/c/${clinicId}?appt=${id}`);
    setNotice("Patient link copied. Send it to the patient so they can confirm or change the time.");
  }

  async function bookForPatient(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setNotice("");
    if (!name.trim()) return setError("Enter the patient's name.");
    if (!slot) return setError("Pick a date and a time.");
    if (isMinor && !guardian.trim()) return setError("Enter the guardian's name.");
    const { data, error } = await supabase.rpc("book_appointment", {
      p_clinic_id: clinicId, p_name: name, p_phone: phone, p_reason: reason, p_starts_at: slot,
      p_is_minor: isMinor, p_guardian: isMinor ? guardian : null, p_by_staff: true,
    });
    if (error) return setError(error.message);
    if (fromWaitlist) await supabase.from("waitlist").update({ status: "booked", booked_at: new Date().toISOString() }).eq("id", fromWaitlist);
    await navigator.clipboard.writeText(`${window.location.origin}/c/${clinicId}?appt=${data.id}`).catch(() => {});
    setNotice(`Booked for ${formatTime(slot)}. The patient link was copied. Send it to the patient.`);
    setName(""); setPhone(""); setReason(""); setIsMinor(false); setGuardian(""); setSlot(""); setFromWaitlist("");
    setPickerKey((n) => n + 1);
    load();
  }

  function fillFromWaitlist(w: Wait) {
    if (view !== "all") {
      router.push(`${rootPath}/book?waitlist=${encodeURIComponent(w.id)}`);
      return;
    }
    // On the main Appointments tab, prefill the booking form on the same page.
    setName(w.name);
    setPhone(w.phone ?? "");
    setReason(w.reason ?? "");
    setFromWaitlist(w.id);
    setNotice(`Details for ${w.name} are filled in. Choose a time and book.`);
    document.getElementById("staff-booking-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    if (view !== "book" || waitlistFilled.current || !clinicId) return;
    const id = new URLSearchParams(window.location.search).get("waitlist");
    if (!id) return;
    const person = waitlist.find((w) => w.id === id);
    if (!person) return;
    waitlistFilled.current = true;
    setName(person.name);
    setPhone(person.phone ?? "");
    setReason(person.reason ?? "");
    setFromWaitlist(person.id);
    setNotice(`Details for ${person.name} are filled in. Choose a time and book.`);
  }, [view, clinicId, waitlist]);

  async function removeWait(id: string) {
    await supabase.from("waitlist").update({ status: "removed" }).eq("id", id);
    load();
  }

  const isToday = !!today && day === today;
  const badge: Record<Status, string> = {
    booked: "bg-amber-50 text-amber-800 ring-amber-200", confirmed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    cancelled: "bg-slate-100 text-slate-600 ring-slate-200", arrived: "bg-[#F2EAFF] text-[#5A2E8A] ring-[#E4D5F6]",
    completed: "bg-slate-100 text-slate-600 ring-slate-200", no_show: "bg-red-50 text-red-700 ring-red-200",
  };
  const label: Record<Status, string> = {
    booked: "Not confirmed", confirmed: "Confirmed", cancelled: "Cancelled",
    arrived: "Checked in", completed: "Done", no_show: "No-show",
  };

  return (
    <div className="w-full px-4 py-5 text-[#2E1747] sm:px-6 sm:py-7 lg:px-8">
      {view !== "all" && <BackLink label="Back to Appointments" />}
      <header className={`${view === "all" ? "" : "mt-4 "}flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between`}>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8B5CB5]">Clinic schedule</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {view === "all" ? "Appointments" : view === "scheduled" ? "Scheduled patients" : "Book for a patient"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(view === "scheduled" || view === "all") && day && (
            <span className="inline-flex w-fit rounded-full bg-[#F2EAFF] px-3 py-1.5 text-xs font-semibold text-[#6D3AA8]">
              {isToday ? "Today" : new Date(`${day}T00:00:00+08:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          )}
        </div>
      </header>

      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{notice}</p>}

      <div className={view === "all" ? "mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)] xl:items-start" : "mt-6"}>
        {(view === "scheduled" || view === "all") && (
        <section aria-labelledby="schedule-heading" className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">
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

          {day && appts.length === 0 && (
            <div className="mt-5 rounded-xl bg-[#FAF8FF] p-5 text-center text-sm text-[#6F647A]">No appointments on this day.</div>
          )}
          <ul className="mt-5 flex flex-col gap-3">
            {appts.map((a) => {
              const open = a.status === "booked" || a.status === "confirmed";
              const past = clock > 0 && new Date(a.starts_at).getTime() < clock;
              const arrivalTiming = open && clock > 0 ? getArrivalTiming(a.starts_at, clock, settings?.grace_minutes ?? 15) : null;
              return (
                <li key={a.id} className="rounded-2xl border border-[#E4D5F6] bg-[#FCFAFF] p-4 text-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-[#2E1747]">{formatTime(a.starts_at)} · {a.name}</p>
                      <p className="mt-1 break-words text-[#6F647A]">
                        {a.reason ?? "No reason"} · {a.phone ?? "no phone"}
                        {a.is_minor && ` · child, guardian: ${a.guardian_name ?? "not given"}`}
                      </p>
                      {a.deposit_status !== "none" && (
                        <div className="mt-3 rounded-xl bg-white p-3 text-xs text-[#5D5068]">
                          <span className="font-bold text-[#49365E]">Deposit {"\u20B1"}{a.deposit_amount}: {DEPOSIT_LABEL[a.deposit_status]}</span>
                          {depositHint(a) && <span className="mt-1 block text-amber-700">{depositHint(a)}</span>}
                          <span className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            {a.deposit_status === "required" && (
                              <>
                                <button type="button" onClick={() => setDeposit(a.id, "received")} className={SMALL_BUTTON}>Mark received</button>
                                <button type="button" onClick={() => setDeposit(a.id, "waived")} className={SMALL_BUTTON}>Waive</button>
                              </>
                            )}
                            {a.deposit_status === "received" && (
                              <>
                                <button type="button" onClick={() => setDeposit(a.id, "forfeited")} className={SMALL_BUTTON}>Keep deposit</button>
                                <button type="button" onClick={() => setDeposit(a.id, "refunded")} className={SMALL_BUTTON}>Refunded</button>
                              </>
                            )}
                          </span>
                        </div>
                      )}
                      {(a.changed_late || a.reschedule_count > 0) && (
                        <p className="mt-2 text-xs font-medium text-amber-700">
                          {a.changed_late ? "Late change. " : ""}{a.reschedule_count > 0 ? `Moved ${a.reschedule_count}x.` : ""}
                        </p>
                      )}
                      {isToday && open && arrivalTiming?.window === "grace" && (
                        <p className="mt-2 text-xs font-medium text-amber-700">
                          {arrivalTiming.minutesAfterStart} min late · still within the {settings?.grace_minutes ?? 15}-min grace period
                        </p>
                      )}
                      {isToday && open && arrivalTiming?.window === "late" && (
                        <p className="mt-2 text-xs font-medium text-red-700">
                          Late arrival · {arrivalTiming.minutesAfterStart} min after the appointment ({arrivalTiming.minutesPastGrace} min past grace)
                        </p>
                      )}
                    </div>
                    <span className={`w-fit whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${badge[a.status]}`}>{label[a.status]}</span>
                  </div>
                  {open && (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {isToday && <button type="button" onClick={() => arrived(a)} className="min-h-11 rounded-xl bg-[#6D3AA8] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3]">
                        {arrivalTiming?.window === "late" ? "Check in late" : "Arrived"}
                      </button>}
                      {a.status === "booked" && <button type="button" onClick={() => setStatus(a.id, "confirmed")} className={SMALL_BUTTON}>Mark confirmed</button>}
                      {past && <button type="button" onClick={() => setStatus(a.id, "no_show")} className={SMALL_BUTTON}>No-show</button>}
                      <button type="button" onClick={() => copyLink(a.id)} className={SMALL_BUTTON}>Copy patient link</button>
                      <button type="button" onClick={() => window.confirm("Cancel this appointment?") && setStatus(a.id, "cancelled")} className="min-h-11 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50">Cancel</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

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
                      <button type="button" onClick={() => removeWait(w.id)} className={SMALL_BUTTON}>Remove</button>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-[#80748B]">Call these patients when a slot opens up.</p>
            </div>
          )}
        </section>
        )}

        {(view === "book" || view === "all") && (
        <section aria-labelledby="staff-booking-heading" className={`${view === "all" ? "xl:sticky xl:top-6" : "mx-auto max-w-3xl"} rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6` }>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B5CB5]">Front desk</p>
          <h2 id="staff-booking-heading" className="mt-1 text-xl font-bold">Book for a patient</h2>
          <p className="mt-1 text-sm text-[#6F647A]">Choose a free time and enter the patient&apos;s details.</p>
          {clinicId && (
            <form onSubmit={bookForPatient} className="mt-5 flex flex-col gap-4">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-[#49365E]">Appointment time</legend>
                <SlotPicker key={pickerKey} clinicId={clinicId} value={slot} onChange={setSlot} ignoreNotice />
              </fieldset>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#49365E]">Patient name
                <input className={FIELD_CLASS} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#49365E]">Mobile number <span className="text-xs font-normal text-[#80748B]">Optional</span>
                <input className={FIELD_CLASS} placeholder="e.g. 0917 123 4567" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#49365E]">Reason for visit
                <select className={FIELD_CLASS} value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="">Select a reason</option>
                  {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-xl bg-[#FAF8FF] px-4 py-3 text-sm font-semibold text-[#49365E]">
                <input className="size-5 accent-[#6D3AA8]" type="checkbox" checked={isMinor} onChange={(e) => setIsMinor(e.target.checked)} />
                Patient is a child under 18
              </label>
              {isMinor && (
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#49365E]">Parent or guardian
                  <input className={FIELD_CLASS} placeholder="Full name" value={guardian} onChange={(e) => setGuardian(e.target.value)} />
                </label>
              )}
              <button className="min-h-12 rounded-xl bg-[#6D3AA8] px-5 py-3 font-bold text-white shadow-sm transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3]">Book appointment</button>
            </form>
          )}
        </section>
        )}
      </div>
      {view === "book" && <div className="mt-5 text-center"><Link href={`${rootPath}/scheduled`} className="text-sm font-semibold text-[#6D3AA8] underline-offset-4 hover:underline">View scheduled patients</Link></div>}
    </div>
  );
}
