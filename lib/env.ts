// Centralized env access with helpful errors. Public vars are inlined by Next
// at build time; server-only vars are read lazily so the client bundle never
// references them. On Cloudflare, the OpenNext adapter copies Worker vars and
// secrets into process.env.

export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .dev.vars.example.`,
    );
  }
  return value;
}

/** Server-only env. Calling these on the client will throw. */
export const serverEnv = {
  get authSecret() {
    return required("AUTH_SECRET");
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
  get resendApiKey() {
    return required("RESEND_API_KEY");
  },
  zoom: {
    accountId: process.env.ZOOM_ACCOUNT_ID ?? "",
    clientId: process.env.ZOOM_CLIENT_ID ?? "",
    clientSecret: process.env.ZOOM_CLIENT_SECRET ?? "",
    webhookSecret: process.env.ZOOM_WEBHOOK_SECRET_TOKEN ?? "",
  },
};

/** True once the core login/runtime secrets are present. */
export function isAppConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET);
}
