// Centralized env access with helpful errors. Public vars are inlined by Next
// at build time; server-only vars are read lazily so the client bundle never
// references them.

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`,
    );
  }
  return value;
}

/** Server-only env. Calling these on the client will throw. */
export const serverEnv = {
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get anthropicApiKey() {
    return required("ANTHROPIC_API_KEY");
  },
  get openaiApiKey() {
    return required("OPENAI_API_KEY");
  },
  get pdfRenderToken() {
    return required("PDF_RENDER_TOKEN");
  },
  zoom: {
    accountId: process.env.ZOOM_ACCOUNT_ID ?? "",
    clientId: process.env.ZOOM_CLIENT_ID ?? "",
    clientSecret: process.env.ZOOM_CLIENT_SECRET ?? "",
    webhookSecret: process.env.ZOOM_WEBHOOK_SECRET_TOKEN ?? "",
  },
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}
