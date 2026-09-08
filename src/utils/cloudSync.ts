import {
  AuthError,
  MissingIdentityError,
  requestPasswordRecovery,
  getUser,
  handleAuthCallback,
  login,
  logout,
  onAuthChange,
  updateUser,
  type AuthEvent,
  type CallbackResult,
  type User,
} from "@netlify/identity";
import type { AppState } from "../types";

export type CloudSaveStatus = "checking" | "signedOut" | "loading" | "saving" | "saved" | "error" | "localOnly";

export interface CloudProjectResponse {
  state: AppState | null;
  updatedAt: string | null;
  updatedBy?: string | null;
}

export interface CloudStatus {
  user: User | null;
  status: CloudSaveStatus;
  message: string;
  lastSavedAt: string | null;
  lastLoadedAt: string | null;
}

export const initialCloudStatus: CloudStatus = {
  user: null,
  status: "checking",
  message: "Checking account",
  lastSavedAt: null,
  lastLoadedAt: null,
};

export function cloudErrorMessage(error: unknown) {
  if (error instanceof MissingIdentityError) {
    return "Cloud login is available on the deployed Netlify site.";
  }
  if (error instanceof AuthError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong with cloud sync.";
}

export async function initializeIdentity(onChange: (event: AuthEvent, user: User | null) => void) {
  let callbackResult: CallbackResult | null = null;
  try {
    callbackResult = await handleAuthCallback();
  } catch (error) {
    throw new Error(cloudErrorMessage(error));
  }
  const unsubscribe = onAuthChange(onChange);
  const user = await getUser();
  return { user, unsubscribe, callbackResult };
}

export async function signInDirector(email: string, password: string) {
  return login(email.trim(), password);
}

export async function createDirectorAccount(email: string, password: string) {
  const response = await fetch("/.netlify/functions/signup", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  if (!response.ok) {
    const message = await responseErrorMessage(response);
    throw new Error(message || "Could not create account.");
  }
  return login(email.trim(), password);
}

export async function signOutDirector() {
  await logout();
}

export async function requestDirectorPasswordReset(email: string) {
  await requestPasswordRecovery(email.trim());
}

export async function finishDirectorPasswordReset(password: string) {
  return updateUser({ password });
}

const PROJECT_ENDPOINT = "/.netlify/functions/project";

export async function loadCloudProject(): Promise<CloudProjectResponse> {
  const response = await fetch(PROJECT_ENDPOINT, { method: "GET", credentials: "include" });
  if (response.status === 401) return { state: null, updatedAt: null };
  if (!response.ok) throw new Error(await responseErrorMessage(response));
  return response.json();
}

export async function saveCloudProject(state: AppState, clientId: string) {
  const response = await fetch(PROJECT_ENDPOINT, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, clientId }),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response));
  return response.json() as Promise<{ updatedAt: string }>;
}

async function responseErrorMessage(response: Response) {
  const text = await response.text();
  try {
    const body = JSON.parse(text);
    if (typeof body?.error === "string") return body.error;
  } catch {
    return text;
  }
  return text;
}
