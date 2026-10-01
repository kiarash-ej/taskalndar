// NEXT_PUBLIC_* values are inlined at build time, so they must be read with
// these literal property accesses (not process.env[name]).
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
