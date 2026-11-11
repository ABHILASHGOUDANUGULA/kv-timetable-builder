
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
              onMouseOver={(e) => (e.target.style.background = "#4338ca")}
              onMouseOut={(e) => (e.target.style.background = "#4f46e5")}
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
        onMouseOver={(e) => {
          e.target.style.background = "#f8fafc";
          e.target.style.borderColor = "#94a3b8";
        }}
        onMouseOut={(e) => {
          e.target.style.background = "white";
          e.target.style.borderColor = "#cbd5e1";
        }}
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
  fontSize: "16px",
  fontWeight: "600",
  color: "#4f46e5",
  background: "#f8fafc",
};

const accountBarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "12px",
  padding: "12px 24px",
  background: "#ffffff",
  borderBottom: "1px solid #e2e8f0",
  fontSize: "14px",
  fontWeight: "500",
  color: "#1e293b",
  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
};

const unauthWrapperStyle = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  background: "#f8fafc",
};

const accountButtonStyle = {
  border: "none",
  borderRadius: "8px",
  padding: "8px 16px",
  background: "#4f46e5",
  color: "white",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "13px",
  transition: "background 0.2s ease",
};

const guestContainerStyle = {
  display: "flex",
  justifyContent: "center",
  padding: "0 24px 32px",
  background: "#f8fafc",
};

const guestButtonStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "12px 24px",
  background: "white",
  color: "#475569",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "14px",
  transition: "all 0.2s ease",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
};

export default App;
