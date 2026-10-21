import {
  ConfigResponse,
  EventsResponse,
  HealthResponse,
  MeResponse,
  type ProposalDecision,
  ProposalsResponse,
  RecentResponse,
  ThreadResponse,
  ThreadsResponse,
} from "@foresight/shared";
import { authedFetch } from "./session.js";

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error(`GET /api/health → ${res.status}`);
  return HealthResponse.parse(await res.json());
}

export async function fetchEvents(): Promise<EventsResponse> {
  const res = await fetch("/api/events");
  if (!res.ok) throw new Error(`GET /api/events → ${res.status}`);
  return EventsResponse.parse(await res.json());
}

export async function fetchRecent(): Promise<RecentResponse> {
  const res = await fetch("/api/recent");
  if (!res.ok) throw new Error(`GET /api/recent → ${res.status}`);
  return RecentResponse.parse(await res.json());
}

export async function fetchConfig(): Promise<ConfigResponse> {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error(`GET /api/config → ${res.status}`);
  return ConfigResponse.parse(await res.json());
}

export async function fetchMe(): Promise<MeResponse> {
  const res = await authedFetch("/api/me");
  if (!res.ok) throw new Error(`GET /api/me → ${res.status}`);
  return MeResponse.parse(await res.json());
}

export async function fetchThreads(): Promise<ThreadsResponse> {
  const res = await fetch("/api/threads");
  if (!res.ok) throw new Error(`GET /api/threads → ${res.status}`);
  return ThreadsResponse.parse(await res.json());
}

export async function fetchThread(id: string): Promise<ThreadResponse | null> {
  const res = await fetch(`/api/threads/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /api/threads/${id} → ${res.status}`);
  return ThreadResponse.parse(await res.json());
}

export async function fetchProposals(): Promise<ProposalsResponse> {
  const res = await authedFetch("/api/threads/proposals");
  if (!res.ok) throw new Error(`GET /api/threads/proposals → ${res.status}`);
  return ProposalsResponse.parse(await res.json());
}

export async function decideProposal(id: string, decision: ProposalDecision): Promise<void> {
  const res = await authedFetch(`/api/threads/proposals/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify(decision) });
  if (!res.ok) throw new Error(`POST /api/threads/proposals/${id} → ${res.status}`);
}
