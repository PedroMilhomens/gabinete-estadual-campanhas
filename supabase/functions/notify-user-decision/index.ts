import { z } from "npm:zod@4";
import {
  createAdminClient,
  isAuthorizedWebhook,
  jsonResponse,
  parseRequestBody,
  sendEmail,
} from "../_shared/notifications.ts";

const webhookSchema = z.object({
  type: z.literal("UPDATE"),
  table: z.literal("profiles"),
  schema: z.literal("public"),
  record: z.object({
    id: z.string().uuid(),
    full_name: z.string().trim().min(1).max(200),
    status: z.enum(["pending", "approved", "rejected"]),
  }).passthrough(),
  old_record: z.object({
    status: z.enum(["pending", "approved", "rejected"]),
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
    return jsonResponse("Invalid user decision webhook payload.", 400);
  }

  const { record, old_record: oldRecord } = parsed.data;
  if (
    record.status === oldRecord.status ||
    (record.status !== "approved" && record.status !== "rejected")
  ) {
    return jsonResponse("No user decision notification required.", 200);
  }

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    return jsonResponse("Notification service is not configured.", 500);
  }

  let data: Awaited<
    ReturnType<typeof supabase.auth.admin.getUserById>
  >["data"];
  let error: Awaited<
    ReturnType<typeof supabase.auth.admin.getUserById>
  >["error"];
  try {
    ({ data, error } = await supabase.auth.admin.getUserById(record.id));
  } catch {
    return jsonResponse("Could not load the user email address.", 500);
  }

  if (error) {
    return jsonResponse("Could not load the user email address.", 500);
  }

  const userEmail = data.user?.email;
  if (!userEmail) {
    return jsonResponse("User email address is unavailable.", 500);
  }

  const isApproved = record.status === "approved";
  const subject = isApproved
    ? "Seu cadastro foi aprovado"
    : "Atualização do seu cadastro";
  const text = isApproved
    ? `Olá, ${record.full_name}. Seu cadastro no portal DeMolay Rondônia foi aprovado.`
    : `Olá, ${record.full_name}. Seu cadastro no portal DeMolay Rondônia não foi aprovado. Entre em contato com a administração do seu capítulo para mais informações.`;

  try {
    const sent = await sendEmail(
      [userEmail],
      subject,
      text,
      `user-decision-${record.id}-${record.status}`,
    );

    return sent
      ? jsonResponse("User notified.", 200)
      : jsonResponse("Email provider rejected the notification.", 502);
  } catch {
    return jsonResponse("Email provider request failed.", 502);
  }
}

if (import.meta.main) {
  Deno.serve(handleRequest);
}
