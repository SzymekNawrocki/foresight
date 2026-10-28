import type { ProposalDecision, ProposalsResponse } from "@foresight/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { decideProposal } from "./api.js";
import { joinCandidates, type JoinCandidate } from "./intel.js";
import { ACTOR_LABEL, REGION_LABEL, TOPIC_LABEL } from "./labels.js";
import { LoadError, PageHeader } from "./panel.js";
import { useSession } from "./session.js";
import { Timeline, useProposals, useThreads } from "./threads.js";
import { When } from "./time.js";
import { Button } from "./ui/button.js";
import { Dialog } from "./ui/dialog.js";
import { Loading } from "./ui/skeleton.js";

/** How long a reject can be undone; the API hears about it only after that (#71, decision 12). */
export const UNDO_MS = 5_000;
/** Length of the card's exit transition. */
const LEAVE_MS = 200;
const HEADLINES = 3;

type Proposal = ProposalsResponse["proposals"][number];
type ListedThread = NonNullable<ReturnType<typeof useThreads>["data"]>["threads"][number];

/** /inbox — New situations; visible only to the owner, the API checks the token on every call anyway. */
export function InboxPage() {
  const token = useSession();
  return (
    <div className="grid gap-6">
      <PageHeader title="Skrzynka" subtitle="Nowe sytuacje zaproponowane przez AI: zacznij śledzić, dołącz do Wątku albo odrzuć." />
      {token ? <Inbox /> : <p className="text-dim">Skrzynka jest dostępna po zalogowaniu.</p>}
    </div>
  );
}

