"use client";









import { useEffect, useMemo, useRef, useState } from "react";



import { createClient } from "@/lib/supabase/client";
import Link from "next/link";



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

  recall_contacted_at: string | null;



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
  const [tab, setTab] = useState<"all" | "due">("all");
  const [months, setMonths] = useState(6);
  const [showContacted, setShowContacted] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(0);
  const [followupTarget, setFollowupTarget] = useState<Patient | null>(null);
  const [followupBusy, setFollowupBusy] = useState(false);
  const [followupError, setFollowupError] = useState("");



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







  // One compact patient directory, optionally filtered to patients due for follow-up.
  // Pagination and filtering happen in Supabase, not just the first 50 records.
  useEffect(() => {
    if (!clinicId) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const clean = q.replace(/[,()%*\\]/g, "").trim();
      const first = (page - 1) * 20;
      let query = supabase
        .from("patients")
        .select("*", { count: "exact" })
        .eq("clinic_id", clinicId)
        .order("last_visit_at", { ascending: tab === "due", nullsFirst: false })
        .order("name", { ascending: true })
        .range(first, first + 19);

      const searchConditions = clean
        ? `name.ilike.%${clean}%,phone.ilike.%${clean}%,clinic_patient_id.ilike.%${clean}%`
        : "";
      let contactConditions = "";
      if (tab === "due") {
        const cutoff = new Date(Date.now() - months * 30.44 * 86400000).toISOString();
        query = query.not("last_visit_at", "is", null).lt("last_visit_at", cutoff);
        if (!showContacted) {
          const recentCutoff = new Date(Date.now() - 30 * 86400000).toISOString();
          contactConditions = `recall_contacted_at.is.null,recall_contacted_at.lt.${recentCutoff}`;
        }
      }
      // Build a single PostgREST OR expression so searching doesn't replace
      // the "not contacted recently" filter on databases using URLSearchParams.set.
      if (searchConditions && contactConditions) {
        query = query.or(`and(or(${searchConditions}),or(${contactConditions}))`);
      } else if (searchConditions || contactConditions) {
        query = query.or(searchConditions || contactConditions);
      }

      const { data, count, error: queryError } = await query;
      if (!active) return;
      setLoading(false);
      if (queryError) {
        setError(queryError.message);
        setPatients([]);
        setTotal(0);
      } else {
        setError("");
        setPatients((data ?? []) as Patient[]);
        setTotal(count ?? 0);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [supabase, clinicId, q, reload, tab, months, showContacted, page]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => setClock(Date.now()), 0);
    const timer = window.setInterval(() => setClock(Date.now()), 60000);
    return () => { window.clearTimeout(kickoff); window.clearInterval(timer); };
  }, []);

  function changeTab(next: "all" | "due") {
    setTab(next);
    setPage(1);
    setSelected([]);
    setEditId("");
  }

  const recentThreshold = 30 * 86400000;
  function recentlyContacted(patient: Patient): boolean {
    return !!clock && !!patient.recall_contacted_at &&
      clock - new Date(patient.recall_contacted_at).getTime() < recentThreshold;
  }

  function dueForVisit(patient: Patient): boolean {
    return !!clock && !!patient.last_visit_at &&
      new Date(patient.last_visit_at).getTime() < clock - months * 30.44 * 86400000;
  }

  async function markContacted() {
    const patient = followupTarget;
    if (!patient || followupBusy) return;
    setFollowupBusy(true);
    setFollowupError("");
    const { error: followupFailure } = await supabase.rpc("mark_contacted", { p_patient_id: patient.id });
    setFollowupBusy(false);
    if (followupFailure) {
      setFollowupError(followupFailure.message);
      return;
    }
    setFollowupTarget(null);
    setMessage(`${patient.name} was marked contacted.`);
    setReload((value) => value + 1);
  }

  function patientActionButtons(p: Patient) {
    const isDue = dueForVisit(p);
    const contacted = recentlyContacted(p);
    return (
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <Link
          href={`/dashboard/history/${encodeURIComponent(p.id)}`}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#D7C4EA] bg-white px-3 text-xs font-bold text-[#6D3AA8] hover:bg-[#F2EAFF]"
        >
          View history
        </Link>
        {isDue && !contacted && (
          <button
            type="button"
            onClick={() => { setFollowupError(""); setFollowupTarget(p); }}
            className="min-h-10 rounded-lg border border-[#BCE5CA] bg-[#E8F6ED] px-3 text-xs font-bold text-[#247344] transition hover:bg-[#D4EDDD]"
          >
            Mark contacted
          </button>
        )}
        {manageMode && (
          <details className="w-full rounded-lg border border-[#E4D5F6] bg-[#FAF8FF] p-2 md:w-auto">
            <summary className="cursor-pointer select-none px-1 text-xs font-bold text-[#5C327F]">Manage record</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.account_id ? (
                <>
                  <button type="button" onClick={() => requestPatientAction({ kind: "resend-account", patient: p })} className="min-h-10 rounded-lg border border-[#D7C4EA] bg-white px-3 text-xs font-semibold text-[#5C327F]">Resend email</button>
                  <button type="button" onClick={() => requestPatientAction({ kind: "remove-access", patient: p })} className="min-h-10 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700">Remove access</button>
                </>
              ) : (
                <button type="button" onClick={() => requestPatientAction({ kind: "create-account", patient: p })} className="min-h-10 rounded-lg bg-[#6D3AA8] px-3 text-xs font-bold text-white">Create account</button>
              )}
              <button type="button" onClick={() => startEdit(p)} className="min-h-10 rounded-lg border border-[#D7C4EA] bg-white px-3 text-xs font-semibold text-[#5C327F]">Edit</button>
            </div>
          </details>
        )}
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(total / 20));
  const DATE_OPTIONS: Intl.DateTimeFormatOptions = { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric" };
  function formatVisitDate(value: string | null): string {
    return value ? new Date(value).toLocaleDateString("en-PH", DATE_OPTIONS) : "No visits yet";
  }

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
    <div className="w-full p-4 text-[#2E1747] sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Patients</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={manageMode}
            onClick={toggleManageMode}
            className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-bold transition ${manageMode ? "border-[#6D3AA8] bg-[#6D3AA8] text-white" : "border-[#D7C4EA] bg-white text-[#5C327F] hover:bg-[#F2EAFF]"}`}
          >
            {manageMode ? "Done managing" : "Manage patients"}
          </button>
          <button
            ref={bulkButtonRef}
            type="button"
            onClick={() => setBulkToolsOpen(true)}
            className="min-h-11 rounded-xl border border-[#D7C4EA] bg-white px-4 py-2 text-sm font-bold text-[#5C327F] hover:bg-[#F2EAFF]"
          >
            Import patients
          </button>
        </div>
      </header>

      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}

      <section className="mt-5 overflow-hidden rounded-2xl border border-[#E4D5F6] bg-white shadow-sm" aria-label="Patient directory and follow-ups">
        <div className="flex flex-col gap-4 border-b border-[#EEE7F6] p-4 sm:p-5">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Patient directory views">
            <button
              type="button"
              aria-pressed={tab === "all"}
              onClick={() => changeTab("all")}
              className={`min-h-10 rounded-xl px-4 text-sm font-bold ${tab === "all" ? "bg-[#6D3AA8] text-white" : "border border-[#D7C4EA] bg-white text-[#5C327F] hover:bg-[#F2EAFF]"}`}
            >
              All patients
            </button>
            <button
              type="button"
              aria-pressed={tab === "due"}
              onClick={() => changeTab("due")}
              className={`min-h-10 rounded-xl px-4 text-sm font-bold ${tab === "due" ? "bg-[#6D3AA8] text-white" : "border border-[#D7C4EA] bg-white text-[#5C327F] hover:bg-[#F2EAFF]"}`}
            >
              Due for a visit
            </button>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <label htmlFor="patient-search" className="w-full max-w-xl text-sm font-semibold text-[#49355F]">
              Search patients
              <input
                id="patient-search"
                type="search"
                autoComplete="off"
                value={q}
                onChange={(event) => { setQ(event.target.value); setPage(1); }}
                placeholder="Name, phone, or clinic patient number"
                className="mt-2 min-h-11 w-full rounded-xl border border-[#E4D5F6] bg-[#FAF8FF] px-4 text-sm font-normal outline-none focus:border-[#6D3AA8] focus:ring-4 focus:ring-[#F2EAFF]"
              />
            </label>
            <span className="w-fit whitespace-nowrap rounded-full bg-[#F2EAFF] px-3 py-2 text-xs font-bold text-[#6D3AA8]">
              {loading ? "Loading…" : `${total} ${total === 1 ? "patient" : "patients"}`}
            </span>
          </div>
          {tab === "due" && (
            <div className="flex flex-col gap-3 rounded-xl bg-[#FAF8FF] p-3 sm:flex-row sm:items-end">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#49355F]">
                Not seen for
                <select
                  value={months}
                  onChange={(event) => { setMonths(Number(event.target.value)); setPage(1); }}
                  className="min-h-10 rounded-lg border border-[#D7C4EA] bg-white px-3 text-sm font-normal"
                >
                  {[3, 6, 9, 12].map((value) => <option key={value} value={value}>{value} months</option>)}
                </select>
              </label>
              <label className="flex min-h-10 items-center gap-2 text-xs font-semibold text-[#49355F]">
                <input type="checkbox" className="size-4 accent-[#6D3AA8]" checked={showContacted} onChange={(event) => { setShowContacted(event.target.checked); setPage(1); }} />
                Show recently contacted
              </label>
              <p className="text-xs leading-5 text-[#756581] sm:ml-auto">Recently contacted patients are hidden for 30 days by default.</p>
            </div>
          )}
        </div>

        {manageMode && picked.length === 2 && (
          <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-bold">Merge duplicate patients</p>
            <p className="mt-1 text-xs">Choose which record to keep. Visit history will be combined.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => requestPatientAction({ kind: "merge", keep: picked[0], remove: picked[1] })} className="min-h-10 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold">Keep {picked[0].name}, remove {picked[1].name}</button>
              <button type="button" onClick={() => requestPatientAction({ kind: "merge", keep: picked[1], remove: picked[0] })} className="min-h-10 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold">Keep {picked[1].name}, remove {picked[0].name}</button>
            </div>
          </div>
        )}

        {manageMode && editId && (
          <div className="m-4 rounded-xl border border-[#D7C4EA] bg-[#FAF8FF] p-4">
            <h2 className="mb-4 font-bold">Edit patient record</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Full name <RequiredMark /><input required className="min-h-11 rounded-lg border border-[#D7C4EA] bg-white px-3 font-normal" value={eName} onChange={(event) => setEName(event.target.value)} /></label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Phone<input className="min-h-11 rounded-lg border border-[#D7C4EA] bg-white px-3 font-normal" value={ePhone} onChange={(event) => setEPhone(event.target.value)} /></label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold sm:col-span-2">Clinic patient number<input className="min-h-11 rounded-lg border border-[#D7C4EA] bg-white px-3 font-normal" value={eCid} onChange={(event) => setECid(event.target.value)} /></label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button type="button" onClick={() => void saveEdit()} className="min-h-11 rounded-lg bg-[#6D3AA8] px-4 text-sm font-bold text-white">Save changes</button>
                <button type="button" onClick={() => setEditId("")} className="min-h-11 rounded-lg border border-[#D7C4EA] bg-white px-4 text-sm font-semibold">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {loading && <p role="status" className="p-6 text-sm text-[#756581]">Loading patients…</p>}
        {!loading && patients.length === 0 && (
          <p className="p-8 text-center text-sm text-[#756581]">{tab === "due" ? "No patients are currently due for follow-up." : q ? "No patients match your search." : "No patients found in this clinic."}</p>
        )}
        {!loading && patients.length > 0 && (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[#FAF8FF] text-xs font-bold uppercase tracking-wide text-[#756581]">
                  <tr>
                    <th scope="col" className="px-4 py-3">Patient</th>
                    <th scope="col" className="px-4 py-3">Contact / ID</th>
                    <th scope="col" className="px-4 py-3">Visits</th>
                    <th scope="col" className="px-4 py-3">Last visit</th>
                    <th scope="col" className="px-4 py-3">Follow-up</th>
                    <th scope="col" className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEE7F6]">
                  {patients.map((p) => (
                    <tr key={p.id} className="align-middle hover:bg-[#FCFAFF]">
                      <td className="px-4 py-3 font-semibold">
                        <div className="flex items-center gap-2">
                          {manageMode && <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name} for merging`} className="size-4 accent-[#6D3AA8]" />}
                          <span>{p.name}</span>
                          {p.is_minor && <span className="rounded-full bg-[#F2EAFF] px-2 py-0.5 text-[10px] text-[#6D3AA8]">Minor</span>}
                        </div>
                        {p.account_id && <span className="mt-1 block text-[10px] font-medium text-emerald-700">Portal active</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#756581]">
                        {p.phone || "No phone"}
                        {p.clinic_patient_id && <span className="mt-1 block">ID: {p.clinic_patient_id}</span>}
                        {p.is_minor && <span className="mt-1 block">Guardian: {p.guardian_name ?? "not given"}</span>}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold">{p.visit_count}</td>
                      <td className="px-4 py-3 text-xs text-[#756581]">{formatVisitDate(p.last_visit_at)}</td>
                      <td className="px-4 py-3 text-xs">
                        {dueForVisit(p) ? recentlyContacted(p) ? <span className="font-semibold text-[#247344]">Contacted recently</span> : <span className="font-semibold text-amber-700">Due for a visit</span> : <span className="text-[#92869B]">—</span>}
                      </td>
                      <td className="px-4 py-3">{patientActionButtons(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-[#EEE7F6] md:hidden">
              {patients.map((p) => (
                <li key={p.id} className="p-4">
                  <div className="flex items-start gap-2">
                    {manageMode && <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name} for merging`} className="mt-1 size-4 accent-[#6D3AA8]" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{p.name}{p.is_minor ? " · Minor" : ""}</p>
                      <p className="mt-1 text-xs text-[#756581]">{p.clinic_patient_id ? `ID: ${p.clinic_patient_id}` : p.phone || "No phone"}</p>
                      <p className="mt-1 text-xs text-[#756581]">{p.visit_count} {p.visit_count === 1 ? "visit" : "visits"} · {formatVisitDate(p.last_visit_at)}</p>
                      {dueForVisit(p) && <p className={`mt-1 text-xs font-semibold ${recentlyContacted(p) ? "text-[#247344]" : "text-amber-700"}`}>{recentlyContacted(p) ? "Contacted recently" : "Due for a visit"}</p>}
                    </div>
                  </div>
                  <div className="mt-3">{patientActionButtons(p)}</div>
                </li>
              ))}
            </ul>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEE7F6] bg-[#FCFAFF] p-4 text-xs text-[#756581]">
              <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="min-h-9 rounded-lg border border-[#D7C4EA] bg-white px-3 font-semibold text-[#6D3AA8] disabled:opacity-40">Previous</button>
                <span className="tabular-nums">{page} / {pageCount}</span>
                <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="min-h-9 rounded-lg border border-[#D7C4EA] bg-white px-3 font-semibold text-[#6D3AA8] disabled:opacity-40">Next</button>
              </div>
            </footer>
          </>
        )}
      </section>
      <p className="mt-3 text-xs leading-5 text-[#756581]">Follow-up reminders use the last recorded visit in this system. Imported patients will appear after their first recorded visit.</p>

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




      <ConfirmationModal
        open={!!followupTarget}
        title="Mark this patient as contacted?"
        description={<>
          Confirm only after reaching out to <strong className="text-[#2E1747]">{followupTarget?.name}</strong>. They will be hidden from the due list for 30 days.
        </>}
        confirmLabel="Mark contacted"
        cancelLabel="Not yet"
        busy={followupBusy}
        busyLabel="Saving…"
        tone="primary"
        error={followupError}
        onCancel={() => { if (followupBusy) return; setFollowupTarget(null); setFollowupError(""); }}
        onConfirm={() => void markContacted()}
      />
    </div>
  );
}
