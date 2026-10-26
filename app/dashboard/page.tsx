
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { startOfTodayManila } from "@/lib/today";
import QueueBoard from "./QueueBoard";
import JoinClinic from "./JoinClinic";

export default async function Dashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: staff } = await supabase
    .from("clinic_staff")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!staff) {
    return <JoinClinic email={user.email ?? ""} />;
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name, accepting_joins, grace_minutes")
    .eq("id", staff.clinic_id)
    .single();

  const { data: entries } = await supabase
    .from("queue_entries")
    .select("*")
    .eq("clinic_id", staff.clinic_id)
    .gte("created_at", startOfTodayManila())
    .order("queued_at");

  return (
    <QueueBoard
      clinicId={staff.clinic_id}
      clinicName={clinic?.name ?? "Clinic"}
      acceptingJoins={clinic?.accepting_joins ?? true}
      initialGraceMinutes={clinic?.grace_minutes ?? 15}
      initial={entries ?? []}
    />
  );
}
