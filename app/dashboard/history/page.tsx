"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Patient = {
  id: string;
  name: string;
  phone: string | null;
  clinic_patient_id: string | null;
  is_minor: boolean;
  visit_count: number;
  last_visit_at: string | null;
};

const PAGE_SIZE = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dateLabel(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("en-PH", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "No visits yet";
}

export default function HistoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [clinicId, setClinicId] = useState("");
  const [accessLoading, setAccessLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Keep existing links from the Patients directory working.
  useEffect(() => {
    const patientId = new URLSearchParams(window.location.search).get("patient");
    if (patientId && UUID.test(patientId)) {
      router.replace(`/dashboard/history/${encodeURIComponent(patientId)}`);
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    async function identifyClinic() {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !user) {
        setError("Please sign in to view clinic patient records.");
        setAccessLoading(false);
        setLoading(false);
        return;
      }
      const { data, error: staffError } = await supabase
        .from("clinic_staff")
        .select("clinic_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (staffError || !data?.clinic_id) {
        setError(staffError?.message ?? "No clinic is linked to this staff account.");
      } else {
        setClinicId(data.clinic_id);
      }
      setAccessLoading(false);
      if (!data?.clinic_id) setLoading(false);
    }
    void identifyClinic();
    return () => { active = false; };
  }, [supabase]);

  useEffect(() => {
    if (!clinicId) return;
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const clean = search.replace(/[,()%*\\]/g, "").trim();
      const start = (page - 1) * PAGE_SIZE;
      let query = supabase
        .from("patients")
        .select("id, name, phone, clinic_patient_id, is_minor, visit_count, last_visit_at", { count: "exact" })
        .eq("clinic_id", clinicId)
        .order("last_visit_at", { ascending: false, nullsFirst: false })
        .order("name", { ascending: true })
        .range(start, start + PAGE_SIZE - 1);
      if (clean) {
        query = query.or(`name.ilike.%${clean}%,phone.ilike.%${clean}%,clinic_patient_id.ilike.%${clean}%`);
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
  }, [supabase, clinicId, search, page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="w-full px-4 pb-10 pt-6 text-[#2E1747] sm:px-6 sm:pt-8 lg:px-8">
      <header className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B5CB5]">Patient records</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Visit history</h1>
        <p className="mt-1 text-sm text-[#756581]">Find a patient and open their complete visit history.</p>
      </header>

      <section aria-label="Patient history directory" className="overflow-hidden rounded-2xl border border-[#E4D5F6] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#EEE7F6] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <label className="block w-full max-w-md text-sm font-semibold text-[#49355F]">
            Search patients
            <input
              type="search"
              autoComplete="off"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Name, phone, or patient ID"
              className="mt-2 min-h-11 w-full rounded-xl border border-[#E4D5F6] bg-[#FAF8FF] px-4 text-sm font-normal outline-none focus:border-[#6D3AA8] focus:ring-4 focus:ring-[#F2EAFF]"
            />
          </label>
          <span className="shrink-0 rounded-full bg-[#F2EAFF] px-3 py-1.5 text-xs font-bold text-[#6D3AA8]">
            {loading || accessLoading ? "Loading…" : `${total} ${total === 1 ? "patient" : "patients"}`}
          </span>
        </div>

        {error && <p role="alert" className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {!error && (loading || accessLoading) && <p role="status" className="p-6 text-sm text-[#756581]">Loading patients…</p>}
        {!error && !loading && !accessLoading && patients.length === 0 && (
          <p className="p-8 text-center text-sm text-[#756581]">{search ? "No patients match your search." : "No patients found in this clinic."}</p>
        )}

        {!error && !loading && patients.length > 0 && (
          <>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-[#FAF8FF] text-xs font-bold uppercase tracking-wide text-[#756581]">
                  <tr>
                    <th scope="col" className="px-5 py-3">Patient</th>
                    <th scope="col" className="px-4 py-3">Contact / Patient ID</th>
                    <th scope="col" className="px-4 py-3">Visits</th>
                    <th scope="col" className="px-4 py-3">Last visit</th>
                    <th scope="col" className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEE7F6]">
                  {patients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-[#FCFAFF]">
                      <td className="px-5 py-3 font-semibold">
                        <span className="break-words">{patient.name}</span>
                        {patient.is_minor && <span className="ml-2 rounded-full bg-[#F2EAFF] px-2 py-0.5 text-[10px] font-bold text-[#6D3AA8]">Minor</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#756581]">
                        <span className="block">{patient.phone || "No phone"}</span>
                        {patient.clinic_patient_id && <span className="mt-1 block">ID: {patient.clinic_patient_id}</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums">{patient.visit_count}</td>
                      <td className="px-4 py-3 text-xs text-[#756581]">{dateLabel(patient.last_visit_at)}</td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/dashboard/history/${encodeURIComponent(patient.id)}`}
                          className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl border border-[#D7C4EA] bg-[#F9F5FF] px-3 text-xs font-bold text-[#6D3AA8] transition hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6]"
                        >
                          View history
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Compact rows on phones avoid horizontal scrolling. */}
            <ul className="divide-y divide-[#EEE7F6] sm:hidden">
              {patients.map((patient) => (
                <li key={patient.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{patient.name}{patient.is_minor ? " · Minor" : ""}</p>
                    <p className="mt-1 truncate text-xs text-[#756581]">{patient.clinic_patient_id ? `ID: ${patient.clinic_patient_id}` : patient.phone || "No phone"}</p>
                    <p className="mt-1 text-xs text-[#756581]">{patient.visit_count} {patient.visit_count === 1 ? "visit" : "visits"} · {dateLabel(patient.last_visit_at)}</p>
                  </div>
                  <Link
                    href={`/dashboard/history/${encodeURIComponent(patient.id)}`}
                    aria-label={`View history for ${patient.name}`}
                    className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-[#F2EAFF] px-3 text-xs font-bold text-[#6D3AA8]"
                  >View history</Link>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEE7F6] bg-[#FCFAFF] px-4 py-3 text-xs text-[#756581] sm:px-5">
              <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="min-h-9 rounded-lg border border-[#E4D5F6] bg-white px-3 font-semibold text-[#6D3AA8] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <span className="tabular-nums">{page} / {pageCount}</span>
                <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="min-h-9 rounded-lg border border-[#E4D5F6] bg-white px-3 font-semibold text-[#6D3AA8] disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
