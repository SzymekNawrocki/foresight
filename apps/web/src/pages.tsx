import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchRecent } from "./api.js";

export function useRecent() {
  return useQuery({ queryKey: ["recent"], queryFn: fetchRecent, refetchInterval: 5 * 60_000 });
}

export function NotFoundPage() {
  return (
    <div>
      <p className="label text-coral">Błąd 404</p>
      <h1 className="text-[28px] font-semibold">Brak takich akt</h1>
      <p className="mt-1 text-dim">Ten adres nie prowadzi do żadnego Wątku ani widoku.</p>
      <Link to="/" className="mt-3 inline-block text-brass">
        ← Wróć na Radar
      </Link>
    </div>
  );
}
