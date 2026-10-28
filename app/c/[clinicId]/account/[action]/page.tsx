"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PatientShell from "@/components/patient/PatientShell";
import ConfirmationModal from "@/components/ConfirmationModal";
import { createClient } from "@/lib/supabase/client";

type Action = "email" | "mobile" | "password" | "forgot-password" | "reset-password";
const LABELS: Record<Action, string> = {
  email: "Change email address",
  mobile: "Change mobile number",
  password: "Change password",
  "forgot-password": "Forgot password",
  "reset-password": "Set a new password",
};
const PH_MOBILE = /^(?:09\d{9}|\+639\d{9})$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const field = "min-h-12 w-full rounded-xl border border-[#E4D5F6] bg-white px-4 py-3 text-sm text-[#2E1747] outline-none focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]";
const label = "flex flex-col gap-2 text-sm font-semibold text-[#49365E]";

function normalizePhone(value: string) {
  const sanitized = value.replace(/[^\d+]/g, "");
  const clean = sanitized.startsWith("+")
    ? "+" + sanitized.slice(1).replace(/\+/g, "")
    : sanitized.replace(/\+/g, "");
  return clean.slice(0, clean.startsWith("+") ? 13 : 11);
}

function validatePassword(password: string) {
  if (password.length < 12 || password.length > 128) return "Use 12–128 characters.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return "Include both uppercase and lowercase letters.";
  if (!/\d/.test(password)) return "Include at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Include at least one symbol.";
  return "";
}

