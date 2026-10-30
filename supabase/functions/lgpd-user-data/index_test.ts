import { handleRequest } from "./index.ts";

Deno.test("LGPD endpoint rejects unauthenticated requests and supports preflight", async () => {
  const unauthenticated = await handleRequest(
    new Request("https://example.test", { method: "POST" }),
  );
  if (unauthenticated.status !== 401) {
    throw new Error("Unauthenticated requests must be rejected.");
  }

  const wrongMethod = await handleRequest(
    new Request("https://example.test", { method: "GET" }),
  );
  if (wrongMethod.status !== 405) {
    throw new Error("Only POST requests should be accepted.");
  }

  const preflight = await handleRequest(
    new Request("https://example.test", { method: "OPTIONS" }),
  );
  if (
    preflight.status !== 204 ||
    !preflight.headers.has("Access-Control-Allow-Origin")
  ) {
    throw new Error("Browser preflight requests should be supported.");
  }
});
