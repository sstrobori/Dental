"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SlotPicker from "@/components/SlotPicker";
import { formatDateTime } from "@/lib/today";
import { downloadIcs, googleCalendarUrl, type CalEvent } from "@/lib/calendar";

type Appt = {
  id: string;
  clinic_id: string;
  clinic: string;
  name: string;
  reason: string | null;
  starts_at: string;
  duration_min: number;
  status: "booked" | "confirmed" | "cancelled" | "arrived" | "completed" | "no_show";
  queue_entry_id: string | null;
  can_change: boolean;
  late: boolean;
  deposit_amount: number;
  deposit_status: string;
  deposit_instructions: string | null;
};

const LABEL: Record<Appt["status"], string> = {
  booked: "Please confirm your appointment",
  confirmed: "Your appointment is confirmed",
  cancelled: "This appointment was cancelled",
  arrived: "You are checked in",
  completed: "This visit is complete. Thank you!",
  no_show: "This appointment was marked as missed",
};

const DEPOSIT_LABEL: Record<string, string> = {
  required: "waiting for payment", received: "received", refunded: "refunded", forfeited: "kept by the clinic",
};

export default function AppointmentView({
  appointmentId,
  onOpenTicket,
}: {
  appointmentId: string;
  onOpenTicket?: (entryId: string) => void;
}) {
  const supabase = createClient();
  const [appt, setAppt] = useState<Appt | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [moving, setMoving] = useState(false);
  const [newSlot, setNewSlot] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("appointment_status", { p_id: appointmentId });
    setAppt(data as Appt | null);
    setLoaded(true);
  }, [supabase, appointmentId]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(kickoff);
  }, [load]);

  async function run(fn: string, args: Record<string, string>) {
    setError("");
    const { error } = await supabase.rpc(fn, args);
    if (error) return setError(error.message);
    setMoving(false);
    setNewSlot("");
    load();
  }

  function confirmAppt() { run("confirm_appointment", { p_id: appointmentId }); }

  function cancelAppt() {
    const warning = appt?.late ? "\n\nThis is within 24 hours of your appointment, so the clinic will see it as a late change." : "";
    if (!window.confirm(`Cancel this appointment?${warning}`)) return;
    run("cancel_appointment", { p_id: appointmentId });
  }

  function moveAppt() {
    if (!newSlot) return setError("Pick a new time first.");
    run("reschedule_appointment", { p_id: appointmentId, p_new_start: newSlot });
  }

  if (!loaded) {
    return (
      <div className="rounded-3xl border border-[#E4D5F6] bg-white p-6 shadow-sm" role="status">
        <div className="h-5 w-48 animate-pulse rounded-full bg-[#E9DDF7]" />
        <div className="mt-5 h-28 animate-pulse rounded-2xl bg-[#F2EAFF]" />
        <p className="mt-5 text-sm font-medium text-[#6F647A]">Loading your appointment…</p>
      </div>
    );
  }
  if (!appt) {
    return (
      <div className="rounded-3xl border border-[#E4D5F6] bg-white p-6 text-center shadow-sm" role="alert">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#F2EAFF] text-[#6D3AA8]" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v5m0 3h.01" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-bold text-[#2E1747]">Appointment not found</h2>
        <p className="mt-2 text-sm leading-6 text-[#6F647A]">Please call the clinic so they can help locate your booking.</p>
      </div>
    );
  }

  const start = new Date(appt.starts_at);
  const event: CalEvent = {
    id: appt.id,
    title: `Dental appointment at ${appt.clinic}`,
    start,
    end: new Date(start.getTime() + appt.duration_min * 60000),
    details: `Appointment for ${appt.name} at ${appt.clinic}.`,
  };
  const active = appt.status === "booked" || appt.status === "confirmed";

  const statusTone = appt.status === "confirmed" || appt.status === "arrived" || appt.status === "completed"
    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
    : appt.status === "cancelled" || appt.status === "no_show"
      ? "bg-red-50 text-red-700 ring-red-200"
      : "bg-[#F2EAFF] text-[#6D3AA8] ring-[#E4D5F6]";

  return (
    <div className="flex flex-col gap-5 text-[#2E1747]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#6F647A]">{appt.clinic}</p>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${statusTone}`}>
            {appt.status.replace("_", " ")}
          </span>
        </div>
        <h2 className="mt-2 text-2xl font-extrabold leading-tight text-[#2E1747] sm:text-3xl">{LABEL[appt.status]}</h2>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-[#E4D5F6] bg-[#FAF8FF] p-4 sm:p-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#6D3AA8] text-white shadow-sm" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-snug text-[#2E1747] sm:text-xl">{formatDateTime(appt.starts_at)}</p>
          <p className="mt-1 text-sm leading-6 text-[#6F647A]">For {appt.name}{appt.reason ? ` · ${appt.reason}` : ""}</p>
        </div>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">{error}</p>}

      {appt.deposit_amount > 0 && appt.deposit_status !== "none" && appt.deposit_status !== "waived" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">Deposit: {"\u20B1"}{appt.deposit_amount} ({DEPOSIT_LABEL[appt.deposit_status] ?? appt.deposit_status})</p>
          {appt.deposit_status === "required" && (
            <>
              <p className="mt-2">Pay the clinic directly, then show your payment at the front desk.</p>
              {appt.deposit_instructions && <p className="mt-2 whitespace-pre-wrap">{appt.deposit_instructions}</p>}
            </>
          )}
          <p className="mt-2 text-xs leading-5 text-amber-800">
            The clinic deposit rules apply. Changing the appointment within 24 hours, or missing it, may mean the clinic keeps the deposit. Ask the front desk if you are unsure.
          </p>
        </div>
      )}

      {appt.can_change && (
        <div className="flex flex-col gap-3">
          {appt.status === "booked" && (
            <button onClick={confirmAppt} className="min-h-12 rounded-xl bg-[#6D3AA8] px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCAF4]">
              Confirm my appointment
            </button>
          )}
          {!moving ? (
            <button onClick={() => setMoving(true)} className="min-h-12 rounded-xl border border-[#CDB8E5] bg-white px-4 py-3 font-semibold text-[#5A2E8A] transition hover:bg-[#F8F3FF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCAF4]">Change the time</button>
          ) : (
            <div className="flex flex-col gap-3 rounded-2xl border border-[#E4D5F6] bg-[#FAF8FF] p-4">
              <SlotPicker clinicId={appt.clinic_id} value={newSlot} onChange={setNewSlot} appearance="patient" />
              <button onClick={moveAppt} className="min-h-12 rounded-xl bg-[#6D3AA8] px-4 py-3 font-bold text-white transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCAF4]">Move my appointment</button>
              <button onClick={() => setMoving(false)} className="min-h-11 rounded-xl px-3 py-2 text-sm font-semibold text-[#5A2E8A] underline decoration-[#B99AD9] underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCAF4]">Never mind</button>
            </div>
          )}
          <button onClick={cancelAppt} className="min-h-12 rounded-xl border border-red-200 bg-white px-4 py-3 font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100">Cancel appointment</button>
          {appt.late && (
            <p className="text-xs leading-5 text-[#6F647A]">Changes within 24 hours of the appointment are marked as late changes.</p>
          )}
        </div>
      )}

      {active && (
        <div className="rounded-2xl border border-[#E4D5F6] bg-white p-4">
          <p className="text-sm font-bold text-[#2E1747]">Add to your calendar</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center rounded-xl border border-[#D8C5EC] px-3 py-2 text-center text-sm font-semibold text-[#5A2E8A] transition hover:bg-[#F8F3FF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCAF4]">Google Calendar</a>
            <button onClick={() => downloadIcs(event)} className="min-h-11 rounded-xl border border-[#D8C5EC] px-3 py-2 text-sm font-semibold text-[#5A2E8A] transition hover:bg-[#F8F3FF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCAF4]">Apple / Outlook (.ics)</button>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#6F647A]">When you arrive, tell the front desk your name. They will check you in.</p>
        </div>
      )}

      {appt.status === "arrived" && appt.queue_entry_id && (
        onOpenTicket ? (
          <button onClick={() => onOpenTicket(appt.queue_entry_id as string)} className="min-h-12 rounded-xl bg-[#6D3AA8] px-4 py-3 text-center font-bold text-white transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCAF4]">
            See my place in line
          </button>
        ) : (
          <Link href={`/q/${appt.queue_entry_id}`} className="flex min-h-12 items-center justify-center rounded-xl bg-[#6D3AA8] px-4 py-3 text-center font-bold text-white transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCAF4]">
            See my place in line
          </Link>
        )
      )}
      <p className="text-center text-xs leading-5 text-[#7B6E88]">Bookmark this page so you can find your appointment later.</p>
    </div>
  );
}
