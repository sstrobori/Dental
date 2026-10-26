"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const REASONS = ["Checkup", "Toothache", "Cleaning", "Braces", "Other"];
const FIELD_CLASS = "min-h-11 rounded-xl border border-[#E4D5F6] bg-white px-3 py-2 text-sm text-[#2E1747] outline-none transition placeholder:text-[#9B8FA6] focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]";

export default function DepositSettings({ clinicId, isOwner }: { clinicId: string; isOwner: boolean }) {
  const supabase = createClient();
  const [amount, setAmount] = useState(0);
  const [reasons, setReasons] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [avgFee, setAvgFee] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("clinics").select("deposit_amount, deposit_reasons, deposit_instructions, avg_visit_fee")
        .eq("id", clinicId).single();
      if (data) {
        setAmount(data.deposit_amount ?? 0);
        setReasons(data.deposit_reasons ?? []);
        setInstructions(data.deposit_instructions ?? "");
        setAvgFee(data.avg_visit_fee ?? 0);
      }
      setLoaded(true);
    })();
  }, [supabase, clinicId]);

  function toggle(r: string) {
    setReasons((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));
  }

  async function save() {
    setError(""); setMsg("");
    const { error } = await supabase.rpc("update_money_settings", {
      p_clinic_id: clinicId, p_deposit: amount, p_reasons: reasons, p_instructions: instructions, p_avg_fee: avgFee,
    });
    if (error) return setError(error.message);
    setMsg("Saved. New bookings use these settings. Existing appointments keep their old deposit.");
  }

  if (!loaded) return null;

  return (
    <details className="group rounded-2xl border border-[#E4D5F6] bg-white shadow-sm">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-bold text-[#2E1747] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6] [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm">Deposits and fees</span>
          <span className="mt-0.5 block text-xs font-normal text-[#6F647A]">Payment instructions and reporting values</span>
        </span>
        <span className="text-xl text-[#6D3AA8] transition group-open:rotate-90" aria-hidden="true">›</span>
      </summary>
      <div className="border-t border-[#E4D5F6] px-4 pb-5 pt-4">
        {!isOwner && <p className="mb-4 rounded-xl bg-[#FAF8FF] p-3 text-sm text-[#6F647A]">Only the clinic owner can change these settings.</p>}
        <fieldset disabled={!isOwner} className="flex flex-col gap-5 text-sm disabled:opacity-60">
          <p className="rounded-xl bg-[#FAF8FF] p-3 leading-6 text-[#6F647A]">
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
            <span className="text-xs font-normal text-[#80748B]">Shown on the patient&apos;s appointment page</span>
            <textarea className={`${FIELD_CLASS} min-h-28 resize-y`} rows={4} maxLength={500}
              placeholder="Example: Send the deposit by GCash to 0917 000 0000 (Clinic Name). Keep the receipt."
              value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </label>

          <button type="button" onClick={save} className="min-h-11 w-full rounded-xl bg-[#6D3AA8] px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3] sm:w-auto sm:self-start">Save payment settings</button>
        </fieldset>
        {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
        {msg && <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{msg}</p>}
      </div>
    </details>
  );
}
