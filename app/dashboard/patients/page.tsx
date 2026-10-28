"use client";




import { useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import ConfirmationModal from "@/components/ConfirmationModal";

import RequiredMark from "@/components/RequiredMark";



type Patient = {

  id: string;

  name: string;

  phone: string | null;

  clinic_patient_id: string | null;

  is_minor: boolean;

  guardian_name: string | null;

  sms_consent: boolean;

  visit_count: number;

  last_visit_at: string | null;

  account_id: string | null;

};




type PatientAction =

  | { kind: "create-account"; patient: Patient }

  | { kind: "resend-account"; patient: Patient }

  | { kind: "remove-access"; patient: Patient }

  | { kind: "import"; file: File }

  | { kind: "merge"; keep: Patient; remove: Patient };

// Small CSV reader: first row = headers, handles "quoted, values".

function parseCsv(text: string): Record<string, string>[] {

  const lines = text.split(/\r?\n/).filter((l) => l.trim());

  if (lines.length < 2) return [];

  const split = (line: string) => {

    const out: string[] = [];

    let cur = "";

    let inQuotes = false;

    for (const ch of line) {

      if (ch === '"') inQuotes = !inQuotes;

      else if (ch === "," && !inQuotes) { out.push(cur); cur = ""; }

      else cur += ch;

    }

    out.push(cur);

    return out.map((s) => s.trim());

  };

  const headers = split(lines[0]).map((h) => h.toLowerCase());

  return lines.slice(1).map((line) => {

    const cells = split(line);

    const row: Record<string, string> = {};

    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });

    return row;

  });

}



