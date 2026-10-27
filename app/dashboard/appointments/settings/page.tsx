import { NavCard } from "../AppointmentNavigation";

export default function ClinicSettingsPage() {
  return (
    <main className="w-full px-4 py-6 text-[#2E1747] sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-7 mt-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8B5CB5]">Administration</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Clinic settings</h1>
      </header>
      <nav aria-label="Clinic settings sections" className="grid gap-4 md:grid-cols-2">
        <NavCard segment="booking" title="Booking settings" description="Customize online booking, clinic hours, open days, appointment duration, and grace periods." icon="calendar" />
        <NavCard segment="deposits" title="Deposits and fees" description="Customize deposit amounts, payment instructions, and estimated visit fees." icon="wallet" />
        <NavCard segment="wait-time" title="Wait-time estimates" description="Customize the default visit length used in patient queue forecasts." icon="clock" />
        <NavCard segment="visit-reasons" title="Visit reasons" description="Customize the reasons patients can choose, where each is offered, and the notes they see." icon="list-checks" />
      </nav>
      <p className="mt-6 rounded-xl border border-[#E4D5F6] bg-[#FCFAFF] px-4 py-3 text-sm leading-6 text-[#6F647A]">
        Clinic administrators can modify and customize these settings to match clinic standards, policies, and day-to-day workflows.
      </p>
    </main>
  );
}
