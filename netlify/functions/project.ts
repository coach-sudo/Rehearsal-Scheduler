import { connectLambda, getStore } from "@netlify/blobs";
import type { Handler, HandlerContext, HandlerEvent, HandlerResponse } from "@netlify/functions";

const headers = {
  "Content-Type": "application/json",
};

const handler: Handler = async (event, context) => {
  connectLambda(event as unknown as Parameters<typeof connectLambda>[0]);
  const user = getContextUser(context);
  if (!user?.id) {
    return json({ error: "Sign in to save your rehearsal project." }, 401);
  }

  const store = getStore("rehearsal-projects");
  const key = `users/${user.id}/project.json`;

  if (event.httpMethod === "GET") {
    const saved = await store.get(key, { type: "json" });
    if (!saved) return json({ state: null, updatedAt: null });
    return json(saved);
  }

  if (event.httpMethod === "PUT") {
    const body = parseBody(event);
    if (!isProjectPayload(body)) {
      return json({ error: "Project data was not valid." }, 400);
    }

    const updatedAt = new Date().toISOString();
    await store.setJSON(key, {
      version: 1,
      updatedAt,
      updatedBy: stringValue((body as { clientId?: unknown }).clientId) ?? null,
      owner: user.email ?? user.id,
      state: body.state,
    });

    return json({ updatedAt });
  }

  if (event.httpMethod === "DELETE") {
    await store.delete(key);
    return json({ deleted: true });
  }

  return json({ error: "Method not allowed." }, 405);
};

function getContextUser(context: HandlerContext): { id?: string; email?: string } | null {
  const user = context.clientContext?.user;
  if (!user || typeof user !== "object") return null;
  const record = user as Record<string, unknown>;
  return {
    id: stringValue(record.sub) ?? stringValue(record.id),
    email: stringValue(record.email),
  };
}

function parseBody(event: HandlerEvent) {
  if (!event.body) return null;
  try {
    const body = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function isProjectPayload(value: unknown): value is { state: Record<string, unknown> } {
  if (!value || typeof value !== "object" || !("state" in value)) return false;
  const state = (value as { state: unknown }).state;
  return Boolean(state && typeof state === "object" && "actors" in state && "settings" in state);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function json(body: unknown, statusCode = 200): HandlerResponse {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

export { handler };
