
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    try {
      // Sign in with Supabase Authentication
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        throw new Error(loginError.message);
      }

      // Verify that this user is a platform admin
      const { data, error: roleError } =
        await supabase.rpc("platform_is_admin");

      if (roleError || data !== true) {
        await supabase.auth.signOut();

        throw new Error(
          roleError
            ? `Unable to verify Super Admin access: ${roleError.message}`
            : "This account does not have Super Admin access."
        );
      }

      // Redirect to the Super Admin dashboard
      router.replace("/super-admin");
      router.refresh();

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#FAF8FF] px-4 py-8 text-[#2E1747]">

      <div className="w-full max-w-md rounded-2xl border border-[#E4D5F6] bg-white p-6 shadow-lg sm:p-8">

        {/* HEADER */}

        <div className="mb-7 text-center">

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2EAFF] text-[#6D3AA8]">

            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 3 4 7v5c0 5 3 8 8 9 5-1 8-4 8-9V7l-8-4Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>

          </div>

          <h1 className="text-2xl font-bold">
            Super Admin Login
          </h1>

          <p className="mt-2 text-sm text-[#756581]">
            Dental Queue &amp; Appointment Management
          </p>

          <p className="mt-1 text-xs text-[#8B5CB5]">
            Platform Administration
          </p>

        </div>

        {/* LOGIN FORM */}

        <form
          onSubmit={handleLogin}
          className="flex flex-col gap-5"
        >

          {/* EMAIL */}

          <div>
            <label
              htmlFor="admin-email"
              className="mb-2 block text-sm font-semibold"
            >
              Email address
            </label>

            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="min-h-12 w-full rounded-xl border border-[#E4D5F6] bg-white px-4 py-3 text-sm outline-none focus:border-[#6D3AA8] focus:ring-4 focus:ring-[#F2EAFF]"
            />
          </div>

          {/* PASSWORD */}

          <div>
            <label
              htmlFor="admin-password"
              className="mb-2 block text-sm font-semibold"
            >
              Password
            </label>

            <div className="relative">

              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="min-h-12 w-full rounded-xl border border-[#E4D5F6] bg-white px-4 py-3 pr-20 text-sm outline-none focus:border-[#6D3AA8] focus:ring-4 focus:ring-[#F2EAFF]"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                className="absolute inset-y-0 right-3 text-xs font-semibold text-[#6D3AA8]"
              >
                {showPassword ? "Hide" : "Show"}
              </button>

            </div>
          </div>

          {/* ERROR */}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {/* LOGIN BUTTON */}

          <button
            type="submit"
            disabled={loading}
            className="min-h-12 w-full rounded-xl bg-[#6D3AA8] px-5 py-3 font-bold text-white shadow-sm transition hover:bg-[#572C87] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Signing in..."
              : "Sign in as Super Admin"}
          </button>

        </form>

        <p className="mt-6 text-center text-xs text-[#80748B]">
          Authorized platform administrators only.
        </p>

      </div>

    </main>
  );
}
