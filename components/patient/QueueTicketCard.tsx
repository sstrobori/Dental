"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { estimateLabel } from "@/lib/today";
import ConfirmationModal from "@/components/ConfirmationModal";

type TicketProps = {
  entryId: string;
  queueNumber: number | null;
  status: "waiting" | "called";
  peopleAhead?: number | null;
  estMinutes?: number | null;
  nowServing?: number | null;
  currentVisitDelayed?: boolean;
  onLeft?: () => void | Promise<void>;
};

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const suffix = ["th", "st", "nd", "rd"];
  return `${n}${suffix[n % 10] ?? "th"}`;
}

export default function QueueTicketCard({
  entryId,
  queueNumber,
  status,
  peopleAhead,
  estMinutes,
  nowServing,
  currentVisitDelayed = false,
  onLeft,
}: TicketProps) {
  const supabase = useMemo(() => createClient(), []);
  const called = status === "called";
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");

  // Keep the estimated-turn label and value in separate, aligned columns.
  // estimateLabel is also used by the registered patient dashboard.
  const estimate = typeof estMinutes === "number"
    ? estimateLabel(estMinutes).replace(/^estimated\s+turn\s*:\s*/i, "")
    : "Updating…";

  function closeDialog() {
    if (leaving) return;
    setConfirmOpen(false);
    setLeaveError("");
  }

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
      setConfirmOpen(false);
      await onLeft?.();
    } catch {
      setLeaveError("Something went wrong. Please check your queue status and try again.");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <>
      <div
        aria-live="polite"
        className={`flex w-full flex-col items-center gap-4 rounded-2xl border px-4 py-6 text-center sm:px-7 sm:py-8 ${
          called
            ? "border-[#7B4AB6] bg-gradient-to-br from-[#9157C9] via-[#6D3AA8] to-[#47216F] text-white shadow-lg shadow-purple-900/15"
            : "border-[#E4D5F6] bg-white text-[#2E1747] shadow-sm"
        }`}
      >
        <div className={`rounded-full px-3 py-1.5 text-xs font-bold ${called ? "border border-white/25 bg-white/20 text-white" : "bg-[#F2EAFF] text-[#6D3AA8]"}`}>
          {called ? "Called · It's your turn" : "Waiting in queue"}
        </div>

        <div
          className={`flex h-44 w-44 shrink-0 flex-col items-center justify-center rounded-full border-[6px] shadow-[0_6px_25px_rgba(76,43,111,0.07)] sm:h-48 sm:w-48 ${
            called
              ? "border-white bg-white/10"
              : "border-[#E4D5F6] bg-[#FAF8FF]"
          }`}
        >
          <p
            className={`text-[0.65rem] font-bold uppercase tracking-[0.12em] ${
              called ? "text-white/90" : "text-[#756581]"
            }`}
          >
            Queue number
          </p>

          <p
            className={`mt-1 text-[clamp(3.3rem,12vw,4.8rem)] font-extrabold leading-none tracking-tight ${
              called ? "text-white" : "text-[#6D3AA8]"
            }`}
          >
            {queueNumber == null ? "—" : `#${queueNumber}`}
          </p>
        </div>


        {called ? (
          <p className="max-w-xs text-lg font-bold leading-7 text-white">
            It is your turn. Please go to the front desk.
          </p>
        ) : (
          <div className="w-full max-w-sm space-y-3">
            <p className="text-lg font-bold text-[#2E1747]">
              {typeof peopleAhead === "number"
                ? `You are ${ordinal(peopleAhead + 1)} in line`
                : "You are waiting in line"}
            </p>
            {typeof peopleAhead === "number" && (
              <p className="text-sm text-[#756581]">
                {peopleAhead === 0
                  ? "No one is ahead of you."
                  : `${peopleAhead} ${peopleAhead === 1 ? "person is" : "people are"} ahead of you.`}
              </p>
            )}


            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-y border-[#EEE5F7] py-3 text-sm">
              <span className="font-medium text-[#756581]">
                Estimated turn:
              </span>
              <span className="font-bold text-[#6D3AA8]">
                {estimate}
              </span>
            </div>


            <p className="text-center text-xs leading-5 text-[#80748B]">
              The estimate uses the clinic&apos;s average visit time and can change.
            </p>

            {currentVisitDelayed && (
              <p className="rounded-xl border border-[#DCCBED] bg-[#F7F2FC] px-3 py-2.5 text-center text-xs font-medium leading-5 text-[#5C327F]" role="status">
                A current visit is taking longer than expected. Your estimated waiting time may change.
              </p>
            )}

            {typeof nowServing === "number" && (
              <p className="text-sm font-semibold text-[#6D3AA8]">Now serving #{nowServing}</p>
            )}
            <button
              type="button"
              onClick={() => { setLeaveError(""); setConfirmOpen(true); }}
              className="mt-2 min-h-11 rounded-xl border border-[#F0C4C8] bg-[#FFF0F1] px-5 py-2.5 text-sm font-semibold text-[#A73743] transition hover:bg-[#FFE1E4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100"
            >
              Leave the queue
            </button>
          </div>
        )}
      </div>

      <ConfirmationModal
        open={confirmOpen}
        title="Are you sure you want to leave the queue?"
        description="You will lose your current place in the queue. You will need to join again to get a new queue number."
        confirmLabel="Yes, leave queue"
        cancelLabel="Keep my place"
        busy={leaving}
        busyLabel="Leaving…"
        tone="danger"
        error={leaveError}
        onCancel={closeDialog}
        onConfirm={() => void confirmLeave()}
      />
    </>
  );
}
