"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { estimateLabel } from "@/lib/today";
import { loadQueueEstimateMetadata } from "@/lib/queueEstimate";
import ConfirmationModal from "@/components/ConfirmationModal";

type Ticket = {
  clinic: string;
  queue_number: number;
  status: "waiting" | "called" | "served" | "skipped" | "no_show" | "cancelled";
  people_ahead: number;
  now_serving: number | null;
  returning: boolean;
  name: string;
  est_minutes?: number | null;
  current_visit_delayed?: boolean;
};

type SyncState = "connecting" | "live" | "fallback" | "offline";

export default function TicketView({ entryId }: { entryId: string }) {
  const supabase = createClient();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("connecting");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [refreshError, setRefreshError] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");

  const load = useCallback(async () => {
    const [{ data, error }, metadata] = await Promise.all([
      supabase.rpc("queue_status", { p_entry_id: entryId }),
      loadQueueEstimateMetadata(supabase, [entryId]),
    ]);
    if (error) {
      setRefreshError("Updates are temporarily delayed. Your last known position is still shown.");
      setSyncState(navigator.onLine ? "fallback" : "offline");
      setLoaded(true);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const estimate = metadata?.get(entryId);
    setTicket((current) => row ? {
      ...(row as Ticket),
      ...(estimate ? {
        people_ahead: estimate.people_ahead,
        est_minutes: estimate.est_minutes,
        current_visit_delayed: estimate.current_visit_delayed,
      } : metadata === null && current ? {
        people_ahead: current.people_ahead,
        est_minutes: current.est_minutes,
        current_visit_delayed: current.current_visit_delayed,
      } : {}),
    } : null);
    setRefreshError("");
    setLastUpdatedAt(new Date());
    setLoaded(true);
  }, [supabase, entryId]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void load(), 0);
    const channel = supabase
      .channel(`patient-ticket-${entryId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries", filter: `id=eq.${entryId}` },
        () => load(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setSyncState("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setSyncState(navigator.onLine ? "fallback" : "offline");
        }
      });
    const timer = window.setInterval(load, 5000);
    const onOnline = () => { setSyncState("connecting"); load(); };
    const onOffline = () => setSyncState("offline");
    const onVisibility = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [supabase, entryId, load]);

  async function confirmLeave() {
    if (leaving) return;
    setLeaving(true);
    setLeaveError("");
    try {
      const { error } = await supabase.rpc("leave_queue", { p_entry_id: entryId });
      if (error) {
        setLeaveError(`Could not leave the queue: ${error.message}`);
        return;
      }
      setLeaveOpen(false);
      await load();
    } catch {
      setLeaveError("Something went wrong. Please check your queue status and try again.");
    } finally {
      setLeaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="rounded-3xl border border-[#E4D5F6] bg-white p-6 shadow-sm" role="status">
        <div className="h-4 w-32 animate-pulse rounded-full bg-[#E9DDF7]" />
        <div className="mx-auto mt-8 h-24 w-40 animate-pulse rounded-2xl bg-[#F2EAFF]" />
        <p className="mt-6 text-center text-sm font-medium text-[#6F647A]">Loading your ticket…</p>
      </div>
    );
  }
  if (!ticket) {
    return (
      <div className="rounded-3xl border border-[#E4D5F6] bg-white p-6 text-center shadow-sm" role="alert">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#F2EAFF] text-[#6D3AA8]" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v5m0 3h.01" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-bold text-[#2E1747]">Ticket not found</h2>
        <p className="mt-2 text-sm leading-6 text-[#6F647A]">Please ask the front desk to check your queue entry.</p>
      </div>
    );
  }

  const message: Record<Ticket["status"], string> = {
    waiting:
      ticket.people_ahead === 0
        ? "You are next."
        : `${ticket.people_ahead} ${ticket.people_ahead === 1 ? "person" : "people"} ahead of you.`,
    called: "It is your turn. Please go to the front desk.",
    served: "Your visit is complete. Thank you!",
    skipped: "The clinic has placed your ticket on hold. Please see the front desk to rejoin.",
    no_show: "This ticket was closed. Please see the front desk.",
    cancelled: "You left the queue. You can join again anytime.",
  };

  const isCalled = ticket.status === "called";
  const isWaiting = ticket.status === "waiting";

  return (
    <>
    <div
      className={`relative overflow-hidden rounded-[1.75rem] border p-5 text-center shadow-[0_18px_50px_-30px_rgba(70,34,103,0.5)] sm:p-8 ${
        isCalled
          ? "border-transparent bg-gradient-to-br from-[#6D3AA8] to-[#452064] text-white"
          : "border-[#E4D5F6] bg-white text-[#2E1747]"
      }`}
    >
      <div className={`absolute -right-12 -top-12 size-36 rounded-full ${isCalled ? "bg-white/10" : "bg-[#F2EAFF]"}`} aria-hidden="true" />
      <div className={`absolute -bottom-20 -left-16 size-44 rounded-full ${isCalled ? "bg-white/5" : "bg-[#FAF8FF]"}`} aria-hidden="true" />

      <div className="relative flex flex-col items-center">
        <div className={`inline-flex min-h-8 items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${isCalled ? "bg-white/15 text-white" : "bg-[#F2EAFF] text-[#6D3AA8]"}`}>
          <span className={`size-2 rounded-full ${isCalled ? "animate-pulse bg-white" : isWaiting ? "bg-emerald-500" : "bg-[#9B83B5]"}`} aria-hidden="true" />
          {isCalled ? "Now calling" : isWaiting ? "In the queue" : "Queue update"}
        </div>

        <p className={`mt-5 text-sm font-medium ${isCalled ? "text-white/80" : "text-[#6F647A]"}`}>{ticket.clinic}</p>
        <p className={`mt-5 text-xs font-bold uppercase tracking-[0.2em] ${isCalled ? "text-white/70" : "text-[#8A759F]"}`}>Your queue number</p>

        <div aria-live={isCalled ? "assertive" : "polite"} aria-atomic="true">
          <p className="mt-1 text-[clamp(4.5rem,24vw,7.5rem)] font-extrabold leading-none tracking-[-0.06em]">
            #{ticket.queue_number}
          </p>
          <p className="mx-auto mt-5 max-w-md text-xl font-bold leading-tight sm:text-2xl">{message[ticket.status]}</p>
        </div>

        {ticket.returning && isWaiting && (
          <p className="mt-3 rounded-full bg-[#F2EAFF] px-4 py-2 text-sm font-semibold text-[#5A2E8A]">Welcome back, {ticket.name}!</p>
        )}

        {isWaiting && (ticket.est_minutes != null || ticket.now_serving !== null) && (
          <div className="mt-5 grid w-full max-w-md gap-2 rounded-2xl border border-[#E4D5F6] bg-[#FAF8FF] p-4 text-sm text-[#554A61] sm:grid-cols-2">
            {ticket.est_minutes != null && <p className="font-semibold">{estimateLabel(ticket.est_minutes)}</p>}
            {ticket.now_serving !== null && <p className="font-medium">Now serving #{ticket.now_serving}</p>}
          </div>
        )}

        {isWaiting && ticket.current_visit_delayed && (
          <p className="mt-3 w-full max-w-md rounded-xl border border-[#DCCBED] bg-[#F7F2FC] px-3 py-2.5 text-xs font-medium leading-5 text-[#5C327F]" role="status">
            A current visit is taking longer than expected. Your estimated waiting time may change.
          </p>
        )}

        {isWaiting && (
          <button
            type="button"
            onClick={() => {
              setLeaveError("");
              setLeaveOpen(true);
            }}
            className="mt-5 min-h-11 rounded-xl border border-[#CDB8E5] bg-white px-5 py-2.5 text-sm font-semibold text-[#5A2E8A] transition hover:border-[#6D3AA8] hover:bg-[#F8F3FF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DDCAF4]"
          >
            Leave the queue
          </button>
        )}

        {refreshError && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900" role="alert">
            {refreshError}
          </p>
        )}
        <p
          role="status"
          className={`mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
            isCalled
              ? "bg-white/10 text-white/80"
              : syncState === "offline"
                ? "bg-red-50 text-red-700"
                : "bg-[#F7F2FC] text-[#6F647A]"
          }`}
          title={lastUpdatedAt ? `Last updated ${lastUpdatedAt.toLocaleTimeString("en-PH")}` : undefined}
        >
          {syncState === "live" && "● Live updates connected"}
          {syncState === "connecting" && "Connecting to live updates…"}
          {syncState === "fallback" && "Reconnecting · checking every 5 seconds"}
          {syncState === "offline" && "Offline · showing your last known position"}
        </p>
      </div>
    </div>
    <ConfirmationModal
      open={leaveOpen}
      title="Are you sure you want to leave the queue?"
      description="You will lose your current place in the queue. You will need to join again to get a new queue number."
      confirmLabel="Yes, leave queue"
      cancelLabel="Keep my place"
      busy={leaving}
      busyLabel="Leaving…"
      tone="danger"
      error={leaveError}
      onCancel={() => {
        if (leaving) return;
        setLeaveOpen(false);
        setLeaveError("");
      }}
      onConfirm={() => void confirmLeave()}
    />
    </>
  );
}
