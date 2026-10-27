"use client";

import { BackLink } from "../../AppointmentNavigation";
import { useClinicSettings } from "../../useClinicSettings";
import VisitReasonSettings from "../../VisitReasonSettings";

export default function VisitReasonsPage() {
  const { clinicId, isOwner, loading, error } = useClinicSettings();

  return (
    <main className="w-full px-4 py-6 text-[#2E1747] sm:px-6 sm:py-8 lg:px-8">
      <BackLink label="Back to Clinic Settings" />
      <header className="mb-6 mt-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8B5CB5]">Clinic settings</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Visit reasons</h1>
        <p className="mt-2 text-sm text-[#6F647A]">
          Choose the reasons patients and staff can pick, where each one is offered, and what patients are told about it.
        </p>
      </header>
      {loading && <p role="status" className="rounded-2xl border border-[#E4D5F6] bg-white p-6 text-sm text-[#6F647A]">Loading settings...</p>}
      {!loading && error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {!loading && !error && clinicId && <VisitReasonSettings clinicId={clinicId} isOwner={isOwner} />}
    </main>
  );
}
