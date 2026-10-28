import { redirect } from "next/navigation";

// Backward-compatible entry point for old clinic links and printed QR codes.
// Patient sign-in detection happens in the /guest route and forwards to /patient.
export default async function LegacyPatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { clinicId } = await params;
  const originalQuery = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(originalQuery)) {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else if (typeof value === "string") {
      query.append(key, value);
    }
  }

  const suffix = query.toString();
  redirect(`/guest/${encodeURIComponent(clinicId)}${suffix ? `?${suffix}` : ""}`);
}
