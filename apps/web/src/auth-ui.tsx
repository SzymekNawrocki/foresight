import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { fetchConfig, fetchMe } from "./api.js";
import { completeSignIn, signIn, signOut, useSession } from "./session.js";
import { Badge } from "./ui/badge.js";
import { Button } from "./ui/button.js";

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
    <span className="flex items-center gap-2">
      <OwnerBadge token={token} />
      <Button variant="ghost" size="sm" onClick={() => signOut(auth, origin)}>
        Wyloguj
      </Button>
    </span>
  ) : (
    <Button size="sm" onClick={() => void signIn(auth, origin)}>
      Zaloguj
    </Button>
  );
}

// Confirms the token against the API, so a stale or forged session shows as such.
function OwnerBadge({ token }: { token: string }) {
  const me = useQuery({ queryKey: ["me", token], queryFn: fetchMe, retry: false });
  if (me.isPending) return null;
  return me.isSuccess ? <Badge>Właściciel</Badge> : <Badge tone="coral">Sesja nieważna</Badge>;
}

/** /auth/callback — Cognito odsyła tu kod; wymieniamy go na token i wracamy na Radar. */
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

  return <p className={error ? "text-coral" : "text-dim"}>{error ?? "Weryfikuję tożsamość…"}</p>;
}
