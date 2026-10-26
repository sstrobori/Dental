"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"login" | "signup" | "">("");

  async function handleSignUp() {
    setMessage("");
    if (!email.trim() || password.length < 8) return setMessage("Enter your email and a password with at least 8 characters.");
    setBusy("signup");
    const { error } = await supabase.auth.signUp({ email, password });
    setBusy("");
    setMessage(error ? error.message : "Signed up! Now log in.");
  }

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    setMessage("");
    if (!email.trim() || !password) return setMessage("Enter your email and password.");
    setBusy("login");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setBusy(""); return setMessage(error.message); }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="admin-ui relative min-h-dvh overflow-hidden bg-[#f8f7fc] px-4 py-8 text-[#2e1747] sm:px-6">
      <div className="pointer-events-none absolute -left-28 -top-28 h-80 w-80 rounded-full bg-[#e8dbfb] blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-[#f2eaff] blur-3xl" aria-hidden="true" />
      <main className="relative mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md items-center">
        <section className="w-full rounded-3xl border border-[#e4d5f6] bg-white p-5 shadow-[0_24px_70px_rgba(73,43,104,0.12)] sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#6d3aa8] text-sm font-extrabold text-white shadow-lg shadow-purple-900/10">CF</span>
            <div><p className="text-lg font-extrabold">ChairFlow</p><p className="text-xs font-medium text-[#756581]">Clinic workspace</p></div>
          </div>
          <div className="mt-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b5cb5]">Staff access</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm leading-6 text-[#756581]">Sign in to manage today&apos;s queue, patients, and appointments.</p>
          </div>
          <form onSubmit={handleLogin} className="mt-7 flex flex-col gap-5">
            <label htmlFor="staff-email" className="flex flex-col gap-2 text-sm font-semibold text-[#49355f]">Email address
              <input id="staff-email" className="min-h-12 rounded-xl border border-[#e4d5f6] px-4 py-3 font-normal" type="email" placeholder="you@clinic.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <label htmlFor="staff-password" className="flex flex-col gap-2 text-sm font-semibold text-[#49355f]">Password
              <input id="staff-password" className="min-h-12 rounded-xl border border-[#e4d5f6] px-4 py-3 font-normal" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </label>
            {message && <p role="status" className="rounded-xl border border-[#e4d5f6] bg-[#faf8ff] p-3 text-sm font-medium text-[#5b3c73]">{message}</p>}
            <button disabled={!!busy} className="min-h-12 rounded-xl bg-[#6d3aa8] px-5 py-3 font-bold text-white shadow-sm transition hover:bg-[#572c87] disabled:cursor-not-allowed disabled:opacity-50">
              {busy === "login" ? "Signing in…" : "Sign in"}
            </button>
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-[#9a8fa5]"><span className="h-px flex-1 bg-[#eee5f7]" />New clinic?<span className="h-px flex-1 bg-[#eee5f7]" /></div>
            <button type="button" disabled={!!busy} className="min-h-12 rounded-xl border border-[#d7c4ea] bg-white px-5 py-3 font-bold text-[#6d3aa8] transition hover:bg-[#f2eaff] disabled:opacity-50" onClick={handleSignUp}>
              {busy === "signup" ? "Creating account…" : "Create staff account"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
