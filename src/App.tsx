import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AppState } from "./types";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ActorsPage from "./pages/ActorsPage";
import CastingPage from "./pages/CastingPage";
import AvailabilityPage from "./pages/AvailabilityPage";
import BeatsPage from "./pages/BeatsPage";
import OverridesPage from "./pages/OverridesPage";
import PlannerPage from "./pages/PlannerPage";
import SchedulePage from "./pages/SchedulePage";
import ScheduleDesignerPage from "./pages/ScheduleDesignerPage";
import ProgressPage from "./pages/ProgressPage";
import SettingsPage from "./pages/SettingsPage";
import ImportExportPage from "./pages/ImportExportPage";
import { createBlankState, loadState, normalizeState, SANDBOX_MODE_KEY, SANDBOX_STORAGE_KEY, saveState, STORAGE_KEY } from "./utils/storage";
import {
  cloudErrorMessage,
  createDirectorAccount,
  initialCloudStatus,
  initializeIdentity,
  loadCloudProject,
  finishDirectorPasswordReset,
  saveCloudProject,
  signInDirector,
  signOutDirector,
  requestDirectorPasswordReset,
  type CloudStatus,
} from "./utils/cloudSync";

const CLIENT_ID_KEY = "rehearsal-scheduler-client-id";
const LOCAL_PROJECT_OWNER_KEY = "rehearsal-scheduler-local-project-owner";

