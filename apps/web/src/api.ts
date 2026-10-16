import { EventsResponse, HealthResponse, RecentResponse } from "@foresight/shared";

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
