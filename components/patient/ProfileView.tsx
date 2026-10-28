
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ConfirmationModal from "@/components/ConfirmationModal";

type Profile = {
  patient_id: string;
  clinic: string;
  person: string;
  visit_count: number;
  last_visit_at: string | null;
  link_status: "linked" | "pending";
};

export default function ProfileView({
  clinicId,
  name,
  email,
  onSignOut,
}: {
  clinicId: string;
  name: string | null;
  email: string | null;
  onSignOut: () => void | Promise<void>;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<{
    id: string;
    person: string;
    pending: boolean;
  } | null>(null);

  // LOAD LINKED PROFILES

  const load = useCallback(async () => {
    const {
      data,
      error: queryError,
    } = await supabase.rpc("my_profiles");

    if (queryError) {
      setError(queryError.message);
    } else {
      setProfiles((data ?? []) as Profile[]);
      setError("");
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(kickoff);
  }, [load]);

  // REMOVE OR CANCEL A LINKED PROFILE

  async function confirmUnlink() {
    const target = confirmTarget;
    if (!target || busyId) return;
    setError("");
    setBusyId(target.id);
    try {
      const { error: unlinkError } = await supabase.rpc(
        "unlink_profile",
        {
          p_patient_id: target.id,
        }
      );

      if (unlinkError) {
        setError(unlinkError.message);
        return;
      }

      setConfirmTarget(null);
      await load();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
    <div className="flex w-full flex-col gap-5 text-[#2E1747] sm:gap-6">

      {/* PROFILE PAGE HEADER */}

      <div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Profile
        </h1>

      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}

      {/* DESKTOP: TWO COLUMNS */}
      {/* MOBILE: STACKED SECTIONS */}

      <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch lg:gap-6">

        {/* LEFT: ACCOUNT DETAILS */}

        <section
          aria-labelledby="account-details-heading"
          className="flex min-w-0 flex-col rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B5CB5]">
              Account details
            </p>

            <p className="mt-1 text-sm text-[#756581]">
              Your personal account information.
            </p>
          </div>

          {/* ACCOUNT INFORMATION */}

          <div className="mt-5 rounded-xl border border-[#E4D5F6] bg-[#FCFAFF] p-4">

            <p className="text-xs font-semibold text-[#80748B]">
              Account name
            </p>

            <p className="mt-1 break-words text-sm font-bold text-[#2E1747]">
              {name || "Not available"}
            </p>

            <div className="my-4 border-t border-[#EDE5F5]" />

            <p className="text-xs font-semibold text-[#80748B]">
              Email address
            </p>

            <p className="mt-1 break-all text-sm font-medium text-[#2E1747]">
              {email || "Not available"}
            </p>

          </div>


{/* ACCOUNT ACTIONS */}

<div className="mt-5 border-t border-[#EDE5F5] pt-3">

  {/* MANAGE ACCOUNT */}

  <Link
    href={`/c/${clinicId}/account`}
    className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-3 text-left text-sm font-semibold text-[#5C327F] transition hover:bg-[#F8F3FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCCAF3]"
  >
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.56V21h-3v-.78a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7.08 15a1.7 1.7 0 0 0-1.56-1H5v-3h.52a1.7 1.7 0 0 0 1.56-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1-1.56V4h3v.78a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.56 1H21v3h-.04A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>

    <span>Manage account</span>
  </Link>



</div>


        </section>

        {/* RIGHT: LINKED PROFILES */}

        <section
          aria-labelledby="people-heading"
          className="min-w-0 rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6"
        >
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B5CB5]">
            Linked profiles
          </p>

          <p className="mt-1 text-sm text-[#756581]">
            Family members linked to this clinic account.
          </p>

          {/* LOADING STATE */}

          {loading && (
            <p
              role="status"
              className="mt-4 rounded-xl bg-[#FAF8FF] p-4 text-sm text-[#6F647A]"
            >
              Loading profiles…
            </p>
          )}

          {/* EMPTY STATE */}

          {!loading && profiles.length === 0 && (
            <p className="mt-4 rounded-xl bg-[#FAF8FF] p-4 text-sm text-[#6F647A]">
              No linked profiles yet. Join the queue
              or book a visit while signed in, and it
              will be saved here.
            </p>
          )}

          {/* LINKED PROFILE LIST */}

          <ul className="mt-4 flex flex-col gap-3">
            {profiles.map((profile) => (
              <li
                key={`${profile.patient_id}-${profile.link_status}`}
                className="flex flex-col gap-3 rounded-xl border border-[#E4D5F6] bg-[#FCFAFF] p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">

                  <p className="break-words font-bold text-[#2E1747]">
                    {profile.person}
                  </p>

                  <p className="mt-1 break-words text-[#756581]">
                    {profile.clinic}
                  </p>

                  {profile.link_status === "pending" ? (
                    <p className="mt-2 text-sm font-medium text-amber-700">
                      Waiting for front desk verification
                    </p>
                  ) : (
                    <p className="mt-2 text-xs leading-5 text-[#80748B]">
                      {profile.visit_count}{" "}
                      {profile.visit_count === 1
                        ? "visit"
                        : "visits"}

                      {profile.last_visit_at
                        ? ` · Last visit ${new Date(
                            profile.last_visit_at
                          ).toLocaleDateString("en-PH")}`
                        : ""}
                    </p>
                  )}

                </div>

                {/* UNLINK BUTTON */}

                <button
                  type="button"
                  disabled={busyId !== ""}
                  onClick={() => {
                    setError("");
                    setConfirmTarget({
                      id: profile.patient_id,
                      person: profile.person,
                      pending: profile.link_status === "pending",
                    });
                  }}
                  className="min-h-11 w-full shrink-0 rounded-xl border border-[#D7C4EA] bg-white px-4 py-2 text-sm font-semibold text-[#5C327F] transition hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {busyId === profile.patient_id
                    ? "Updating…"
                    : profile.link_status === "pending"
                      ? "Cancel request"
                      : "Remove"}
                </button>

              </li>
            ))}
          </ul>
        </section>

      </div>


{/* SIGN OUT - BOTTOM OF PROFILE PAGE */}

<div className="mt-auto border-t border-[#E4D5F6] pt-4">
  <button
    type="button"
    onClick={() => void onSignOut()}
    className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-3 text-left text-sm font-semibold text-[#B5414D] transition hover:bg-[#FFF0F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0C4C8]"
  >
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>

    <span>Sign out</span>
  </button>
</div>

    </div>
    <ConfirmationModal
      open={confirmTarget !== null}
      title={confirmTarget?.pending ? "Cancel this link request?" : `Remove ${confirmTarget?.person ?? "this person"}?`}
      description={confirmTarget?.pending
        ? "The pending request will be cancelled. You can request this profile link again later."
        : "This person will be removed from your account, and their visits will stop appearing in your history."}
      confirmLabel={confirmTarget?.pending ? "Yes, cancel request" : "Yes, remove profile"}
      cancelLabel={confirmTarget?.pending ? "Keep request" : "Keep profile"}
      busy={busyId !== ""}
      busyLabel="Updating…"
      tone={confirmTarget?.pending ? "warning" : "danger"}
      error={confirmTarget ? error : ""}
      onCancel={() => {
        if (busyId) return;
        setConfirmTarget(null);
        setError("");
      }}
      onConfirm={() => void confirmUnlink()}
    />
    </>
  );
}
