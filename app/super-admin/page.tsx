"use client";

import SuperAdminShell from "@/components/super-admin/SuperAdminShell";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

type ClinicStatus = "pending" | "active" | "suspended";
type RequestStatus = "new" | "reviewing" | "approved" | "rejected";

type Clinic = {
  clinic_id: string;
  clinic_name: string;
  status: ClinicStatus;
  contact_email: string | null;
  staff_count: number;
};

type PartnerRequest = {
  id: string;
  clinic_name: string;
  contact_email: string;
  notes: string;
  status: RequestStatus;
  created_at: string;
};

type NewRequest = { name: string; email: string; notes: string };

type ClinicStaff = {
  user_id: string;
  staff_name: string;
  staff_email: string | null;
  staff_role: string | null;
};

type ModalState =
  | { kind: "view-staff"; clinic: Clinic }
  | { kind: "add-request" }
  | { kind: "confirm-add"; request: NewRequest }
  | { kind: "edit-contact"; clinic: Clinic }
  | { kind: "confirm-contact"; clinic: Clinic; nextEmail: string }
  | { kind: "confirm-clinic-status"; clinic: Clinic; nextStatus: ClinicStatus }
  | { kind: "confirm-request-status"; request: PartnerRequest; nextStatus: RequestStatus };

const inputClass =
  "min-h-11 w-full rounded-xl border border-[#E4D5F6] bg-white px-3 py-2.5 text-sm text-[#2E1747] outline-none transition focus:border-[#6D3AA8] focus:ring-4 focus:ring-[#F2EAFF]";
const buttonClass =
  "min-h-10 rounded-xl border border-[#D7C4EA] bg-white px-3 py-2 text-sm font-semibold text-[#6D3AA8] transition hover:bg-[#F2EAFF] disabled:cursor-not-allowed disabled:opacity-50";
const primaryClass =
  "min-h-11 rounded-xl bg-[#6D3AA8] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6] disabled:cursor-not-allowed disabled:opacity-50";
const dangerClass =
  "min-h-11 rounded-xl bg-[#C74652] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#AC3642] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:opacity-50";

function statusStyle(status: string) {
  if (status === "active" || status === "approved") return "bg-emerald-50 text-emerald-700";
  if (status === "suspended" || status === "rejected") return "bg-red-50 text-red-700";
  if (status === "pending" || status === "reviewing") return "bg-amber-50 text-amber-800";
  return "bg-[#F2EAFF] text-[#6D3AA8]";
}

