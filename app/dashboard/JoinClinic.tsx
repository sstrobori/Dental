"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function JoinClinic({ email }: { email: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function joinWithCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await supabase.rpc("accept_invite", { p_code: code });
    setBusy(false);
    if (error) return setError(error.message);
    router.refresh();
  }

  async function createClinic(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await supabase.rpc("create_clinic", { p_name: clinicName });
    setBusy(false);
    if (error) return setError(error.message);
    router.refresh();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-[calc(100dvh-2rem)] bg-[#FAF8FF] px-4 py-8 text-[#2E1747] sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-4xl">
        <header className="flex flex-col items-center text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-[#6D3AA8] text-white shadow-[0_12px_30px_rgba(109,58,168,0.24)]" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.4 3.7c1.6-.8 3.1.3 4.6.3s3-1.1 4.6-.3c2.3 1.2 3 4.3 1.8 7.2-.6 1.5-1.6 2.6-2.1 4.4-.8 2.6-1.2 4.7-2.6 4.7-1.5 0-1.2-4.3-2.2-4.3s-.7 4.3-2.2 4.3c-1.4 0-1.8-2.1-2.6-4.7-.5-1.8-1.5-2.9-2.1-4.4-1.2-2.9-.5-6 1.8-7.2Z" />
            </svg>
          </span>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#8151AE]">Staff workspace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Set up your clinic</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#756581] sm:text-base">
            Join your clinic&apos;s team with an invite, or create a new workspace if you are the clinic owner.
          </p>
          <p className="mt-4 max-w-full rounded-full border border-[#E4D5F6] bg-white px-3 py-1.5 text-xs font-medium text-[#756581] shadow-sm">
            Signed in as <span className="break-all font-semibold text-[#5C327F]">{email}</span>
          </p>
        </header>

        {error && <p role="alert" className="mx-auto mt-6 max-w-2xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <form onSubmit={joinWithCode} className="flex flex-col rounded-2xl border border-[#E4D5F6] bg-white p-5 shadow-sm sm:p-6">
            <span className="grid size-10 place-items-center rounded-xl bg-[#F2EAFF] text-[#6D3AA8]" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5m5 5H3" />
              </svg>
            </span>
            <h2 className="mt-4 text-xl font-bold">Join an existing clinic</h2>
            <p className="mt-2 text-sm leading-6 text-[#756581]">Enter the invite code sent by your clinic owner.</p>
            <label htmlFor="clinic-invite-code" className="mt-5 text-sm font-semibold">Invite code</label>
            <input
              id="clinic-invite-code"
              className="mt-2 min-h-12 w-full rounded-xl border border-[#E4D5F6] bg-white px-4 py-3 uppercase tracking-widest outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-[#9B8FA6] focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]"
              placeholder="Code from the clinic owner"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
            />
            <button disabled={busy || !code.trim()} aria-busy={busy} className="mt-4 min-h-12 rounded-xl bg-[#6D3AA8] px-5 py-3 font-bold text-white transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3] disabled:cursor-not-allowed disabled:opacity-45">
              {busy ? "Working…" : "Join clinic"}
            </button>
          </form>

          <form onSubmit={createClinic} className="flex flex-col rounded-2xl border border-[#E4D5F6] bg-white p-5 shadow-sm sm:p-6">
            <span className="grid size-10 place-items-center rounded-xl bg-[#F2EAFF] text-[#6D3AA8]" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v18M3 12h18" />
              </svg>
            </span>
            <h2 className="mt-4 text-xl font-bold">Create a new clinic</h2>
            <p className="mt-2 text-sm leading-6 text-[#756581]">Start a workspace and invite your staff after setup.</p>
            <label htmlFor="new-clinic-name" className="mt-5 text-sm font-semibold">Clinic name</label>
            <input
              id="new-clinic-name"
              className="mt-2 min-h-12 w-full rounded-xl border border-[#E4D5F6] bg-white px-4 py-3 outline-none placeholder:text-[#9B8FA6] focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]"
              placeholder="e.g. Dental Queue and Appointment Management"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
            />
            <button disabled={busy || !clinicName.trim()} aria-busy={busy} className="mt-4 min-h-12 rounded-xl border border-[#CDB8E5] bg-white px-5 py-3 font-bold text-[#5C327F] transition hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3] disabled:cursor-not-allowed disabled:opacity-45">
              {busy ? "Working…" : "Create clinic"}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <button type="button" onClick={signOut} className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-[#6F647A] underline decoration-[#CDB8E5] underline-offset-4 transition hover:text-[#5C327F] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3]">Sign out of this account</button>
        </div>
      </div>
    </main>
  );
}
