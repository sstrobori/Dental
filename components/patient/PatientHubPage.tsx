
"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { startOfTodayManila } from "@/lib/today";

import JoinForm from "@/components/patient/JoinForm";
import BookForm from "@/components/patient/BookForm";
import GuestQueueTicket from "@/components/patient/GuestQueueTicket";
import AccountPanel, {
  type Account,
} from "@/components/patient/AccountPanel";
import HistoryView from "@/components/patient/HistoryView";
import ProfileView from "@/components/patient/ProfileView";
import PatientDashboard from "@/components/patient/PatientDashboard";
import Link from "next/link";

import PatientShell, {
  PatientIcon,
  type PatientIconName,
} from "@/components/patient/PatientShell";

type Tab =
  | "dashboard"
  | "queue"
  | "book"
  | "visit"
  | "history"
  | "profile"
  | "account";

type Saved = {
  entryId?: string;
  appointmentId?: string;
};

const UUID = /^[0-9a-f-]{36}$/i;

const TICKET_DONE = [
  "served",
  "cancelled",
  "no_show",
];

const APPT_DONE = [
  "cancelled",
  "completed",
  "no_show",
];

export default function PatientHubPage({ mode }: { mode: "guest" | "patient" }) {
  return (
    <Suspense
      fallback={
        <PatientShell hideHeaderOnMobile>
          <div className="mx-auto mt-10 max-w-xl patient-card p-6 text-center text-[#756581]">
            Loading your patient portal…
          </div>
        </PatientShell>
      }
    >
      <PatientHub mode={mode} />
    </Suspense>
  );
}

