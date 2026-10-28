"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PendingBookingsPanel from "./PendingBookingsPanel";

// Identifies the signed-in staff member's clinic for the Appointments landing page.
export default function PendingBookingsOverview() {
  const supabase = useMemo(() => createClient(), []);
  const [clinicId, setClinicId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadClinic() {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user || authError) {
        setError("Sign in as clinic staff to review pending bookings.");
        setLoading(false);
        return;
      }

      const { data: staff, error: staffError } = await supabase
        .from("clinic_staff")
        .select("clinic_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (staffError || !staff?.clinic_id) {
        setError("A clinic staff assignment is required to review pending bookings.");
      } else {
        setClinicId(staff.clinic_id);
      }
      setLoading(false);
    }

    void loadClinic();
    return () => { cancelled = true; };
  }, [supabase]);

  if (loading) {
    return <p className="mt-6 text-sm text-[#6F647A]">Loading pending bookings...</p>;
  }
  if (error) {
    return <p role="status" className="mt-6 text-sm text-[#6F647A]">{error}</p>;
  }

  return <PendingBookingsPanel clinicId={clinicId} />;
}
