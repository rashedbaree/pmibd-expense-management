import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/types";

export async function getCurrentProfile(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return data as AppUser | null;
}
