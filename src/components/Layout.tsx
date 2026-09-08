import { Cloud, CloudOff, Redo2, ShieldCheck, Undo2 } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { CloudStatus } from "../utils/cloudSync";
import Nav, { navItems } from "./Nav";

interface Props {
  active: string;
  onNavigate: (page: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  cloud: CloudStatus;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onPasswordResetRequest: (email: string) => Promise<void>;
  onCompletePasswordReset: (password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  passwordRecoveryMode: boolean;
  sandboxMode: boolean;
  onSandboxModeChange: (enabled: boolean) => void;
  children: ReactNode;
}

export default function Layout({
  active,
  onNavigate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  cloud,
  onSignIn,
  onSignUp,
  onPasswordResetRequest,
  onCompletePasswordReset,
  onSignOut,
  onSyncNow,
  passwordRecoveryMode,
  sandboxMode,
  onSandboxModeChange,
  children,
}: Props) {
  return (
    <div className="min-h-screen">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-white/60 bg-white/70 p-5 shadow-[8px_0_30px_rgba(23,33,31,0.06)] backdrop-blur lg:block">
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Rehearsal</div>
            <h1 className="mt-1 text-2xl font-semibold">Scheduler</h1>
            <p className="mt-2 text-sm text-stone-600">A director's weekly planning desk</p>
          </div>
          <AccountPanel
            cloud={cloud}
            sandboxMode={sandboxMode}
            onSandboxModeChange={onSandboxModeChange}
            onSignIn={onSignIn}
            onSignUp={onSignUp}
            onPasswordResetRequest={onPasswordResetRequest}
            onCompletePasswordReset={onCompletePasswordReset}
            onSignOut={onSignOut}
            onSyncNow={onSyncNow}
            passwordRecoveryMode={passwordRecoveryMode}
          />
          <Nav active={active} onChange={onNavigate} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={onUndo} disabled={!canUndo} className="inline-flex items-center justify-center gap-1 rounded border border-line bg-white px-2 py-2 text-xs font-medium disabled:opacity-40"><Undo2 size={14} /> Undo</button>
            <button onClick={onRedo} disabled={!canRedo} className="inline-flex items-center justify-center gap-1 rounded border border-line bg-white px-2 py-2 text-xs font-medium disabled:opacity-40"><Redo2 size={14} /> Redo</button>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-line bg-panel/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="mb-3 text-lg font-semibold">Rehearsal Scheduler</div>
            <div className="mb-3 flex flex-wrap gap-2">
              <button onClick={onUndo} disabled={!canUndo} className="inline-flex items-center gap-1 rounded border border-line bg-white px-2 py-1 text-xs disabled:opacity-40"><Undo2 size={14} /> Undo</button>
              <button onClick={onRedo} disabled={!canRedo} className="inline-flex items-center gap-1 rounded border border-line bg-white px-2 py-1 text-xs disabled:opacity-40"><Redo2 size={14} /> Redo</button>
              <button
                onClick={() => onSandboxModeChange(!sandboxMode)}
                className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${sandboxMode ? "border-amber-300 bg-amber-50 text-amber-900" : "border-line bg-white"}`}
              >
                <ShieldCheck size={14} /> {sandboxMode ? "Test sandbox" : "Live mode"}
              </button>
              <span className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${cloud.status === "saved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-line bg-white text-stone-600"}`}>
                {cloud.user && !sandboxMode ? <Cloud size={14} /> : <CloudOff size={14} />}
                {cloud.user ? cloud.message : "Local save"}
              </span>
            </div>
            <details className="mb-3 rounded-lg border border-line bg-white p-2">
              <summary className="cursor-pointer text-sm font-semibold">Account and testing</summary>
              <AccountPanel
                cloud={cloud}
                sandboxMode={sandboxMode}
                onSandboxModeChange={onSandboxModeChange}
                onSignIn={onSignIn}
                onSignUp={onSignUp}
                onPasswordResetRequest={onPasswordResetRequest}
                onCompletePasswordReset={onCompletePasswordReset}
                onSignOut={onSignOut}
                onSyncNow={onSyncNow}
                passwordRecoveryMode={passwordRecoveryMode}
              />
            </details>
            <div className="overflow-x-auto">
              <div className="flex min-w-max gap-2">
                {navItems.map(({ id, label }) => (
                  <button key={id} onClick={() => onNavigate(id)} className={`rounded px-3 py-1.5 text-sm ${active === id ? "bg-ink text-white" : "bg-white"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </header>
          <div className="p-4 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function AccountPanel({
  cloud,
  sandboxMode,
  onSandboxModeChange,
  onSignIn,
  onSignUp,
  onPasswordResetRequest,
  onCompletePasswordReset,
  onSignOut,
  onSyncNow,
  passwordRecoveryMode,
}: {
  cloud: CloudStatus;
  sandboxMode: boolean;
  onSandboxModeChange: (enabled: boolean) => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onPasswordResetRequest: (email: string) => Promise<void>;
  onCompletePasswordReset: (password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  passwordRecoveryMode: boolean;
}) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const busy = cloud.status === "checking" || cloud.status === "loading" || cloud.status === "saving";
  const isCloudSaved = cloud.status === "saved";
  const passwordIsLongEnough = password.length >= 8;
  const newPasswordIsLongEnough = newPassword.length >= 8;

  useEffect(() => {
    if (passwordRecoveryMode) setMode("reset");
  }, [passwordRecoveryMode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "signin") await onSignIn(email, password);
    else if (mode === "signup") await onSignUp(email, password);
    else if (mode === "forgot") await onPasswordResetRequest(email);
    else await onCompletePasswordReset(newPassword);
  }

  return (
    <div className={`mt-4 rounded-lg border p-3 text-sm ${sandboxMode ? "border-amber-200 bg-amber-50" : "border-line bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            {cloud.user && !sandboxMode ? <Cloud size={16} /> : <CloudOff size={16} />}
            {sandboxMode ? "Test sandbox" : cloud.user ? "Director account" : "Account"}
          </div>
          <p className={`mt-1 text-xs ${cloud.status === "error" ? "text-coral" : "text-stone-600"}`}>{cloud.message}</p>
        </div>
        <label className="flex shrink-0 items-center gap-1 text-[11px] font-medium">
          <input type="checkbox" checked={sandboxMode} onChange={(event) => onSandboxModeChange(event.target.checked)} />
          Test
        </label>
      </div>

      {cloud.user && !passwordRecoveryMode ? (
        <div className="mt-3 space-y-2">
          <div className="truncate rounded border border-line bg-panel px-2 py-1 text-xs">{cloud.user.email ?? cloud.user.name}</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onSyncNow} disabled={busy || sandboxMode} className="rounded bg-ink px-2 py-1.5 text-xs font-medium text-white disabled:opacity-40">
              {isCloudSaved ? "Synced" : "Sync now"}
            </button>
            <button onClick={onSignOut} className="rounded border border-line bg-white px-2 py-1.5 text-xs font-medium">Sign out</button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <div className="grid grid-cols-3 rounded border border-line bg-panel p-0.5 text-xs">
            <button type="button" onClick={() => setMode("signin")} className={`rounded px-2 py-1 ${mode === "signin" ? "bg-white shadow-sm" : ""}`}>Sign in</button>
            <button type="button" onClick={() => setMode("signup")} className={`rounded px-2 py-1 ${mode === "signup" ? "bg-white shadow-sm" : ""}`}>Create</button>
            <button type="button" onClick={() => setMode("forgot")} className={`rounded px-2 py-1 ${mode === "forgot" || mode === "reset" ? "bg-white shadow-sm" : ""}`}>Reset</button>
          </div>
          {mode === "reset" ? (
            <>
              <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">Enter the new password from your reset email session.</p>
              <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" type="password" className="w-full rounded border border-line px-2 py-1.5 text-xs" />
            </>
          ) : (
            <>
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" className="w-full rounded border border-line px-2 py-1.5 text-xs" />
              {mode !== "forgot" && <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" className="w-full rounded border border-line px-2 py-1.5 text-xs" />}
            </>
          )}
          {(mode === "signup" || mode === "signin") && password && !passwordIsLongEnough && <p className="text-xs text-coral">Use at least 8 characters.</p>}
          {mode === "reset" && newPassword && !newPasswordIsLongEnough && <p className="text-xs text-coral">Use at least 8 characters.</p>}
          <button
            disabled={
              busy ||
              (mode !== "reset" && !email) ||
              ((mode === "signin" || mode === "signup") && !passwordIsLongEnough) ||
              (mode === "reset" && !newPasswordIsLongEnough)
            }
            className="w-full rounded bg-ink px-2 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create and sign in" : mode === "forgot" ? "Send reset email" : "Save new password"}
          </button>
          {mode === "signin" && <button type="button" onClick={() => setMode("forgot")} className="w-full text-left text-xs font-medium text-moss">Forgot password?</button>}
          {mode === "signup" && <p className="text-xs text-stone-600">New accounts are confirmed automatically for this app, so the password should work immediately.</p>}
        </form>
      )}
    </div>
  );
}
