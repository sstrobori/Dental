"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useVisitReasons } from "@/lib/useVisitReasons";


const FIELD_CLASS = "min-h-11 w-full rounded-xl border border-[#E4D5F6] bg-white px-3 py-2 text-sm text-[#2E1747] outline-none transition placeholder:text-[#9B8FA6] focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]";

export default function DepositSettings({ clinicId, isOwner }: { clinicId: string; isOwner: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [amount, setAmount] = useState(0);
  const [reasons, setReasons] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [avgFee, setAvgFee] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { names: REASONS } = useVisitReasons(clinicId, "staff");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.from("clinics")
        .select("deposit_amount, deposit_reasons, deposit_instructions, avg_visit_fee")
        .eq("id", clinicId).single();
      if (!active) return;
      if (error) setError(error.message);
      if (data) {
        setAmount(data.deposit_amount ?? 0);
        setReasons(data.deposit_reasons ?? []);
        setInstructions(data.deposit_instructions ?? "");
        setAvgFee(data.avg_visit_fee ?? 0);
      }
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [supabase, clinicId]);

  function toggle(r: string) {
    setReasons((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));
  }

  async function save() {
    if (!isOwner || saving) return;
    setError(""); setMsg(""); setSaving(true);
    try {
      const { error } = await supabase.rpc("update_money_settings", {
        p_clinic_id: clinicId, p_deposit: amount, p_reasons: reasons,
        p_instructions: instructions, p_avg_fee: avgFee,
      });
      if (error) setError(error.message);
      else setMsg("Saved. New bookings use these settings. Existing appointments keep their old deposit.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p role="status" className="rounded-2xl border border-[#E4D5F6] bg-white p-5 text-sm text-[#6F647A]">Loading deposit settings...</p>;

  return (
    <section aria-label="Deposit and fee settings form" className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">
      {!isOwner && <p className="mb-4 rounded-xl bg-[#FAF8FF] p-3 text-sm text-[#6F647A]">Only the clinic owner can change these settings.</p>}
      <fieldset disabled={!isOwner || saving} className="flex flex-col gap-6 text-sm disabled:opacity-60">
        <p className="rounded-xl bg-[#FAF8FF] p-4 leading-6 text-[#6F647A]">
          Payments happen directly between the patient and clinic. Staff only record whether a deposit was received.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 font-semibold text-[#49365E]">Deposit amount
            <span className="text-xs font-normal text-[#80748B]">Philippine pesos; enter 0 for none</span>
            <input type="number" min={0} className={FIELD_CLASS} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1.5 font-semibold text-[#49365E]">Average fee per visit
            <span className="text-xs font-normal text-[#80748B]">Used only for report estimates</span>
            <input type="number" min={0} className={FIELD_CLASS} value={avgFee} onChange={(e) => setAvgFee(Number(e.target.value))} />
          </label>
        </div>
        <div>
          <p className="font-semibold text-[#49365E]">Deposit applies to</p>
          <p className="mt-1 text-xs text-[#80748B]">Leave every option unselected to apply it to all reasons.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <label key={r} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition focus-within:ring-4 focus-within:ring-[#E4D5F6] ${reasons.includes(r) ? "border-[#CDB8E5] bg-[#F2EAFF] text-[#5A2E8A]" : "border-[#E4D5F6] bg-white text-[#6F647A]"}`}>
                <input className="size-4 accent-[#6D3AA8]" type="checkbox" checked={reasons.includes(r)} onChange={() => toggle(r)} />{r}
              </label>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5 font-semibold text-[#49365E]">Patient payment instructions
          <span className="text-xs font-normal text-[#80748B]">Shown on the patient's appointment page</span>
          <textarea className={`${FIELD_CLASS} min-h-28 resize-y`} rows={4} maxLength={500}
            placeholder="Example: Send the deposit using the clinic's payment details. Keep the receipt."
            value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </label>
        <button type="button" onClick={save} className="min-h-11 w-full rounded-xl bg-[#6D3AA8] px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3] disabled:opacity-60 sm:w-auto sm:self-start">
          {saving ? "Saving..." : "Save payment settings"}
        </button>
      </fieldset>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
      {msg && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{msg}</p>}
    </section>
  );
}
