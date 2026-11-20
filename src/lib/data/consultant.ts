import "server-only";
import { createClient } from "@/lib/supabase/server";

/** The signed-in consultant's own row (RLS lets owners read unpublished profiles). */
export async function getMyConsultant(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("consultants")
    .select("*, consultant_countries(country_id), consultant_specialties(specialty_id), consultant_languages(language_code), consultant_qualifications(*), consultant_documents(*)")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}
