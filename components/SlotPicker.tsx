"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDaysManila, formatTime, todayManila } from "@/lib/today";

export default function SlotPicker({
  clinicId,
  value,
  onChange,
  ignoreNotice = false,
  onDayChange,
  emptyAction,
  appearance = "default",
}: {
  clinicId: string;
  value: string;                       // chosen time as an ISO string, or ""
  onChange: (iso: string) => void;
  ignoreNotice?: boolean;              // staff can book closer to the time
  onDayChange?: (day: string) => void;
  emptyAction?: React.ReactNode;       // shown when the day has no free times
  appearance?: "default" | "patient";
}) {
  const supabase = createClient();
  const [day, setDay] = useState(todayManila());
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!day) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc("available_slots", {
        p_clinic_id: clinicId, p_day: day, p_ignore_notice: ignoreNotice,
      });
      if (cancelled) return;
      setSlots(((data ?? []) as { slot_time: string }[]).map((r) => r.slot_time));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [supabase, clinicId, day, ignoreNotice]);

  return (
    <div className="flex flex-col gap-3">
      <input
        id={`appointment-day-${clinicId}`}
        type="date" className="rounded-lg border p-3" min={todayManila()} max={addDaysManila(60)} value={day}
        onChange={(e) => { setDay(e.target.value); onChange(""); onDayChange?.(e.target.value); }}
      />
      {loading ? (
        <p className="text-sm text-gray-500">Loading times...</p>
      ) : slots.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-600">No times available on this day.</p>
          {emptyAction}
        </div>
      ) : (
        appearance === "patient" ? (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-[#49355f]">Available times</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {slots.map((s) => (
                <button
                  type="button" key={s} onClick={() => onChange(s)}
                  aria-pressed={value === s}
                  className={`min-h-11 rounded-xl border px-2 py-2.5 text-sm font-semibold transition ${value === s
                    ? "border-[#6d3aa8] bg-[#6d3aa8] text-white shadow-sm"
                    : "border-[#e4d5f6] bg-white text-[#49355f] hover:border-[#8b5cf6] hover:bg-[#f7f2ff]"
                  }`}
                >
                  {formatTime(s)}
                </button>
              ))}
            </div>
          </fieldset>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s) => (
              <button
                type="button" key={s} onClick={() => onChange(s)}
                className={`rounded-lg border p-2 text-sm ${value === s ? "bg-[#12303f] text-white" : "bg-white"}`}
              >
                {formatTime(s)}
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
