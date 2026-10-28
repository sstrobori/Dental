
"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type IconName =
  | "queue"
  | "calendar"
  | "servedCalendar"
  | "patients"
  | "followups"
  | "reports"
  | "history"
  | "settings"
  | "team";

const NAV: {
  href: string;
  label: string;
  icon: IconName;
  ownerOnly?: boolean;
}[] = [
  {
    href: "/dashboard",
    label: "Live queue",
    icon: "queue",
  },
  {
    href: "/dashboard/appointments",
    label: "Appointments",
    icon: "calendar",
  },
  {
    href: "/dashboard/appointments/settings",
    label: "Clinic settings",
    icon: "settings",
  },
  {
    href: "/dashboard/calendar",
    label: "Calendar",
    icon: "servedCalendar",
  },
  {
    href: "/dashboard/patients",
    label: "Patients",
    icon: "patients",
  },
  {
    href: "/dashboard/history",
    label: "History",
    icon: "history",
  },
  {
    href: "/dashboard/followups",
    label: "Follow-ups",
    icon: "followups",
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: "reports",
    ownerOnly: true,
  },
  {
    href: "/dashboard/team",
    label: "Team",
    icon: "team",
    ownerOnly: true,
  },
];

function AdminIcon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  const p = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (name === "queue") {
    return (
      <svg {...p}>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <circle cx="4" cy="6" r="1.4" />
        <circle cx="4" cy="12" r="1.4" />
        <circle cx="4" cy="18" r="1.4" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg {...p}>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4m8-4v4M3 10h18" />
      </svg>
    );
  }

  if (name === "servedCalendar") {
    return (
      <svg {...p}>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4m8-4v4M3 10h18m-11 6 2 2 4-4" />
      </svg>
    );
  }

  if (name === "patients") {
    return (
      <svg {...p}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0m1-10a3 3 0 0 1 0 6m1 1a5 5 0 0 1 4 3" />
      </svg>
    );
  }

  if (name === "followups") {
    return (
      <svg {...p}>
        <path d="M20 11a8 8 0 1 1-3-6.2" />
        <path d="M20 4v7h-7" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  if (name === "history") {
    return (
      <svg {...p}>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg {...p}>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  if (name === "reports") {
    return (
      <svg {...p}>
        <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" />
      </svg>
    );
  }

  return (
    <svg {...p}>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2 20a6 6 0 0 1 12 0m1-5a5 5 0 0 1 7 5" />
    </svg>
  );
}

// Standalone purple tooth icon
const BrandMark = () => (
  <svg
    viewBox="0 0 48 48"
    className="h-11 w-11 shrink-0 text-[#6D3AA8]"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M14.2 7.8c3.1-1.5 6.5.4 9.8.4s6.7-1.9 9.8-.4c4.8 2.3 6.5 8.6 4.1 14.5-1.2 3-3.2 5.1-4.3 8.8-1.5 5.1-2.4 9.1-5.2 9.1-3.1 0-2.4-8.4-4.4-8.4s-1.3 8.4-4.4 8.4c-2.8 0-3.7-4-5.2-9.1-1.1-3.7-3.1-5.8-4.3-8.8-2.4-5.9-.7-12.2 4.1-14.5Z"
      fill="currentColor"
    />
    <path
      d="M18 13c2.3 1.3 4 1.8 6 1.8s3.7-.5 6-1.8"
      stroke="white"
      strokeWidth="2.2"
      strokeLinecap="round"
      opacity=".8"
    />
  </svg>
);

// Sidebar toggle icon
function SidebarIcon({
  collapsed,
}: {
  collapsed: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3"
      />

      <path d="M9 3v18" />

      {collapsed ? (
        <path d="m13 9 3 3-3 3" />
      ) : (
        <path d="m16 9-3 3 3 3" />
      )}
    </svg>
  );
}

export default function AdminShell({
  clinicName,
  role,
  email,
  children,
}: {
  clinicName: string | null;
  role: string | null;
  email: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  // Sidebar is visible by default on desktop.
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const items = NAV.filter(
    (item) => !item.ownerOnly || role === "owner"
  );

  const active = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    if (href === "/dashboard/appointments") {
      return pathname.startsWith(href) &&
        !pathname.startsWith("/dashboard/appointments/settings");
    }
    return pathname.startsWith(href);
  };

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const navLinks = (mobile = false) =>
    items.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        aria-current={
          active(item.href) ? "page" : undefined
        }
        className={`
          flex items-center gap-2
          rounded-xl font-semibold transition
          ${
            mobile
              ? "min-h-10 px-3 py-2 text-xs"
              : "min-h-11 px-3 py-2.5 text-sm"
          }
          ${
            active(item.href)
              ? "bg-gradient-to-r from-[#F3E8FF] via-[#E9D5FF] to-[#DDD0FA] text-[#5B2E8A] shadow-sm"
              : mobile
                ? "bg-[#faf8ff] text-[#675873]"
                : "text-[#675873] hover:bg-[#f2eaff] hover:text-[#5b2e8a]"
          }
        `}
      >
        <AdminIcon
          name={item.icon}
          className={
            mobile ? "h-4 w-4" : "h-5 w-5"
          }
        />

        {item.label}
      </Link>
    ));

  return (
    <div className="admin-ui min-h-dvh bg-[#f8f7fc] text-[#2e1747]">

      {/* DESKTOP SIDEBAR */}

      {sidebarOpen && (
        <aside
          id="admin-sidebar"
          className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-[#e4d5f6] bg-white px-4 py-5 lg:flex"
        >

{/* Branding with icon-only sidebar toggle */}

<div className="flex items-start justify-between gap-2">
  <div className="flex min-w-0 flex-1 items-start gap-2">
    <BrandMark />

    <div className="min-w-0 flex-1">
      <p className="text-sm font-extrabold leading-snug text-[#2e1747]">
        Dental Queue and Appointment Management
      </p>

      <p className="mt-1 text-xs font-medium text-[#756581]">
        Dental Clinic workspace
      </p>
    </div>
  </div>

  <button
    type="button"
    onClick={() => setSidebarOpen(false)}
    aria-label="Hide sidebar"
    title="Hide sidebar"
    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#6D3AA8] transition hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6]"
  >
    <SidebarIcon collapsed={false} />
  </button>
</div>


          {/* Navigation */}

          {role && (
            <nav
              aria-label="Admin navigation"
              className="mt-6 flex flex-col gap-1.5"
            >
              {navLinks()}
            </nav>
          )}

          {/* Account and Sign Out */}

          <div className="mt-auto border-t border-[#eee5f7] pt-4">

            <p
              className="truncate px-2 text-xs text-[#756581]"
              title={email}
            >
              {email}
            </p>

            <button
              type="button"
              onClick={signOut}
              className="mt-2 min-h-10 w-full rounded-xl px-3 text-left text-sm font-semibold text-[#6d3aa8] transition hover:bg-[#f2eaff]"
            >
              Sign out
            </button>
          </div>
        </aside>
      )}

      {/* MAIN DASHBOARD */}

      <div
        className={`
          min-h-dvh min-w-0
          transition-[padding] duration-300 ease-in-out
          ${sidebarOpen ? "lg:pl-72" : "lg:pl-0"}
        `}
      >



    {/* DESKTOP SHOW SIDEBAR BUTTON */}

    {!sidebarOpen && (
      <div className="hidden min-h-16 items-center gap-3 border-b border-[#E4D5F6] bg-white px-5 py-3 lg:flex">

        {/* Show sidebar icon - LEFT of tooth icon */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Show sidebar"
          aria-controls="admin-sidebar"
          aria-expanded={false}
          title="Show sidebar"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#6D3AA8] transition hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6]"
        >
          <SidebarIcon collapsed={true} />
        </button>

        {/* Tooth icon */}
        <BrandMark />

        {/* System name and tagline */}
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-[#2E1747]">
            Dental Queue and Appointment Management
          </p>

          <p className="text-xs font-medium text-[#756581]">
            Dental Clinic workspace
          </p>
        </div>

      </div>
    )}



        {/* MOBILE HEADER */}

        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-[#e4d5f6] bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6 lg:hidden">

          <div className="flex min-w-0 items-center gap-3">

            <BrandMark />

<div className="min-w-0">
  <p className="text-sm font-bold leading-tight text-[#2E1747]">
    Dental Queue and Appointment Management
  </p>

  <p className="mt-1 text-xs font-medium text-[#756581]">
    Clinic workspace
  </p>
</div>
          </div>

          <button
            type="button"
            onClick={signOut}
            className="min-h-10 shrink-0 rounded-xl border border-[#e4d5f6] px-3 text-xs font-semibold text-[#6d3aa8]"
          >
            Sign out
          </button>
        </header>

        {/* MOBILE NAVIGATION */}

        {role && (
          <nav
            aria-label="Admin navigation"
            className="sticky top-16 z-20 overflow-x-auto border-b border-[#e4d5f6] bg-white px-3 py-2 lg:hidden"
          >
            <div className="flex w-max gap-1.5">
              {navLinks(true)}
            </div>
          </nav>
        )}

        {/* PAGE CONTENT */}

        <main className="mx-auto w-full max-w-[1600px]">
          {children}
        </main>

      </div>
    </div>
  );
}
