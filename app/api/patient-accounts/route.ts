import { NextResponse } from "next/server";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// Staff only: create a patient account (sends a setup email) or resend the setup email.
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return fail("SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local and restart the server.", 500);
  }

  // 1. The caller must be logged-in clinic staff.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Not logged in.", 401);

  const body = (await request.json().catch(() => null)) as
    { action?: string; patientId?: string; email?: string } | null;
  if (!body || !body.patientId || !UUID.test(body.patientId)) return fail("Missing patient.");

  // Row Level Security only shows patients from the staff member's own clinic.
  const { data: patient } = await supabase
    .from("patients").select("id, clinic_id, name, account_id").eq("id", body.patientId).maybeSingle();
  if (!patient) return fail("Patient not found.", 404);

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const redirectTo = `${site}/welcome?clinic=${patient.clinic_id}`;
  const admin = createSupabase(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // ---------- resend the setup email ----------
  if (body.action === "resend") {
    if (!patient.account_id) return fail("This patient has no account yet.");
    const { data: u } = await admin.auth.admin.getUserById(patient.account_id);
    const address = u?.user?.email;
    if (!address) return fail("Could not find the account email.");

    // Implicit flow, so the link works even though it is not opened in the same browser.
    const mailer = createSupabase(url, anonKey, {
      auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false },
    });
    const { error } = await mailer.auth.resetPasswordForEmail(address, { redirectTo });
    if (error) return fail(error.message);
    return NextResponse.json({ message: `Setup email sent to ${address}.` });
  }

  // ---------- create an account ----------
  if (body.action !== "create") return fail("Unknown action.");
  if (patient.account_id) return fail("This patient already has an account.");

  const address = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(address)) return fail("Enter a valid email address.");

  // If the email already has a patient account (for example a parent with several children),
  // link this person to it instead of creating a second account.
  const { data: existingId } = await admin.rpc("find_user_by_email", { p_email: address });
  if (existingId) {
    const { data: isPatient } = await admin
      .from("patient_accounts").select("user_id").eq("user_id", existingId).maybeSingle();
    if (!isPatient) return fail("That email already belongs to a different kind of account, such as clinic staff. Use another email.");
    await admin.from("patients").update({ account_id: existingId }).eq("id", patient.id);
    await admin.from("audit_log").insert({ clinic_id: patient.clinic_id, actor: user.id, action: "patient_account_linked", detail: null });
    return NextResponse.json({ message: `${patient.name} was added to the existing account for ${address}. They can already sign in.` });
  }

  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(address, {
    redirectTo,
    data: { display_name: patient.name },
  });
  if (error || !invited?.user) return fail(error?.message ?? "Could not send the invitation.");

  await admin.from("patient_accounts").insert({ user_id: invited.user.id, display_name: patient.name });
  await admin.from("patients").update({ account_id: invited.user.id }).eq("id", patient.id);
  await admin.from("audit_log").insert({ clinic_id: patient.clinic_id, actor: user.id, action: "patient_account_created", detail: null });

  return NextResponse.json({ message: `Setup email sent to ${address}. The patient opens it to choose a password.` });
}