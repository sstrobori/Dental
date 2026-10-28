
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import RequiredMark from "@/components/RequiredMark";

// Exact purple tooth icon from AdminShell.tsx
const BrandMark = ({
  className = "h-11 w-11 shrink-0 text-[#6D3AA8]",
}: {
  className?: string;
}) => (
  <svg
    viewBox="0 0 48 48"
    className={className}
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M14.2 7.8c3.1-1.5 6.5.4 9.8.4s6.7-1.9 9.8-.4c4.8 2.3 6.5 8.6 4.1 14.5-1.2 3-3.2 5.1-4.3 8.8-1.5 5.1-2.4 9.1-5.2 9.1-3.1 0-2.4-8.4-4.4-8.4s-1.3 8.4-4.4 8.4c-2.8 0-3.7-4-5.2-9.1-1.1-3.7-3.1-5.8-4.3-8.8-2.4-5.9-.7-12.2 4.1-14.5Z"
      fill="currentColor"
    />
    <path
      d="M18 13c2.3 1.3 4 1.8 6 1.8s3.7-.5 6-1.8"
      stroke="white"
      strokeWidth="2.2"
      strokeLinecap="round"
      opacity=".8"
    />
  </svg>
);

const FIELD_CLASS =
  "min-h-12 w-full rounded-xl border border-[#DDD3EA] bg-white px-4 py-3 text-sm text-[#2E1747] outline-none transition placeholder:text-[#A79AB3] hover:border-[#BBA6D5] focus:border-[#8854C4] focus:ring-4 focus:ring-[#F2EAFF] disabled:opacity-60";

function EmailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <rect x="5" y="10" width="14" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function FeatureIcon({ type }: { type: "queue" | "calendar" }) {
  const base = {
    className: "h-5 w-5",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (type === "queue") {
    return (
      <svg {...base}>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <circle cx="4" cy="6" r="1.4" />
        <circle cx="4" cy="12" r="1.4" />
        <circle cx="4" cy="18" r="1.4" />
      </svg>
    );
  }

  if (type === "calendar") {
    return (
      <svg {...base}>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4m8-4v4M3 10h18" />
      </svg>
    );
  }

  return (
    <svg {...base}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0m1-10a3 3 0 0 1 0 6m1 1a5 5 0 0 1 4 3" />
    </svg>
  );
}

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("Please enter your email address and password.");
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage("Invalid email or password. Please try again.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setMessage("Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
<div className="admin-ui relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-[#F8F7FC] px-4 py-6 text-[#2E1747] sm:px-6 lg:py-10">

{/* FULL-SCREEN DENTAL BACKGROUND */}
<div
  className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
  style={{
    backgroundImage: "url('/test-dental-bg.jpg')",
  }}
  aria-hidden="true"
/>

{/* SUBTLE OVERLAY */}
<div
className="pointer-events-none absolute inset-0 z-0 bg-white/15 backdrop-blur-[3px]"
/>


      {/* BACKGROUND DECORATIONS */}
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#E9DDF8]/75 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[#E9DDF8]/70 blur-3xl"
        aria-hidden="true"
      />

<main className="relative z-10 mx-auto grid w-full max-w-[1040px] overflow-hidden rounded-[28px] border border-[#E4D5F6] bg-white shadow-[0_24px_80px_rgba(65,35,95,0.12)] lg:grid-cols-[0.95fr_1.05fr]">
        {/* LEFT: BRANDING PANEL */}
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#7B46BA] via-[#62349B] to-[#3E205F] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">

          {/* DECORATIVE SHAPES */}
          <div
            className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full border-[48px] border-white/10"
            aria-hidden="true"
          />

          <div
            className="pointer-events-none absolute -bottom-36 -left-36 h-96 w-96 rounded-full border-[55px] border-white/10"
            aria-hidden="true"
          />


<div className="relative z-10">
  {/* BRANDING */}
  <div className="flex items-center gap-4">
    <BrandMark className="h-14 w-14 shrink-0 text-white" />

    <div className="min-w-0">
      <p className="text-lg font-extrabold leading-snug tracking-tight text-white">
        Dental Queue and Appointment Management
      </p>

      <p className="mt-1 text-sm font-medium text-white/75">
        Dental Clinic workspace
      </p>
    </div>
  </div>
</div>


          <div className="relative z-10 my-10">
            <div className="mb-4 h-1 w-12 rounded-full bg-white/70" />


<h2 className="max-w-sm text-3xl font-extrabold leading-tight tracking-tight xl:text-4xl">
  <span className="block whitespace-nowrap">Smarter queues.</span>
  <span className="block whitespace-nowrap">Simpler appointments.</span>
</h2>

            {/* FEATURE LIST */}
            <div className="mt-9 flex flex-col gap-3">

              <div className="flex items-center gap-4 rounded-xl border border-white/15 bg-white/10 px-4 py-3.5 backdrop-blur-sm">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/15">
                  <FeatureIcon type="queue" />
                </div>
                <div>
                  <p className="text-sm font-bold">Live queue management</p>
                  <p className="mt-0.5 text-xs text-[#EADCF6]">
                    Keep track of patients and queue progress.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-xl border border-white/15 bg-white/10 px-4 py-3.5 backdrop-blur-sm">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/15">
                  <FeatureIcon type="calendar" />
                </div>
                <div>
                  <p className="text-sm font-bold">Appointment scheduling</p>
                  <p className="mt-0.5 text-xs text-[#EADCF6]">
                    Manage upcoming patient visits.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* RIGHT: SIGN IN */}
        <section className="flex flex-col justify-center px-5 py-8 sm:px-10 sm:py-12 lg:px-12 xl:px-16">

          {/* MOBILE BRANDING */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark />

            <div>
              <p className="text-sm font-extrabold leading-snug text-[#2E1747]">
                Dental Queue and Appointment Management
              </p>
              <p className="mt-1 text-xs font-medium text-[#756581]">
                Dental Clinic workspace
              </p>
            </div>
          </div>

          {/* STAFF ACCESS BADGE */}
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#E4D5F6] bg-[#F6F0FF] px-3 py-1.5 text-xs font-bold text-[#7040A6]">
            <span className="h-2 w-2 rounded-full bg-[#8B5CF6]" />
            STAFF PORTAL
          </div>

          <div className="mt-5">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#2E1747] sm:text-4xl">
              Welcome back
            </h1>

            <p className="mt-3 max-w-md text-sm leading-6 text-[#756581]">
              Sign in to manage patient queues and appointments.
            </p>
          </div>

          {/* LOGIN FORM */}
          <form
            onSubmit={handleLogin}
            className="mt-8 flex flex-col gap-5"
          >

            {/* EMAIL */}
            <div>
              <label
                htmlFor="staff-email"
                className="mb-2 block text-sm font-semibold text-[#49355F]"
              >
                Email address <RequiredMark />
              </label>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#9587A5]">
                  <EmailIcon />
                </div>

                <input
                  id="staff-email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="you@clinic.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setMessage("");
                  }}
                  disabled={busy}
                  className={`${FIELD_CLASS} pl-12`}
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label
                htmlFor="staff-password"
                className="mb-2 block text-sm font-semibold text-[#49355F]"
              >
                Password <RequiredMark />
              </label>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#9587A5]">
                  <LockIcon />
                </div>

                <input
                  id="staff-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setMessage("");
                  }}
                  disabled={busy}
                  className={`${FIELD_CLASS} pl-12 pr-14`}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-1 right-2 flex w-10 items-center justify-center rounded-lg text-[#897A99] transition hover:bg-[#F2EAFF] hover:text-[#6D3AA8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCCAF3]"
                >
                  {showPassword ? (
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 5.2A10.9 10.9 0 0 1 12 5c5 0 8.5 4.2 9 7a11.8 11.8 0 0 1-3 4.6" />
                      <path d="M6.2 6.2C4.2 7.6 3.3 9.8 3 12c.5 2.8 4 7 9 7 1.1 0 2.1-.2 3.1-.5" />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* ERROR MESSAGE */}
            {message && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-[#F0C4C8] bg-[#FFF0F1] px-4 py-3 text-sm leading-5 text-[#A73743]"
              >
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5m0 3h.01" />
                </svg>
                <span>{message}</span>
              </div>
            )}

            {/* SIGN IN BUTTON */}
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#6D3AA8] px-5 py-3.5 text-sm font-bold text-white shadow-[0_6px_18px_rgba(109,58,168,0.17)] transition hover:bg-[#572C87] hover:shadow-[0_8px_22px_rgba(109,58,168,0.2)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    aria-hidden="true"
                  />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14m-6-6 6 6-6 6" />
                  </svg>
                </>
              )}
            </button>
          </form>

        </section>
      </main>
    </div>
  );
}
