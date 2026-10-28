"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AppointmentStatus = {
  status: string;
  starts_at: string;
};

function calendarDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Only offers a calendar reminder after the database reports that staff
 * have confirmed the appointment. No Google login or OAuth is required:
 * the patient reviews the pre-filled event and chooses Save in Google Calendar.
 */
export default function GoogleCalendarOption({
  appointmentId,
  clinicName,
  durationMinutes = 30,
}: {
  appointmentId: string;
  clinicName?: string | null;
  /** Calendar placeholder length until your booking system stores a real end time. */
  durationMinutes?: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [appointment, setAppointment] = useState<AppointmentStatus | null>(null);

  useEffect(() => {
    if (!appointmentId) {
      return;
    }

    let cancelled = false;

    async function refresh() {
      const { data, error } = await supabase.rpc("appointment_status", {
        p_id: appointmentId,
      });

      if (cancelled) return;

      if (
        error ||
        !data ||
        typeof data.status !== "string" ||
        typeof data.starts_at !== "string"
      ) {
        setAppointment(null);
        return;
      }

      setAppointment({ status: data.status, starts_at: data.starts_at });
    }

    void refresh();

    // Pick up staff confirmation while the patient has the portal open.
    const timer = window.setInterval(() => void refresh(), 20000);
    const onFocus = () => void refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [appointmentId, supabase]);

  if (appointment?.status === "booked") {
    return (
      <p className="mt-3 text-xs font-medium text-amber-800">
        Awaiting clinic confirmation. You can add this appointment to your
        Google Calendar once the clinic confirms it.
      </p>
    );
  }

  if (appointment?.status !== "confirmed") return null;

  const start = new Date(appointment.starts_at);
  if (Number.isNaN(start.getTime())) return null;

  const minutes =
    Number.isFinite(durationMinutes) && durationMinutes > 0
      ? Math.round(durationMinutes)
      : 30;
  const end = new Date(start.getTime() + minutes * 60_000);

  const title = clinicName
    ? `Dental Appointment - ${clinicName}`
    : "Dental Appointment";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${calendarDate(start)}/${calendarDate(end)}`,
    stz: "Asia/Manila",
    etz: "Asia/Manila",
    details:
      "Your dental appointment has been confirmed by the clinic. " +
      "Follow clinic instructions for arrival. " +
      "If your appointment changes, check the clinic portal and update this " +
      "calendar event manually. " +
      `Calendar duration is an estimate (${minutes} minutes).`,
  });

  const url = `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`;

  return (
    <div className="mt-3 flex flex-col items-start gap-1.5">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#D7C4EA] bg-white px-4 py-2.5 text-sm font-bold text-[#6D3AA8] transition hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6]"
      >
        <svg
          className="h-4 w-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4m8-4v4M3 10h18m9 4v5m-2.5-2.5h5" />
        </svg>
        Add to Google Calendar
        <span aria-hidden="true">↗</span>
      </a>
      <p className="text-xs text-[#756581]">
        Opens Google Calendar to review and save your appointment reminder.
      </p>
    </div>
  );
}