function Dialog({
  title,
  description,
  children,
  onClose,
  busy,
  danger = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
  danger?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]'
        ) ?? []
      ).filter((element) => element.getClientRects().length > 0);
      if (controls.length === 0) {
        event.preventDefault();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, busy]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#241334]/60 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="super-admin-dialog-title"
        aria-describedby={description ? "super-admin-dialog-description" : undefined}
        aria-busy={busy}
        className="my-auto w-full max-w-lg rounded-2xl border border-[#E4D5F6] bg-white p-5 text-left shadow-[0_24px_70px_rgba(40,20,50,0.25)] sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${danger ? "bg-[#FFF0F1] text-[#B5414D]" : "bg-[#F2EAFF] text-[#6D3AA8]"}`}
            aria-hidden="true"
          >
            {danger ? (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4M12 17h.01" />
                <path d="M10.3 3.8 2.2 18.2A1.9 1.9 0 0 0 3.9 21h16.2a1.9 1.9 0 0 0 1.7-2.8L13.7 3.8a1.9 1.9 0 0 0-3.4 0Z" />
              </svg>
            ) : (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="super-admin-dialog-title" className="text-lg font-extrabold leading-7 text-[#2E1747] sm:text-xl">
              {title}
            </h2>
            {description && (
              <p id="super-admin-dialog-description" className="mt-1 text-sm leading-6 text-[#756581]">
                {description}
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#756581] transition hover:bg-[#F2EAFF] hover:text-[#6D3AA8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6] disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SuperAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [requests, setRequests] = useState<PartnerRequest[]>([]);
  const [tab, setTab] = useState<"clinics" | "requests">("clinics");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | ClinicStatus>("all");
  const [requestName, setRequestName] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [contactDraft, setContactDraft] = useState("");
  const [suspensionNote, setSuspensionNote] = useState("");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [modalError, setModalError] = useState("");
  const [staff, setStaff] = useState<ClinicStaff[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [busy, setBusy] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoadingData(true);
    const [clinicResult, requestResult] = await Promise.all([
      supabase.rpc("platform_list_clinics"),
      supabase.rpc("platform_list_requests"),
    ]);
    if (clinicResult.error || requestResult.error) {
      setError(clinicResult.error?.message ?? requestResult.error?.message ?? "Unable to load platform information.");
    } else {
      setClinics((clinicResult.data ?? []) as Clinic[]);
      setRequests((requestResult.data ?? []) as PartnerRequest[]);
      setError("");
    }
    setLoadingData(false);
  }, [supabase]);

  useEffect(() => {
    let active = true;
    async function initialize() {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !user) {
        setError(authError?.message ?? "You are not signed in. Sign in using your Super Admin account first.");
        setAuthorized(false);
        return;
      }
      setEmail(user.email ?? "");
      const { data, error: roleError } = await supabase.rpc("platform_is_admin");
      if (!active) return;
      if (roleError) {
        setError(`Authorization check failed: ${roleError.message}`);
        setAuthorized(false);
        return;
      }
      if (data !== true) {
        setError(`You are signed in as ${user.email ?? "an unknown email"}, but this account is not registered as a platform administrator.`);
        setAuthorized(false);
        return;
      }
      setError("");
      setAuthorized(true);
      await refresh();
    }
    void initialize();
    return () => { active = false; };
  }, [supabase, refresh]);

  // Load staff only when a Super Admin opens that clinic's read-only staff dialog.
  // Do not query auth.users from the browser: the RPC restricts access server-side.
  useEffect(() => {
    if (modal?.kind !== "view-staff") return;
    let cancelled = false;
    setStaff([]);
    setStaffError("");
    setStaffLoading(true);

    async function loadStaff() {
      if (modal?.kind !== "view-staff") return;
      const { data, error: staffLookupError } = await supabase.rpc(
        "platform_list_clinic_staff",
        { p_clinic_id: modal.clinic.clinic_id }
      );
      if (cancelled) return;
      setStaffLoading(false);
      if (staffLookupError) {
        setStaffError(staffLookupError.message);
        return;
      }
      setStaff((data ?? []) as ClinicStaff[]);
    }

    void loadStaff();
    return () => { cancelled = true; };
  }, [modal, supabase]);

  const filtered = clinics.filter((clinic) => {
    if (filter !== "all" && clinic.status !== filter) return false;
    const keyword = search.trim().toLowerCase();
    return !keyword || `${clinic.clinic_name} ${clinic.contact_email ?? ""} ${clinic.clinic_id}`.toLowerCase().includes(keyword);
  });

  const activeCount = clinics.filter((clinic) => clinic.status === "active").length;
  const pendingCount = clinics.filter((clinic) => clinic.status === "pending").length;
  const suspendedCount = clinics.filter((clinic) => clinic.status === "suspended").length;

  function showModal(next: ModalState) {
    if (busy) return;
    setModalError("");
    setModal(next);
  }

  function closeModal() {
    if (busy) return;
    setModal(null);
    setModalError("");
  }

  function startAddRequest() {
    setRequestName("");
    setRequestEmail("");
    setRequestNotes("");
    showModal({ kind: "add-request" });
  }

  function submitAddRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (requestName.trim().length < 2 || !requestEmail.trim()) {
      setModalError("Please enter a clinic name and a valid contact email.");
      return;
    }
    showModal({
      kind: "confirm-add",
      request: {
        name: requestName.trim(),
        email: requestEmail.trim(),
        notes: requestNotes.trim(),
      },
    });
  }

  function startEditContact(clinic: Clinic) {
    setContactDraft(clinic.contact_email ?? "");
    showModal({ kind: "edit-contact", clinic });
  }

  function submitEditContact(event: FormEvent<HTMLFormElement>, clinic: Clinic) {
    event.preventDefault();
    if (busy) return;
    const nextEmail = contactDraft.trim();
    if (nextEmail === (clinic.contact_email ?? "")) {
      closeModal();
      return;
    }
    showModal({ kind: "confirm-contact", clinic, nextEmail });
  }

  function startClinicStatus(clinic: Clinic, nextStatus: ClinicStatus) {
    if (clinic.status === nextStatus) return;
    setSuspensionNote("");
    showModal({ kind: "confirm-clinic-status", clinic, nextStatus });
  }

  async function confirmAction() {
    const action = modal;
    if (!action || busy) return;
    if (action.kind === "add-request" || action.kind === "edit-contact" || action.kind === "view-staff") return;
    if (action.kind === "confirm-clinic-status" && action.nextStatus === "suspended" && suspensionNote.trim().length < 5) {
      setModalError("Please provide a suspension reason of at least 5 characters.");
      return;
    }

    setBusy("saving");
    setModalError("");
    setError("");
    setNotice("");

    try {
      if (action.kind === "confirm-add") {
        const { error: actionError } = await supabase.rpc("platform_add_request", {
          p_name: action.request.name,
          p_email: action.request.email,
          p_notes: action.request.notes,
        });
        if (actionError) throw actionError;
        setRequestName("");
        setRequestEmail("");
        setRequestNotes("");
        setNotice("Partnership request created. Clinic provisioning is a separate step.");
      } else if (action.kind === "confirm-contact") {
        const { error: actionError } = await supabase.rpc("platform_set_clinic_contact", {
          p_clinic_id: action.clinic.clinic_id,
          p_email: action.nextEmail,
        });
        if (actionError) throw actionError;
        setNotice(`Contact email updated for ${action.clinic.clinic_name}.`);
      } else if (action.kind === "confirm-clinic-status") {
        const { error: actionError } = await supabase.rpc("platform_set_clinic_status", {
          p_clinic_id: action.clinic.clinic_id,
          p_status: action.nextStatus,
          p_note: action.nextStatus === "suspended" ? suspensionNote.trim() : "",
        });
        if (actionError) throw actionError;
        setNotice(`${action.clinic.clinic_name} is now marked ${action.nextStatus}.`);
      } else if (action.kind === "confirm-request-status") {
        const { error: actionError } = await supabase.rpc("platform_set_request_status", {
          p_request_id: action.request.id,
          p_status: action.nextStatus,
        });
        if (actionError) throw actionError;
        setNotice(`Partnership request marked ${action.nextStatus}.`);
      }
      setModal(null);
      await refresh();
    } catch (caught) {
      setModalError(
        caught && typeof caught === "object" && "message" in caught && typeof caught.message === "string"
          ? caught.message
          : "Unable to save changes. Please try again."
      );
    } finally {
      setBusy("");
    }
  }

  if (authorized === null) {
    return <main className="min-h-dvh bg-[#FAF8FF] p-8 text-[#756581]" role="status">Checking platform administrator access…</main>;
  }
  if (!authorized) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#FAF8FF] px-4">
        <section className="w-full max-w-lg rounded-2xl border border-[#E4D5F6] bg-white p-7 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-[#2E1747]">Platform access restricted</h1>
          <p className="mt-3 text-sm leading-6 text-[#756581]">Only designated platform super administrators can open this page. Sign in with your authorized account first.</p>
          <a href="/super-admin/login" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#6D3AA8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#572C87]">
            Sign in as Super Admin
          </a>
          {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        </section>
      </main>
    );
  }

  const modalDanger = modal?.kind === "confirm-clinic-status" && modal.nextStatus === "suspended"
    || modal?.kind === "confirm-request-status" && modal.nextStatus === "rejected";

  return (
    <SuperAdminShell email={email} activeTab={tab} onTabChange={setTab}>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">
              {tab === "clinics" ? "Partner clinics" : "Clinic onboarding"}
            </h2>
            <p className="mt-1 text-sm text-[#756581]">Oversee clinics and partnership requests across the platform.</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Registered clinics", count: clinics.length },
            { label: "Active", count: activeCount },
            { label: "Pending", count: pendingCount },
            { label: "Suspended", count: suspendedCount },
          ].map((item) => (
            <section key={item.label} className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-5">
              <p className="text-xs font-medium text-[#756581]">{item.label}</p>
              <p className="mt-2 text-3xl font-extrabold text-[#2E1747]">{item.count}</p>
            </section>
          ))}
        </div>

        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

        {tab === "clinics" && (
          <section aria-label="Partner clinic directory">
            <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <label className="text-xs font-semibold text-[#49365E]">Search partner clinics
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Clinic name, email, or ID" className={`${inputClass} mt-1`} />
              </label>
              <label className="text-xs font-semibold text-[#49365E]">Status
                <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className={`${inputClass} mt-1`}>
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                </select>
              </label>
            </div>
            {filtered.length === 0 ? (
              <p className="rounded-xl bg-white p-6 text-sm text-[#756581]">No partner clinics match your search.</p>
            ) : (
              <div className="grid gap-3">
                {filtered.map((clinic) => (
                  <article key={clinic.clinic_id} className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-lg font-bold">{clinic.clinic_name}</h3>
                        <p className="mt-1 break-all text-xs text-[#756581]">ID: {clinic.clinic_id}</p>
                        <p className="mt-2 text-sm text-[#756581]">Contact: {clinic.contact_email || "Not provided"}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${statusStyle(clinic.status)}`}>{clinic.status}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4 border-t border-[#F0EAF7] pt-4 text-sm text-[#756581]">
                      <span><strong className="text-[#2E1747]">{clinic.staff_count}</strong> staff</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" disabled={!!busy} className={buttonClass} onClick={() => showModal({ kind: "view-staff", clinic })}>
                        View staff
                      </button>
                      <button type="button" disabled={!!busy} className={buttonClass} onClick={() => startEditContact(clinic)}>Edit contact</button>
                      {clinic.status !== "active" && <button type="button" disabled={!!busy} className={buttonClass} onClick={() => startClinicStatus(clinic, "active")}>Mark active</button>}
                      {clinic.status !== "pending" && <button type="button" disabled={!!busy} className={buttonClass} onClick={() => startClinicStatus(clinic, "pending")}>Mark pending</button>}
                      {clinic.status !== "suspended" && (
                        <button type="button" disabled={!!busy} className="min-h-10 rounded-xl border border-red-200 bg-[#FFF4F4] px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50" onClick={() => startClinicStatus(clinic, "suspended")}>
                          Mark suspended
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "requests" && (
          <section aria-label="Prospective partner clinics">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#2E1747]">Onboarding requests</h3>
                <p className="mt-1 text-sm text-[#756581]">Review prospective clinics and manage their request status.</p>
              </div>
              <button type="button" disabled={!!busy} onClick={startAddRequest} className={primaryClass}>
                + Add a partner request
              </button>
            </div>
            {requests.length === 0 && <p className="rounded-xl border border-[#E4D5F6] bg-white p-5 text-sm text-[#756581]">No partnership requests yet.</p>}
            <div className="flex flex-col gap-3">
              {requests.map((request) => (
                <article key={request.id} className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold">{request.clinic_name}</h4>
                      <p className="mt-1 break-all text-sm text-[#756581]">{request.contact_email}</p>
                      <p className="mt-1 text-xs text-[#80748B]">Requested {new Date(request.created_at).toLocaleDateString("en-PH")}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyle(request.status)}`}>{request.status}</span>
                  </div>
                  {request.notes && <p className="mt-3 break-words text-sm text-[#756581]">{request.notes}</p>}
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[#F0EAF7] pt-4">
                    {(["new", "reviewing", "approved", "rejected"] as RequestStatus[])
                      .filter((value) => value !== request.status)
                      .map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          disabled={!!busy}
                          className={nextStatus === "rejected"
                            ? "min-h-10 rounded-xl border border-red-200 bg-[#FFF4F4] px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                            : buttonClass}
                          onClick={() => showModal({ kind: "confirm-request-status", request, nextStatus })}
                        >
                          Mark {nextStatus}
                        </button>
                      ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <p className="mt-8 text-xs leading-5 text-[#80748B]">
          Important: Deploy and verify the companion status-enforcement migration to block core queue and appointment operations. Audit all other patient/staff RPCs and RLS policies before treating clinic suspension as complete. Partnership approval does not provision a clinic.
        </p>
      </div>

      {modal && (
        <Dialog
          key={modal.kind}
          title={
            modal.kind === "view-staff" ? `Staff at ${modal.clinic.clinic_name}`
              : modal.kind === "add-request" ? "Add a partner request"
              : modal.kind === "confirm-add" ? "Confirm new partner request"
              : modal.kind === "edit-contact" ? "Edit clinic contact"
              : modal.kind === "confirm-contact" ? "Confirm contact update"
              : modal.kind === "confirm-clinic-status" ? `Mark clinic ${modal.nextStatus}?`
              : `Mark request ${modal.nextStatus}?`
          }
          description={
            modal.kind === "view-staff" ? "Names and email addresses of staff assigned to this clinic."
              : modal.kind === "add-request" ? "Record a prospective clinic for onboarding."
              : modal.kind === "confirm-add" ? "Please review the details before saving this request."
              : modal.kind === "edit-contact" ? `Update the contact email for ${modal.clinic.clinic_name}.`
              : modal.kind === "confirm-contact" ? "Please review the email address before saving."
              : modal.kind === "confirm-clinic-status" ? `Confirm the status change for ${modal.clinic.clinic_name}.`
              : `Confirm the request status for ${modal.request.clinic_name}.`
          }
          busy={!!busy}
          danger={modalDanger}
          onClose={closeModal}
        >
          {modal.kind === "view-staff" && (
            <div className="mt-5 space-y-4">
              {staffLoading ? (
                <p role="status" className="rounded-xl border border-[#E4D5F6] bg-[#FAF8FF] p-4 text-sm text-[#756581]">
                  Loading clinic staff…
                </p>
              ) : staffError ? (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  Could not load staff: {staffError}. Make sure the staff-list SQL function has been installed in Supabase.
                </p>
              ) : staff.length === 0 ? (
                <p className="rounded-xl border border-[#E4D5F6] bg-[#FAF8FF] p-4 text-sm text-[#756581]">
                  No staff accounts are linked to this clinic yet.
                </p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-[#49365E]">
                    {staff.length} registered {staff.length === 1 ? "staff member" : "staff members"}
                  </p>
                  <ul className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                    {staff.map((member) => (
                      <li key={member.user_id} className="rounded-xl border border-[#E4D5F6] bg-[#FCFAFF] p-4">
                        <div className="flex items-start gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F2EAFF] text-[#6D3AA8]" aria-hidden="true">
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="8" r="3.5" />
                              <path d="M5 20a7 7 0 0 1 14 0" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-bold text-[#2E1747]">{member.staff_name}</p>
                            <p className="mt-1 break-all text-sm text-[#756581]">{member.staff_email || "Email unavailable"}</p>
                            {member.staff_role && (
                              <p className="mt-2 inline-block rounded-full bg-[#F2EAFF] px-2.5 py-1 text-xs font-semibold capitalize text-[#6D3AA8]">
                                {member.staff_role}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="flex justify-end">
                <button type="button" className={buttonClass} onClick={closeModal}>Close</button>
              </div>
            </div>
          )}

          {modal.kind === "add-request" && (
            <form onSubmit={submitAddRequest} className="mt-5 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#49365E]">
                Clinic name
                <input required minLength={2} maxLength={120} className={inputClass} value={requestName} onChange={(event) => setRequestName(event.target.value)} placeholder="Example Dental Clinic" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#49365E]">
                Contact email
                <input required type="email" maxLength={254} className={inputClass} value={requestEmail} onChange={(event) => setRequestEmail(event.target.value)} placeholder="owner@example.com" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#49365E]">
                Notes <span className="text-xs font-normal text-[#80748B]">(optional)</span>
                <textarea maxLength={1000} rows={3} className={inputClass} value={requestNotes} onChange={(event) => setRequestNotes(event.target.value)} placeholder="Contact details and onboarding context" />
              </label>
              <p className="rounded-xl border border-[#E4D5F6] bg-[#FAF8FF] p-3 text-xs leading-5 text-[#756581]">
                Creating a request does not create a live clinic or owner account.
              </p>
              {modalError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{modalError}</p>}
              <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className={buttonClass} onClick={closeModal}>Cancel</button>
                <button type="submit" className={primaryClass}>Review &amp; save</button>
              </div>
            </form>
          )}

          {modal.kind === "edit-contact" && (
            <form className="mt-5 flex flex-col gap-4" onSubmit={(event) => submitEditContact(event, modal.clinic)}>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#49365E]">
                Contact email
                <input type="email" maxLength={254} className={inputClass} value={contactDraft} onChange={(event) => setContactDraft(event.target.value)} placeholder="Leave blank to remove contact email" />
              </label>
              <p className="text-xs text-[#80748B]">Leave the field empty to remove the contact email.</p>
              {modalError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{modalError}</p>}
              <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className={buttonClass} onClick={closeModal}>Cancel</button>
                <button type="submit" className={primaryClass}>Review change</button>
              </div>
            </form>
          )}

          {modal.kind === "confirm-add" && (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-[#E4D5F6] bg-[#FAF8FF] p-4 text-sm">
                <p className="font-bold text-[#2E1747]">{modal.request.name}</p>
                <p className="mt-1 break-all text-[#756581]">{modal.request.email}</p>
                {modal.request.notes && <p className="mt-2 whitespace-pre-wrap text-[#756581]">{modal.request.notes}</p>}
              </div>
              <p className="text-sm text-[#756581]">Are you sure you want to save this onboarding request? This does not activate a clinic account.</p>
              {modalError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{modalError}</p>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className={buttonClass} disabled={!!busy} onClick={() => showModal({ kind: "add-request" })}>Back to edit</button>
                <button type="button" className={primaryClass} disabled={!!busy} onClick={() => void confirmAction()}>{busy ? "Saving…" : "Yes, save request"}</button>
              </div>
            </div>
          )}

          {modal.kind === "confirm-contact" && (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-[#E4D5F6] bg-[#FAF8FF] p-4 text-sm">
                <p className="font-bold text-[#2E1747]">{modal.clinic.clinic_name}</p>
                <p className="mt-2 text-[#756581]">Current: {modal.clinic.contact_email || "Not provided"}</p>
                <p className="mt-1 font-semibold text-[#2E1747]">New: {modal.nextEmail || "Remove contact email"}</p>
              </div>
              <p className="text-sm text-[#756581]">Are you sure you want to save this contact change?</p>
              {modalError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{modalError}</p>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className={buttonClass} disabled={!!busy} onClick={() => showModal({ kind: "edit-contact", clinic: modal.clinic })}>Back to edit</button>
                <button type="button" className={primaryClass} disabled={!!busy} onClick={() => void confirmAction()}>{busy ? "Saving…" : "Yes, save change"}</button>
              </div>
            </div>
          )}

          {modal.kind === "confirm-clinic-status" && (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-[#E4D5F6] bg-[#FAF8FF] p-4 text-sm">
                <p className="font-bold text-[#2E1747]">{modal.clinic.clinic_name}</p>
                <p className="mt-2 text-[#756581]">Current status: <span className="font-semibold capitalize">{modal.clinic.status}</span></p>
                <p className="mt-1 text-[#2E1747]">New status: <span className="font-bold capitalize">{modal.nextStatus}</span></p>
              </div>
              {modal.nextStatus === "suspended" && (
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#49365E]">
                  Suspension reason <span className="text-xs font-normal text-[#80748B]">(required, at least 5 characters)</span>
                  <textarea
                    required
                    minLength={5}
                    maxLength={1000}
                    rows={3}
                    className={inputClass}
                    value={suspensionNote}
                    onChange={(event) => { setSuspensionNote(event.target.value); setModalError(""); }}
                    placeholder="Explain why the clinic is being suspended"
                  />
                </label>
              )}
              <p className="text-sm leading-6 text-[#756581]">
                {modal.nextStatus === "active"
                  ? "Are you sure you want to activate this clinic?"
                  : modal.nextStatus === "pending"
                    ? "Are you sure you want to mark this clinic pending?"
                    : "Are you sure you want to suspend this clinic?"}
                {" "}Access restrictions depend on the companion Supabase enforcement migration and other RPC/policy checks.
              </p>
              {modalError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{modalError}</p>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className={buttonClass} disabled={!!busy} onClick={closeModal}>Cancel</button>
                <button type="button" className={modal.nextStatus === "suspended" ? dangerClass : primaryClass} disabled={!!busy} onClick={() => void confirmAction()}>
                  {busy ? "Saving…" : `Yes, mark ${modal.nextStatus}`}
                </button>
              </div>
            </div>
          )}

          {modal.kind === "confirm-request-status" && (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-[#E4D5F6] bg-[#FAF8FF] p-4 text-sm">
                <p className="font-bold text-[#2E1747]">{modal.request.clinic_name}</p>
                <p className="mt-2 text-[#756581]">Current request status: <span className="font-semibold capitalize">{modal.request.status}</span></p>
                <p className="mt-1 text-[#2E1747]">New status: <span className="font-bold capitalize">{modal.nextStatus}</span></p>
              </div>
              <p className="text-sm leading-6 text-[#756581]">Are you sure you want to change this onboarding request? Approval alone does not create or activate a clinic account.</p>
              {modalError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{modalError}</p>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className={buttonClass} disabled={!!busy} onClick={closeModal}>Cancel</button>
                <button type="button" className={modal.nextStatus === "rejected" ? dangerClass : primaryClass} disabled={!!busy} onClick={() => void confirmAction()}>
                  {busy ? "Saving…" : `Yes, mark ${modal.nextStatus}`}
                </button>
              </div>
            </div>
          )}
        </Dialog>
      )}
    </SuperAdminShell>
  );
}
