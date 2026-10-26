import type { ReactNode } from "react";

export type PatientIconName = "dashboard" | "queue" | "calendar" | "visit" | "history" | "signin";

export function PatientIcon({ name, className = "h-5 w-5" }: { name: PatientIconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "dashboard") {
    return <svg {...common}><path d="M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z" /></svg>;
  }
  if (name === "queue") {
    return <svg {...common}><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></svg>;
  }
  if (name === "calendar") {
    return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4m8-4v4M3 10h18" /><path d="m9 15 2 2 4-4" /></svg>;
  }
  if (name === "visit") {
    return <svg {...common}><path d="M12 21s7-3.7 7-10V5l-7-2-7 2v6c0 6.3 7 10 7 10Z" /><path d="M9 12h6m-3-3v6" /></svg>;
  }
  if (name === "history") {
    return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5m4-1v5l3 2" /></svg>;
  }
  return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
}

function ToothMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-7 w-7 sm:h-8 sm:w-8" fill="none" aria-hidden="true">
      <path
        d="M14.2 7.8c3.1-1.5 6.5.4 9.8.4s6.7-1.9 9.8-.4c4.8 2.3 6.5 8.6 4.1 14.5-1.2 3-3.2 5.1-4.3 8.8-1.5 5.1-2.4 9.1-5.2 9.1-3.1 0-2.4-8.4-4.4-8.4s-1.3 8.4-4.4 8.4c-2.8 0-3.7-4-5.2-9.1-1.1-3.7-3.1-5.8-4.3-8.8-2.4-5.9-.7-12.2 4.1-14.5Z"
        fill="currentColor"
      />
      <path d="M18 13c2.3 1.3 4 1.8 6 1.8s3.7-.5 6-1.8" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity=".8" />
    </svg>
  );
}

export default function PatientShell({
  clinicName,
  children,
}: {
  clinicName?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="patient-ui relative min-h-dvh overflow-x-hidden bg-[#faf8ff] text-[#2e1747]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-[#eadcff] blur-3xl" />
        <div className="absolute -right-24 -top-16 h-64 w-64 rounded-full bg-[#f2eaff] blur-3xl" />
      </div>

      <div className="patient-page-bottom relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        <header className="flex items-center justify-between gap-3 rounded-2xl border border-[#e4d5f6] bg-white/90 px-4 py-3 shadow-[0_12px_35px_rgba(73,43,104,0.08)] backdrop-blur sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center text-[#6D3AA8] sm:h-12 sm:w-12">
              <ToothMark />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-[-0.01em] text-[#2e1747] sm:text-lg">
                Dental Queue & Appointment Management
              </p>
              <p className="text-xs font-medium text-[#756581] sm:text-sm">Easy appointments, less waiting</p>
            </div>
          </div>
          <span className="hidden rounded-full border border-[#e4d5f6] bg-[#f7f2ff] px-3 py-1.5 text-xs font-semibold text-[#6d3aa8] sm:inline-flex">
            Patient portal
          </span>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="mt-8 hidden border-t border-[#e9def6] py-5 text-center text-xs text-[#756581] md:block">
          Your clinic manages appointments and queue updates securely through this patient portal.
        </footer>
      </div>
    </div>
  );
}
