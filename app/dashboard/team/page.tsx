"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = { user_id: string; email: string; role: string };
type Invite = { code: string; role: string; expires_at: string };

export default function TeamPage() {
  const supabase = createClient();
  const [clinicId, setClinicId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [role, setRole] = useState("front_desk");
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: staff } = await supabase
      .from("clinic_staff").select("clinic_id, role").eq("user_id", user.id).limit(1).maybeSingle();
    if (!staff) { setError("Your account is not linked to a clinic."); setLoaded(true); return; }
    setClinicId(staff.clinic_id);
    if (staff.role !== "owner") { setDenied(true); setLoaded(true); return; }

    const args = { p_clinic_id: staff.clinic_id };
    const [m, i] = await Promise.all([
      supabase.rpc("list_team", args),
      supabase.rpc("open_invites", args),
    ]);
    if (m.error) setError(m.error.message);
    setMembers((m.data ?? []) as Member[]);
    setInvites((i.data ?? []) as Invite[]);
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function createInvite() {
    setError("");
    const { error } = await supabase.rpc("create_invite", { p_clinic_id: clinicId, p_role: role });
    if (error) return setError(error.message);
    load();
  }

  async function removeMember(userId: string) {
    if (!window.confirm("Remove this person from the clinic?")) return;
    const { error } = await supabase.rpc("remove_staff", { p_clinic_id: clinicId, p_user_id: userId });
    if (error) return setError(error.message);
    load();
  }

  if (!loaded) return <div className="p-6 text-[#756581]">Loading...</div>;

  if (denied) {
    return (
      <div className="w-full p-4 md:p-6">
        <div className="admin-card p-6">
          <p className="font-semibold text-[#2E1747]">Only the clinic owner can see this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold text-[#2E1747]">Team</h1>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}

      <section className="admin-card p-5">
        <h2 className="mb-3 text-lg font-bold text-[#2E1747]">Staff</h2>
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-[#E4D5F6] p-3 text-sm">
              <span className="min-w-0 break-words">
                {m.email} <span className="text-[#756581]">({m.role.replace("_", " ")})</span>
              </span>
              {m.role !== "owner" && (
                <button onClick={() => removeMember(m.user_id)}
                  className="shrink-0 rounded-lg border border-[#D7C4EA] px-3 py-1.5 text-xs font-semibold text-[#5C327F] hover:bg-[#F2EAFF]">
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-card p-5">
        <h2 className="mb-3 text-lg font-bold text-[#2E1747]">Invite staff</h2>
        <div className="flex flex-wrap gap-2">
          <select className="rounded-xl border p-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="front_desk">Front desk</option>
            <option value="dentist">Dentist</option>
          </select>
          <button onClick={createInvite} className="rounded-xl bg-[#6D3AA8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#572C87]">
            Create invite code
          </button>
        </div>
        <p className="mt-2 text-xs text-[#756581]">
          Send the code to your staff. They sign up, then enter the code on the dashboard. Codes work once and expire in 7 days.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {invites.map((i) => (
            <li key={i.code} className="flex flex-wrap justify-between gap-2 rounded-xl bg-[#F2EAFF] p-3 text-sm">
              <span className="font-mono font-bold text-[#2E1747]">{i.code}</span>
              <span className="text-[#756581]">
                {i.role.replace("_", " ")}, expires {new Date(i.expires_at).toLocaleDateString("en-PH")}
              </span>
            </li>
          ))}
        </ul>
      </section>

    </div>
  );
}