interface AppContextValue {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  cloud: CloudStatus;
  sandboxMode: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppState must be used inside AppContext");
  return context;
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [sandboxMode, setSandboxMode] = useState(() => localStorage.getItem(SANDBOX_MODE_KEY) === "true");
  const [state, setState] = useState<AppState>(() => loadState(localStorage.getItem(SANDBOX_MODE_KEY) === "true" ? SANDBOX_STORAGE_KEY : STORAGE_KEY));
  const [past, setPast] = useState<AppState[]>([]);
  const [future, setFuture] = useState<AppState[]>([]);
  const [cloud, setCloud] = useState<CloudStatus>(initialCloudStatus);
  const [cloudReady, setCloudReady] = useState(false);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);
  const stateRef = useRef(state);
  const sandboxRef = useRef(sandboxMode);
  const lastCloudJson = useRef("");
  const lastCloudUpdatedAt = useRef<string | null>(null);
  const clientId = useRef(getClientId());
  const cloudSaveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    sandboxRef.current = sandboxMode;
  }, [sandboxMode]);

  async function loadProjectForUser(user: CloudStatus["user"]) {
    if (!user) return;
    if (sandboxRef.current) {
      setCloud({
        user,
        status: "localOnly",
        message: "Test sandbox: cloud sync paused",
        lastSavedAt: null,
        lastLoadedAt: null,
      });
      return;
    }
    setCloudReady(false);
    setCloud((current) => ({ ...current, user, status: "loading", message: "Loading your saved project" }));
    try {
      const remote = await loadCloudProject();
      if (remote.state) {
        const normalizedRemote = normalizeState(remote.state);
        setState(normalizedRemote);
        stateRef.current = normalizedRemote;
        localStorage.setItem(LOCAL_PROJECT_OWNER_KEY, cloudUserKey(user));
        lastCloudJson.current = JSON.stringify(normalizedRemote);
        lastCloudUpdatedAt.current = remote.updatedAt;
        setCloud({
          user,
          status: "saved",
          message: "Cloud project loaded",
          lastSavedAt: remote.updatedAt,
          lastLoadedAt: new Date().toISOString(),
        });
      } else {
        const owner = localStorage.getItem(LOCAL_PROJECT_OWNER_KEY);
        // A first account may intentionally adopt the work already on this
        // browser. A different account must start clean so projects cannot
        // leak between directors sharing one device.
        const initialProject = !owner || owner === cloudUserKey(user) ? stateRef.current : createBlankState();
        if (initialProject !== stateRef.current) {
          setState(initialProject);
          stateRef.current = initialProject;
        }
        const saved = await saveCloudProject(initialProject, clientId.current);
        localStorage.setItem(LOCAL_PROJECT_OWNER_KEY, cloudUserKey(user));
        lastCloudJson.current = JSON.stringify(initialProject);
        lastCloudUpdatedAt.current = saved.updatedAt;
        setCloud({
          user,
          status: "saved",
          message: "Cloud project created",
          lastSavedAt: saved.updatedAt,
          lastLoadedAt: new Date().toISOString(),
        });
      }
      setCloudReady(true);
    } catch (error) {
      setCloudReady(false);
      setCloud((current) => ({ ...current, user, status: "error", message: cloudErrorMessage(error) }));
    }
  }

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    initializeIdentity((event, user) => {
      if (cancelled) return;
      if (event === "recovery") {
        setPasswordRecoveryMode(true);
        setCloud({ user, status: "loading", message: "Enter a new password to finish resetting your account.", lastSavedAt: null, lastLoadedAt: null });
        return;
      }
      if (!user) {
        setCloudReady(false);
        setCloud({ user: null, status: "signedOut", message: "Sign in to save across devices", lastSavedAt: null, lastLoadedAt: null });
        return;
      }
      void loadProjectForUser(user);
    })
      .then(({ user, unsubscribe: stopListening, callbackResult }) => {
        if (cancelled) {
          stopListening();
          return;
        }
        unsubscribe = stopListening;
        if (callbackResult?.type === "recovery") {
          setPasswordRecoveryMode(true);
          setCloud({ user, status: "loading", message: "Enter a new password to finish resetting your account.", lastSavedAt: null, lastLoadedAt: null });
          return;
        }
        if (user) void loadProjectForUser(user);
        else setCloud({ user: null, status: "signedOut", message: "Sign in to save across devices", lastSavedAt: null, lastLoadedAt: null });
      })
      .catch((error) => {
        if (!cancelled) {
          setCloud({ user: null, status: "localOnly", message: cloudErrorMessage(error), lastSavedAt: null, lastLoadedAt: null });
        }
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
      window.clearTimeout(cloudSaveTimer.current);
    };
  }, []);

  useEffect(() => {
    saveState(state, sandboxMode ? SANDBOX_STORAGE_KEY : STORAGE_KEY);
    if (sandboxMode) {
      setCloud((current) => ({
        ...current,
        status: current.user ? "localOnly" : current.status === "checking" ? "checking" : "signedOut",
        message: current.user ? "Test sandbox: cloud sync paused" : "Test sandbox saves only on this browser",
      }));
      return;
    }
    if (!cloud.user || !cloudReady) return;

    const json = JSON.stringify(state);
    if (json === lastCloudJson.current) return;

    window.clearTimeout(cloudSaveTimer.current);
    setCloud((current) => ({ ...current, status: "saving", message: "Saving to cloud" }));
    cloudSaveTimer.current = window.setTimeout(async () => {
      try {
        const saved = await saveCloudProject(stateRef.current, clientId.current);
        lastCloudJson.current = JSON.stringify(stateRef.current);
        lastCloudUpdatedAt.current = saved.updatedAt;
        setCloud((current) => ({ ...current, status: "saved", message: "Cloud saved", lastSavedAt: saved.updatedAt }));
      } catch (error) {
        setCloud((current) => ({ ...current, status: "error", message: cloudErrorMessage(error) }));
      }
    }, 900);
  }, [state, cloud.user, cloudReady, sandboxMode]);

  const setStateWithHistory: React.Dispatch<React.SetStateAction<AppState>> = (update) => {
    setState((current) => {
      const next = typeof update === "function" ? (update as (current: AppState) => AppState)(current) : update;
      if (Object.is(next, current)) return current;
      setPast((items) => [...items.slice(-24), current]);
      setFuture([]);
      return next;
    });
  };

  function undo() {
    setPast((items) => {
      const previous = items[items.length - 1];
      if (!previous) return items;
      setFuture((redoItems) => [state, ...redoItems.slice(0, 24)]);
      setState(previous);
      return items.slice(0, -1);
    });
  }

  function redo() {
    setFuture((items) => {
      const next = items[0];
      if (!next) return items;
      setPast((undoItems) => [...undoItems.slice(-24), state]);
      setState(next);
      return items.slice(1);
    });
  }

  async function handleSignIn(email: string, password: string) {
    setCloud((current) => ({ ...current, status: "loading", message: "Signing in" }));
    try {
      const user = await signInDirector(email, password);
      setPasswordRecoveryMode(false);
      await loadProjectForUser(user);
    } catch (error) {
      setCloud((current) => ({ ...current, status: "error", message: cloudErrorMessage(error) }));
    }
  }

  async function handleSignUp(email: string, password: string) {
    setCloud((current) => ({ ...current, status: "loading", message: "Creating account" }));
    try {
      const user = await createDirectorAccount(email, password);
      setPasswordRecoveryMode(false);
      await loadProjectForUser(user);
    } catch (error) {
      setCloud((current) => ({ ...current, status: "error", message: cloudErrorMessage(error) }));
    }
  }

  async function handlePasswordResetRequest(email: string) {
    setCloud((current) => ({ ...current, status: "loading", message: "Sending password reset email" }));
    try {
      await requestDirectorPasswordReset(email);
      setCloud((current) => ({ ...current, status: "signedOut", message: "Password reset email sent. Open the link in that email, then choose a new password here." }));
    } catch (error) {
      setCloud((current) => ({ ...current, status: "error", message: cloudErrorMessage(error) }));
    }
  }

  async function handleCompletePasswordReset(password: string) {
    setCloud((current) => ({ ...current, status: "loading", message: "Saving new password" }));
    try {
      const user = await finishDirectorPasswordReset(password);
      setPasswordRecoveryMode(false);
      await loadProjectForUser(user);
    } catch (error) {
      setCloud((current) => ({ ...current, status: "error", message: cloudErrorMessage(error) }));
    }
  }

  async function handleSignOut() {
    try {
      await signOutDirector();
    } finally {
      setCloudReady(false);
      setCloud({ user: null, status: "signedOut", message: "Signed out. This browser still autosaves locally.", lastSavedAt: null, lastLoadedAt: null });
    }
  }

  async function handleSyncNow() {
    if (!cloud.user || sandboxMode) return;
    setCloud((current) => ({ ...current, status: "saving", message: "Saving to cloud" }));
    try {
      const saved = await saveCloudProject(stateRef.current, clientId.current);
      lastCloudJson.current = JSON.stringify(stateRef.current);
      lastCloudUpdatedAt.current = saved.updatedAt;
      setCloud((current) => ({ ...current, status: "saved", message: "Cloud saved", lastSavedAt: saved.updatedAt }));
      setCloudReady(true);
    } catch (error) {
      setCloud((current) => ({ ...current, status: "error", message: cloudErrorMessage(error) }));
    }
  }

  function handleSandboxMode(enabled: boolean) {
    saveState(stateRef.current, sandboxRef.current ? SANDBOX_STORAGE_KEY : STORAGE_KEY);
    sandboxRef.current = enabled;
    localStorage.setItem(SANDBOX_MODE_KEY, String(enabled));
    setSandboxMode(enabled);
    setPast([]);
    setFuture([]);
    setCloudReady(false);
    if (enabled) {
      setState(loadState(SANDBOX_STORAGE_KEY));
      setCloud((current) => ({
        ...current,
        status: current.user ? "localOnly" : "signedOut",
        message: "Test sandbox saves only on this browser",
        lastSavedAt: null,
        lastLoadedAt: null,
      }));
    } else {
      const localLiveState = loadState(STORAGE_KEY);
      setState(localLiveState);
      stateRef.current = localLiveState;
      if (cloud.user) void loadProjectForUser(cloud.user);
      else setCloud((current) => ({ ...current, status: "signedOut", message: "Live mode. Sign in to save to cloud." }));
    }
  }

  useEffect(() => {
    if (!cloud.user || !cloudReady || sandboxMode) return;
    const interval = window.setInterval(async () => {
      try {
        const remote = await loadCloudProject();
        if (!remote.state || !remote.updatedAt) return;
        if (remote.updatedBy === clientId.current) return;
        if (remote.updatedAt === lastCloudUpdatedAt.current) return;

        const normalizedRemote = normalizeState(remote.state);
        setState(normalizedRemote);
        stateRef.current = normalizedRemote;
        lastCloudJson.current = JSON.stringify(normalizedRemote);
        lastCloudUpdatedAt.current = remote.updatedAt;
        setCloud((current) => ({
          ...current,
          status: "saved",
          message: "Synced changes from another signed-in director",
          lastSavedAt: remote.updatedAt,
          lastLoadedAt: new Date().toISOString(),
        }));
      } catch (error) {
        setCloud((current) => ({ ...current, status: "error", message: cloudErrorMessage(error) }));
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [cloud.user, cloudReady, sandboxMode]);

  const value = useMemo(() => ({ state, setState: setStateWithHistory, cloud, sandboxMode }), [state, cloud, sandboxMode]);
  const pages: Record<string, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={setPage} />,
    actors: <ActorsPage />,
    casting: <CastingPage />,
    availability: <AvailabilityPage />,
    beats: <BeatsPage />,
    overrides: <OverridesPage />,
    planner: <PlannerPage onNavigate={setPage} />,
    schedule: <SchedulePage onNavigate={setPage} />,
    designer: <ScheduleDesignerPage />,
    progress: <ProgressPage />,
    settings: <SettingsPage />,
    import: <ImportExportPage />,
  };

  return (
    <AppContext.Provider value={value}>
      <Layout
        active={page}
        onNavigate={setPage}
        onUndo={undo}
        onRedo={redo}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        cloud={cloud}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onPasswordResetRequest={handlePasswordResetRequest}
        onCompletePasswordReset={handleCompletePasswordReset}
        onSignOut={handleSignOut}
        onSyncNow={handleSyncNow}
        passwordRecoveryMode={passwordRecoveryMode}
        sandboxMode={sandboxMode}
        onSandboxModeChange={handleSandboxMode}
      >
        {pages[page] ?? pages.dashboard}
      </Layout>
    </AppContext.Provider>
  );
}

function getClientId() {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const next = `client_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  localStorage.setItem(CLIENT_ID_KEY, next);
  return next;
}

function cloudUserKey(user: CloudStatus["user"]) {
  return user?.id ?? user?.email ?? "unknown-user";
}
