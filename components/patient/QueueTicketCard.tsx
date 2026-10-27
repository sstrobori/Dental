"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { estimateLabel } from "@/lib/today";

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
  const dialogId = useId();
  const called = status === "called";
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Keep the estimated-turn label and value in separate, aligned columns.
  // estimateLabel is also used by the registered patient dashboard.
  const estimate = typeof estMinutes === "number"
    ? estimateLabel(estMinutes).replace(/^estimated\s+turn\s*:\s*/i, "")
    : "Updating…";

  function closeDialog() {
    if (leaving) return;
    setConfirmOpen(false);
    setLeaveError("");
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!confirmOpen) return;
    cancelRef.current?.focus();

    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !leaving) {
        event.preventDefault();
        setConfirmOpen(false);
        setLeaveError("");
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
      if (event.key !== "Tab") return;
      const buttons = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []
      );
      if (!buttons.length) {
        event.preventDefault();
        return;
      }
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [confirmOpen, leaving]);

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
              ref={triggerRef}
              type="button"
              onClick={() => { setLeaveError(""); setConfirmOpen(true); }}
              className="mt-2 min-h-11 rounded-xl border border-[#F0C4C8] bg-[#FFF0F1] px-5 py-2.5 text-sm font-semibold text-[#A73743] transition hover:bg-[#FFE1E4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100"
            >
              Leave the queue
            </button>
          </div>
        )}
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#241334]/60 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => { if (event.currentTarget === event.target) closeDialog(); }}
        >
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${dialogId}-title`}
            aria-describedby={`${dialogId}-description`}
            className="w-full max-w-md rounded-2xl border border-[#F2D7DA] bg-white p-5 text-left text-[#2E1747] shadow-[0_24px_70px_rgba(40,20,50,0.25)] sm:p-6"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FFF0F1] text-[#B5414D]" aria-hidden="true">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4M12 17h.01" />
                  <path d="M10.3 3.8 2.2 18.2A1.9 1.9 0 0 0 3.9 21h16.2a1.9 1.9 0 0 0 1.7-2.8L13.7 3.8a1.9 1.9 0 0 0-3.4 0Z" />
                </svg>
              </div>
              <h2 id={`${dialogId}-title`} className="text-xl font-bold leading-7">
                Are you sure you want to leave the queue?
              </h2>
            </div>
            <p id={`${dialogId}-description`} className="text-sm leading-6 text-[#756581]">
              You will lose your current place in the queue. You will need to join again to get a new queue number.
            </p>
            {leaveError && (
              <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{leaveError}</p>
            )}
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                ref={cancelRef}
                type="button"
                disabled={leaving}
                onClick={closeDialog}
                className="min-h-11 rounded-xl border border-[#E2DCE8] bg-white px-4 py-2.5 text-sm font-semibold text-[#49365E] transition hover:bg-[#F8F7FB] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6] disabled:opacity-50"
              >
                Keep my place
              </button>
              <button
                type="button"
                disabled={leaving}
                aria-busy={leaving}
                onClick={() => void confirmLeave()}
                className="min-h-11 rounded-xl bg-[#C74652] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#AC3642] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100 disabled:opacity-60"
              >
                {leaving ? "Leaving…" : "Yes, leave queue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