function Inbox() {
  const client = useQueryClient();
  const proposals = useProposals(true);
  const threads = useThreads();
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const [rejected, setRejected] = useState<{ proposal: Proposal; index: number } | null>(null);
  // The reject waiting out its undo window; a ref so the unmount cleanup sees the latest one.
  const pending = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  // The nav count reads the same cache, so dropping a card here also lowers it.
  const drop = (id: string) =>
    client.setQueryData<ProposalsResponse>(["proposals"], (old) => old && { proposals: old.proposals.filter((p) => p.thread.id !== id) });
  const refresh = () =>
    Promise.all([client.invalidateQueries({ queryKey: ["proposals"] }), client.invalidateQueries({ queryKey: ["threads"] })]);

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: ProposalDecision }) => decideProposal(id, decision),
    onSuccess: (_, { id, decision }) => {
      setError(null);
      if (decision.action === "reject") return void refresh();
      setLeaving((s) => new Set(s).add(id));
      setTimeout(() => {
        drop(id);
        void refresh();
      }, LEAVE_MS);
    },
    onError: () => {
      setError("Decyzja nie przeszła — odśwież i spróbuj ponownie.");
      void refresh();
    },
  });

  const sendReject = () => {
    const waiting = pending.current;
    if (!waiting) return;
    clearTimeout(waiting.timer);
    pending.current = null;
    setRejected(null);
    decide.mutate({ id: waiting.id, decision: { action: "reject" } });
  };

  // Leaving the page within the undo window keeps the decision: it is sent at once.
  useEffect(
    () => () => {
      const waiting = pending.current;
      if (!waiting) return;
      clearTimeout(waiting.timer);
      pending.current = null;
      decideProposal(waiting.id, { action: "reject" }).catch(() => undefined);
    },
    [],
  );

  const reject = (proposal: Proposal, index: number) => {
    sendReject();
    drop(proposal.thread.id);
    setRejected({ proposal, index });
    pending.current = { id: proposal.thread.id, timer: setTimeout(sendReject, UNDO_MS) };
  };

  const undo = () => {
    const waiting = pending.current;
    if (!waiting || !rejected) return;
    clearTimeout(waiting.timer);
    pending.current = null;
    client.setQueryData<ProposalsResponse>(["proposals"], (old) => {
      const list = old?.proposals.filter((p) => p.thread.id !== waiting.id) ?? [];
      return { proposals: list.toSpliced(rejected.index, 0, rejected.proposal) };
    });
    setRejected(null);
  };

  if (proposals.isPending) return <Loading label="Ładuję Skrzynkę" />;
  if (proposals.isError) return <LoadError what="Skrzynki" retry={proposals.refetch} />;
  const list = proposals.data.proposals;
  const targets = threads.data?.threads ?? [];
  return (
    <>
      {list.length === 0 ? (
        <p className="text-dim">Skrzynka pusta. Nowe sytuacje pojawiają się po godzinnych przebiegach workera.</p>
      ) : (
        <ul className="grid gap-4">
          {list.map((proposal, index) => (
            <li key={proposal.thread.id}>
              <ProposalCard
                proposal={proposal}
                targets={targets}
                leaving={leaving.has(proposal.thread.id)}
                busy={decide.isPending && decide.variables.id === proposal.thread.id}
                onDecide={(decision) => decide.mutate({ id: proposal.thread.id, decision })}
                onReject={() => reject(proposal, index)}
              />
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-coral">
          {error}
        </p>
      )}
      <div role="status" aria-label="Powiadomienie" className="fixed inset-x-4 bottom-4 z-20 flex justify-center">
        {rejected && (
          <div className="flex items-center gap-3 rounded-lg border border-line bg-raised px-4 py-2 shadow-2xl">
            <span>{`Odrzucono: ${rejected.proposal.thread.name}`}</span>
            <Button size="sm" variant="ghost" className="text-brass" onClick={undo}>
              Cofnij
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function ProposalCard({
  proposal: { thread, timeline },
  targets,
  leaving,
  busy,
  onDecide,
  onReject,
}: {
  proposal: Proposal;
  targets: ListedThread[];
  leaving: boolean;
  busy: boolean;
  onDecide: (decision: ProposalDecision) => void;
  onReject: () => void;
}) {
  const [all, setAll] = useState(false);
  const regions = thread.regions.map((r) => REGION_LABEL[r]).join(", ") || "bez Regionu";
  return (
    <article
      className={`rounded-lg border border-line bg-surface p-4 transition duration-200 ${leaving ? "-translate-y-1 opacity-0" : ""}`}
    >
      <h3 className="text-[17px] font-medium">{thread.name}</h3>
      <p className="mb-3 text-[14px] text-dim">
        {`${thread.eventCount} Zdarzeń · ${regions} · zaproponowano `}
        <When iso={thread.createdAt} />
      </p>
      <Timeline entries={all ? timeline : timeline.slice(0, HEADLINES)} label={`Nagłówki: ${thread.name}`} />
      {timeline.length > HEADLINES && (
        <Button size="sm" variant="ghost" className="mt-2" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "Pokaż mniej" : `Pokaż wszystkie (${timeline.length})`}
        </Button>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" disabled={busy || leaving} onClick={() => onDecide({ action: "accept" })}>
          Śledź jako nowy Wątek
        </Button>
        <JoinDialog
          proposal={{ id: thread.id, topics: thread.topics ?? [], actors: thread.actors ?? [...new Set(timeline.flatMap((e) => e.actors))] }}
          targets={targets}
          disabled={busy || leaving}
          onJoin={(into) => onDecide({ action: "merge", into })}
        />
        <Button size="sm" disabled={busy || leaving} onClick={onReject}>
          Odrzuć
        </Button>
      </div>
    </article>
  );
}

function JoinDialog({
  proposal,
  targets,
  disabled,
  onJoin,
}: {
  proposal: Parameters<typeof joinCandidates>[0];
  targets: ListedThread[];
  disabled: boolean;
  onJoin: (into: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { suggested, others } = joinCandidates(proposal, targets, query);
  const join = (into: string) => {
    setOpen(false);
    onJoin(into);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      trigger={
        <Button size="sm" disabled={disabled}>
          Dołącz do Wątku…
        </Button>
      }
      title="Dołącz do Wątku"
      description="Zdarzenia tej sytuacji trafią na oś czasu wybranego Wątku."
    >
      <div className="grid min-h-0 gap-3">
        <input
          type="search"
          aria-label="Szukaj Wątku"
          placeholder="Szukaj Wątku po nazwie"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 rounded-md border border-line bg-bg px-3 placeholder:text-faint"
        />
        <div className="grid min-h-0 gap-3 overflow-y-auto">
          <Candidates label="Podobne" hint="wspólny Temat lub Aktor" candidates={suggested} onJoin={join} />
          <Candidates label="Pozostałe" candidates={others} onJoin={join} />
          {suggested.length + others.length === 0 && <p className="text-dim">{`Żaden Wątek nie pasuje do „${query}”.`}</p>}
        </div>
      </div>
    </Dialog>
  );
}

function Candidates({
  label,
  hint,
  candidates,
  onJoin,
}: {
  label: string;
  hint?: string;
  candidates: JoinCandidate[];
  onJoin: (into: string) => void;
}) {
  if (candidates.length === 0) return null;
  return (
    <div className="grid gap-1">
      <p className="label">
        {label}
        {hint && <span className="ml-2 tracking-normal normal-case text-faint">{hint}</span>}
      </p>
      <ul aria-label={label} className="grid gap-1">
        {candidates.map(({ thread, topics, actors }) => {
          const shared = [...topics.map((t) => TOPIC_LABEL[t]), ...actors.map((a) => ACTOR_LABEL[a])];
          return (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => onJoin(thread.id)}
                className="grid w-full rounded-md border border-transparent px-3 py-2 text-left hover:border-line hover:bg-raised"
              >
                <span className="font-medium">{thread.name}</span>
                <span className="text-[13px] text-dim">
                  {shared.length > 0 && <span className="text-brass">{`wspólne: ${shared.join(", ")} · `}</span>}
                  {`${thread.eventCount} Zdarzeń${thread.dormant ? " · uśpiony" : ""}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
