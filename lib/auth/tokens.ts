// One-time login credentials: magic-link tokens (email) and 6-digit codes
// (SMS). Secrets are stored hashed and are single-use with a 15-minute expiry.
import { and, eq, gt } from "drizzle-orm";
import { getDb, tables } from "@/lib/db";
import { randomDigits, randomToken, sha256Hex } from "./crypto";

const TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_SMS_ATTEMPTS = 5;

export async function issueMagicToken(email: string): Promise<string> {
  const token = randomToken(32);
  await getDb()
    .insert(tables.login_tokens)
    .values({
      type: "magic",
      identifier: email.toLowerCase(),
      token_hash: await sha256Hex(token),
      expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    });
  return token;
}

export async function issueSmsCode(phone: string): Promise<string> {
  const code = randomDigits(6);
  await getDb()
    .insert(tables.login_tokens)
    .values({
      type: "sms",
      identifier: phone,
      token_hash: await sha256Hex(code),
      expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    });
  return code;
}

/**
 * Consume a one-time credential. Returns the identifier (email/phone) it was
 * issued for, or null if invalid/expired/used.
 */
export async function consumeToken(
  type: "magic" | "sms",
  identifier: string,
  secret: string,
): Promise<string | null> {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const hash = await sha256Hex(secret);
  const ident = type === "magic" ? identifier.toLowerCase() : identifier;

  const rows = await db
    .select()
    .from(tables.login_tokens)
    .where(
      and(
        eq(tables.login_tokens.type, type),
        eq(tables.login_tokens.identifier, ident),
        eq(tables.login_tokens.consumed, false),
        gt(tables.login_tokens.expires_at, nowIso),
      ),
    )
    .limit(10);

  const match = rows.find((r) => r.token_hash === hash);
  if (!match) {
    // Count the failed guess against every outstanding token so codes can't
    // be brute-forced by spreading attempts across requests.
    for (const r of rows) {
      const attempts = r.attempts + 1;
      await db
        .update(tables.login_tokens)
        .set({ attempts, consumed: attempts >= MAX_SMS_ATTEMPTS })
        .where(eq(tables.login_tokens.id, r.id));
    }
    return null;
  }

  await db
    .update(tables.login_tokens)
    .set({ consumed: true })
    .where(eq(tables.login_tokens.id, match.id));
  return match.identifier;
}
