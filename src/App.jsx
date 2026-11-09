
import { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import { supabase } from "./lib/supabaseClient";

function App() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [guestMode, setGuestMode] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error("Unable to load session:", error.message);
      }

      setSession(data?.session ?? null);
      setAuthChecked(true);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
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
                await supabase.auth.signOut();
                setSession(null);
                setGuestMode(false);
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
    <div>
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