function AccountActionContent() {
  const { clinicId, action: segment } = useParams<{ clinicId: string; action: string }>();
  const action: Action | null = Object.prototype.hasOwnProperty.call(LABELS, segment) ? segment as Action : null;
  const supabase = useMemo(() => createClient(), []);
  const base = `/c/${clinicId}/account`;
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [currentEmail, setCurrentEmail] = useState("");
  const [nextEmail, setNextEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailForReset, setEmailForReset] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      setLoading(true);
      setError("");
      setSuccess("");
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      setReady(false);
      if (!action) { setError("That settings page does not exist."); setLoading(false); return; }

      if (action === "reset-password") {
        // Only a real Supabase recovery link should unlock this form.
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        let recoveryError = "";
        let validLink = false;

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          recoveryError = exchangeError?.message ?? "";
          validLink = !exchangeError;
        } else if (tokenHash && type === "recovery") {
          const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          recoveryError = verifyError?.message ?? "";
          validLink = !verifyError;
        } else if (hash.get("type") === "recovery" && hash.get("access_token") && hash.get("refresh_token")) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: hash.get("access_token")!,
            refresh_token: hash.get("refresh_token")!,
          });
          recoveryError = sessionError?.message ?? "";
          validLink = !sessionError;
        } else {
          recoveryError = hash.get("error_description")?.replace(/\+/g, " ") || "Open a valid password-reset link from your email.";
        }

        // Remove tokens and one-time codes from the visible address bar.
        window.history.replaceState(null, "", window.location.pathname);
        if (validLink) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) { validLink = false; recoveryError = "The reset link could not be verified. Request a new one."; }
        }
        if (!cancelled) {
          setReady(validLink);
          if (!validLink) setError(recoveryError);
          setLoading(false);
        }
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (user) {
        setCurrentEmail(user.email ?? "");
        setEmailForReset(user.email ?? "");
        setPhone(typeof user.user_metadata?.contact_phone === "string" ? user.user_metadata.contact_phone : "");
      }
      const allowed = action === "forgot-password" || !!user?.email;
      setReady(allowed);
      if (!allowed) setError("Sign in to change your account information.");
      setLoading(false);
    }
    void initialize();
    return () => { cancelled = true; };
  }, [action, supabase]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!action || !ready || busy) return;

    if (action === "email" && (!EMAIL.test(nextEmail.trim()) || nextEmail.trim().toLowerCase() === currentEmail.toLowerCase())) {
      return setError("Enter a valid new email address that differs from your current one.");
    }
    if (action === "mobile" && phone && !PH_MOBILE.test(phone)) {
      return setError("Enter 11 digits starting with 09, or +63 followed by 10 digits starting with 9.");
    }
    if (action === "forgot-password" && !EMAIL.test(emailForReset.trim())) return setError("Enter a valid email address.");
    if (action === "password" || action === "reset-password") {
      const issue = validatePassword(nextPassword);
      if (issue) return setError(issue);
      if (nextPassword !== confirmPassword) return setError("New passwords do not match.");
      if (action === "password" && currentPassword === nextPassword) return setError("Choose a password different from your current password.");
    }
    if ((action === "email" || action === "mobile" || action === "password") && !currentPassword) {
      return setError("Enter your current password to continue.");
    }
    setConfirmOpen(true);
  }

  async function performAction() {
    if (!action) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (action === "forgot-password") {
        const { error: requestError } = await supabase.auth.resetPasswordForEmail(emailForReset.trim(), {
          redirectTo: `${window.location.origin}${base}/reset-password`,
        });
        if (requestError) throw requestError;
        setSuccess("If an account exists for this email, a password-reset link will be sent. Check your inbox and spam folder.");
      } else if (action === "reset-password") {
        const { error: changeError } = await supabase.auth.updateUser({ password: nextPassword });
        if (changeError) throw changeError;
        setNextPassword("");
        setConfirmPassword("");
        await supabase.auth.signOut();
        setReady(false);
        setSuccess("Your password has been reset. Please sign in using your new password.");
      } else {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user?.email) throw new Error("Your session expired. Please sign in again.");
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });
        if (loginError) throw new Error("Current password is incorrect, or reauthentication failed.");

        if (action === "email") {
          const { error: updateError } = await supabase.auth.updateUser(
            { email: nextEmail.trim().toLowerCase() },
            { emailRedirectTo: `${window.location.origin}${base}` }
          );
          if (updateError) throw updateError;
          setSuccess("Email change requested. Confirm the email message(s) from Supabase to finish updating your sign-in address.");
          setNextEmail("");
        } else if (action === "mobile") {
          const { error: updateError } = await supabase.auth.updateUser({ data: { contact_phone: phone } });
          if (updateError) throw updateError;
          setSuccess("Your contact mobile number has been updated. This does not change the phone numbers stored in individual clinic patient records.");
        } else if (action === "password") {
          const { error: updateError } = await supabase.auth.updateUser({ password: nextPassword });
          if (updateError) throw updateError;
          setCurrentPassword("");
          setNextPassword("");
          setConfirmPassword("");
          setSuccess("Your password has been changed successfully.");
        }
        setCurrentPassword("");
      }
      setConfirmOpen(false);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PatientShell hideHeaderOnMobile>
      <main className="mx-auto mt-6 w-full max-w-xl pb-10 sm:mt-10">
        <Link href={action === "reset-password" ? `/c/${clinicId}` : base} className="text-sm font-semibold text-[#6D3AA8] hover:underline">
          ← {action === "reset-password" ? "Back to patient portal" : "Back to Manage account"}
        </Link>
        <section className="patient-card mt-4 p-5 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#8B5CB5]">Account security</p>
          <h1 className="mt-2 text-2xl font-bold text-[#2E1747] sm:text-3xl">{action ? LABELS[action] : "Page not found"}</h1>
          {loading && <p role="status" className="mt-5 text-sm text-[#756581]">Checking your account…</p>}
          {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {success && <p role="status" className="mt-5 rounded-xl border border-[#D8C5EF] bg-[#F2EAFF] p-3 text-sm text-[#5C327F]">{success}</p>}

          {!loading && ready && !success && (
            <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
              {action === "email" && (
                <>
                  <p className="text-sm text-[#756581]">Current email: <strong className="break-all text-[#2E1747]">{currentEmail}</strong></p>
                  <label className={label}><span>New email address <span className="text-red-500" aria-hidden="true">*</span></span>
                    <input className={field} type="email" required autoComplete="email" value={nextEmail} onChange={e => setNextEmail(e.target.value)} placeholder="new@email.com" />
                  </label>
                </>
              )}

              {action === "mobile" && (
                <>
                  <label className={label}><span className="flex items-center justify-between gap-2"><span>Contact mobile number</span><span className="text-xs font-normal text-[#82758E]">(optional)</span></span>
                    <input className={field} type="tel" inputMode="tel" maxLength={13} autoComplete="tel" value={phone} onChange={e => setPhone(normalizePhone(e.target.value))} placeholder="09171234567 or +639171234567" />
                  </label>
                  <p className="text-xs text-[#756581]">Leave this empty to clear your contact number. This is not an SMS-verified login number.</p>
                </>
              )}

              {action === "forgot-password" && (
                <>
                  <p className="text-sm leading-6 text-[#756581]">Enter the email associated with your patient account. We will send a link to create a new password, never your existing password.</p>
                  <label className={label}><span>Account email address <span className="text-red-500" aria-hidden="true">*</span></span>
                    <input className={field} type="email" required autoComplete="email" value={emailForReset} onChange={e => setEmailForReset(e.target.value)} placeholder="you@example.com" />
                  </label>
                </>
              )}

              {(action === "email" || action === "mobile" || action === "password") && (
                <label className={label}><span>Current password <span className="text-red-500" aria-hidden="true">*</span></span>
                  <input className={field} type="password" required autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                </label>
              )}

              {(action === "password" || action === "reset-password") && (
                <>
                  <label className={label}><span>New password <span className="text-red-500" aria-hidden="true">*</span></span>
                    <input className={field} type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={nextPassword} onChange={e => setNextPassword(e.target.value)} />
                  </label>
                  <label className={label}><span>Confirm new password <span className="text-red-500" aria-hidden="true">*</span></span>
                    <input className={field} type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                  </label>
                  <p className="text-xs leading-5 text-[#756581]">Use 12–128 characters, including uppercase and lowercase letters, a number, and a symbol. Don&apos;t reuse your current password.</p>
                </>
              )}

              <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-[#6D3AA8] px-5 py-3 font-bold text-white transition hover:bg-[#572C87] disabled:opacity-50">
                {action === "forgot-password" ? "Send reset link" : action === "reset-password" ? "Reset password" : "Continue"}
              </button>
              {action === "password" && <Link href={`${base}/forgot-password`} className="self-center text-sm font-semibold text-[#6D3AA8] underline">Forgot your current password?</Link>}
            </form>
          )}
          {!loading && !ready && !success && action === "reset-password" && <Link href={`${base}/forgot-password`} className="mt-5 inline-flex text-sm font-semibold text-[#6D3AA8] underline">Request a new reset link</Link>}
          {!loading && !ready && !success && action !== "reset-password" && <Link href={`/c/${clinicId}`} className="mt-5 inline-flex text-sm font-semibold text-[#6D3AA8] underline">Go to patient sign-in</Link>}
          {success && <Link href={action === "reset-password" ? `/c/${clinicId}?tab=account` : base} className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-[#D7C4EA] px-4 text-sm font-semibold text-[#6D3AA8] hover:bg-[#F2EAFF]">{action === "reset-password" ? "Return to sign in" : "Back to Manage account"}</Link>}
        </section>
      </main>

      <ConfirmationModal
        open={confirmOpen}
        title={action === "forgot-password" ? "Send password reset link?" : action === "reset-password" ? "Reset your password?" : action === "email" ? "Change email address?" : action === "mobile" ? "Update contact number?" : "Change password?"}
        description={`Are you sure you want to ${action === "forgot-password" ? "send a password-reset email" : action === "reset-password" ? "reset your password" : action === "email" ? "request this email change" : action === "mobile" ? "save this contact number" : "change your password"}?`}
        confirmLabel={action === "forgot-password" ? "Send reset link" : action === "reset-password" ? "Reset password" : action === "email" ? "Request change" : action === "mobile" ? "Save changes" : "Change password"}
        cancelLabel="No, cancel"
        busy={busy}
        busyLabel={action === "forgot-password" ? "Sending…" : action === "reset-password" ? "Resetting…" : action === "email" ? "Requesting…" : action === "mobile" ? "Saving…" : "Changing…"}
        error={confirmOpen ? error : ""}
        onCancel={() => {
          if (busy) return;
          setConfirmOpen(false);
          setError("");
        }}
        onConfirm={() => void performAction()}
      />
    </PatientShell>
  );
}


export default function AccountActionPage() {
  return (
    <Suspense
      fallback={
        <PatientShell hideHeaderOnMobile>
          <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-[#E4D5F6] bg-white p-6 text-center text-sm text-[#756581]">
            Loading account settings...
          </div>
        </PatientShell>
      }
    >
      <AccountActionContent />
    </Suspense>
  );
}

