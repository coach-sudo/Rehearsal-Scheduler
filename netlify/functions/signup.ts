import { admin, AuthError } from "@netlify/identity";
import type { Context } from "@netlify/functions";

export default async function handler(request: Request, _context: Context) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  if (origin && origin !== requestOrigin) {
    return json({ error: "Account requests must come from this app." }, 403);
  }

  const body = await readJson(request);
  const email = stringValue(body.email)?.toLowerCase();
  const password = stringValue(body.password);
  const name = stringValue(body.name) ?? email;

  if (!email || !email.includes("@")) return json({ error: "Enter a valid email address." }, 400);
  if (!password || password.length < 8) return json({ error: "Use at least 8 characters for the password." }, 400);

  try {
    const user = await admin.createUser({
      email,
      password,
      data: {
        user_metadata: { full_name: name },
      },
    });
    return json({ id: user.id, email: user.email });
  } catch (error) {
    const message = error instanceof AuthError || error instanceof Error ? error.message : "Could not create account.";
    const status = message.toLowerCase().includes("exist") || message.toLowerCase().includes("already") ? 409 : 400;
    return json({ error: message }, status);
  }
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}
