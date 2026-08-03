import { useEffect, useState } from "react";
import LoginScreen from "./LoginScreen";
import { authHeaders, clearCredentials, setCredentials, hasCredentials } from "../lib/auth";
import { API_URL } from "../lib/api";

type Props = {
  children: React.ReactNode;
};

export default function AuthGate({ children }: Props) {
  const [status, setStatus] = useState<"checking" | "authenticated" | "unauthenticated">("checking");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const probe = async (revalidate: boolean) => {
    if (!revalidate && !hasCredentials()) {
      setStatus("unauthenticated");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/auth/me`, { headers: authHeaders() });
      if (res.ok) {
        setStatus("authenticated");
        setError(null);
      } else if (res.status === 401 || res.status === 429) {
        clearCredentials();
        setStatus("unauthenticated");
      } else {
        setStatus("unauthenticated");
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
      setStatus("unauthenticated");
    } finally {
      setLoading(false);
    }
  };

  const handleUnauthorized = () => {
    clearCredentials();
    setStatus("unauthenticated");
  };

  useEffect(() => {
    probe(false);
    window.addEventListener("railboard:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("railboard:unauthorized", handleUnauthorized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    setCredentials(username, password);
    try {
      const res = await fetch(`${API_URL}/admin/auth/me`, {
        headers: { ...authHeaders(), Accept: "application/json" },
      });
      if (res.ok) {
        setStatus("authenticated");
      } else {
        clearCredentials();
        setError("Credenciales incorrectas.");
      }
    } catch {
      clearCredentials();
      setError("No se pudo contactar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "checking") {
    return null;
  }
  if (status === "unauthenticated") {
    return <LoginScreen onSubmit={handleLogin} error={error} loading={loading} />;
  }
  return <>{children}</>;
}