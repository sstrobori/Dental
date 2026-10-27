"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const FIELD_CLASS = "min-h-12 w-full rounded-xl border border-[#E4D5F6] bg-white px-4 py-3 text-base text-[#2E1747] outline-none transition placeholder:text-[#9B8FA6] focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]";

export type Account = {
  email: string | null;
  is_patient: boolean;
  is_staff: boolean;
  name: string | null;
};

// Sign in only. Patient accounts are created by the clinic, who sends a setup email.
export default function AccountPanel({
  signedIn,
  account,
  onChange,
}: {
  clinicId: string;
  signedIn: boolean;
  account: Account | null;
  onChange: () => void;
}) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setError("Wrong email or password.");
    onChange();
  }

  async function signOut() {
    await supabase.auth.signOut();
    onChange();
  }

  if (signedIn && account?.is_staff) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-[#2E1747]">
        <p className="text-sm leading-6 text-amber-900">
          You are signed in with a clinic staff account ({account.email}). Patient accounts use a different email.
        </p>
        <button onClick={signOut} className="min-h-11 self-start rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200">Sign out</button>
      </div>
    );
  }

  if (signedIn && account && !account.is_patient) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-[#2E1747]">
        <p className="text-sm leading-6 text-amber-900">
          {account.email} is not set up as a patient account. Ask the front desk to create one for you.
        </p>
        <button onClick={signOut} className="min-h-11 self-start rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200">Sign out</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-[#2E1747]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7B4BB3]">Returning patient</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#2E1747] sm:text-3xl">Patient sign in</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#6F647A] sm:text-base">
          See your place in line, your estimated turn, and your visit history.
          Accounts are created by the clinic. Ask the front desk to set one up, and you will get an email to choose your password.
        </p>
      </div>
      <form onSubmit={signIn} className="flex flex-col gap-5 rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">
        <div>
          <label htmlFor="patient-signin-email" className="mb-2 block text-sm font-semibold text-[#49365E]">Email address</label>
          <input id="patient-signin-email" className={FIELD_CLASS} type="email" placeholder="you@example.com" value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <label htmlFor="patient-signin-password" className="mb-2 block text-sm font-semibold text-[#49365E]">Password</label>
          <input id="patient-signin-password" className={FIELD_CLASS} type="password" placeholder="Enter your password" value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
        <button disabled={busy} aria-busy={busy} className="min-h-12 rounded-xl bg-[#6D3AA8] px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3] disabled:cursor-not-allowed disabled:opacity-50 sm:text-lg">{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
