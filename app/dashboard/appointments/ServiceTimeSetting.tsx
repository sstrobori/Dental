"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ServiceTimeSetting({ clinicId, isOwner }: { clinicId: string; isOwner: boolean }) {
  const supabase = createClient();
  const [minutes, setMinutes] = useState(20);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("clinics").select("default_service_minutes").eq("id", clinicId).single();
      if (data) setMinutes(data.default_service_minutes ?? 20);
      setLoaded(true);
    })();
  }, [supabase, clinicId]);

  async function save() {
    setError(""); setMsg("");
    const { error } = await supabase.rpc("update_service_time", { p_clinic_id: clinicId, p_minutes: minutes });
    if (error) return setError(error.message);
    setMsg("Saved.");
  }

  if (!loaded) return null;

  return (
    <details className="group rounded-2xl border border-[#E4D5F6] bg-white shadow-sm">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-bold text-[#2E1747] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6] [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm">Wait-time estimates</span>
          <span className="mt-0.5 block text-xs font-normal text-[#6F647A]">Set the fallback duration for queue forecasts</span>
        </span>
        <span className="text-xl text-[#6D3AA8] transition group-open:rotate-90" aria-hidden="true">›</span>
      </summary>
      <div className="border-t border-[#E4D5F6] px-4 pb-5 pt-4">
        {!isOwner && <p className="mb-4 rounded-xl bg-[#FAF8FF] p-3 text-sm text-[#6F647A]">Only the clinic owner can change this setting.</p>}
        <fieldset disabled={!isOwner} className="flex flex-col gap-4 text-sm disabled:opacity-60">
          <p className="rounded-xl bg-[#FAF8FF] p-3 leading-6 text-[#6F647A]">
            Until at least five visits have been timed from “Call” to “Mark served,” patient estimates use this typical duration. The live average takes over automatically afterward.
          </p>
          <label className="flex max-w-xs flex-col gap-1.5 font-semibold text-[#49365E]">Typical visit length
            <span className="text-xs font-normal text-[#80748B]">Minutes per patient</span>
            <input type="number" min={5} max={120} className="min-h-11 rounded-xl border border-[#E4D5F6] bg-white px-3 py-2 text-sm text-[#2E1747] outline-none transition focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]" value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))} />
          </label>
          <button type="button" onClick={save} className="min-h-11 w-full rounded-xl bg-[#6D3AA8] px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3] sm:w-auto sm:self-start">Save estimate setting</button>
        </fieldset>
        {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
        {msg && <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{msg}</p>}
      </div>
    </details>
  );
}
