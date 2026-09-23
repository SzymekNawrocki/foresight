import { HealthResponse } from "@foresight/shared";

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error(`GET /api/health → ${res.status}`);
  return HealthResponse.parse(await res.json());
}
