export type HistoryRow = {
  kind: string;
  happened_at: string;
  clinic: string;
  person: string;
  reason: string | null;
  status: string;
  // Optional: if you later add a stable patient ID to the my_history RPC,
  // the list will automatically group by ID instead of patient name + clinic.
  patient_id?: string | null;
};

export type PatientHistoryGroup = {
  key: string;
  person: string;
  clinic: string;
  records: HistoryRow[];
  latest: HistoryRow;
};

export const HISTORY_STATUS: Record<string, string> = {
  served: "Completed",
  completed: "Completed",
  no_show: "Missed",
  cancelled: "Cancelled",
  skipped: "Skipped",
  waiting: "In line",
  called: "Called",
  booked: "Booked",
  confirmed: "Confirmed",
  arrived: "Checked in",
};

export function historyStatusClass(status: string): string {
  if (status === "served" || status === "completed") {
    return "bg-emerald-50 text-emerald-700";
  }
  if (status === "confirmed" || status === "booked") {
    return "bg-blue-50 text-blue-700";
  }
  if (status === "no_show" || status === "cancelled") {
    return "bg-red-50 text-red-700";
  }
  if (status === "waiting" || status === "called" || status === "arrived") {
    return "bg-[#F2EAFF] text-[#6D3AA8]";
  }
  return "bg-slate-100 text-slate-600";
}

function identityOf(record: HistoryRow): string {
  if (record.patient_id) return `id:${record.patient_id}`;
  // Existing my_history only returns person names, not IDs.
  // Pair with clinic to avoid combining similarly named patients from
  // different clinics. Add patient_id to the RPC for full disambiguation.
  return `name:${record.clinic.trim().toLowerCase()}|${record.person.trim().toLowerCase()}`;
}

function keyForIdentity(value: string): string {
  // Deterministic, URL-safe identifier without placing names in the URL.
  // This is a lookup key, not an authorization credential.
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (const symbol of value) {
    const code = symbol.codePointAt(0) ?? 0;
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x01000193);
  }
  return [first, second]
    .map((value) => (value >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

export function groupHistoryByPatient(rows: HistoryRow[]): PatientHistoryGroup[] {
  const grouped = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    const identity = identityOf(row);
    const existing = grouped.get(identity) ?? [];
    existing.push(row);
    grouped.set(identity, existing);
  }

  return [...grouped.entries()]
    .map(([identity, records]) => {
      const sorted = [...records].sort(
        (a, b) => new Date(b.happened_at).getTime() - new Date(a.happened_at).getTime()
      );
      return {
        key: keyForIdentity(identity),
        person: sorted[0].person,
        clinic: sorted[0].clinic,
        records: sorted,
        latest: sorted[0],
      };
    })
    .sort(
      (a, b) =>
        new Date(b.latest.happened_at).getTime() -
        new Date(a.latest.happened_at).getTime()
    );
}
