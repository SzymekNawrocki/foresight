import { ConfigResponse, EventsResponse, HealthResponse, type NewThesis, RecentResponse, ThesesResponse, Thesis } from "@foresight/shared";
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

export async function fetchTheses(): Promise<ThesesResponse> {
  const res = await authedFetch("/api/theses");
  if (!res.ok) throw new Error(`GET /api/theses → ${res.status}`);
  return ThesesResponse.parse(await res.json());
}

export async function postThesis(thesis: NewThesis): Promise<Thesis> {
  const res = await authedFetch("/api/theses", { method: "POST", body: JSON.stringify(thesis) });
  if (!res.ok) throw new Error(`POST /api/theses → ${res.status}`);
  return Thesis.parse(await res.json());
}