export default function PatientsPage() {

  const supabase = useMemo(() => createClient(), []);

  const [clinicId, setClinicId] = useState("");

  const [q, setQ] = useState("");

  const [patients, setPatients] = useState<Patient[]>([]);

  const [selected, setSelected] = useState<string[]>([]);

  // Management controls remain hidden in the normal directory view.
  const [manageMode, setManageMode] = useState(false);
  const [bulkToolsOpen, setBulkToolsOpen] = useState(false);
  const bulkButtonRef = useRef<HTMLButtonElement>(null);
  const bulkCloseRef = useRef<HTMLButtonElement>(null);

  const [editId, setEditId] = useState("");

  const [eName, setEName] = useState("");

  const [ePhone, setEPhone] = useState("");

  const [eCid, setECid] = useState("");

  const [reload, setReload] = useState(0);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");



  const [patientAction, setPatientAction] = useState<PatientAction | null>(null);

  const [accountEmail, setAccountEmail] = useState("");

  const [actionBusy, setActionBusy] = useState(false);

  const [modalError, setModalError] = useState("");

  const accountEmailRef = useRef<HTMLInputElement>(null);



  useEffect(() => {

    (async () => {

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase

        .from("clinic_staff").select("clinic_id").eq("user_id", user.id).limit(1).maybeSingle();

      if (data) setClinicId(data.clinic_id);

    })();

  }, [supabase]);



  useEffect(() => {

    if (!clinicId) return;

    const timer = setTimeout(async () => {
      const clean = q.replace(/[,()%*\\]/g, "").trim();

      let query = supabase

        .from("patients")

        .select("*")

        .eq("clinic_id", clinicId)

        .order("last_visit_at", { ascending: false, nullsFirst: false })

        .limit(50);

      if (clean) {

        query = query.or(`name.ilike.%${clean}%,phone.ilike.%${clean}%,clinic_patient_id.ilike.%${clean}%`);

      }

      const { data, error } = await query;

      if (error) setError(error.message);

      else setPatients((data ?? []) as Patient[]);

    }, 250);

    return () => clearTimeout(timer);

  }, [supabase, clinicId, q, reload]);



  function requestPatientAction(action: PatientAction) {

    setError("");

    setMessage("");

    setModalError("");

    setAccountEmail("");

    setPatientAction(action);

  }



  async function confirmPatientAction() {

    const action = patientAction;

    if (!action || actionBusy) return;



    const email = accountEmail.trim();
    if (action.kind === "create-account" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {

      setModalError("Enter a valid email address for the patient account.");

      accountEmailRef.current?.focus();

      return;

    }



    setActionBusy(true);

    setModalError("");

    try {

      if (action.kind === "create-account" || action.kind === "resend-account") {

        const response = await fetch("/api/patient-accounts", {

          method: "POST",

          headers: { "Content-Type": "application/json" },

          body: JSON.stringify({

            action: action.kind === "create-account" ? "create" : "resend",

            patientId: action.patient.id,

            email: action.kind === "create-account" ? email : "",

          }),

        });

        const body = await response.json().catch(() => ({}));

        if (!response.ok) throw new Error(body.error ?? "Something went wrong.");

        setMessage(body.message ?? "Done.");

      } else if (action.kind === "import") {

        const rows = parseCsv(await action.file.text()).map((row) => ({

          name: row["name"] || row["patient name"] || "",

          phone: row["phone"] || row["mobile"] || row["mobile number"] || row["contact"] || "",

          clinic_id: row["clinic_id"] || row["patient id"] || row["id"] || "",

        }));

        if (rows.length === 0) {

          throw new Error("No rows found. The first row must be headers, such as: name, phone, clinic_id.");

        }

        const { data, error } = await supabase.rpc("import_patients", { p_clinic_id: clinicId, p_rows: rows });

        if (error) throw error;

        setMessage(`Imported ${data.inserted} patients. Skipped ${data.skipped} (duplicates or missing names).`);

      } else if (action.kind === "remove-access") {

        const { error } = await supabase.rpc("staff_unlink_account", { p_patient_id: action.patient.id });

        if (error) throw error;

        setMessage("Account access removed.");

      } else {

        const { error } = await supabase.rpc("merge_patients", {

          p_keep: action.keep.id,

          p_remove: action.remove.id,

        });

        if (error) throw error;

        setSelected([]);

        setMessage("Patients merged.");

      }

      setPatientAction(null);

      setReload((n) => n + 1);

    } catch (problem) {

      setModalError(problem instanceof Error ? problem.message : "Something went wrong. Please try again.");

    } finally {

      setActionBusy(false);

    }

  }



  function toggle(id: string) {

    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 2 ? [...s, id] : s));

  }



  function startEdit(p: Patient) {

    setEditId(p.id); setEName(p.name); setEPhone(p.phone ?? ""); setECid(p.clinic_patient_id ?? "");

  }



  async function saveEdit() {

    setError("");

    if (!eName.trim()) return setError("Enter the patient's full name.");

    const { error } = await supabase.rpc("update_patient", {

      p_id: editId, p_name: eName.trim(), p_phone: ePhone, p_clinic_patient_id: eCid,

    });

    if (error) return setError(error.message);

    setEditId("");

    setReload((n) => n + 1);

  }



  // Keep the bulk import dialog keyboard-accessible.
  useEffect(() => {
    if (!bulkToolsOpen) return;

    bulkCloseRef.current?.focus();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBulkToolsOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
      bulkButtonRef.current?.focus();
    };
  }, [bulkToolsOpen]);

  const picked = selected.map((id) => patients.find((p) => p.id === id)).filter(Boolean) as Patient[];

  function toggleManageMode() {
    setManageMode((current) => !current);
    setSelected([]);
    setEditId("");
  }



  return (

    <div className="w-full p-4 sm:p-6 lg:p-8">

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b5cb5]">Patient directory</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Patients</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={manageMode}
            onClick={toggleManageMode}
            className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-bold transition ${
              manageMode
                ? "border-[#6d3aa8] bg-[#6d3aa8] text-white hover:bg-[#572c87]"
                : "border-[#d7c4ea] bg-white text-[#5c327f] hover:bg-[#f2eaff]"
            }`}
          >
            {manageMode ? "Done managing" : "Manage patients"}
          </button>
          <button
            ref={bulkButtonRef}
            type="button"
            onClick={() => setBulkToolsOpen(true)}
            className="min-h-11 rounded-xl border border-[#d7c4ea] bg-white px-4 py-2 text-sm font-bold text-[#5c327f] transition hover:bg-[#f2eaff]"
          >
            Import Patients
          </button>
        </div>
      </header>

      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}

      {message && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{message}</p>}



      <div className="admin-card mt-5 p-4 sm:p-5">

        <label htmlFor="patient-search" className="mb-2 block text-sm font-semibold text-[#49355f]">Search patients</label>

        <input id="patient-search" className="min-h-12 w-full border px-4 py-3" placeholder="Name, phone, or clinic patient number" value={q} onChange={(e) => setQ(e.target.value)} />

        <p className="mt-2 text-xs text-[#82758e]">Showing up to 50 matching records.</p>

      </div>



      {manageMode && picked.length === 2 && (

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">

          <p className="font-bold">Merge duplicate patients</p>

          <p className="mt-1 text-xs text-amber-800">Choose which record to keep. Visit history will be combined.</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">

          <button type="button" onClick={() => requestPatientAction({ kind: "merge", keep: picked[0], remove: picked[1] })} className="min-h-11 rounded-xl border border-amber-300 bg-white px-3 py-2 font-semibold">

            Keep {picked[0].name}, remove {picked[1].name}

          </button>

          <button type="button" onClick={() => requestPatientAction({ kind: "merge", keep: picked[1], remove: picked[0] })} className="min-h-11 rounded-xl border border-amber-300 bg-white px-3 py-2 font-semibold">

            Keep {picked[1].name}, remove {picked[0].name}

          </button>

          </div>

        </div>

      )}



      <ul className="mt-5 flex flex-col gap-3">

        {patients.length === 0 && <li className="admin-card p-6 text-center text-sm text-[#756581]">No patients found.</li>}

        {patients.map((p) => (

          <li key={p.id} className="admin-card p-4 text-sm sm:p-5">

            {manageMode && editId === p.id ? (

              <div className="grid gap-4 sm:grid-cols-2">

                <label className="flex flex-col gap-1.5 font-semibold text-[#49355f]"><span>Full name <RequiredMark /></span><input required className="border px-3 py-2 font-normal" value={eName} onChange={(e) => setEName(e.target.value)} /></label>

                <label className="flex flex-col gap-1.5 font-semibold text-[#49355f]">Phone<input className="border px-3 py-2 font-normal" value={ePhone} onChange={(e) => setEPhone(e.target.value)} /></label>

                <label className="flex flex-col gap-1.5 font-semibold text-[#49355f] sm:col-span-2">Clinic patient number<input className="border px-3 py-2 font-normal" value={eCid} onChange={(e) => setECid(e.target.value)} /></label>

                <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">

                  <button onClick={saveEdit} className="min-h-11 rounded-xl bg-[#6d3aa8] px-4 py-2 font-bold text-white hover:bg-[#572c87]">Save changes</button>

                  <button onClick={() => setEditId("")} className="min-h-11 rounded-xl border border-[#d7c4ea] px-4 py-2 font-semibold text-[#5c327f]">Cancel</button>

                </div>

              </div>

            ) : (

              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">

                <div className="flex min-w-0 items-start gap-3">

                  {manageMode && (
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 accent-[#6d3aa8]"
                      checked={selected.includes(p.id)}
                      onChange={() => toggle(p.id)}
                      aria-label={`Select ${p.name} for merging`}
                    />
                  )}

                  <span className="min-w-0">

                    <span className="font-bold text-base text-[#2e1747]">{p.name}</span>{p.is_minor && <span className="ml-2 rounded-full bg-[#f2eaff] px-2 py-0.5 text-xs font-semibold text-[#6d3aa8]">Child</span>}<br />

                    <span className="mt-1 block break-words leading-6 text-[#756581]">

                      {p.is_minor && `Guardian: ${p.guardian_name ?? "not given"} · `}

                      {p.phone ?? "no phone"}

                      {p.clinic_patient_id && ` · patient no. ${p.clinic_patient_id}`}

                      {` · ${p.visit_count} visits`}

                      {p.last_visit_at && `, last ${new Date(p.last_visit_at).toLocaleDateString("en-PH")}`}

                    </span>

                    {p.account_id && <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Portal account active</span>}

                  </span>

                </div>

                {manageMode && (
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:max-w-md xl:justify-end">

                      {p.account_id ? (

                    <>

                      <button type="button" onClick={() => requestPatientAction({ kind: "resend-account", patient: p })} className="min-h-10 rounded-xl border border-[#d7c4ea] bg-white px-3 py-2 text-xs font-semibold text-[#5c327f]">Resend email</button>

                      <button type="button" onClick={() => requestPatientAction({ kind: "remove-access", patient: p })} className="min-h-10 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700">Remove access</button>

                    </>

                  ) : (

                    <button type="button" onClick={() => requestPatientAction({ kind: "create-account", patient: p })} className="min-h-10 rounded-xl bg-[#6d3aa8] px-3 py-2 text-xs font-bold text-white">Create account</button>

                  )}

                  <button onClick={() => startEdit(p)} className="min-h-10 rounded-xl border border-[#d7c4ea] bg-white px-3 py-2 text-xs font-semibold text-[#5c327f]">Edit</button>

                  </div>
                )}

              </div>

            )}

          </li>

        ))}

      </ul>

      {/* BULK TOOLS: CSV import is hidden until the button is clicked. */}
      {bulkToolsOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#241334]/60 p-3 backdrop-blur-[2px] sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setBulkToolsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-tools-title"
            aria-describedby="bulk-tools-description"
            className="w-full max-w-lg rounded-2xl border border-[#E4D5F6] bg-white shadow-[0_30px_100px_rgba(28,15,44,0.3)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#EDE5F5] p-5 sm:p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8b5cb5]">Bulk tools</p>
                <h2 id="bulk-tools-title" className="mt-1 text-xl font-extrabold text-[#2e1747]">
                  Import existing patients
                </h2>
              </div>
              <button
                ref={bulkCloseRef}
                type="button"
                aria-label="Close bulk tools"
                onClick={() => setBulkToolsOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#E4D5F6] text-[#6d3aa8] hover:bg-[#f2eaff]"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="p-5 sm:p-6">
              <p id="bulk-tools-description" className="text-sm leading-6 text-[#756581]">
                Upload a CSV file with a header row and columns: <code>name</code>, <code>phone</code>, and
                <code> clinic_id</code> (optional clinic patient number). In Excel or Google Sheets,
                save the file as CSV. Up to 2,000 rows at a time.
              </p>
              <label htmlFor="patient-csv-upload" className="mt-5 block text-sm font-bold text-[#49355f]">
                Select CSV file
              </label>
              <input
                id="patient-csv-upload"
                type="file"
                accept=".csv,text/csv"
                className="mt-2 block w-full rounded-xl border border-dashed border-[#cdb8e5] bg-[#faf8ff] p-4 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#6d3aa8] file:px-3 file:py-2 file:font-semibold file:text-white"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) {
                    setBulkToolsOpen(false);
                    requestPatientAction({ kind: "import", file });
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setBulkToolsOpen(false)}
                className="mt-5 min-h-11 w-full rounded-xl border border-[#d7c4ea] px-4 py-2 text-sm font-semibold text-[#5c327f] hover:bg-[#f2eaff]"
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}

      {patientAction && (() => {

        const isCreate = patientAction.kind === "create-account";

        const isResend = patientAction.kind === "resend-account";

        const isRemove = patientAction.kind === "remove-access";

        const isImport = patientAction.kind === "import";

        const title = patientAction.kind === "create-account"

          ? `Create an account for ${patientAction.patient.name}?`

          : patientAction.kind === "resend-account"

            ? `Resend the account email to ${patientAction.patient.name}?`

            : patientAction.kind === "remove-access"

              ? `Remove ${patientAction.patient.name}’s account access?`

              : patientAction.kind === "import"

                ? "Import patients from this CSV?"

                : `Merge ${patientAction.remove.name} into ${patientAction.keep.name}?`;

        const description = patientAction.kind === "create-account"

          ? "Enter the sign-in email for this patient account. A parent or guardian can use their own email for a child."

          : patientAction.kind === "resend-account"

            ? "A new account setup email will be sent to the address already linked to this patient."

            : patientAction.kind === "remove-access"

              ? "The patient will no longer be able to sign in and view this clinic’s visits. Their visit records will remain in the clinic directory."

              : patientAction.kind === "import"

                ? `The records in ${patientAction.file.name} will be added to the clinic directory. Duplicate or nameless rows will be skipped.`

                : `All visit history will be moved to ${patientAction.keep.name}, and ${patientAction.remove.name}’s duplicate record will be removed. This cannot be undone.`;

        return (

          <ConfirmationModal

            open

            role={isCreate ? "dialog" : "alertdialog"}

            title={title}

            description={description}

            confirmLabel={isCreate ? "Create account" : isResend ? "Resend email" : isRemove ? "Remove access" : isImport ? "Import patients" : "Merge patients"}

            cancelLabel={isCreate ? "Cancel" : isResend ? "Do not send" : isRemove ? "Keep access" : isImport ? "Do not import" : "Keep separate"}

            busy={actionBusy}

            busyLabel={isCreate ? "Creating…" : isResend ? "Sending…" : isRemove ? "Removing…" : isImport ? "Importing…" : "Merging…"}

            confirmDisabled={isCreate && !accountEmail.trim()}

            tone={isRemove || patientAction.kind === "merge" ? "danger" : isResend || isImport ? "warning" : "primary"}

            error={modalError}

            initialFocusRef={isCreate ? accountEmailRef : undefined}

            onCancel={() => {

              if (actionBusy) return;

              setPatientAction(null);

              setModalError("");

            }}

            onConfirm={() => void confirmPatientAction()}

          >

            {isCreate && (

              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#49365E]">

                <span>Account email address <RequiredMark /></span>

                <input

                  ref={accountEmailRef}

                  required

                  type="email"

                  autoComplete="email"

                  className="min-h-12 w-full rounded-xl border border-[#E4D5F6] bg-white px-4 py-3 font-normal outline-none focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]"

                  placeholder="patient@example.com"

                  value={accountEmail}

                  onChange={(event) => setAccountEmail(event.target.value)}

                  onKeyDown={(event) => {

                    if (event.key === "Enter" && accountEmail.trim()) {

                      event.preventDefault();

                      void confirmPatientAction();

                    }

                  }}

                />

              </label>

            )}

          </ConfirmationModal>

        );

      })()}

    </div>

  );

}
