import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Browser client. Uses @supabase/ssr's cookie-based storage (not
 * localStorage) so the session is visible to middleware.ts and Server
 * Components — required for server-side route/role guards to work at all.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
