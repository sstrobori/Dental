
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/today";

type Row = {
  kind: string;
  happened_at: string;
  clinic: string;
  person: string;
  reason: string | null;
  status: string;
};

const PAGE_SIZE = 10;

const STATUS: Record<string, string> = {
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

function statusClass(status: string): string {
  if (
    status === "served" ||
    status === "completed"
  ) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "confirmed") {
    return "bg-[#F2EAFF] text-[#6D3AA8]";
  }

  if (
    status === "no_show" ||
    status === "cancelled"
  ) {
    return "bg-red-50 text-red-700";
  }

  if (
    status === "waiting" ||
    status === "called" ||
    status === "arrived"
  ) {
    return "bg-[#EDE3F8] text-[#5C327F]";
  }

  return "bg-slate-100 text-slate-600";
}

export default function HistoryView() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const [visibleCount, setVisibleCount] =
    useState(PAGE_SIZE);

  const load = useCallback(async () => {
    setLoaded(false);
    setError("");

    const {
      data,
      error: queryError,
    } = await supabase.rpc("my_history");

    if (queryError) {
      setError(queryError.message);
      setRows([]);
    } else {
      const history = (data ?? []) as Row[];

      // Display newest visits first.
      const sorted = [...history].sort(
        (a, b) =>
          new Date(b.happened_at).getTime() -
          new Date(a.happened_at).getTime()
      );

      setRows(sorted);
    }

    setVisibleCount(PAGE_SIZE);
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  // Show 10 records initially.
  const visibleRows = rows.slice(
    0,
    visibleCount
  );

  const hasMore = visibleCount < rows.length;

  const remaining = Math.max(
    0,
    rows.length - visibleCount
  );

  const nextBatchCount = Math.min(
    PAGE_SIZE,
    remaining
  );

  function loadMore() {
    setVisibleCount((current) =>
      Math.min(current + PAGE_SIZE, rows.length)
    );
  }

  return (
    <div className="flex flex-col gap-5 text-[#2E1747] sm:gap-6">

      {/* VISIT HISTORY HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">

          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#2E1747] sm:text-3xl">
            My History
          </h2>
        </div>

        {/* RECORD COUNT - UPPER RIGHT */}

        {loaded && !error && (
          <span className="shrink-0 rounded-full bg-[#F2EAFF] px-3 py-1.5 text-xs font-semibold text-[#6D3AA8]">
            {rows.length}{" "}
            {rows.length === 1
              ? "record"
              : "records"}
          </span>
        )}
      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}

      {/* VISIT HISTORY LIST - NO OUTER CARD */}

      <section aria-label="Visit history records">

        {/* LOADING STATE */}

        {!loaded && (
          <p
            role="status"
            className="rounded-xl bg-[#FAF8FF] p-4 text-sm text-[#6F647A]"
          >
            Loading visit history…
          </p>
        )}

        {/* EMPTY STATE */}

        {loaded && !error && rows.length === 0 && (
          <p className="rounded-xl bg-[#FAF8FF] p-4 text-sm text-[#6F647A]">
            You have no visit records yet.
          </p>
        )}

        {/* INDIVIDUAL VISIT RECORD CARDS */}

        {loaded && rows.length > 0 && (
          <>
            <ul className="flex flex-col gap-3">

              {visibleRows.map((record, index) => (
              <li
                key={`${record.kind}-${record.happened_at}-${index}`}
                className="rounded-xl border border-[#E4D5F6] bg-white p-4 text-sm shadow-sm"
              >

                  {/* VISIT TYPE AND STATUS */}

                  <div className="flex flex-wrap items-center justify-between gap-2">

                    <p className="font-bold text-[#2E1747]">
                      {record.kind === "appointment"
                        ? "Appointment"
                        : "Walk-in visit"}
                    </p>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
                        record.status
                      )}`}
                    >
                      {STATUS[record.status] ??
                        record.status}
                    </span>
                  </div>

                  {/* VISIT DATE */}

                  <p className="mt-2 font-medium text-[#5C327F]">
                    {formatDateTime(
                      record.happened_at
                    )}
                  </p>

                  {/* CLINIC */}

                  <p className="mt-1 text-[#6F647A]">
                    {record.clinic}
                  </p>

                  {/* PATIENT AND REASON */}

                  <p className="mt-1 text-[#6F647A]">
                    {record.person}

                    {record.reason
                      ? ` · ${record.reason}`
                      : ""}
                  </p>

                </li>
              ))}

            </ul>

            {/* LOAD MORE */}

            {hasMore && (
              <div className="mt-6 flex flex-col items-center gap-3 border-t border-[#F0EAF7] pt-5">

                <p
                  aria-live="polite"
                  className="text-xs text-[#80748B]"
                >
                  Showing {visibleRows.length} of{" "}
                  {rows.length} records
                </p>

                <button
                  type="button"
                  onClick={loadMore}
                  className="min-h-11 w-full rounded-xl border border-[#D7C4EA] bg-white px-5 py-2.5 text-sm font-semibold text-[#6D3AA8] transition hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3] sm:w-auto"
                >
                  Load {nextBatchCount} more
                </button>

              </div>
            )}

            {/* ALL RECORDS LOADED */}

            {!hasMore && rows.length > PAGE_SIZE && (
              <p className="mt-5 border-t border-[#F0EAF7] pt-4 text-center text-xs text-[#80748B]">
                All {rows.length} records displayed
              </p>
            )}

          </>
        )}

      </section>

    </div>
  );
}
