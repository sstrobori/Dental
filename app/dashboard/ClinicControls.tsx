
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ConfirmationModal from "@/components/ConfirmationModal";

export default function ClinicControls({
  clinicId,
  acceptingJoins,
}: {
  clinicId: string;
  acceptingJoins: boolean;
}) {
  const supabase = createClient();

  const [open, setOpen] = useState(acceptingJoins);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmPause, setConfirmPause] = useState(false);

  async function toggle() {
    setError("");

    const next = !open;
    setBusy(true);

    const { error } = await supabase.rpc(
      "set_accepting_joins",
      {
        p_clinic_id: clinicId,
        p_value: next,
      }
    );

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    setOpen(next);
    setConfirmPause(false);
  }

  function requestPause() {
    setError("");
    setConfirmPause(true);
  }

  return (
    <>
    <div className="flex flex-col gap-3 border-t border-[#E4D5F6] bg-[#FAF8FF] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl ${
            open
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
          }`}
          aria-hidden="true"
        >
          <span
            className={`size-3 rounded-full ${
              open ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-[#2E1747]">
              Online queue joining
            </h2>

            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                open
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              {open ? "Open" : "Paused"}
            </span>
          </div>

          <p className="mt-1 text-sm leading-5 text-[#756581]">
            {open
              ? "Patients can join the live queue from the clinic link."
              : "New online queue entries are temporarily paused."}
          </p>

          {error && (
            <p
              role="alert"
              className="mt-2 text-sm font-medium text-red-700"
            >
              {error}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => open ? requestPause() : void toggle()}
        disabled={busy}
        aria-pressed={open}
        aria-busy={busy}
        className={`min-h-11 w-full shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
          open
            ? "border-[#F1D1B5] bg-[#FFF3E6] text-[#9A4B15] hover:bg-[#FFE8D2] focus-visible:ring-orange-100"
            : "border-[#BEDFC9] bg-[#E6F4EA] text-[#237347] hover:bg-[#D5EEDD] focus-visible:ring-green-100"
        }`}      >
        {busy
          ? "Saving…"
          : open
            ? "Pause online joining"
            : "Resume online joining"}
      </button>
    </div>
    <ConfirmationModal
      open={confirmPause}
      title="Pause online queue joining?"
      description="New patients will not be able to join the live queue from the clinic link until a staff member resumes online joining. Existing queue entries are not affected."
      confirmLabel="Pause online joining"
      cancelLabel="Keep queue open"
      busy={busy}
      busyLabel="Pausing…"
      tone="warning"
      error={error}
      onCancel={() => {
        if (!busy) {
          setConfirmPause(false);
          setError("");
        }
      }}
      onConfirm={() => void toggle()}
    />
    </>
  );
}
