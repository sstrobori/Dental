import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";

export const instant = false;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: staff } = await supabase.from("clinic_staff").select("clinic_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  let clinicName: string | null = null;
  if (staff?.clinic_id) {
    const { data: clinic } = await supabase.from("clinics").select("name").eq("id", staff.clinic_id).maybeSingle();
    clinicName = clinic?.name ?? null;
  }
  return <AdminShell clinicName={clinicName} role={staff?.role ?? null} email={user.email ?? "Staff account"}>{children}</AdminShell>;
}
