"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { startOfTodayManila } from "@/lib/today";
import JoinForm from "@/components/patient/JoinForm";
import BookForm from "@/components/patient/BookForm";
import TicketView from "@/components/patient/TicketView";
import AppointmentView from "@/components/patient/AppointmentView";
import AccountPanel, { type Account } from "@/components/patient/AccountPanel";
import HistoryView from "@/components/patient/HistoryView";
import PatientDashboard from "@/components/patient/PatientDashboard";
import PatientShell, { PatientIcon, type PatientIconName } from "@/components/patient/PatientShell";

type Tab = "dashboard" | "queue" | "book" | "visit" | "account";
type Saved = { entryId?: string; appointmentId?: string };

const UUID = /^[0-9a-f-]{36}$/i;
const TICKET_DONE = ["served", "cancelled", "no_show"];
const APPT_DONE = ["cancelled", "completed", "no_show"];

export default function PatientHubPage() {
  return (
    <Suspense fallback={
      <PatientShell>
        <div className="mx-auto mt-10 max-w-xl patient-card p-6 text-center text-[#756581]">Loading your patient portal…</div>
      </PatientShell>
    }>
      <PatientHub />
    </Suspense>
  );
}

// The one page patients use. Guests can join or book. Patients with an account (created by the
// clinic) also get a dashboard with their live place in line, and their history.
function PatientHub() {
  const { clinicId } = useParams<{ clinicId: string }>();
  const supabase = createClient();
  const storageKey = `chairflow-visit-${clinicId}`;
  const [info, setInfo] = useState<{ name: string; accepting: boolean } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<Saved>({});
  const [tab, setTab] = useState<Tab>("queue");
  const [signedIn, setSignedIn] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);

  const loadAccount = useCallback(async (): Promise<Account | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSignedIn(false);
      setAccount(null);
      return null;
    }
    setSignedIn(true);
    const { data } = await supabase.rpc("my_account");
    setAccount(data as Account);
    return data as Account;
  }, [supabase]);

  function persist(next: Saved) {
    setSaved(next);
    try {
      if (next.entryId || next.appointmentId) localStorage.setItem(storageKey, JSON.stringify(next));
      else localStorage.removeItem(storageKey);
    } catch {
      // storage unavailable: the visit simply is not remembered
    }
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("booking_info", { p_clinic_id: clinicId });
      setInfo(data);

      let s: Saved = {};
      try {
        s = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      } catch {
        s = {};
      }

      const params = new URLSearchParams(window.location.search);
      const appt = params.get("appt");
      if (appt && UUID.test(appt)) s = { ...s, appointmentId: appt };

      // Finished visits clear themselves, so "My visit" only shows what is still going on.
      if (s.entryId) {
        const { data: t } = await supabase.rpc("queue_status", { p_entry_id: s.entryId });
        const fromEarlierDay = t?.created_at && new Date(t.created_at).getTime() < new Date(startOfTodayManila()).getTime();
        if (!t || TICKET_DONE.includes(t.status) || fromEarlierDay) s = { ...s, entryId: undefined };
      }
      if (s.appointmentId) {
        const { data: a } = await supabase.rpc("appointment_status", { p_id: s.appointmentId });
        const longPast = a && a.status !== "arrived" && new Date(a.starts_at).getTime() < Date.now() - 12 * 3600 * 1000;
        if (!a || APPT_DONE.includes(a.status) || longPast) s = { ...s, appointmentId: undefined };
      }

      try {
        if (s.entryId || s.appointmentId) localStorage.setItem(storageKey, JSON.stringify(s));
        else localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
      setSaved(s);
      const acct = await loadAccount();

      if (acct?.is_patient) setTab("dashboard");
      else if (s.entryId || s.appointmentId) setTab("visit");
      else if (params.get("tab") === "book" && data?.accepting) setTab("book");
      setLoaded(true);
    })();
  }, [supabase, clinicId, storageKey, loadAccount]);

  async function afterAuthChange() {
    const acct = await loadAccount();
    setTab(acct?.is_patient ? "dashboard" : "queue");
  }

  if (!loaded) return (
    <PatientShell>
      <div className="mx-auto mt-10 max-w-xl patient-card p-6 text-center text-[#756581]">Loading your patient portal…</div>
    </PatientShell>
  );
  if (!info) return (
    <PatientShell>
      <div className="mx-auto mt-10 max-w-xl patient-card p-6 text-center">
        <h1 className="text-xl font-bold text-[#2e1747]">Clinic not found</h1>
        <p className="mt-2 text-sm text-[#756581]">Please check the link or ask the clinic for a new one.</p>
      </div>
    </PatientShell>
  );

  const hasVisit = !!(saved.entryId || saved.appointmentId);
  const isPatient = !!account?.is_patient;
  // New patients use the simple guest flow. Returning patients keep their live queue
  // number and appointments together on Dashboard, so Queue and My visit are not repeated.
  const tabs: { id: Tab; label: string; icon: PatientIconName }[] = isPatient
    ? [
        { id: "dashboard", label: "Dashboard", icon: "dashboard" },
        ...(info.accepting ? [{ id: "book" as Tab, label: "Book", icon: "calendar" as PatientIconName }] : []),
        { id: "account", label: "History", icon: "history" },
      ]
    : [
        { id: "queue", label: "Join queue", icon: "queue" },
        ...(info.accepting ? [{ id: "book" as Tab, label: "Book", icon: "calendar" as PatientIconName }] : []),
        ...(hasVisit ? [{ id: "visit" as Tab, label: "My visit", icon: "visit" as PatientIconName }] : []),
        { id: "account", label: "Sign in", icon: "signin" },
      ];

  return (
    <PatientShell clinicName={info.name}>
      <nav
        aria-label="Patient portal navigation"
        className="patient-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-[#e4d5f6] bg-white/95 px-2 pt-2 shadow-[0_-12px_30px_rgba(73,43,104,0.10)] backdrop-blur md:static md:mt-6 md:rounded-2xl md:border md:p-2 md:shadow-sm"
      >
        <div
          className="mx-auto grid max-w-xl gap-1 md:max-w-none"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
        {tabs.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[0.68rem] font-semibold transition sm:text-xs md:min-h-11 md:flex-row md:gap-2 md:px-3 md:text-sm ${tab === t.id
              ? "bg-[#6d3aa8] text-white shadow-sm"
              : "text-[#756581] hover:bg-[#f2eaff] hover:text-[#6d3aa8]"
            }`}
          >
            <PatientIcon name={t.icon} className="h-5 w-5 shrink-0" />
            {t.label}
          </button>
        ))}
        </div>
      </nav>

      <div className={`mt-4 md:mt-6 ${tab === "dashboard" ? "" : "mx-auto max-w-3xl patient-card p-4 sm:p-6 md:p-8"}`}>
        {tab === "dashboard" && isPatient && <PatientDashboard clinicId={clinicId} name={account?.name ?? null} />}

        {tab === "queue" && !isPatient && (
          <JoinForm
            clinicId={clinicId}
            onDone={(entryId) => {
              persist({ ...saved, entryId });
              setTab("visit");
            }}
          />
        )}

        {tab === "book" && info.accepting && (
          <BookForm
            clinicId={clinicId}
            onDone={(appointmentId) => {
              if (isPatient) {
                setTab("dashboard");
              } else {
                persist({ ...saved, appointmentId });
                setTab("visit");
              }
            }}
          />
        )}

        {tab === "visit" && !isPatient && hasVisit && (
          <div className="flex flex-col gap-6">
            {saved.entryId && (
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[#7b4bb3]">Your place in line</h2>
                <TicketView entryId={saved.entryId} />
              </section>
            )}
            {saved.appointmentId && (
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[#7b4bb3]">Your appointment</h2>
                <AppointmentView
                  appointmentId={saved.appointmentId}
                  onOpenTicket={(entryId) => persist({ ...saved, entryId })}
                />
              </section>
            )}
            <button
              type="button"
              onClick={() => {
                persist({});
                setTab(isPatient ? "dashboard" : "queue");
              }}
              className="min-h-11 self-start rounded-xl border border-[#d7c4ea] bg-white px-4 py-2.5 text-sm font-semibold text-[#5c327f] transition hover:bg-[#f2eaff]"
            >
              Start a new visit
            </button>
          </div>
        )}

        {tab === "account" && (
          isPatient ? (
            <HistoryView
              name={account?.name ?? null}
              email={account?.email ?? null}
              onSignOut={async () => {
                await supabase.auth.signOut();
                await afterAuthChange();
              }}
            />
          ) : (
            <AccountPanel clinicId={clinicId} signedIn={signedIn} account={account} onChange={afterAuthChange} />
          )
        )}
      </div>
    </PatientShell>
  );
}
