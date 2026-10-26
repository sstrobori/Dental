"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Settings = {
  accepting_bookings: boolean;
  open_time: string;
  close_time: string;
  slot_minutes: number;
  chairs: number;
  open_days: number[];
  grace_minutes: number;
  min_notice_hours: number;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FIELD_CLASS = "min-h-11 rounded-xl border border-[#E4D5F6] bg-white px-3 py-2 text-sm text-[#2E1747] outline-none transition focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]";

export default function BookingSettings({
  clinicId, isOwner, initial,
}: { clinicId: string; isOwner: boolean; initial: Settings }) {
  const supabase = createClient();
  const [s, setS] = useState<Settings>({
    ...initial, open_time: initial.open_time.slice(0, 5), close_time: initial.close_time.slice(0, 5),
  });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [link, setLink] = useState("");

  useEffect(() => {
    const kickoff = window.setTimeout(() => setLink(`${window.location.origin}/c/${clinicId}`), 0);
    return () => window.clearTimeout(kickoff);
  }, [clinicId]);

  function toggleDay(d: number) {
    setS((p) => ({ ...p, open_days: p.open_days.includes(d) ? p.open_days.filter((x) => x !== d) : [...p.open_days, d] }));
  }

  async function save() {
    setError(""); setMsg("");
    const { error } = await supabase.rpc("update_booking_settings", {
      p_clinic_id: clinicId, p_accepting: s.accepting_bookings, p_open: s.open_time, p_close: s.close_time,
      p_slot: s.slot_minutes, p_chairs: s.chairs, p_days: s.open_days, p_grace: s.grace_minutes, p_notice: s.min_notice_hours,
    });
    if (error) return setError(error.message);
    setMsg("Saved.");
  }

  return (
    <details className="group rounded-2xl border border-[#E4D5F6] bg-white shadow-sm">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-bold text-[#2E1747] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6] [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm">Booking settings</span>
          <span className="mt-0.5 block text-xs font-normal text-[#6F647A]">Hours, capacity, grace period and online availability</span>
        </span>
        <span className="text-xl text-[#6D3AA8] transition group-open:rotate-90" aria-hidden="true">›</span>
      </summary>
      <div className="border-t border-[#E4D5F6] px-4 pb-5 pt-4">
        {!isOwner && <p className="mb-4 rounded-xl bg-[#FAF8FF] p-3 text-sm text-[#6F647A]">Only the clinic owner can change these settings.</p>}
        <fieldset disabled={!isOwner} className="flex flex-col gap-5 text-sm disabled:opacity-60">
          <label className="flex min-h-12 items-center gap-3 rounded-xl bg-[#FAF8FF] px-4 py-3 font-semibold text-[#49365E]">
            <input className="size-5 accent-[#6D3AA8]" type="checkbox" checked={s.accepting_bookings}
              onChange={(e) => setS({ ...s, accepting_bookings: e.target.checked })} />
            Accept online bookings
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 font-semibold text-[#49365E]">Opening time
              <input type="time" className={FIELD_CLASS} value={s.open_time} onChange={(e) => setS({ ...s, open_time: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5 font-semibold text-[#49365E]">Closing time
              <input type="time" className={FIELD_CLASS} value={s.close_time} onChange={(e) => setS({ ...s, close_time: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5 font-semibold text-[#49365E]">Appointment length
              <select className={FIELD_CLASS} value={s.slot_minutes} onChange={(e) => setS({ ...s, slot_minutes: Number(e.target.value) })}>
                {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 font-semibold text-[#49365E]">Available chairs
              <input type="number" min={1} max={20} className={FIELD_CLASS} value={s.chairs} onChange={(e) => setS({ ...s, chairs: Number(e.target.value) })} />
            </label>
          </div>

          <div>
            <p className="mb-2 font-semibold text-[#49365E]">Open days</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {DAYS.map((d, i) => (
                <label key={d} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-xs font-semibold transition focus-within:ring-4 focus-within:ring-[#E4D5F6] ${s.open_days.includes(i) ? "border-[#CDB8E5] bg-[#F2EAFF] text-[#5A2E8A]" : "border-[#E4D5F6] bg-white text-[#6F647A]"}`}>
                  <input className="sr-only" type="checkbox" checked={s.open_days.includes(i)} onChange={() => toggleDay(i)} />{d}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 font-semibold text-[#49365E]">Late-arrival grace
              <span className="text-xs font-normal text-[#80748B]">Minutes after the appointment time</span>
              <input type="number" min={0} max={120} className={FIELD_CLASS} value={s.grace_minutes} onChange={(e) => setS({ ...s, grace_minutes: Number(e.target.value) })} />
            </label>
            <label className="flex flex-col gap-1.5 font-semibold text-[#49365E]">Minimum booking notice
              <span className="text-xs font-normal text-[#80748B]">Hours before the appointment</span>
              <input type="number" min={0} max={168} className={FIELD_CLASS} value={s.min_notice_hours} onChange={(e) => setS({ ...s, min_notice_hours: Number(e.target.value) })} />
            </label>
          </div>

          <button type="button" onClick={save} className="min-h-11 w-full rounded-xl bg-[#6D3AA8] px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3] sm:w-auto sm:self-start">Save booking settings</button>
        </fieldset>
        {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
        {msg && <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{msg}</p>}
        {link && <p className="mt-4 break-all rounded-xl bg-[#FAF8FF] p-3 text-xs text-[#6F647A]"><b className="text-[#49365E]">Patient portal:</b> {link}</p>}
      </div>
    </details>
  );
}
