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
      ? ["Łącze: zerwane", "bg-coral"]
      : ["Łącze: aktywne", "bg-sage"];
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
    <span className={`flex items-center gap-1.5 ${fresh.stale ? "text-coral" : ""}`}>
      {fresh.stale && <TriangleAlert className="size-4" aria-hidden />}
      {fresh.text}
    </span>
  );
}

const navLink =
  "flex items-center gap-2 rounded-md px-3 py-1.5 text-[14px] font-medium text-dim no-underline hover:bg-raised hover:text-fg hover:no-underline";
const navActive = { className: "bg-raised text-brass hover:text-brass" };

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
      {count > 0 && <span className="data rounded-full bg-brass px-1.5 text-[12px] leading-5 font-semibold text-bg">{count}</span>}
    </NavItem>
  );
}

export function Shell() {
  return (
    <TooltipProvider>
      <div className="mx-auto min-h-screen max-w-7xl px-4 pb-16">
        <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line py-4">
          <Link to="/" className="flex items-center gap-2 no-underline hover:no-underline">
            <span className="size-2.5 rotate-45 bg-brass" aria-hidden />
            <span className="text-[18px] font-semibold tracking-[0.06em] text-fg">FORESIGHT</span>
          </Link>
          <nav aria-label="Główne" className="flex flex-wrap gap-1">
            <NavItem to="/" exact>
              Radar
            </NavItem>
            <NavItem to="/threads">Wątki</NavItem>
            <NavItem to="/stream">Strumień</NavItem>
            <InboxNavItem />
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-dim">
            <Freshness />
            <LinkStatus />
            <AuthButton />
          </div>
        </header>

        <main className="pt-8">
          <Outlet />
        </main>

        <footer className="mt-12 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-3 text-[13px] text-dim">
          <span>Analizy generuje AI na podstawie nagłówków; to nie jest porada inwestycyjna.</span>
        </footer>
      </div>
    </TooltipProvider>
  );
}
