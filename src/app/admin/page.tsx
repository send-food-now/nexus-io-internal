"use client";

import { useState } from "react";
import IntakeForm from "./components/IntakeForm";

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0a0a0a",
    color: "#e5e5e5",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  loginBox: {
    backgroundColor: "#1a1a1a",
    borderRadius: "12px",
    padding: "40px",
    maxWidth: "400px",
    width: "100%",
    border: "1px solid #333",
  },
  title: {
    fontSize: "24px",
    fontWeight: 700,
    marginBottom: "8px",
    color: "#fff",
  },
  subtitle: {
    fontSize: "14px",
    color: "#888",
    marginBottom: "24px",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    backgroundColor: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: "8px",
    color: "#e5e5e5",
    fontSize: "14px",
    outline: "none",
    marginBottom: "16px",
    boxSizing: "border-box" as const,
  },
  button: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  error: {
    color: "#ef4444",
    fontSize: "13px",
    marginBottom: "12px",
  },
};

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nexus-admin-auth") === "true";
    }
    return false;
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    const res = await fetch("/api/admin-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      localStorage.setItem("nexus-admin-auth", "true");
      setAuthenticated(true);
      setError("");
    } else {
      setError("Invalid password");
    }
  };

  if (authenticated) {
    return <IntakeForm />;
  }

  return (
    <div style={styles.container}>
      <div style={styles.loginBox}>
        <h1 style={styles.title}>Nexus Admin</h1>
        <p style={styles.subtitle}>Enter password to access the pipeline</p>
        {error && <p style={styles.error}>{error}</p>}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          style={styles.input}
        />
        <button onClick={handleLogin} style={styles.button}>
          Sign In
        </button>
      </div>
    </div>
  );
}
