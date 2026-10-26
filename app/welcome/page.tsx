"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PatientShell from "@/components/patient/PatientShell";

const UUID = /^[0-9a-f-]{36}$/i;

// Opened from the clinic's email link: the patient chooses (or changes) their password here.
export default function WelcomePage() {
  const supabase = createClient();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [clinic, setClinic] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const c = params.get("clinic") ?? "";
      if (UUID.test(c)) setClinic(c);

      // The link brings the sign-in tokens in the address (after the #).
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const at = hash.get("access_token");
      const rt = hash.get("refresh_token");
      if (at && rt) await supabase.auth.setSession({ access_token: at, refresh_token: rt });

      const first = await supabase.auth.getSession();
      let session = first.data.session;
      const code = params.get("code");
      if (!session && code) {
        await supabase.auth.exchangeCodeForSession(code);
        session = (await supabase.auth.getSession()).data.session;
      }

      window.history.replaceState(null, "", window.location.pathname + (UUID.test(c) ? `?clinic=${c}` : ""));
      setStatus(session ? "ready" : "invalid");
    })();
  }, [supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    setStatus("done");
  }

  const home = clinic ? `/c/${clinic}` : "/";

  return (
    <PatientShell>
      <main className="mx-auto mt-8 w-full max-w-xl patient-card p-5 sm:mt-12 sm:p-8">
      {status === "checking" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center" role="status">
          <span className="h-10 w-10 animate-pulse rounded-full bg-[#e4d5f6]" />
          <div>
            <h1 className="text-xl font-bold text-[#2e1747]">Checking your secure link</h1>
            <p className="mt-1 text-sm text-[#756581]">This will only take a moment.</p>
          </div>
        </div>
      )}

      {status === "invalid" && (
        <div className="flex flex-col gap-4">
          <span className="w-fit rounded-full bg-[#f2eaff] px-3 py-1 text-xs font-semibold text-[#6d3aa8]">Account setup</span>
          <h1 className="text-2xl font-bold tracking-tight text-[#2e1747] sm:text-3xl">This link has expired</h1>
          <p className="leading-7 text-[#756581]">
            Links work once and expire after a while. Ask the clinic to send a new setup email,
            or use &quot;Forgot password&quot; on the sign-in page.
          </p>
          <Link href={home} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#6d3aa8] px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-[#572c87]">Go to the clinic page</Link>
        </div>
      )}

      {status === "ready" && (
        <form onSubmit={save} className="flex flex-col gap-5">
          <div>
            <span className="rounded-full bg-[#f2eaff] px-3 py-1 text-xs font-semibold text-[#6d3aa8]">Account setup</span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#2e1747] sm:text-3xl">Choose your password</h1>
            <p className="mt-2 leading-6 text-[#756581]">Use this password with your email to open your patient dashboard.</p>
          </div>
          <label htmlFor="new-password" className="-mb-3 text-sm font-semibold text-[#49355f]">New password</label>
          <input id="new-password" className="rounded-xl border p-3" type="password" placeholder="At least 8 characters"
            value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <label htmlFor="confirm-password" className="-mb-3 text-sm font-semibold text-[#49355f]">Confirm password</label>
          <input id="confirm-password" className="rounded-xl border p-3" type="password" placeholder="Type your password again"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
          <button disabled={busy} className="min-h-12 rounded-xl bg-[#6d3aa8] px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-[#572c87] disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Saving..." : "Save password"}
          </button>
        </form>
      )}

      {status === "done" && (
        <div className="flex flex-col items-center gap-4 py-3 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[#f2eaff] text-2xl text-[#6d3aa8]" aria-hidden="true">✓</span>
          <div>
            <h1 className="text-2xl font-bold text-[#2e1747]">Password saved</h1>
            <p className="mt-1 text-[#756581]">You are signed in and ready to continue.</p>
          </div>
          <Link href={home} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#6d3aa8] px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-[#572c87]">Open my dashboard</Link>
        </div>
      )}
      </main>
    </PatientShell>
  );
}
