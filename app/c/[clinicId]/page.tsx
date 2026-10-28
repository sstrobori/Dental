
import { Suspense } from "react";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ clinicId: string }>;
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

// Handles the old clinic URLs.
async function RedirectToGuest({
  params,
  searchParams,
}: Props) {
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

return redirect(
  `/guest/${encodeURIComponent(clinicId)}${
    suffix ? `?${suffix}` : ""
  }`
);
}

// Suspense handles runtime URL data during prerendering.
export default function LegacyPatientPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#FAF8FF] text-[#6D3AA8]">
          <p className="text-sm font-semibold">
            Redirecting to clinic portal...
          </p>
        </main>
      }
    >
      <RedirectToGuest {...props} />
    </Suspense>
  );
}
