"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type VisitReason = { name: string; note: string | null };

// Used only if the clinic's list cannot be loaded (for example before the database update is run).
const FALLBACK: VisitReason[] = ["Checkup", "Toothache", "Cleaning", "Braces", "Other"].map((name) => ({ name, note: null }));

// The clinic's own list of visit reasons.
//   "walk_in": reasons offered when joining the queue
//   "online": reasons offered when booking online
//   "staff":  every active reason (front desk forms)
export function useVisitReasons(clinicId: string, channel: "walk_in" | "online" | "staff") {
  const supabase = useMemo(() => createClient(), []);
  const [reasons, setReasons] = useState<VisitReason[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc("visit_reasons_for", { p_clinic_id: clinicId, p_channel: channel });
      if (!active) return;
      setReasons(!error && Array.isArray(data) ? (data as VisitReason[]) : FALLBACK);
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [supabase, clinicId, channel]);

  const names = useMemo(() => reasons.map((r) => r.name), [reasons]);
  return { reasons, names, loaded };
}