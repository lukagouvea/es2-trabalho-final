import { cleanUploads } from "./upload-cleanup.js";
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key)
  throw new Error(
    "Configure SUPABASE_URL e SUPABASE_SECRET_KEY somente no ambiente do operador.",
  );
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
await cleanUploads(client, process.argv.includes("--apply"));
