"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

type HistRow = { when: string; kind: string; reason: string | null; status: string };
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
  const supabase = createClient();
  const [clinicId, setClinicId] = useState("");
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [editId, setEditId] = useState("");
  const [eName, setEName] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eCid, setECid] = useState("");
  const [reload, setReload] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");
  const [hist, setHist] = useState<HistRow[]>([]);

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

  async function accountAction(p: Patient, action: "create" | "resend") {
    setError(""); setMessage("");
    let email = "";
    if (action === "create") {
      const input = window.prompt(`Email address for ${p.name}'s account.\n(A parent can use their own email for a child.)`);
      if (!input) return;
      email = input.trim();
    }
    const res = await fetch("/api/patient-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, patientId: p.id, email }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? "Something went wrong.");
    setMessage(body.message ?? "Done.");
    setReload((n) => n + 1);
  }

  async function removeAccess(p: Patient) {
    if (!window.confirm(`Remove ${p.name}'s access to their patient account? Their visit records stay.`)) return;
    const { error } = await supabase.rpc("staff_unlink_account", { p_patient_id: p.id });
    if (error) return setError(error.message);
    setMessage("Account access removed.");
    setReload((n) => n + 1);
  }

  async function showHistory(id: string) {
    if (openId === id) { setOpenId(""); return; }
    setOpenId(id);
    setHist([]);
    const [{ data: visits }, { data: appts }] = await Promise.all([
      supabase.from("queue_entries").select("created_at, visit_reason, status")
        .eq("patient_id", id).is("appointment_id", null).order("created_at", { ascending: false }).limit(50),
      supabase.from("appointments").select("starts_at, reason, status")
        .eq("patient_id", id).order("starts_at", { ascending: false }).limit(50),
    ]);
    const rows: HistRow[] = [
      ...(visits ?? []).map((v) => ({ when: v.created_at as string, kind: "Walk-in", reason: v.visit_reason as string | null, status: v.status as string })),
      ...(appts ?? []).map((a) => ({ when: a.starts_at as string, kind: "Appointment", reason: a.reason as string | null, status: a.status as string })),
    ].sort((x, y) => new Date(y.when).getTime() - new Date(x.when).getTime());
    setHist(rows);
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 2 ? [...s, id] : s));
  }

  function startEdit(p: Patient) {
    setEditId(p.id); setEName(p.name); setEPhone(p.phone ?? ""); setECid(p.clinic_patient_id ?? "");
  }

  async function saveEdit() {
    setError("");
    const { error } = await supabase.rpc("update_patient", {
      p_id: editId, p_name: eName, p_phone: ePhone, p_clinic_patient_id: eCid,
    });
    if (error) return setError(error.message);
    setEditId("");
    setReload((n) => n + 1);
  }

  async function merge(keep: string, remove: string) {
    if (!window.confirm("Merge these two patients? This cannot be undone.")) return;
    setError("");
    const { error } = await supabase.rpc("merge_patients", { p_keep: keep, p_remove: remove });
    if (error) return setError(error.message);
    setSelected([]);
    setMessage("Patients merged.");
    setReload((n) => n + 1);
  }

  async function importCsv(file: File) {
    setError(""); setMessage("");
    const rows = parseCsv(await file.text()).map((r) => ({
      name: r["name"] || r["patient name"] || "",
      phone: r["phone"] || r["mobile"] || r["mobile number"] || r["contact"] || "",
      clinic_id: r["clinic_id"] || r["patient id"] || r["id"] || "",
    }));
    if (rows.length === 0) return setError("No rows found. The first row must be headers, such as: name, phone, clinic_id.");
    const { data, error } = await supabase.rpc("import_patients", { p_clinic_id: clinicId, p_rows: rows });
    if (error) return setError(error.message);
    setMessage(`Imported ${data.inserted} patients. Skipped ${data.skipped} (duplicates or missing names).`);
    setReload((n) => n + 1);
  }

  const picked = selected.map((id) => patients.find((p) => p.id === id)).filter(Boolean) as Patient[];

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b5cb5]">Patient directory</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Patients</h1>
      </header>

      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}
      {message && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{message}</p>}

      <div className="admin-card mt-5 p-4 sm:p-5">
        <label htmlFor="patient-search" className="mb-2 block text-sm font-semibold text-[#49355f]">Search patients</label>
        <input id="patient-search" className="min-h-12 w-full border px-4 py-3" placeholder="Name, phone, or clinic patient number" value={q} onChange={(e) => setQ(e.target.value)} />
        <p className="mt-2 text-xs text-[#82758e]">Showing up to 50 matching records.</p>
      </div>

      {picked.length === 2 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">Merge duplicate patients</p>
          <p className="mt-1 text-xs text-amber-800">Choose which record to keep. Visit history will be combined.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button onClick={() => merge(picked[0].id, picked[1].id)} className="min-h-11 rounded-xl border border-amber-300 bg-white px-3 py-2 font-semibold">
            Keep {picked[0].name}, remove {picked[1].name}
          </button>
          <button onClick={() => merge(picked[1].id, picked[0].id)} className="min-h-11 rounded-xl border border-amber-300 bg-white px-3 py-2 font-semibold">
            Keep {picked[1].name}, remove {picked[0].name}
          </button>
          </div>
        </div>
      )}

      <ul className="mt-5 flex flex-col gap-3">
        {patients.length === 0 && <li className="admin-card p-6 text-center text-sm text-[#756581]">No patients found.</li>}
        {patients.map((p) => (
          <li key={p.id} className="admin-card p-4 text-sm sm:p-5">
            {editId === p.id ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 font-semibold text-[#49355f]">Full name<input className="border px-3 py-2 font-normal" value={eName} onChange={(e) => setEName(e.target.value)} /></label>
                <label className="flex flex-col gap-1.5 font-semibold text-[#49355f]">Phone<input className="border px-3 py-2 font-normal" value={ePhone} onChange={(e) => setEPhone(e.target.value)} /></label>
                <label className="flex flex-col gap-1.5 font-semibold text-[#49355f] sm:col-span-2">Clinic patient number<input className="border px-3 py-2 font-normal" value={eCid} onChange={(e) => setECid(e.target.value)} /></label>
                <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
                  <button onClick={saveEdit} className="min-h-11 rounded-xl bg-[#6d3aa8] px-4 py-2 font-bold text-white hover:bg-[#572c87]">Save changes</button>
                  <button onClick={() => setEditId("")} className="min-h-11 rounded-xl border border-[#d7c4ea] px-4 py-2 font-semibold text-[#5c327f]">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <label className="flex min-w-0 items-start gap-3">
                  <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name} for merging`} />
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
                </label>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:max-w-md xl:justify-end">
                  <button onClick={() => showHistory(p.id)} className="min-h-10 rounded-xl border border-[#d7c4ea] bg-white px-3 py-2 text-xs font-semibold text-[#5c327f]">History</button>
                  {p.account_id ? (
                    <>
                      <button onClick={() => accountAction(p, "resend")} className="min-h-10 rounded-xl border border-[#d7c4ea] bg-white px-3 py-2 text-xs font-semibold text-[#5c327f]">Resend email</button>
                      <button onClick={() => removeAccess(p)} className="min-h-10 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700">Remove access</button>
                    </>
                  ) : (
                    <button onClick={() => accountAction(p, "create")} className="min-h-10 rounded-xl bg-[#6d3aa8] px-3 py-2 text-xs font-bold text-white">Create account</button>
                  )}
                  <button onClick={() => startEdit(p)} className="min-h-10 rounded-xl border border-[#d7c4ea] bg-white px-3 py-2 text-xs font-semibold text-[#5c327f]">Edit</button>
                </div>
              </div>
            )}
            {openId === p.id && (
              <ul className="mt-4 flex flex-col gap-2 border-t border-[#eee5f7] pt-4 text-xs">
                {hist.length === 0 && <li className="text-[#756581]">No visits recorded yet.</li>}
                {hist.map((h, i) => (
                  <li key={i} className="flex flex-col gap-1 rounded-xl bg-[#faf8ff] p-3 sm:flex-row sm:justify-between">
                    <span>{new Date(h.when).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })} · <b>{h.kind}</b>{h.reason ? ` · ${h.reason}` : ""}</span>
                    <span className="font-semibold capitalize text-[#6d3aa8]">{h.status.replace("_", " ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <section className="admin-card mt-8 p-4 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8b5cb5]">Bulk tools</p>
        <h2 className="mt-1 text-lg font-bold">Import existing patients</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#756581]">
          Upload a CSV file with a header row and these columns: <code>name</code>, <code>phone</code>,
          <code> clinic_id</code> (the clinic&apos;s own patient number, optional). In Excel or Google Sheets, use
          File, then Save as CSV. Up to 2000 rows at a time.
        </p>
        <input type="file" accept=".csv,text/csv" className="mt-4 block w-full rounded-xl border border-dashed border-[#cdb8e5] bg-[#faf8ff] p-4 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#6d3aa8] file:px-3 file:py-2 file:font-semibold file:text-white"
          onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
      </section>
    </div>
  );
}