function PatientHub({ mode }: { mode: "guest" | "patient" }) {
  const router = useRouter();
  const { clinicId } = useParams<{
    clinicId: string;
  }>();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const storageKey = `chairflow-visit-${clinicId}`;

  const [info, setInfo] = useState<{
    name: string;
    accepting: boolean;
  } | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<Saved>({});
  const [tab, setTab] = useState<Tab>("queue");
  const [signedIn, setSignedIn] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);

  // Load the logged-in patient's account.
  const loadAccount =
    useCallback(async (): Promise<Account | null> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSignedIn(false);
        setAccount(null);
        return null;
      }

      setSignedIn(true);

      const { data } =
        await supabase.rpc("my_account");

      setAccount((data as Account) ?? null);

      return (data as Account) ?? null;
    }, [supabase]);

  // Remember a guest's active queue ticket
  // or appointment.
  function persist(next: Saved) {
    setSaved(next);

    try {
      if (next.entryId || next.appointmentId) {
        localStorage.setItem(
          storageKey,
          JSON.stringify(next)
        );
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // Storage may be unavailable.
    }
  }

  // Initial clinic, visit, and account loading.
  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const { data } = await supabase.rpc(
        "booking_info",
        {
          p_clinic_id: clinicId,
        }
      );

      if (cancelled) return;

      setInfo(data);

      let current: Saved = {};

      try {
        current = JSON.parse(
          localStorage.getItem(storageKey) ?? "{}"
        );
      } catch {
        current = {};
      }

      const params = new URLSearchParams(
        window.location.search
      );

      const appt = params.get("appt");

      if (appt && UUID.test(appt)) {
        current = {
          ...current,
          appointmentId: appt,
        };
      }

      // Remove finished or old queue tickets.
      if (current.entryId) {
        const { data: ticket } = await supabase.rpc(
          "queue_status",
          {
            p_entry_id: current.entryId,
          }
        );

        const fromEarlierDay =
          ticket?.created_at &&
          new Date(ticket.created_at).getTime() <
            new Date(startOfTodayManila()).getTime();

        if (
          !ticket ||
          TICKET_DONE.includes(ticket.status) ||
          fromEarlierDay
        ) {
          current = {
            ...current,
            entryId: undefined,
          };
        }
      }

      // Remove finished or expired appointments.
      if (current.appointmentId) {
        const { data: appointment } =
          await supabase.rpc(
            "appointment_status",
            {
              p_id: current.appointmentId,
            }
          );

        const longPast =
          appointment &&
          appointment.status !== "arrived" &&
          new Date(
            appointment.starts_at
          ).getTime() <
            Date.now() - 12 * 3600 * 1000;

        if (
          !appointment ||
          APPT_DONE.includes(appointment.status) ||
          longPast
        ) {
          current = {
            ...current,
            appointmentId: undefined,
          };
        }
      }

      if (cancelled) return;

      try {
        if (
          current.entryId ||
          current.appointmentId
        ) {
          localStorage.setItem(
            storageKey,
            JSON.stringify(current)
          );
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch {
        // Ignore storage errors.
      }

      setSaved(current);

      const currentAccount = await loadAccount();

      if (cancelled) return;

      // Keep the guest and patient routes separate without duplicating the UI.
      // The patient-only page never renders protected content before this check.
      const search = window.location.search;
      if (mode === "guest" && currentAccount?.is_patient) {
        router.replace(`/patient/${encodeURIComponent(clinicId)}${search}`);
        return;
      }
      if (mode === "patient" && !currentAccount?.is_patient) {
        router.replace(`/guest/${encodeURIComponent(clinicId)}${search}`);
        return;
      }

      // Signed-in patients start at Dashboard.

      const requestedTab = params.get("tab");

      if (currentAccount?.is_patient) {
        // Signed-in patients
        if (
          requestedTab === "profile" ||
          requestedTab === "history" ||
          requestedTab === "book"
        ) {
          setTab(requestedTab);
        } else {
          setTab("dashboard");
        }
      } else if (requestedTab === "account") {
        // Open the Sign in tab for guests
        setTab("account");
      } else if (
        current.entryId ||
        current.appointmentId
      ) {
        // Show an existing active visit
        setTab("visit");
      } else if (
        requestedTab === "book" &&
        data?.accepting
      ) {
        setTab("book");
      } else {
        // Default guest tab
        setTab("queue");
      }


      setLoaded(true);
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [
    supabase,
    clinicId,
    storageKey,
    loadAccount,
    mode,
    router,
  ]);

  // Called when someone signs in or signs out.
  async function afterAuthChange() {
    const currentAccount = await loadAccount();
    if (currentAccount?.is_patient) {
      router.replace(`/patient/${encodeURIComponent(clinicId)}`);
    } else {
      router.replace(`/guest/${encodeURIComponent(clinicId)}`);
    }
  }

  // Loading state.
  if (!loaded) {
    return (
      <PatientShell hideHeaderOnMobile>
        <div className="mx-auto mt-10 max-w-xl patient-card p-6 text-center text-[#756581]">
          Loading your patient portal…
        </div>
      </PatientShell>
    );
  }

  // Clinic not found.
  if (!info) {
    return (
      <PatientShell hideHeaderOnMobile>
        <div className="mx-auto mt-10 max-w-xl patient-card p-6 text-center">
          <h1 className="text-xl font-bold text-[#2E1747]">
            Clinic not found
          </h1>

          <p className="mt-2 text-sm text-[#756581]">
            Please check the link or ask the clinic
            for a new one.
          </p>
        </div>
      </PatientShell>
    );
  }

  const hasVisit = !!(
    saved.entryId ||
    saved.appointmentId
  );

  const isPatient = !!account?.is_patient;

  // SIGNED-IN PATIENT: Four tabs.
  // GUEST: Original navigation is preserved.
  const tabs: {
    id: Tab;
    label: string;
    icon: PatientIconName;
  }[] = isPatient
    ? [
        {
          id: "dashboard",
          label: "Dashboard",
          icon: "dashboard",
        },
        {
          id: "book",
          label: "Book",
          icon: "calendar",
        },
        {
          id: "history",
          label: "History",
          icon: "history",
        },
        {
          id: "profile",
          label: "Profile",
          icon: "signin",
        },
      ]
    : [
        {
          id: "queue",
          label: "Join queue",
          icon: "queue",
        },
        ...(info.accepting
          ? [
              {
                id: "book" as Tab,
                label: "Book",
                icon: "calendar" as PatientIconName,
              },
            ]
          : []),
        ...(hasVisit
          ? [
              {
                id: "visit" as Tab,
                label: "My visit",
                icon: "visit" as PatientIconName,
              },
            ]
          : []),
        {
          id: "account",
          label: "Sign in",
          icon: "signin",
        },
      ];

  return (

      <PatientShell
        clinicName={info.name}
        hideHeaderOnMobile={true}
      >

      {/* PATIENT NAVIGATION */}

      <nav
        aria-label="Patient portal navigation"
        className="patient-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-[#E4D5F6] bg-white/95 px-2 pt-2 shadow-[0_-12px_30px_rgba(73,43,104,0.10)] backdrop-blur md:static md:mt-6 md:rounded-2xl md:border md:p-2 md:shadow-sm"
      >
        <div
          className="mx-auto grid max-w-xl gap-1 md:max-w-none"
          style={{
            gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
          }}
        >
          {tabs.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setTab(item.id)}
              aria-current={
                tab === item.id
                  ? "page"
                  : undefined
              }
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[0.68rem] font-semibold transition sm:text-xs md:min-h-11 md:flex-row md:gap-2 md:px-3 md:text-sm ${
                tab === item.id
                  ? "bg-[#6D3AA8] text-white shadow-sm"
                  : "text-[#756581] hover:bg-[#F2EAFF] hover:text-[#6D3AA8]"
              }`}
            >
              <PatientIcon
                name={item.icon}
                className="h-5 w-5 shrink-0"
              />

              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* TAB CONTENT */}

      <div className="mt-4 w-full min-w-0 md:mt-6">

        {/* DASHBOARD */}

        {tab === "dashboard" && isPatient && (
          <PatientDashboard
            clinicId={clinicId}
            name={account?.name ?? null}
            clinicName={info.name}
          />
        )}

        {/* GUEST JOIN QUEUE */}

        {tab === "queue" && !isPatient && (
          <JoinForm
            clinicId={clinicId}
            onDone={(entryId) => {
              persist({
                ...saved,
                entryId,
              });

              setTab("visit");
            }}
          />
        )}

        {/* BOOK APPOINTMENT */}

        {tab === "book" &&
          (isPatient || info.accepting) && (
            <BookForm
              clinicId={clinicId}
              onDone={(appointmentId) => {
                if (!isPatient) {
                  persist({ ...saved, appointmentId });
                }
                const portal = isPatient ? "patient" : "guest";
                router.push(`/${portal}/${encodeURIComponent(clinicId)}/appointments/${encodeURIComponent(appointmentId)}`);
              }}
            />
          )}

        {/* GUEST ACTIVE VISIT */}

        {tab === "visit" &&
          !isPatient &&
          hasVisit && (
            <div className="flex flex-col gap-6">

              {saved.entryId && (
                <section>
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[#7B4BB3]">
                    Your place in line
                  </h2>

                  <GuestQueueTicket
                    entryId={saved.entryId}
                    onExit={() => {
                      persist({ ...saved, entryId: undefined });
                      setTab("queue");
                    }}
                  />
                </section>
              )}

              {saved.appointmentId && (
                <section className="rounded-2xl border border-[#E4D5F6] bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-[#2E1747]">
                    Your appointment
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#6F647A]">
                    View the appointment details, change the time, or cancel your booking.
                  </p>
                  <Link
                    href={`/guest/${encodeURIComponent(clinicId)}/appointments/${encodeURIComponent(saved.appointmentId)}`}
                    className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#6D3AA8] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3]"
                  >
                    View appointment details
                  </Link>
                </section>
              )}
            </div>
          )}

        {/* HISTORY - VISIT RECORDS ONLY */}

        {tab === "history" && isPatient && (
          <HistoryView />
        )}

        {/* PROFILE - ACCOUNT AND LINKED PEOPLE */}

        {tab === "profile" && isPatient && (
          <ProfileView
            clinicId={clinicId}
            name={account?.name ?? null}
            email={account?.email ?? null}
            onSignOut={async () => {
              await supabase.auth.signOut();
              setSignedIn(false);
              setAccount(null);
              router.replace(`/guest/${encodeURIComponent(clinicId)}`);
            }}
          />
        )}

        {/* GUEST ACCOUNT SIGN IN */}

        {tab === "account" && !isPatient && (
          <div className="flex flex-col gap-4">
            <AccountPanel
              clinicId={clinicId}
              signedIn={signedIn}
              account={account}
              onChange={afterAuthChange}
            />

            <Link
              href={`/c/${clinicId}/account/forgot-password`}
              className="text-center text-sm font-semibold text-[#6D3AA8] underline underline-offset-4"
            >
              Forgot your password?
            </Link>
          </div>
        )}

      </div>
    </PatientShell>
  );
}
