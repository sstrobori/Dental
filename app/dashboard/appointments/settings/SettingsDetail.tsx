"use client";

import { BackLink } from "../AppointmentNavigation";
import { useClinicSettings } from "../useClinicSettings";
import BookingSettings from "../BookingSettings";
import DepositSettings from "../DepositSettings";
import ServiceTimeSetting from "../ServiceTimeSetting";

export default function SettingsDetail({ section }: { section: "booking" | "deposits" | "wait-time" }) {
  const { clinicId, isOwner, settings, loading, error } = useClinicSettings();
  const headings = {
    booking: { title: "Booking settings", description: "Manage clinic availability and appointment policies." },
    deposits: { title: "Deposits and fees", description: "Manage payment instructions and reporting estimates." },
    "wait-time": { title: "Wait-time estimates", description: "Configure the initial queue duration estimate." },
  };
  const heading = headings[section];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 text-[#2E1747] sm:px-6 sm:py-8 lg:px-8">
      <BackLink label="Back to Clinic Settings" />
      <header className="mb-6 mt-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8B5CB5]">Clinic settings</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{heading.title}</h1>
        <p className="mt-2 text-sm text-[#6F647A]">{heading.description}</p>
      </header>
      {loading && <p role="status" className="rounded-2xl border border-[#E4D5F6] bg-white p-6 text-sm text-[#6F647A]">Loading settings...</p>}
      {!loading && error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {!loading && !error && clinicId && (
        <>
          {section === "booking" && settings && <BookingSettings clinicId={clinicId} isOwner={isOwner} initial={settings} />}
          {section === "deposits" && <DepositSettings clinicId={clinicId} isOwner={isOwner} />}
          {section === "wait-time" && <ServiceTimeSetting clinicId={clinicId} isOwner={isOwner} />}
        </>
      )}
    </main>
  );
}
