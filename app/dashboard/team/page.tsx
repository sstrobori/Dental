"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ConfirmationModal from "@/components/ConfirmationModal";
import RequiredMark from "@/components/RequiredMark";

type Member = { user_id: string; email: string; role: string };
type Invite = { code: string; role: string; expires_at: string };

const readableRole = (value: string) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default function TeamPage() {
  const supabase = useMemo(() => createClient(), []);
  const [clinicId, setClinicId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [role, setRole] = useState("front_desk");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [denied, setDenied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const load = useCallback(async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setError("Please sign in to manage clinic staff.");
      setLoaded(true);
      return;
    }

    const { data: staff, error: staffError } = await supabase
      .from("clinic_staff")
      .select("clinic_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (staffError || !staff?.clinic_id) {
      setError(staffError?.message ?? "Your account is not linked to a clinic.");
      setLoaded(true);
      return;
    }

    setClinicId(staff.clinic_id);
    if (staff.role !== "owner") {
      setDenied(true);
      setLoaded(true);
      return;
    }

    const args = { p_clinic_id: staff.clinic_id };
    const [memberResult, inviteResult] = await Promise.all([
      supabase.rpc("list_team", args),
      supabase.rpc("open_invites", args),
    ]);

    if (memberResult.error || inviteResult.error) {
      setError(memberResult.error?.message ?? inviteResult.error?.message ?? "Unable to load team.");
    } else {
      setError("");
    }
    setMembers((memberResult.data ?? []) as Member[]);
    setInvites((inviteResult.data ?? []) as Invite[]);
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(kickoff);
  }, [load]);

  async function createInvite() {
    if (!clinicId || creating) return;
    setError("");
    setNotice("");
    setCreating(true);
    const { error: inviteError } = await supabase.rpc("create_invite", {
      p_clinic_id: clinicId,
      p_role: role,
    });
    setCreating(false);
    if (inviteError) return setError(inviteError.message);
    setNotice("Invite code created. Copy it below and share it privately with the staff member.");
    await load();
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setNotice("Invite code copied to clipboard.");
    } catch {
      setError("Could not copy automatically. Please select and copy the code manually.");
    }
  }

  function requestRemoveMember(member: Member) {
    setError("");
    setNotice("");
    setRemoveError("");
    setMemberToRemove(member);
  }

  async function removeMember() {
    if (!memberToRemove || removing || !clinicId) return;
    setRemoving(true);
    setRemoveError("");
    const { error: removeErrorResponse } = await supabase.rpc("remove_staff", {
      p_clinic_id: clinicId,
      p_user_id: memberToRemove.user_id,
    });
    setRemoving(false);
    if (removeErrorResponse) return setRemoveError(removeErrorResponse.message);
    setMemberToRemove(null);
    setNotice("Staff member removed from this clinic.");
    await load();
  }

  const filteredMembers = members.filter((member) =>
    `${member.email} ${member.role}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  if (!loaded) {
    return <div className="p-6 text-sm text-[#756581]" role="status">Loading team...</div>;
  }

  if (denied) {
    return (
      <div className="w-full p-4 sm:p-6 lg:p-8">
        <div className="rounded-2xl border border-[#E4D5F6] bg-white p-6 text-sm font-semibold text-[#2E1747]">
          Only the clinic owner can manage team members.
        </div>
      </div>
    );
  }

  return (
    <main className="w-full px-4 pb-10 pt-6 text-[#2E1747] sm:px-6 sm:pt-8 lg:px-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Team</h1>
      </header>

      {error && (
        <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {notice}
        </p>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(19rem,1fr)] xl:items-start">
        <section aria-labelledby="team-members-heading" className="min-w-0 overflow-hidden rounded-2xl border border-[#E4D5F6] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#EEE7F6] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
            <div>
              <h2 id="team-members-heading" className="text-lg font-bold">Staff members</h2>
              <p className="mt-1 text-xs text-[#756581]">{members.length} {members.length === 1 ? "member" : "members"}</p>
            </div>
            <label className="w-full text-xs font-semibold text-[#49365E] sm:max-w-[240px]">
              Search staff
              <input
                type="search"
                autoComplete="off"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Email or role"
                className="mt-1 min-h-10 w-full rounded-xl border border-[#E4D5F6] bg-[#FCFAFF] px-3 text-sm font-normal outline-none focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]"
              />
            </label>
          </div>

          {filteredMembers.length === 0 ? (
            <p className="p-6 text-sm text-[#756581]">
              {search ? "No staff members match your search." : "No staff members found."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[440px] text-left text-sm">
                <thead className="bg-[#FAF8FF] text-xs font-bold uppercase tracking-wide text-[#756581]">
                  <tr>
                    <th className="px-4 py-3 sm:px-5" scope="col">Staff email</th>
                    <th className="px-3 py-3" scope="col">Role</th>
                    <th className="px-4 py-3 text-right sm:px-5" scope="col">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEE7F6]">
                  {filteredMembers.map((member) => (
                    <tr key={member.user_id} className="hover:bg-[#FCFAFF]">
                      <td className="max-w-[260px] break-all px-4 py-3 font-medium sm:px-5">{member.email}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex whitespace-nowrap rounded-full bg-[#F2EAFF] px-2.5 py-1 text-xs font-semibold text-[#6D3AA8]">
                          {readableRole(member.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right sm:px-5">
                        {member.role !== "owner" ? (
                          <button
                            type="button"
                            onClick={() => requestRemoveMember(member)}
                            className="min-h-9 rounded-lg border border-[#E8C5C7] px-3 py-1.5 text-xs font-semibold text-[#A73743] transition hover:bg-[#FFF0F1]"
                          >
                            Remove
                          </button>
                        ) : (
                          <span className="text-xs text-[#756581]">Owner</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="min-w-0 space-y-5">
          <section aria-labelledby="invite-staff-heading" className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-5">
            <h2 id="invite-staff-heading" className="text-lg font-bold">Invite staff</h2>
            <p className="mt-1 text-xs leading-5 text-[#756581]">Generate a one-time code for a new team member.</p>
            <label className="mt-4 flex flex-col gap-1.5 text-sm font-semibold text-[#49365E]">
              <span>Staff role <RequiredMark /></span>
              <select
                required
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="min-h-11 rounded-xl border border-[#E4D5F6] bg-white px-3 text-sm font-normal outline-none focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]"
              >
                <option value="front_desk">Front desk</option>
                <option value="dentist">Dentist</option>
              </select>
            </label>
            <button
              type="button"
              disabled={!clinicId || creating}
              aria-busy={creating}
              onClick={() => void createInvite()}
              className="mt-3 min-h-11 w-full rounded-xl bg-[#6D3AA8] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#572C87] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating invite..." : "Create invite code"}
            </button>
            <p className="mt-3 text-xs leading-5 text-[#756581]">
              Share codes privately. Each code works once and expires in 7 days.
            </p>
          </section>

          <section aria-labelledby="open-invites-heading" className="overflow-hidden rounded-2xl border border-[#E4D5F6] bg-white shadow-sm">
            <div className="border-b border-[#EEE7F6] p-4 sm:p-5">
              <h2 id="open-invites-heading" className="text-lg font-bold">Active invitations</h2>
              <p className="mt-1 text-xs text-[#756581]">{invites.length} unused {invites.length === 1 ? "code" : "codes"}</p>
            </div>
            {invites.length === 0 ? (
              <p className="p-5 text-sm text-[#756581]">No active invite codes.</p>
            ) : (
              <ul className="divide-y divide-[#EEE7F6]">
                {invites.map((invite) => (
                  <li key={invite.code} className="flex flex-col gap-2 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <code className="break-all rounded-lg bg-[#F2EAFF] px-3 py-2 text-sm font-bold tracking-wide text-[#5B2E8A]">
                        {invite.code}
                      </code>
                      <button
                        type="button"
                        onClick={() => void copyCode(invite.code)}
                        className="min-h-9 rounded-lg border border-[#D7C4EA] px-3 text-xs font-semibold text-[#5C327F] hover:bg-[#F2EAFF]"
                        aria-label={`Copy invite code for ${readableRole(invite.role)}`}
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-[#756581]">
                      {readableRole(invite.role)} - expires {dateLabel(invite.expires_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <ConfirmationModal
        open={!!memberToRemove}
        title="Remove this staff member?"
        description={
          <>
            <strong className="break-all text-[#2E1747]">{memberToRemove?.email}</strong> will lose access to this clinic workspace. Their existing clinic records will remain.
          </>
        }
        confirmLabel="Remove from clinic"
        cancelLabel="Keep staff member"
        busy={removing}
        busyLabel="Removing..."
        tone="danger"
        error={removeError}
        onCancel={() => {
          if (removing) return;
          setMemberToRemove(null);
          setRemoveError("");
        }}
        onConfirm={() => void removeMember()}
      />
    </main>
  );
}
