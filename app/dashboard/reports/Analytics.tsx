"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayManila } from "@/lib/today";

type Day = { weekday: number; total: number; days: number; per_day: number };
type Mon = { month: number; total: number };
type Data = { first_date: string | null; weeks_used: number; weekdays: Day[]; months: Mon[] };
type Measure = "served" | "all";

type ChartItem = {
  key: number;
  label: string;
  shortLabel: string;
  value: number;
  detail: string;
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SELECT_CLASS = "min-h-11 w-full rounded-xl border border-[#E4D5F6] bg-white px-3 py-2 text-sm font-medium text-[#2E1747] outline-none transition focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]";
const formatNumber = (n: number) => Number(n).toLocaleString("en-PH", { maximumFractionDigits: 1 });

function VerticalBarChart({
  items,
  unit,
  minWidth,
}: {
  items: ChartItem[];
  unit: string;
  minWidth: number;
}) {
  const max = Math.max(0, ...items.map((item) => item.value));

  return (
    <div className="overflow-x-auto pb-1" role="region" aria-label={`${unit} bar chart`} tabIndex={0}>
      <div style={{ minWidth }}>
        <div className="relative h-60 rounded-xl border-b border-[#E4D5F6] bg-[#FCFAFF] px-2 pt-9 sm:h-72 sm:px-4">
          {/* Subtle horizontal grid lines make differences easier to compare. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-2 bottom-0 top-9 sm:inset-x-4">
            {[25, 50, 75, 100].map((percent) => (
              <div
                key={percent}
                className="absolute inset-x-0 border-t border-dashed border-[#E9DEF4]"
                style={{ bottom: `${percent}%` }}
              />
            ))}
          </div>

          <div className="relative z-10 flex h-full items-end gap-2 sm:gap-3" aria-hidden="true">
            {items.map((item) => {
              const isPeak = max > 0 && item.value === max;
              const percent = max ? (item.value / max) * 100 : 0;
              return (
                <div key={item.key} className="flex h-full min-w-0 flex-1 items-end justify-center">
                  <div
                    className={`relative w-full max-w-14 rounded-t-lg transition-[height] duration-300 ${
                      isPeak ? "bg-[#6D3AA8]" : "bg-[#C9B2E6]"
                    }`}
                    style={{ height: percent > 0 ? `${Math.max(percent, 2)}%` : "0%" }}
                    title={item.detail}
                  >
                    <span className={`absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold ${isPeak ? "text-[#5A2E8A]" : "text-[#70617D]"}`}>
                      {formatNumber(item.value)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 px-2 pt-3 sm:gap-3 sm:px-4" aria-hidden="true">
          {items.map((item) => (
            <div key={item.key} className="min-w-0 flex-1 text-center text-[11px] font-semibold text-[#6F647A] sm:text-xs" title={item.label}>
              {item.shortLabel}
            </div>
          ))}
        </div>
      </div>
      <ul className="sr-only">
        {items.map((item) => <li key={item.key}>{item.detail}</li>)}
      </ul>
    </div>
  );
}

function ChartCard({
  eyebrow,
  title,
  description,
  insightLabel,
  insight,
  empty,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  insightLabel: string;
  insight: string;
  empty: boolean;
  children: React.ReactNode;
  footer: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#8B5CB5]">{eyebrow}</p>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-[#2E1747] sm:text-xl">{title}</h3>
          <p className="mt-1 max-w-xl text-sm leading-6 text-[#6F647A]">{description}</p>
        </div>
        {!empty && (
          <div className="w-fit shrink-0 rounded-xl bg-[#F5EFFF] px-4 py-3 sm:max-w-56">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8B5CB5]">{insightLabel}</p>
            <p className="mt-1 text-sm font-bold text-[#5A2E8A]">{insight}</p>
          </div>
        )}
      </div>
      {empty ? (
        <div className="mt-6 rounded-xl bg-[#FAF8FF] px-4 py-10 text-center text-sm text-[#6F647A]">No visits recorded for this period yet.</div>
      ) : (
        <div className="mt-6">{children}</div>
      )}
      <p className="mt-5 border-t border-[#F0EAF7] pt-4 text-xs leading-5 text-[#80748B]">{footer}</p>
    </section>
  );
}

export default function Analytics({ clinicId }: { clinicId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const thisYear = Number(todayManila().slice(0, 4));
  const currentMonth = Number(todayManila().slice(5, 7));
  const [measure, setMeasure] = useState<Measure>("served");
  const [weeks, setWeeks] = useState(12);
  const [year, setYear] = useState(thisYear);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [firstAvailableYear, setFirstAvailableYear] = useState(thisYear);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setError("");
      setLoading(true);
      const { data: result, error: queryError } = await supabase.rpc("peak_analytics", {
        p_clinic_id: clinicId,
        p_weeks: weeks,
        p_year: year,
        p_measure: measure,
      });
      if (cancelled) return;
      if (queryError) {
        setData(null);
        setError(queryError.message);
      } else {
        const next = result as Data;
        setData(next);
        if (next.first_date) {
          const first = Number(next.first_date.slice(0, 4));
          if (Number.isFinite(first)) setFirstAvailableYear(first);
        }
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [supabase, clinicId, weeks, year, measure]);

  const years: number[] = [];
  for (let y = thisYear; y >= Math.min(firstAvailableYear, thisYear); y--) years.push(y);

  const days = data?.weekdays ?? [];
  const weekdayItems: ChartItem[] = DAY_NAMES.map((name, index) => {
    const d = days.find((item) => item.weekday === index + 1);
    const value = Number(d?.per_day ?? 0);
    return {
      key: index + 1,
      label: name,
      shortLabel: name.slice(0, 3),
      value,
      detail: `${name}: ${formatNumber(value)} patients per day on average; ${Number(d?.total ?? 0)} visits total`,
    };
  });
  const peakDayValue = Math.max(0, ...weekdayItems.map((item) => item.value));
  const topDays = weekdayItems.filter((item) => peakDayValue > 0 && item.value === peakDayValue);

  const months = data?.months ?? [];
  const monthItems: ChartItem[] = MONTH_NAMES.map((name, index) => {
    const m = months.find((item) => item.month === index + 1);
    const value = Number(m?.total ?? 0);
    return {
      key: index + 1,
      label: name,
      shortLabel: name.slice(0, 3),
      value,
      detail: `${name} ${year}: ${formatNumber(value)} total visits`,
    };
  });
  const peakMonthValue = Math.max(0, ...monthItems.map((item) => item.value));
  const topMonths = [...monthItems]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  return (
    <section className="space-y-5" aria-labelledby="busy-patterns-heading">

      <div className="grid gap-4 rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:grid-cols-3 sm:p-5 xl:min-h-[126px]">
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#49365E]">
          Count
          <select className={SELECT_CLASS} value={measure} onChange={(e) => setMeasure(e.target.value as Measure)}>
            <option value="served">Patients served</option>
            <option value="all">Everyone who joined</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#49365E]">
          Weekday period
          <select className={SELECT_CLASS} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
            {[4, 8, 12, 26, 52].map((w) => <option key={w} value={w}>Last {w} weeks</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#49365E]">
          Monthly year
          <select className={SELECT_CLASS} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}
      {loading && <p role="status" className="rounded-xl border border-[#E4D5F6] bg-white p-5 text-sm text-[#6F647A]">Loading visit trends…</p>}

      {data && !loading && (
        <div className="grid gap-5">
          <ChartCard
            eyebrow="Weekly pattern"
            title="Busiest day of the week"
            description="Typical patients per weekday, averaged over the selected period."
            insightLabel="Peak weekday"
            insight={`${topDays.map((item) => item.label).join(" & ")} · ${formatNumber(peakDayValue)} per day`}
            empty={peakDayValue === 0}
            footer={`Based on ${data.weeks_used} ${data.weeks_used === 1 ? "week" : "weeks"} of available data.${data.weeks_used < 4 ? " A short history may not reflect the usual pattern." : ""}`}
          >
            <VerticalBarChart items={weekdayItems} unit="Average patients per weekday" minWidth={400} />
          </ChartCard>

          <ChartCard
            eyebrow="Yearly pattern"
            title={`Busiest months of ${year}`}
            description="Total patient visits recorded each month of the selected year."
            insightLabel="Top months"
            insight={topMonths.map((item) => item.label).join(", ")}
            empty={peakMonthValue === 0}
            footer={`Monthly totals, not daily averages.${year === thisYear ? ` ${MONTH_NAMES[currentMonth - 1]} is still in progress; later months may have no data.` : ""} Seasonal trends become more reliable with a full year of data.`}
          >
            <VerticalBarChart items={monthItems} unit="Total visits per month" minWidth={620} />
          </ChartCard>
        </div>
      )}
    </section>
  );
}
