"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadQueueEstimateMetadata } from "@/lib/queueEstimate";
import QueueTicketCard from "@/components/patient/QueueTicketCard";

type QueueStatus = {
  id?: string;
  entry_id?: string;
  status?: string;
  queue_number?: number | null;
  name?: string | null;
  person?: string | null;
  people_ahead?: number | null;
  est_minutes?: number | null;
  now_serving?: number | null;
  current_visit_delayed?: boolean;
  created_at?: string;
};

export default function GuestQueueTicket({
  entryId,
  onExit,
}: {
  entryId: string;
  onExit?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [ticket, setTicket] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const [{ data, error: statusError }, metadata] = await Promise.all([
      supabase.rpc("queue_status", { p_entry_id: entryId }),
      loadQueueEstimateMetadata(supabase, [entryId]),
    ]);
    if (statusError) {
      setError(`Unable to update your queue status: ${statusError.message}`);
    } else {
      const row = Array.isArray(data) ? data[0] : data;
      const estimate = metadata?.get(entryId);
      setTicket((current) => row ? {
        ...(row as QueueStatus),
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
      setError("");
    }
    setLoading(false);
  }, [entryId, supabase]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void refresh(true), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const status = ticket?.status ?? "";
  const active = status === "waiting" || status === "called";
  const queueNumber = ticket?.queue_number ?? null;

  return (
    <section aria-label="Your queue status" className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B5CB5]">Live status</p>
          <h2 className="mt-1 text-lg font-bold text-[#2E1747]">Your queue</h2>
        </div>
        {active && (
          <span className="rounded-full bg-[#F2EAFF] px-3 py-1 text-xs font-semibold text-[#6D3AA8]">
            {status === "called" ? "Called" : "In line"}
          </span>
        )}
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && !ticket ? (
        <p role="status" className="rounded-xl bg-[#FAF8FF] p-4 text-sm text-[#756581]">Loading your queue status…</p>
      ) : !ticket ? (
        <p className="rounded-xl bg-[#FAF8FF] p-4 text-sm text-[#756581]">Your queue ticket is unavailable. Please check with the front desk if you recently joined.</p>
      ) : active ? (
        <QueueTicketCard
          entryId={entryId}
          queueNumber={queueNumber}
          status={status as "waiting" | "called"}
          peopleAhead={ticket.people_ahead}
          estMinutes={ticket.est_minutes}
          nowServing={ticket.now_serving}
          currentVisitDelayed={ticket.current_visit_delayed}
          onLeft={async () => {
            await refresh();
            onExit?.();
          }}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#E4D5F6] bg-[#FAF8FF] p-6 text-center">
          <p className="text-sm font-semibold text-[#756581]">Queue #{queueNumber ?? "—"}</p>
          <h3 className="text-xl font-bold text-[#2E1747]">
            {status === "served"
              ? "Your visit is complete"
              : status === "no_show"
                ? "Your turn was missed"
                : status === "cancelled"
                  ? "You left the queue"
                  : "This ticket is no longer active"}
          </h3>
          {onExit && (
            <button type="button" className="min-h-11 rounded-xl bg-[#6D3AA8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#572C87]" onClick={onExit}>
              Back to join queue
            </button>
          )}
        </div>
      )}
    </section>
  );
}
