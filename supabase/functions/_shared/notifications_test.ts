import { handleRequest as handleNewSignup } from "../notify-new-signup/index.ts";
import { handleRequest as handleUserDecision } from "../notify-user-decision/index.ts";

Deno.test("notification webhooks reject missing or invalid shared secrets", async () => {
  const previousSecret = Deno.env.get("DATABASE_WEBHOOK_SECRET");
  Deno.env.set("DATABASE_WEBHOOK_SECRET", "test-webhook-secret");

  try {
    for (const handle of [handleNewSignup, handleUserDecision]) {
      const missingSecret = await handle(
        new Request("https://example.test", { method: "POST" }),
      );
      if (missingSecret.status !== 401) {
        throw new Error("Webhook without a secret must be rejected.");
      }

      const invalidSecret = await handle(
        new Request("https://example.test", {
          method: "POST",
          headers: { "x-webhook-secret": "incorrect" },
        }),
      );
      if (invalidSecret.status !== 401) {
        throw new Error("Webhook with an invalid secret must be rejected.");
      }

      const jwtOnly = await handle(
        new Request("https://example.test", {
          method: "POST",
          headers: { Authorization: "Bearer test-webhook-secret" },
        }),
      );
      if (jwtOnly.status !== 401) {
        throw new Error("Bearer tokens must not replace the webhook secret.");
      }

      const invalidPayload = await handle(
        new Request("https://example.test", {
          method: "POST",
          headers: { "x-webhook-secret": "test-webhook-secret" },
          body: "{invalid",
        }),
      );
      if (invalidPayload.status !== 400) {
        throw new Error("Malformed webhook payloads must be rejected.");
      }
    }

    const unchangedDecision = await handleUserDecision(
      new Request("https://example.test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": "test-webhook-secret",
        },
        body: JSON.stringify({
          type: "UPDATE",
          table: "profiles",
          schema: "public",
          record: {
            id: "c4ff0cab-1769-4c53-9760-461805747c57",
            full_name: "Test User",
            status: "pending",
          },
          old_record: { status: "pending" },
        }),
      }),
    );
    if (unchangedDecision.status !== 200) {
      throw new Error("Unchanged profile statuses must not trigger email.");
    }
  } finally {
    if (previousSecret === undefined) {
      Deno.env.delete("DATABASE_WEBHOOK_SECRET");
    } else {
      Deno.env.set("DATABASE_WEBHOOK_SECRET", previousSecret);
    }
  }
});
