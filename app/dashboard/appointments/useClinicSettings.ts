"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Settings } from "./BookingSettings";

export function useClinicSettings() {
  const supabase = useMemo(() => createClient(), []);
  const [clinicId, setClinicId] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("Please sign in to access clinic settings.");
        const { data: staff, error: staffError } = await supabase.from("clinic_staff")
          .select("clinic_id, role").eq("user_id", user.id).limit(1).maybeSingle();
        if (staffError) throw staffError;
        if (!staff) throw new Error("No clinic was found for this staff account.");
        const { data: clinic, error: clinicError } = await supabase.from("clinics")
          .select("accepting_bookings, open_time, close_time, slot_minutes, chairs, open_days, grace_minutes, min_notice_hours")
          .eq("id", staff.clinic_id).single();
        if (clinicError) throw clinicError;
        if (!current) return;
        setClinicId(staff.clinic_id);
        setIsOwner(staff.role === "owner");
        setSettings(clinic as Settings);
      } catch (e) {
        if (current) setError(e instanceof Error ? e.message : "Could not load clinic settings.");
      } finally {
        if (current) setLoading(false);
      }
    })();
    return () => { current = false; };
  }, [supabase]);

  return { clinicId, isOwner, settings, loading, error };
}
