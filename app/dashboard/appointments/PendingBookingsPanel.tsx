"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/today";

type PendingBooking = {
  id: string;
  name: string;
  starts_at: string;
  reason: string | null;
  phone: string | null;
  is_minor: boolean;
  guardian_name: string | null;
};

export default function PendingBookingsPanel({
  clinicId,
  onConfirmed,
  embedded = false,
}: {
  clinicId: string;
  onConfirmed?: () => void;
  embedded?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [bookings, setBookings] = useState<PendingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!clinicId) return;

    // Load every pending booking, not only the selected schedule date.
    // Page through results so the default Supabase row limit cannot hide requests.
    const pageSize = 200;
    const all: PendingBooking[] = [];

    for (let offset = 0; ; offset += pageSize) {
      const { data, error: fetchError } = await supabase
        .from("appointments")
        .select("id, name, starts_at, reason, phone, is_minor, guardian_name")
        .eq("clinic_id", clinicId)
        .eq("status", "booked")
        .order("starts_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (fetchError) {
        setError(`Could not load pending bookings: ${fetchError.message}`);
        setLoading(false);
        return;
      }

      const batch = (data ?? []) as PendingBooking[];
      all.push(...batch);
      if (batch.length < pageSize) break;
    }

    setBookings(all);
    setError("");
    setLoading(false);
  }, [clinicId, supabase]);

  useEffect(() => {
    if (!clinicId) return;

    const kickoff = window.setTimeout(() => void refresh(), 0);
    const channel = supabase
      .channel(`pending-bookings-${clinicId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    const timer = window.setInterval(() => void refresh(), 30000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [clinicId, refresh, supabase]);

  async function confirmBooking(booking: PendingBooking) {
    if (confirmingId) return;
    setConfirmingId(booking.id);
    setError("");
    setNotice("");

    try {
      const { data, error: confirmError } = await supabase
        .from("appointments")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", booking.id)
        .eq("clinic_id", clinicId)
        .eq("status", "booked")
        .select("id")
        .maybeSingle();

      if (confirmError) {
        setError(`Could not confirm the appointment: ${confirmError.message}`);
        return;
      }
      if (!data) {
        setError("This booking is no longer pending or you do not have permission to confirm it.");
        await refresh();
        return;
      }

      setBookings((current) => current.filter((item) => item.id !== booking.id));
      setNotice(`${booking.name}'s appointment has been confirmed.`);
      onConfirmed?.();
      await refresh();
    } catch {
      setError("Something went wrong while confirming. Please refresh and try again.");
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <section
      aria-labelledby="pending-bookings-heading"
      className={`${embedded ? "" : "mt-6 "}min-w-0 rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B5CB5]">
            Booking approvals
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 id="pending-bookings-heading" className="text-xl font-bold text-[#2E1747]">
              Pending confirmations
            </h2>
            {!loading && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                {bookings.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      {loading ? (
        <p role="status" className="mt-5 text-sm text-[#6F647A]">Loading pending bookings...</p>
      ) : bookings.length === 0 && !error ? (
        <p className="mt-5 rounded-xl bg-[#FAF8FF] p-4 text-sm text-[#6F647A]">
          No bookings are awaiting confirmation.
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="flex flex-col gap-3 rounded-xl border border-[#E9DDF7] bg-[#FCFAFF] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-bold text-[#2E1747]">{booking.name}</p>
                <p className="mt-1 text-sm font-medium text-[#6D3AA8]">
                  {formatDateTime(booking.starts_at)}
                </p>
                <p className="mt-1 break-words text-sm text-[#6F647A]">
                  {booking.reason || "Reason not specified"}
                  {booking.phone ? ` · ${booking.phone}` : ""}
                  {booking.is_minor && booking.guardian_name
                    ? ` · Guardian: ${booking.guardian_name}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={confirmingId !== null}
                aria-busy={confirmingId === booking.id}
                onClick={() => void confirmBooking(booking)}
                className="min-h-11 self-end shrink-0 rounded-xl border border-[#32965F] bg-[#E8F6ED] px-5 py-2.5 text-sm font-bold text-[#247344] transition hover:bg-[#D4EDDD] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 sm:self-center"              >
                {confirmingId === booking.id ? "Confirming..." : "Confirm booking"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
