import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@4";
import { createAdminClient } from "../_shared/notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const requestSchema = z.object({
  action: z.enum(["export", "delete"]),
  userId: z.string().uuid(),
});

type AdminVerification =
  | { user: { id: string }; error?: never }
  | { error: Response; user?: never };

function response(message: string, status: number, body?: unknown): Response {
  return new Response(
    status === 204 ? null : JSON.stringify(body ?? { message }),
    {
      status,
      headers: {
        ...corsHeaders,
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
    },
  );
}

function withCorsHeaders(result: Response): Response {
  const headers = new Headers(result.headers);
  for (const [name, value] of Object.entries(corsHeaders)) {
    headers.set(name, value);
  }
  return new Response(result.body, {
    status: result.status,
    statusText: result.statusText,
    headers,
  });
}

async function loadPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0;; from += 500) {
    const { data, error } = await loadPage(from, from + 499);
    if (error) {
      throw new Error("Could not load requested account data.");
    }

    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}

async function verifyAdministrator(
  request: Request,
): Promise<AdminVerification> {
  const authorization = request.headers.get("Authorization");
  if (!authorization || !/^Bearer \S+$/.test(authorization)) {
    return { error: response("Authentication required.", 401) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return {
      error: response("Authentication service is not configured.", 500),
    };
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let user: { id: string } | null;
  try {
    const { data, error } = await userClient.auth.getUser();
    if (error || !data.user) {
      return { error: response("Authentication required.", 401) };
    }
    user = data.user;
  } catch {
    return {
      error: response("Authentication could not be verified.", 401),
    };
  }

  try {
    const { data: profile, error } = await userClient
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      return {
        error: response("Authorization could not be verified.", 500),
      };
    }
    if (profile?.role !== "admin" || profile.status !== "approved") {
      return {
        error: response("Approved administrator access required.", 403),
      };
    }
  } catch {
    return {
      error: response("Authorization could not be verified.", 500),
    };
  }

  return { user };
}

async function listUserSubmissions(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  return await loadPages((from, to) =>
    admin
      .from("submissions")
      .select(
        "id, activity_id, chapter_id, description, status, score, reviewed_by, reviewed_at, created_at",
      )
      .eq("submitted_by", userId)
      .range(from, to)
  );
}

async function listUserAttachments(
  admin: ReturnType<typeof createAdminClient>,
  submissionIds: string[],
) {
  const attachments = [];
  for (let index = 0; index < submissionIds.length; index += 100) {
    const ids = submissionIds.slice(index, index + 100);
    attachments.push(
      ...await loadPages((from, to) =>
        admin
          .from("attachments")
          .select("submission_id, storage_path, mime, size_bytes")
          .in("submission_id", ids)
          .range(from, to)
      ),
    );
  }
  return attachments;
}

async function exportUserData(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<Response> {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select(
      "id, full_name, chapter_id, position, role, status, terms_accepted_at, guardian_consent_at, created_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileError) return response("Could not load account data.", 500);
  if (!profile) return response("Account not found.", 404);

  const { data: authResult, error: authError } = await admin.auth.admin
    .getUserById(userId);
  if (authError) return response("Could not load account data.", 500);

  let submissions;
  let attachments;
  let authoredComments;
  let auditEntries;
  try {
    submissions = await listUserSubmissions(admin, userId);
    attachments = await listUserAttachments(
      admin,
      submissions.map(({ id }) => id),
    );
    authoredComments = await loadPages((from, to) =>
      admin
        .from("comments")
        .select("id, submission_id, body, created_at")
        .eq("author_id", userId)
        .range(from, to)
    );
    auditEntries = await loadPages((from, to) =>
      admin
        .from("audit_log")
        .select("id, action, table_name, record_id, created_at")
        .eq("actor_id", userId)
        .range(from, to)
    );
  } catch {
    return response("Could not load account data for export.", 500);
  }

  const ownedSubmissionIds = submissions.map(({ id }) => id);
  const submissionComments = [];
  for (let index = 0; index < ownedSubmissionIds.length; index += 100) {
    const ids = ownedSubmissionIds.slice(index, index + 100);
    try {
      submissionComments.push(
        ...await loadPages((from, to) =>
          admin
            .from("comments")
            .select("id, submission_id, author_id, body, created_at")
            .in("submission_id", ids)
            .range(from, to)
        ),
      );
    } catch {
      return response("Could not load account data for export.", 500);
    }
  }

  const signedUrls = new Map<string, string>();
  for (let index = 0; index < attachments.length; index += 100) {
    const batch = attachments.slice(index, index + 100);
    const { data, error } = await admin.storage
      .from("attachments")
      .createSignedUrls(batch.map(({ storage_path }) => storage_path), 300);
    if (error || !data || data.some(({ signedUrl }) => !signedUrl)) {
      return response("Could not prepare attachment links for export.", 500);
    }
    data.forEach(({ path, signedUrl }) => {
      if (path && signedUrl) signedUrls.set(path, signedUrl);
    });
  }

  const comments = new Map(
    [...authoredComments, ...submissionComments].map((comment) => [
      comment.id,
      comment,
    ]),
  );

  return response("Account data exported.", 200, {
    exported_at: new Date().toISOString(),
    profile,
    account: {
      email: authResult.user?.email ?? null,
      created_at: authResult.user?.created_at ?? null,
      email_confirmed_at: authResult.user?.email_confirmed_at ?? null,
    },
    submissions,
    attachments: attachments.map((attachment) => ({
      ...attachment,
      signed_url: signedUrls.get(attachment.storage_path),
    })),
    comments: [...comments.values()],
    audit_log: auditEntries,
  });
}

async function deleteUserData(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<Response> {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) {
    return response("Could not verify the target account.", 500);
  }
  if (!profile) return response("Account not found.", 404);

  const { data: authUser, error: authUserError } = await admin.auth.admin
    .getUserById(userId);
  if (authUserError || !authUser.user) {
    return response("Could not verify the target account.", 500);
  }

  let submissions;
  let attachments;
  try {
    submissions = await listUserSubmissions(admin, userId);
    attachments = await listUserAttachments(
      admin,
      submissions.map(({ id }) => id),
    );
  } catch {
    return response("Could not prepare account data for deletion.", 500);
  }

  const storagePaths = new Set(
    attachments.map(({ storage_path }) => storage_path),
  );
  for (const { id, chapter_id: chapterId } of submissions) {
    if (!chapterId) continue;

    const directory = `${chapterId}/${id}`;
    for (let offset = 0;; offset += 100) {
      const { data, error } = await admin.storage
        .from("attachments")
        .list(directory, { limit: 100, offset });
      if (error) return response("Could not remove account files.", 500);
      for (const item of data) {
        storagePaths.add(`${directory}/${item.name}`);
      }
      if (data.length < 100) break;
    }
  }

  const paths = [...storagePaths];
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await admin.storage
      .from("attachments")
      .remove(paths.slice(index, index + 100));
    if (error) return response("Could not remove account files.", 500);
  }

  const { error: commentsError } = await admin
    .from("comments")
    .delete()
    .eq("author_id", userId);
  if (commentsError) {
    return response("Could not remove account comments.", 500);
  }

  const { error: reviewedError } = await admin
    .from("submissions")
    .update({ reviewed_by: null })
    .eq("reviewed_by", userId);
  if (reviewedError) {
    return response("Could not remove account review references.", 500);
  }

  const { error: submissionsError } = await admin
    .from("submissions")
    .delete()
    .eq("submitted_by", userId);
  if (submissionsError) {
    return response("Could not remove account submissions.", 500);
  }

  const { error: auditError } = await admin
    .from("audit_log")
    .update({ actor_id: null })
    .eq("actor_id", userId);
  if (auditError) {
    return response("Could not anonymize account audit entries.", 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return response(
      "Account data was removed, but the login could not be deleted.",
      500,
    );
  }

  const { error: auditReferenceError } = await admin
    .from("audit_log")
    .update({ record_id: null })
    .eq("table_name", "profiles")
    .eq("record_id", userId);
  if (auditReferenceError) {
    return response(
      "Account deleted, but profile audit references could not be anonymized.",
      500,
    );
  }

  return response("Account and associated data deleted.", 200);
}

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return response("", 204);
  }
  if (request.method !== "POST") {
    return response("Method not allowed.", 405);
  }

  let verified: Awaited<ReturnType<typeof verifyAdministrator>>;
  try {
    verified = await verifyAdministrator(request);
  } catch {
    return response("Authentication could not be verified.", 401);
  }
  if (verified.error) return withCorsHeaders(verified.error);
  if (!verified.user) {
    return response("Authentication could not be verified.", 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return response("Invalid request body.", 400);
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) return response("Invalid data-rights request.", 400);
  if (
    parsed.data.action === "delete" && parsed.data.userId === verified.user.id
  ) {
    return response(
      "Administrators cannot delete their own account here.",
      400,
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return response("Data-rights service is not configured.", 500);
  }

  try {
    return parsed.data.action === "export"
      ? await exportUserData(admin, parsed.data.userId)
      : await deleteUserData(admin, parsed.data.userId);
  } catch {
    return response("The data-rights request could not be completed.", 500);
  }
}

if (import.meta.main) {
  Deno.serve(handleRequest);
}
