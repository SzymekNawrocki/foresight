import { Topic } from "@foresight/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchHealth } from "./api.js";
import { AuthButton } from "./auth-ui.js";
import { TOPIC_LABEL } from "./labels.js";

const clock = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "UTC",
});

function UtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);
  return <time dateTime={now.toISOString()}>{clock.format(now)} UTC</time>;
}

function LinkStatus() {
  const health = useQuery({ queryKey: ["health"], queryFn: fetchHealth });
  const [text, color] = health.isPending
    ? ["Łącze: sprawdzam", "bg-amber"]
    : health.isError
      ? ["Łącze: zerwane", "bg-alert"]
      : ["Łącze: aktywne", "bg-ok"];
  return (
    <span className="label flex items-center gap-2">
      <span className={`size-1.5 rounded-full ${color}`} aria-hidden />
      {text}
    </span>
  );
}

export function Shell() {
  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 pb-16">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-alert/70 pt-5 pb-3">
        <Link to="/" className="no-underline hover:no-underline">
          <span className="flex items-center gap-2 font-display text-2xl font-bold tracking-[0.3em] text-fg">
            <span className="size-3 bg-alert" aria-hidden />
            FORESIGHT
          </span>
          <span className="label block text-[10px]">Centrum analityczne · geo × tech × rynki</span>
        </Link>
        <span className="label ml-auto hidden border border-alert/60 px-2 py-0.5 text-alert sm:inline">
          Użytek wewnętrzny
        </span>
        <div className="flex flex-col items-end gap-1 text-[11px] text-dim">
          <UtcClock />
          <span className="flex gap-4">
            <LinkStatus />
            <AuthButton />
          </span>
        </div>
      </header>

      <nav aria-label="Tematy" className="flex flex-wrap gap-x-4 gap-y-1 border-b border-line py-2">
        <Link to="/" className="label no-underline hover:text-alert" activeProps={{ className: "text-alert" }} activeOptions={{ exact: true }}>
          Briefing
        </Link>
        <span className="text-faint" aria-hidden>
          //
        </span>
        {Topic.options.map((t) => (
          <Link
            key={t}
            to="/topic/$topic"
            params={{ topic: t }}
            className="label no-underline hover:text-alert"
            activeProps={{ className: "text-alert" }}
          >
            {TOPIC_LABEL[t]}
          </Link>
        ))}
      </nav>

      <main className="pt-6">
        <Outlet />
      </main>
    </div>
  );
}
