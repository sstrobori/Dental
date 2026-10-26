import { redirect } from "next/navigation";

export const instant = false;

// Old link: patients now use one page.
export default async function BookRedirect({ params }: { params: Promise<{ clinicId: string }> }) {
  const { clinicId } = await params;
  redirect(`/c/${clinicId}?tab=book`);
}
