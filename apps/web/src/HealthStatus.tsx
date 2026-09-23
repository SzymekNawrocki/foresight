import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "./api.js";

export function HealthStatus() {
  const health = useQuery({ queryKey: ["health"], queryFn: fetchHealth });

  if (health.isPending) return <p>API: sprawdzam…</p>;
  if (health.isError) return <p>API: niedostępne</p>;
  return <p>API: {health.data.status}</p>;
}
