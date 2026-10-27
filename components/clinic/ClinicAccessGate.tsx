"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

type ClinicStatus = "active" | "pending" | "suspended";
type ClinicStatusRow = { clinic_id: string; clinic_status: ClinicStatus };
type GateState =
  | { kind: "loading" }
  | { kind: "active" }
  | { kind: "pending" | "suspended" }
  | { kind: "error"; message: string };

/** Display gate only. The SQL migration protects core database operations. */
export default function ClinicAccessGate({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<GateState>({ kind: "loading" });

  const check = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("platform_my_clinic_status");
      if (error) {
        setState({ kind: "error", message: error.message });
        return;
      }
      const status = (data as ClinicStatusRow[] | null)?.[0]?.clinic_status;
      if (status === "active" || status === "pending" || status === "suspended") {
        setState({ kind: status });
      } else {
        setState({ kind: "error", message: "No clinic is linked to this staff account." });
      }
    } catch {
      setState({ kind: "error", message: "Unable to check clinic access. Please retry." });
    }
  }, [supabase]);

  useEffect(() => {
    void check();
    // Periodic checks catch status changes without granting direct read access
    // to the restricted platform_partner_clinics table.
    const timer = window.setInterval(() => void check(), 15000);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [check]);

  if (state.kind === "active") return <>{children}</>;

  if (state.kind === "loading") {
    return <main role="status" className="grid min-h-dvh place-items-center bg-[#F8F7FC] p-6 text-[#756581]">Checking clinic access…</main>;
  }

  const locked = state.kind === "pending" || state.kind === "suspended";
  return (
    <main className="grid min-h-dvh place-items-center bg-[#F8F7FC] px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border border-[#E4D5F6] bg-white p-7 text-center shadow-sm">
        <div className={`mx-auto mb-4 grid size-12 place-items-center rounded-xl ${state.kind === "suspended" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`} aria-hidden="true">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 1 1 8 0v3" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[#2E1747]">
          {state.kind === "pending" ? "Clinic approval pending" : state.kind === "suspended" ? "Clinic access suspended" : "Unable to verify clinic access"}
        </h1>

        <p className="mt-3 text-sm leading-6 text-[#756581]">
          {state.kind === "pending"
            ? "Your clinic is awaiting Super Admin approval. The clinic dashboard is temporarily unavailable."
            : state.kind === "suspended"
              ? "Your clinic has been suspended. Please contact your platform administrator for assistance."
              : state.kind === "error"
                ? state.message
                : "Unable to verify clinic access."}
        </p>

        <button type="button" onClick={() => void check()} className="mt-5 min-h-11 rounded-xl bg-[#6D3AA8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#572C87]">
          {locked ? "Check status again" : "Retry"}
        </button>
      </section>
    </main>
  );
}
