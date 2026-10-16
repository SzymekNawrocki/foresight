import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { fetchConfig } from "./api.js";
import { completeSignIn, signIn, signOut, useSession } from "./session.js";

export function useAuthConfig() {
  return useQuery({ queryKey: ["config"], queryFn: fetchConfig, staleTime: Infinity });
}

export function AuthButton() {
  const token = useSession();
  const config = useAuthConfig();
  const auth = config.data?.auth ?? null;
  if (!auth) return null;
  const origin = window.location.origin;
  return token ? (
    <button type="button" onClick={() => signOut(auth, origin)} className="label hover:text-alert">
      Wyloguj
    </button>
  ) : (
    <button type="button" onClick={() => void signIn(auth, origin)} className="label text-fg hover:text-alert">
      Zaloguj
    </button>
  );
}

/** /auth/callback — Cognito odsyła tu kod; wymieniamy go na token i wracamy do Briefingu. */
export function AuthCallbackPage() {
  const config = useAuthConfig();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const auth = config.data?.auth;
    if (!auth || started.current) return;
    started.current = true;
    completeSignIn(auth, window.location.origin, window.location.href)
      .then(() => navigate({ to: "/theses", replace: true }))
      .catch(() => setError("Logowanie nie powiodło się. Spróbuj ponownie."));
  }, [config.data, navigate]);

  return <p className={`label ${error ? "text-alert" : ""}`}>{error ?? "Weryfikuję tożsamość…"}</p>;
}
