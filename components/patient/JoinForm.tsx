"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const REASONS = ["Checkup", "Toothache", "Cleaning", "Braces", "Other"];
const SAVED_KEY = "chairflow-patient";
const FIELD_CLASS = "min-h-12 w-full rounded-xl border border-[#E4D5F6] bg-white px-4 py-3 text-base text-[#2E1747] outline-none transition placeholder:text-[#9B8FA6] focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]";

export default function JoinForm({
  clinicId,
  onDone,
}: {
  clinicId: string;
  onDone: (entryId: string) => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [isMinor, setIsMinor] = useState(false);
  const [guardian, setGuardian] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Remember this person's details on their own phone, so the next visit is one tap.
  useEffect(() => {
    const kickoff = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(SAVED_KEY);
        if (saved) {
          const p = JSON.parse(saved);
          setName(p.name ?? "");
          setPhone(p.phone ?? "");
        }
      } catch {
        // storage unavailable: the form simply starts empty
      }
    }, 0);
    return () => window.clearTimeout(kickoff);
  }, []);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError(isMinor ? "Enter the child's name." : "Enter your name.");
    if (isMinor && !guardian.trim()) return setError("Enter the parent or guardian's name.");

    setBusy(true);
    const { data, error } = await supabase.rpc("join_queue", {
      p_clinic_id: clinicId,
      p_name: name,
      p_phone: phone,
      p_reason: reason,
      p_consent: false,
      p_is_minor: isMinor,
      p_guardian: isMinor ? guardian : null,
    });
    setBusy(false);

    if (error) return setError(error.message);
    if (!isMinor) {
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify({ name: name.trim(), phone: phone.trim() }));
      } catch {
        // ignore: saving is only a convenience
      }
    }
    onDone(data.id);
  }

  return (
    <div className="flex flex-col gap-6 text-[#2E1747]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7B4BB3]">Walk-in visit</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#2E1747] sm:text-3xl">Join the queue</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#6F647A] sm:text-base">Get your queue number now and wait wherever you are most comfortable.</p>
      </div>

      <form onSubmit={handleJoin} className="flex flex-col gap-5 rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-[#FAF8FF] px-4 py-3 text-sm font-medium text-[#49365E]">
          <input className="size-5 shrink-0 accent-[#6D3AA8]" type="checkbox" checked={isMinor} onChange={(e) => setIsMinor(e.target.checked)} />
          <span>This visit is for a child under 18</span>
        </label>

        <div>
          <label htmlFor="queue-patient-name" className="mb-2 block text-sm font-semibold text-[#49365E]">
            {isMinor ? "Child's full name" : "Full name"}
          </label>
          <input id="queue-patient-name" className={FIELD_CLASS} placeholder={isMinor ? "Enter the child's name" : "Enter your full name"}
            value={name} onChange={(e) => setName(e.target.value)} autoComplete={isMinor ? "off" : "name"} />
        </div>
        {isMinor && (
          <div>
            <label htmlFor="queue-guardian-name" className="mb-2 block text-sm font-semibold text-[#49365E]">Parent or guardian&apos;s full name</label>
            <input id="queue-guardian-name" className={FIELD_CLASS} placeholder="Enter parent or guardian's name"
              value={guardian} onChange={(e) => setGuardian(e.target.value)} />
          </div>
        )}

        <div>
          <label htmlFor="queue-mobile" className="mb-2 block text-sm font-semibold text-[#49365E]">
            {isMinor ? "Parent's mobile number" : "Mobile number"} <span className="font-normal text-[#82758E]">(optional)</span>
          </label>
          <input id="queue-mobile" className={FIELD_CLASS} placeholder="e.g. 0917 123 4567"
            inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </div>

        <div>
          <label htmlFor="queue-reason" className="mb-2 block text-sm font-semibold text-[#49365E]">Reason for visit <span className="font-normal text-[#82758E]">(optional)</span></label>
          <select id="queue-reason" className={FIELD_CLASS} value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Select a reason</option>
            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
        <button disabled={busy} aria-busy={busy} className="min-h-12 rounded-xl bg-[#6D3AA8] px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3] disabled:cursor-not-allowed disabled:opacity-50 sm:text-lg">
          {busy ? "Joining..." : "Get my number"}
        </button>
      </form>

      <p className="rounded-xl bg-[#F2EAFF] px-4 py-3 text-xs leading-5 text-[#6F647A]">
        We use your name and number only to run your visit and to recognize you next time.
        Your name and number are saved on this phone to make your next visit faster.
        We do not store medical records here.
      </p>
    </div>
  );
}
