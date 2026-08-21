// Custom Worker entrypoint: serves the Next.js app via the OpenNext handler
// and adds a `scheduled` handler so the wrangler cron trigger can run the
// weekly reminders without an external cron service.
import type {
  ExecutionContext,
  ExportedHandler,
  ScheduledController,
} from "@cloudflare/workers-types";
// @ts-expect-error generated at build time by `opennextjs-cloudflare build`
import handler from "./.open-next/worker.js";

interface Env {
  CRON_SECRET?: string;
  NEXT_PUBLIC_APP_URL?: string;
}

export default {
  fetch: handler.fetch,

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) {
    const base = env.NEXT_PUBLIC_APP_URL ?? "http://localhost";
    const request = new Request(`${base}/api/cron/reminders`, {
      headers: { authorization: `Bearer ${env.CRON_SECRET ?? ""}` },
    });
    ctx.waitUntil(handler.fetch(request, env, ctx));
  },
} satisfies ExportedHandler<Env>;
