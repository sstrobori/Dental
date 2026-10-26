"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ClinicControls({
  clinicId,
  role,
  acceptingJoins,
}: {
  clinicId: string;
  role: string;
  acceptingJoins: boolean;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(acceptingJoins);
  const [error, setError] = useState("");

  async function toggle() {
    setError("");
    const next = !open;
    const { error } = await supabase.rpc("set_accepting_joins", { p_clinic_id: clinicId, p_value: next });
    if (error) return setError(error.message);
    setOpen(next);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 pt-4 md:px-8">
      <span className={`rounded px-2 py-1 text-xs ${open ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
        Online joining: {open ? "on" : "paused"}
      </span>
      <button onClick={toggle} className="rounded border px-3 py-1 text-sm">
        {open ? "Pause online joining" : "Resume online joining"}
      </button>
      {role === "owner" && (
        <Link href="/dashboard/team" className="rounded border px-3 py-1 text-sm">Team and activity</Link>
      )}
      {error && <span className="text-sm text-red-700">{error}</span>}
    </div>
  );
}