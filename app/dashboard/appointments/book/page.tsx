import { Suspense } from "react";
import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ waitlist?: string | string[] }> };

async function RedirectToBookingModal({ searchParams }: Props) {
  const params = await searchParams;
  const query = new URLSearchParams({ book: "1" });
  const waitlist = Array.isArray(params.waitlist) ? params.waitlist[0] : params.waitlist;
  if (waitlist) query.set("waitlist", waitlist);
  return redirect(`/dashboard/appointments?${query.toString()}`);
}

export default function BookAppointmentPage(props: Props) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[#6F647A]">Opening booking form...</p>}>
      <RedirectToBookingModal {...props} />
    </Suspense>
  );
}
