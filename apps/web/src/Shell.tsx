import { useQuery } from "@tanstack/react-query";
import { Link, Outlet } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { fetchHealth } from "./api.js";
import { AuthButton } from "./auth-ui.js";
import { freshness } from "./intel.js";
import { useRecent } from "./pages.js";
import { useSession } from "./session.js";
import { useProposals } from "./threads.js";
import { TooltipProvider } from "./ui/tooltip.js";

function LinkStatus() {
  const health = useQuery({ queryKey: ["health"], queryFn: fetchHealth });
  const [text, color] = health.isPending
    ? ["Łącze: sprawdzam", "bg-faint"]
    : health.isError
      ? ["Łącze: zerwane", "bg-critical"]
      : ["Łącze: aktywne", "bg-positive"];
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${color}`} aria-hidden />
      {text}
    </span>
  );
}

// Shares the "recent" query with the pages, so it costs no extra request.
function Freshness() {
  const recent = useRecent();
  const fresh = recent.data ? freshness(recent.data.events, new Date()) : null;
  if (!fresh) return null;
  return (
    <span className={`flex items-center gap-1.5 ${fresh.stale ? "text-critical" : ""}`}>
      {fresh.stale && <TriangleAlert className="size-4" aria-hidden />}
      {fresh.text}
    </span>
  );
}

const navLink =
  "flex min-h-11 items-center gap-2 px-3 py-1.5 font-display text-lg font-semibold tracking-[0.06em] uppercase text-muted md:min-h-0 no-underline hover:bg-hover hover:text-fg hover:no-underline";
const navActive = { className: "bg-amber-wash text-amber hover:text-amber" };

function NavItem({ to, exact, children }: { to: "/" | "/threads" | "/stream" | "/inbox"; exact?: boolean; children: ReactNode }) {
  return (
    <Link to={to} className={navLink} activeProps={navActive} activeOptions={{ exact: exact ?? false }}>
      {children}
    </Link>
  );
}

// Visible only to the owner; the API checks the token anyway.
function InboxNavItem() {
  const token = useSession();
  const proposals = useProposals(Boolean(token));
  if (!token) return null;
  const count = proposals.data?.proposals.length ?? 0;
  return (
    <NavItem to="/inbox">
      Skrzynka
      {count > 0 && <span className="data bg-amber px-1.5 text-xs leading-5 font-semibold text-bg">{count}</span>}
    </NavItem>
  );
}

export function Shell() {
  return (
    <TooltipProvider>
      <div className="mx-auto min-h-screen max-w-7xl px-4 pb-16">
        <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border py-3">
          <Link to="/" className="flex items-center gap-2 no-underline hover:no-underline">
            <span className="size-2.5 rotate-45 bg-amber" aria-hidden />
            <span className="font-display text-xl font-semibold tracking-[0.12em] text-fg">FORESIGHT</span>
          </Link>
          <nav aria-label="Główne" className="flex flex-wrap gap-1">
            <NavItem to="/" exact>
              Radar
            </NavItem>
            <NavItem to="/threads">Wątki</NavItem>
            <NavItem to="/stream">Strumień</NavItem>
            <InboxNavItem />
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <Freshness />
            <LinkStatus />
            <AuthButton />
          </div>
        </header>

        <main className="pt-6">
          <Outlet />
        </main>

        <footer className="mt-12 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 text-sm text-muted">
          <span>Analizy generuje AI na podstawie nagłówków; to nie jest porada inwestycyjna.</span>
        </footer>
      </div>
    </TooltipProvider>
  );
}
