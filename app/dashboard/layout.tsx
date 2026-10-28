
import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";

export const instant = false;

// Authenticated dashboard content
async function DashboardContent({
  children,
}: {
  children: ReactNode;
}) {
  // Wait for an actual request before checking authentication.
  await connection();

  const supabase = await createClient();

const {
  data: { user },
  error: authError,
} = await supabase.auth.getUser();

console.log("[Dashboard authentication]", {
  authenticated: Boolean(user),
  error: authError?.message ?? null,
});

  if (!user) {
    redirect("/login");
  }

  const { data: staff } = await supabase
    .from("clinic_staff")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  let clinicName: string | null = null;

  if (staff?.clinic_id) {
    const { data: clinic } = await supabase
      .from("clinics")
      .select("name")
      .eq("id", staff.clinic_id)
      .maybeSingle();

    clinicName = clinic?.name ?? null;
  }

  return (
    <AdminShell
      clinicName={clinicName}
      role={staff?.role ?? null}
      email={user.email ?? "Staff account"}
    >
      {children}
    </AdminShell>
  );
}

// Dashboard layout with Suspense
export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8FF]">
          <p className="text-sm font-semibold text-[#6D3AA8]">
            Loading dashboard...
          </p>
        </div>
      }
    >
      <DashboardContent>{children}</DashboardContent>
    </Suspense>
  );
}
