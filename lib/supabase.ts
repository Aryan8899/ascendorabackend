import { createClient } from "@supabase/supabase-js";

// Service-role key sirf backend mein. Frontend mein kabhi mat daalna.
export const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export const BUCKET = "candidate-files";
