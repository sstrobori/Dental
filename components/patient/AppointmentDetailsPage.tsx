"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PatientShell from "@/components/patient/PatientShell";
import AppointmentView from "@/components/patient/AppointmentView";

type PortalMode = "guest" | "patient";

export default function AppointmentDetailsPage({ mode }: { mode: PortalMode }) {
  return (
    <Suspense
      fallback={
        <PatientShell hideHeaderOnMobile>
          <p className="mx-auto max-w-3xl p-6 text-sm text-[#756581]">Loading appointment...</p>
        </PatientShell>
      }
    >
      <AppointmentDetailsContent mode={mode} />
    </Suspense>
  );
}

function AppointmentDetailsContent({ mode }: { mode: PortalMode }) {
  const router = useRouter();
  const { clinicId, appointmentId } = useParams<{
    clinicId: string;
    appointmentId: string;
  }>();
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [clinicName, setClinicName] = useState<string | null>(null);

  const backHref = mode === "patient"
    ? `/patient/${encodeURIComponent(clinicId)}`
    : `/guest/${encodeURIComponent(clinicId)}?tab=visit`;

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      // The patient portal must not display patient-only content to guests.
      const { data: { user } } = await supabase.auth.getUser();
      let isPatient = false;
      if (user) {
        const { data: account } = await supabase.rpc("my_account");
        isPatient = !!account?.is_patient;
      }
      if (cancelled) return;

      if (mode === "patient" && !isPatient) {
        router.replace(`/guest/${encodeURIComponent(clinicId)}/appointments/${encodeURIComponent(appointmentId)}`);
        return;
      }
      if (mode === "guest" && isPatient) {
        router.replace(`/patient/${encodeURIComponent(clinicId)}/appointments/${encodeURIComponent(appointmentId)}`);
        return;
      }

      const { data } = await supabase.rpc("booking_info", { p_clinic_id: clinicId });
      if (cancelled) return;
      setClinicName(data?.name ?? null);
      setReady(true);
    }

    void initialize();
    return () => { cancelled = true; };
  }, [appointmentId, clinicId, mode, router, supabase]);

  return (
    <PatientShell clinicName={clinicName} hideHeaderOnMobile>
      <main className="mx-auto mt-4 w-full max-w-3xl pb-8 md:mt-8">
        <Link
          href={backHref}
          className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-[#6D3AA8] hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6]"
        >
          <span aria-hidden="true">←</span> Back to {mode === "patient" ? "dashboard" : "my visit"}
        </Link>
        <section className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">
          {ready ? (
            <AppointmentView appointmentId={appointmentId} />
          ) : (
            <p className="py-8 text-center text-sm text-[#756581]">Loading appointment details...</p>
          )}
        </section>
      </main>
    </PatientShell>
  );
}
