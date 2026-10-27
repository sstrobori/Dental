"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Tab = "clinics" | "requests";

const tabs: { id: Tab; label: string }[] = [
  { id: "clinics", label: "Partner clinics" },
  { id: "requests", label: "Clinic onboarding" },
];

// Match the standalone tooth logo used by the Dental Clinic workspace.
function BrandMark() {
  return (
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
}

// Match the collapse/expand control used by the Dental Clinic workspace.
function SidebarIcon({ collapsed }: { collapsed: boolean }) {
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
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M9 3v18" />
      {collapsed ? (
        <path d="m13 9 3 3-3 3" />
      ) : (
        <path d="m16 9-3 3 3 3" />
      )}
    </svg>
  );
}

function TabIcon({ tab, className = "h-5 w-5" }: { tab: Tab; className?: string }) {
  const iconProps = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (tab === "clinics") {
    return (
      <svg {...iconProps}>
        <path d="M3 21h18M5 21V6l7-3 7 3v15M9 9h6M9 13h6M9 17h6" />
      </svg>
    );
  }

  return (
    <svg {...iconProps}>
      <path d="M8 3h8a2 2 0 0 1 2 2v16H6V5a2 2 0 0 1 2-2ZM9 9h6M9 13h6M9 17h4" />
    </svg>
  );
}

export default function SuperAdminShell({
  email,
  activeTab,
  onTabChange,
  children,
}: {
  email: string;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError("");
    const { error } = await createClient().auth.signOut();
    if (error) {
      setSigningOut(false);
      setSignOutError(error.message);
      return;
    }
    router.replace("/super-admin/login");
    router.refresh();
  }

  const navLinks = (mobile = false) =>
    tabs.map((item) => (
      <button
        key={item.id}
        type="button"
        aria-current={activeTab === item.id ? "page" : undefined}
        onClick={() => onTabChange(item.id)}
        className={`flex shrink-0 items-center gap-2 rounded-xl font-semibold transition ${
          mobile ? "min-h-10 px-3 py-2 text-xs" : "min-h-11 w-full px-3 py-2.5 text-left text-sm"
        } ${
          activeTab === item.id
            ? "bg-gradient-to-r from-[#F3E8FF] via-[#E9D5FF] to-[#DDD0FA] text-[#5B2E8A] shadow-sm"
            : mobile
              ? "bg-[#FAF8FF] text-[#675873]"
              : "text-[#675873] hover:bg-[#F2EAFF] hover:text-[#5B2E8A]"
        }`}
      >
        <TabIcon tab={item.id} className={mobile ? "h-4 w-4" : "h-5 w-5"} />
        {item.label}
      </button>
    ));

  return (
    <div className="admin-ui min-h-dvh bg-[#F8F7FC] text-[#2E1747]">
      {/* Desktop sidebar, matching the clinic admin sidebar. */}
      {sidebarOpen && (
        <aside
          id="super-admin-sidebar"
          className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-[#E4D5F6] bg-white px-4 py-5 lg:flex"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <BrandMark />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold leading-snug text-[#2E1747]">
                  Dental Queue and Appointment Management
                </p>
                <p className="mt-1 text-xs font-medium text-[#756581]">
                  Super Admin workspace
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Hide sidebar"
              aria-controls="super-admin-sidebar"
              aria-expanded={true}
              title="Hide sidebar"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#6D3AA8] transition hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6]"
            >
              <SidebarIcon collapsed={false} />
            </button>
          </div>

          <nav aria-label="Super Admin navigation" className="mt-6 flex flex-col gap-1.5">
            {navLinks()}
          </nav>

          <div className="mt-auto border-t border-[#EEE5F7] pt-4">
            <p className="truncate px-2 text-xs text-[#756581]" title={email}>
              {email}
            </p>
            {signOutError && <p role="alert" className="mt-2 px-2 text-xs text-red-700">{signOutError}</p>}
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void signOut()}
              className="mt-2 min-h-10 w-full rounded-xl px-3 text-left text-sm font-semibold text-[#6D3AA8] transition hover:bg-[#F2EAFF] disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </aside>
      )}

      {/* Shift content when the desktop sidebar is visible. */}
      <div
        className={`min-h-dvh min-w-0 transition-[padding] duration-300 ease-in-out ${
          sidebarOpen ? "lg:pl-72" : "lg:pl-0"
        }`}
      >
        {/* When collapsed, show the same top bar as the clinic workspace. */}
        {!sidebarOpen && (
          <div className="hidden min-h-16 items-center gap-3 border-b border-[#E4D5F6] bg-white px-5 py-3 lg:flex">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Show sidebar"
              aria-controls="super-admin-sidebar"
              aria-expanded={false}
              title="Show sidebar"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#6D3AA8] transition hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6]"
            >
              <SidebarIcon collapsed={true} />
            </button>
            <BrandMark />
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-[#2E1747]">
                Dental Queue and Appointment Management
              </p>
              <p className="text-xs font-medium text-[#756581]">
                Super Admin workspace
              </p>
            </div>
          </div>
        )}

        {/* Mobile header with the same tooth branding and dimensions. */}
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-[#E4D5F6] bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6 lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#2E1747]">
                Dental Queue and Appointment Management
              </p>
              <p className="text-xs font-medium text-[#756581]">
                Super Admin workspace
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={signingOut}
            onClick={() => void signOut()}
            className="min-h-10 shrink-0 rounded-xl border border-[#E4D5F6] px-3 text-xs font-semibold text-[#6D3AA8] disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </header>

        {/* Horizontal mobile tabs, matching the clinic admin navigation. */}
        <nav
          aria-label="Mobile Super Admin navigation"
          className="sticky top-16 z-20 overflow-x-auto border-b border-[#E4D5F6] bg-white px-3 py-2 lg:hidden"
        >
          <div className="flex w-max gap-1.5">{navLinks(true)}</div>
        </nav>
        {signOutError && (
          <p role="alert" className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 lg:hidden">
            {signOutError}
          </p>
        )}

        <main className="mx-auto w-full max-w-[1600px]">{children}</main>
      </div>
    </div>
  );
}
