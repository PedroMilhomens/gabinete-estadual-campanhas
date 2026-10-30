import { z } from "npm:zod@4";
import {
  createAdminClient,
  isAuthorizedWebhook,
  jsonResponse,
  parseRequestBody,
  sendEmail,
} from "../_shared/notifications.ts";

const webhookSchema = z.object({
  type: z.literal("INSERT"),
  table: z.literal("profiles"),
  schema: z.literal("public"),
  record: z.object({
    id: z.string().uuid(),
    full_name: z.string().trim().min(1).max(200),
  }).passthrough(),
});

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse("Method not allowed.", 405);
  }

  if (!isAuthorizedWebhook(request)) {
    return jsonResponse("Unauthorized.", 401);
  }

  const parsed = webhookSchema.safeParse(await parseRequestBody(request));
  if (!parsed.success) {
    return jsonResponse("Invalid signup webhook payload.", 400);
  }

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    return jsonResponse("Notification service is not configured.", 500);
  }

  let reviewers: { id: string }[];
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["reviewer", "admin"])
      .eq("status", "approved");

    if (error) {
      return jsonResponse("Could not load notification recipients.", 500);
    }

    reviewers = data;
  } catch {
    return jsonResponse("Could not load notification recipients.", 500);
  }

  if (reviewers.length === 0) {
    return jsonResponse("No approved reviewers or admins to notify.", 200);
  }

  let userResults: Awaited<
    ReturnType<typeof supabase.auth.admin.getUserById>
  >[];
  try {
    userResults = await Promise.all(
      reviewers.map(({ id }) => supabase.auth.admin.getUserById(id)),
    );
  } catch {
    return jsonResponse("Could not load notification recipients.", 500);
  }
  if (userResults.some(({ error: userError }) => userError)) {
    return jsonResponse("Could not load notification recipients.", 500);
  }

  const recipients = reviewers.flatMap(({ id }, index) => {
    const email = userResults[index].data.user?.email;
    return email ? [{ id, email }] : [];
  });
  if (recipients.length === 0) {
    return jsonResponse("No email addresses available for notification.", 200);
  }

  try {
    const sendResults = await Promise.all(
      recipients.map(({ id, email }) =>
        sendEmail(
          [email],
          "Novo cadastro aguardando aprovação",
          `Um novo cadastro de ${parsed.data.record.full_name} está aguardando aprovação no portal DeMolay Rondônia.`,
          `new-signup-${parsed.data.record.id}-${id}`,
        )
      ),
    );

    return sendResults.every(Boolean)
      ? jsonResponse("Reviewers notified.", 200)
      : jsonResponse("Email provider rejected the notification.", 502);
  } catch {
    return jsonResponse("Email provider request failed.", 502);
  }
}

if (import.meta.main) {
  Deno.serve(handleRequest);
}
