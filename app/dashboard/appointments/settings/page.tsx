import { BackLink, NavCard } from "../AppointmentNavigation";

export default function ClinicSettingsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 text-[#2E1747] sm:px-6 sm:py-8 lg:px-8">
      <BackLink label="Back to Appointments" />
      <header className="mb-7 mt-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8B5CB5]">Administration</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Clinic settings</h1>
        <p className="mt-2 text-sm leading-6 text-[#6F647A]">Choose a setting to view or manage. Only the clinic owner can save changes.</p>
      </header>
      <nav aria-label="Clinic settings sections" className="grid gap-4 md:grid-cols-2">
        <NavCard segment="booking" title="Booking settings" description="Online booking, clinic hours, open days, appointment duration, and grace periods." icon="calendar" />
        <NavCard segment="deposits" title="Deposits and fees" description="Deposit amounts, payment instructions, and estimated visit fees." icon="wallet" />
        <NavCard segment="wait-time" title="Wait-time estimates" description="Set the default visit length used in patient queue forecasts." icon="clock" />
      </nav>
    </main>
  );
}
