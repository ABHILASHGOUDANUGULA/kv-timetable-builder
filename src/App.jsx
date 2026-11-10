
import { useEffect, useRef, useState } from "react";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import { supabase } from "./lib/supabaseClient";

function App() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const prevUserIdRef = useRef(null);

  const clearLocalProjectCache = () => {
    try {
      window.localStorage?.removeItem("school_timetable_projects_v1");
      window.localStorage?.removeItem("school_timetable_selected_project");
    } catch (err) {
      console.error("Unable to clear local project cache:", err);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (!mounted) return;

    if (error) {
      console.error("Unable to load session:", error.message);
    }

    setSession(data?.session ?? null);
  } catch (err) {
    console.error("Auth bootstrap failed:", err);
  } finally {
    if (mounted) setAuthChecked(true);
  }
}

    loadSession();

        const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;

      const newUserId = newSession?.user?.id ?? null;
      const wasSignedIn = !!prevUserIdRef.current;
      prevUserIdRef.current = newUserId;

      setSession(newSession);

      if (newSession) {
        setGuestMode(false);
      } else if (wasSignedIn) {
        // Signed out (explicit or session expiry): clear this user's browser
        // data before the next user can trigger a migration from it.
        clearLocalProjectCache();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!authChecked) {
    return (
      <div style={loadingStyle}>
        Loading your timetable builder...
      </div>
    );
  }

  if (session || guestMode) {
    return (
      <div>
        {session && (
          <div style={accountBarStyle}>
            <span>
              Signed in as {session.user.email}
            </span>

            <button
              onClick={async () => {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error("Logout failed:", err);
  } finally {
    clearLocalProjectCache();
    setSession(null);
    setGuestMode(false);
  }
}}
              style={accountButtonStyle}
            >
              Logout
            </button>
          </div>
        )}

        {guestMode && (
          <div style={accountBarStyle}>
            <span>Guest Mode — Your work is local to this browser.</span>

            <button
              onClick={() => setGuestMode(false)}
              style={accountButtonStyle}
            >
              Sign In
            </button>
          </div>
        )}

        <Dashboard session={session} />
      </div>
    );
  }

  return (
  <div style={unauthWrapperStyle}>
    <Auth
      onAuthSuccess={(newSession) => {
        setSession(newSession);
        setGuestMode(false);
      }}
    />

    <div style={guestContainerStyle}>
      <button
        onClick={() => setGuestMode(true)}
        style={guestButtonStyle}
      >
        Continue Without Account
      </button>
    </div>
  </div>
);
}

const loadingStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "18px",
  color: "#334155",
};

const accountBarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "10px",
  padding: "10px 20px",
  background: "#eff6ff",
  borderBottom: "1px solid #dbeafe",
  fontSize: "14px",
};
const unauthWrapperStyle = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  background: "#f3f6fb",
};

const accountButtonStyle = {
  border: "none",
  borderRadius: "6px",
  padding: "8px 14px",
  background: "#2563eb",
  color: "white",
  cursor: "pointer",
  fontWeight: "600",
};

const guestContainerStyle = {
  display: "flex",
  justifyContent: "center",
  padding: "0 20px 24px",
  background: "#f3f6fb",
};

const guestButtonStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "12px 20px",
  background: "white",
  color: "#334155",
  cursor: "pointer",
  fontWeight: "600",
};

export default App;
