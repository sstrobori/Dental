"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ServiceTimeSetting({ clinicId, isOwner }: { clinicId: string; isOwner: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [minutes, setMinutes] = useState(20);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.from("clinics")
        .select("default_service_minutes").eq("id", clinicId).single();
      if (!active) return;
      if (error) setError(error.message);
      if (data) setMinutes(data.default_service_minutes ?? 20);
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [supabase, clinicId]);

  async function save() {
    if (!isOwner || saving) return;
    setError(""); setMsg(""); setSaving(true);
    try {
      const { error } = await supabase.rpc("update_service_time", {
        p_clinic_id: clinicId, p_minutes: minutes,
      });
      if (error) setError(error.message);
      else setMsg("Wait-time estimate saved successfully.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p role="status" className="rounded-2xl border border-[#E4D5F6] bg-white p-5 text-sm text-[#6F647A]">Loading wait-time settings...</p>;

  return (
    <section aria-label="Wait-time settings form" className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">
      {!isOwner && <p className="mb-4 rounded-xl bg-[#FAF8FF] p-3 text-sm text-[#6F647A]">Only the clinic owner can change this setting.</p>}
      <fieldset disabled={!isOwner || saving} className="flex flex-col gap-5 text-sm disabled:opacity-60">
        <p className="rounded-xl bg-[#FAF8FF] p-4 leading-6 text-[#6F647A]">
          Until at least five visits have been timed from “Call” to “Mark served,” patient estimates use this typical duration. The live average takes over automatically afterward.
        </p>
        <label className="flex max-w-xs flex-col gap-1.5 font-semibold text-[#49365E]">Typical visit length
          <span className="text-xs font-normal text-[#80748B]">Minutes per patient</span>
          <input type="number" min={5} max={120}
            className="min-h-11 rounded-xl border border-[#E4D5F6] bg-white px-3 py-2 text-sm text-[#2E1747] outline-none transition focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]"
            value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </label>
        <button type="button" onClick={save} className="min-h-11 w-full rounded-xl bg-[#6D3AA8] px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3] disabled:opacity-60 sm:w-auto sm:self-start">
          {saving ? "Saving..." : "Save estimate setting"}
        </button>
      </fieldset>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
      {msg && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{msg}</p>}
    </section>
  );
}
