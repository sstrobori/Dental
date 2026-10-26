import { Suspense } from "react";
import AppointmentView from "@/components/patient/AppointmentView";
import PatientShell from "@/components/patient/PatientShell";

// Direct link to one appointment. Patients normally use /c/<clinic id> instead.
export default function AppointmentPage({ params }: PageProps<"/a/[appointmentId]">) {
  return (
    <PatientShell>
      <main className="mx-auto mt-5 w-full max-w-2xl patient-card p-4 sm:mt-8 sm:p-6 md:p-8">
        <Suspense fallback={<div className="py-8 text-center text-sm text-[#756581]">Loading your appointment…</div>}>
          <AppointmentContent params={params} />
        </Suspense>
      </main>
    </PatientShell>
  );
}

async function AppointmentContent({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  return <AppointmentView appointmentId={appointmentId} />;
}
