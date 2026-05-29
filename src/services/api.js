// ── Edge Function caller ─────────────────────────────────────────
// Wrapper untuk supabase.functions.invoke() dengan error handling
import { supabase } from "../lib/supabase";

export async function callEdge(fnName, body) {
  const { data, error } = await supabase.functions.invoke(fnName, { body });
  if (error) throw new Error(error.message || "Server error");
  if (data?.error) throw new Error(data.error);
  return data;
}
