import { Suspense } from "react";
import TicketView from "@/components/patient/TicketView";
import PatientShell from "@/components/patient/PatientShell";

// Direct link to one ticket. Patients normally use /c/<clinic id> instead.
export default function TicketPage({ params }: PageProps<"/q/[entryId]">) {
  return (
    <PatientShell>
      <main className="mx-auto mt-5 w-full max-w-2xl sm:mt-8">
        <Suspense fallback={<div className="patient-card p-6 text-center text-sm text-[#756581]">Loading your ticket…</div>}>
          <TicketContent params={params} />
        </Suspense>
      </main>
    </PatientShell>
  );
}

async function TicketContent({ params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  return <TicketView entryId={entryId} />;
}
