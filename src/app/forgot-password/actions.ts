"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });
  if (error) {
    // Logged server-side only - the user-facing message stays generic so
    // this can't be used to check which addresses have accounts.
    console.error(`resetPasswordForEmail failed for ${email}:`, {
      message: error.message,
      status: error.status,
      code: error.code,
      name: error.name,
    });
  }

  redirect("/forgot-password?sent=1");
}
