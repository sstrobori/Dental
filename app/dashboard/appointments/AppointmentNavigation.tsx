"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BackLink({ label = "Back", levels = 1 }: { label?: string; levels?: number }) {
  const pathname = usePathname();
  const pieces = pathname.split("/").filter(Boolean);
  const href = "/" + pieces.slice(0, Math.max(0, pieces.length - levels)).join("/");
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#6D3AA8] transition hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3]">
      <span aria-hidden="true">&larr;</span> {label}
    </Link>
  );
}

export function NavCard({ segment, title, description, icon }: {
  segment: string; title: string; description: string; icon: "calendar" | "calendar-plus" | "list-checks" | "wallet" | "clock";
}) {
  const pathname = usePathname().replace(/\/$/, "");
  return (
    <Link href={`${pathname}/${segment}`} className="group flex min-h-28 items-center gap-4 rounded-2xl border border-[#E4D5F6] bg-white p-5 shadow-sm transition hover:border-[#BEA0E2] hover:bg-[#FCFAFF] hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6]">
      <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#F2EAFF] text-[#6D3AA8]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {icon === "calendar" && <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15h3"/></>}
          {icon === "calendar-plus" && <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M12 13v5M9.5 15.5h5"/></>}
          {icon === "list-checks" && <><path d="m3 7 2 2 4-4"/><path d="m3 17 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></>}
          {icon === "wallet" && <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M15 14h3"/></>}
          {icon === "clock" && <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-bold text-[#2E1747]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[#6F647A]">{description}</p>
      </div>
      <span aria-hidden="true" className="text-2xl text-[#8B5CB5] transition group-hover:translate-x-1">&rsaquo;</span>
    </Link>
  );
}
