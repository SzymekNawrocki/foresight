import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { fetchConfig, fetchMe } from "./api.js";
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
    <span className="flex gap-3">
      <OwnerBadge token={token} />
      <button type="button" onClick={() => signOut(auth, origin)} className="label hover:text-alert">
        Wyloguj
      </button>
    </span>
  ) : (
    <button type="button" onClick={() => void signIn(auth, origin)} className="label text-fg hover:text-alert">
      Zaloguj
    </button>
  );
}

// Confirms the token against the API, so a stale or forged session shows as such.
function OwnerBadge({ token }: { token: string }) {
  const me = useQuery({ queryKey: ["me", token], queryFn: fetchMe, retry: false });
  if (me.isPending) return null;
  return me.isSuccess ? <span className="label text-ok">Właściciel</span> : <span className="label text-alert">Sesja nieważna</span>;
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
      .then(() => navigate({ to: "/", replace: true }))
      .catch(() => setError("Logowanie nie powiodło się. Spróbuj ponownie."));
  }, [config.data, navigate]);

  return <p className={`label ${error ? "text-alert" : ""}`}>{error ?? "Weryfikuję tożsamość…"}</p>;
}
