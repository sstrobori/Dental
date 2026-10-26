"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type IconName = "queue" | "calendar" | "patients" | "followups" | "reports" | "team";
const NAV: { href: string; label: string; icon: IconName; ownerOnly?: boolean }[] = [
  { href: "/dashboard", label: "Live queue", icon: "queue" }, { href: "/dashboard/appointments", label: "Appointments", icon: "calendar" },
  { href: "/dashboard/patients", label: "Patients", icon: "patients" }, { href: "/dashboard/followups", label: "Follow-ups", icon: "followups" },
  { href: "/dashboard/reports", label: "Reports", icon: "reports", ownerOnly: true }, { href: "/dashboard/team", label: "Team", icon: "team", ownerOnly: true },
];

function AdminIcon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const p = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "queue") return <svg {...p}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4" cy="6" r="1.4" /><circle cx="4" cy="12" r="1.4" /><circle cx="4" cy="18" r="1.4" /></svg>;
  if (name === "calendar") return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4m8-4v4M3 10h18" /></svg>;
  if (name === "patients") return <svg {...p}><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0m1-10a3 3 0 0 1 0 6m1 1a5 5 0 0 1 4 3" /></svg>;
  if (name === "followups") return <svg {...p}><path d="M20 11a8 8 0 1 1-3-6.2" /><path d="M20 4v7h-7" /><path d="M12 7v5l3 2" /></svg>;
  if (name === "reports") return <svg {...p}><path d="M4 20V10m6 10V4m6 16v-7m4 7H2" /></svg>;
  return <svg {...p}><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2 20a6 6 0 0 1 12 0m1-5a5 5 0 0 1 7 5" /></svg>;
}

const BrandMark = () => <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#6d3aa8] text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(109,58,168,0.25)]">CF</span>;

export default function AdminShell({ clinicName, role, email, children }: { clinicName: string | null; role: string | null; email: string; children: ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const supabase = createClient();
  const items = NAV.filter((item) => !item.ownerOnly || role === "owner");
  const active = (href: string) => href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  async function signOut() { await supabase.auth.signOut(); router.push("/login"); router.refresh(); }
  const navLinks = (mobile = false) => items.map((item) => <Link key={item.href} href={item.href} aria-current={active(item.href) ? "page" : undefined} className={`flex items-center gap-2 rounded-xl font-semibold transition ${mobile ? "min-h-10 px-3 py-2 text-xs" : "min-h-11 px-3 py-2.5 text-sm"} ${active(item.href) ? "bg-[#6d3aa8] text-white shadow-sm" : mobile ? "bg-[#faf8ff] text-[#675873]" : "text-[#675873] hover:bg-[#f2eaff] hover:text-[#5b2e8a]"}`}><AdminIcon name={item.icon} className={mobile ? "h-4 w-4" : "h-5 w-5"} />{item.label}</Link>);
  return <div className="admin-ui min-h-dvh bg-[#f8f7fc] text-[#2e1747]">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-[#e4d5f6] bg-white px-4 py-5 lg:flex">
      <div className="flex items-center gap-3 px-2"><BrandMark /><div><p className="text-lg font-extrabold">ChairFlow</p><p className="text-xs font-medium text-[#756581]">Clinic workspace</p></div></div>
      <div className="mt-7 rounded-2xl border border-[#e4d5f6] bg-[#faf8ff] p-4"><p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#8b5cb5]">Current clinic</p><p className="mt-1 truncate font-bold">{clinicName || "Clinic setup"}</p>{role && <span className="mt-2 inline-flex rounded-full bg-[#f2eaff] px-2.5 py-1 text-xs font-semibold capitalize text-[#6d3aa8]">{role}</span>}</div>
      {role && <nav aria-label="Admin navigation" className="mt-6 flex flex-col gap-1.5">{navLinks()}</nav>}
      <div className="mt-auto border-t border-[#eee5f7] pt-4"><p className="truncate px-2 text-xs text-[#756581]" title={email}>{email}</p><button type="button" onClick={signOut} className="mt-2 min-h-10 w-full rounded-xl px-3 text-left text-sm font-semibold text-[#6d3aa8] hover:bg-[#f2eaff]">Sign out</button></div>
    </aside>
    <div className="min-h-dvh lg:pl-72">
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-[#e4d5f6] bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6 lg:hidden"><div className="flex min-w-0 items-center gap-3"><BrandMark /><div className="min-w-0"><p className="truncate text-sm font-bold">{clinicName || "Clinic setup"}</p><p className="text-xs font-medium text-[#756581]">ChairFlow staff</p></div></div><button type="button" onClick={signOut} className="min-h-10 shrink-0 rounded-xl border border-[#e4d5f6] px-3 text-xs font-semibold text-[#6d3aa8]">Sign out</button></header>
      {role && <nav aria-label="Admin navigation" className="sticky top-16 z-20 overflow-x-auto border-b border-[#e4d5f6] bg-white px-3 py-2 lg:hidden"><div className="flex w-max gap-1.5">{navLinks(true)}</div></nav>}
      <main className="mx-auto w-full max-w-[1600px]">{children}</main>
    </div>
  </div>;
}
