
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PatientShell from "@/components/patient/PatientShell";
import { createClient } from "@/lib/supabase/client";

const SETTINGS = [
  {
    path: "email",
    label: "Change email address",
    detail: "Request a confirmed change of your sign-in email.",
  },
  {
    path: "mobile",
    label: "Change mobile number",
    detail: "Update your account's contact phone number.",
  },
  {
    path: "password",
    label: "Change password",
    detail: "Update your password using your current password.",
  },
  {
    path: "forgot-password",
    label: "Forgot password",
    detail: "Receive an email link to set a new password.",
  },
];

export default function ManageAccountPage() {
  const { clinicId } = useParams<{ clinicId: string }>();

  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return;

      setEmail(user?.email ?? null);

      setPhone(
        typeof user?.user_metadata?.contact_phone === "string"
          ? user.user_metadata.contact_phone
          : ""
      );

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const home = `/c/${clinicId}`;

  return (
    <PatientShell hideHeaderOnMobile>
      <main className="mx-auto mt-6 w-full max-w-2xl pb-10 sm:mt-10">
        <Link
          href={`${home}?tab=profile`}
          className="text-sm font-semibold text-[#6D3AA8] hover:underline"
        >
          ← Back to Profile
        </Link>

        <section className="patient-card mt-4 p-5 sm:p-8">
          <h1 className="mt-2 text-2xl font-bold text-[#2E1747] sm:text-3xl">
            Manage account
          </h1>
          {loading ? (
            <p className="mt-6 text-sm text-[#756581]">
              Checking your account…
            </p>
          ) : !email ? (
            <div className="mt-6 rounded-xl bg-[#FAF8FF] p-4 text-sm">
              Please sign in to manage your account.{" "}
              <Link
                href={home}
                className="font-semibold text-[#6D3AA8] underline"
              >
                Go to patient portal
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-5 rounded-xl bg-[#FAF8FF] p-4 text-sm">
                <p className="break-all">
                  <strong>Email:</strong> {email}
                </p>

                <p className="mt-2">
                  <strong>Contact number:</strong>{" "}
                  {phone || "Not provided"}
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-3">
                {SETTINGS.map((item) => (
                  <Link
                    key={item.path}
                    href={`${home}/account/${item.path}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#E4D5F6] bg-white p-4 transition hover:bg-[#FAF8FF]"
                  >
                    <span>
                      <strong className="block text-sm text-[#2E1747]">
                        {item.label}
                      </strong>

                      <span className="mt-1 block text-xs text-[#756581]">
                        {item.detail}
                      </span>
                    </span>

                    <span
                      className="text-xl text-[#6D3AA8]"
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </PatientShell>
  );
}
