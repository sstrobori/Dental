// "Add to calendar" for Google, and a .ics file for Apple, Outlook and others.

export type CalEvent = { id: string; title: string; start: Date; end: Date; details: string };

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function googleCalendarUrl(e: CalEvent): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.start)}/${stamp(e.end)}`,
    details: e.details,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function downloadIcs(e: CalEvent) {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ChairFlow//EN", "BEGIN:VEVENT",
    `UID:${e.id}@chairflow`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`,
    `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(e.details)}`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "appointment.ics";
  a.click();
  URL.revokeObjectURL(url);
}