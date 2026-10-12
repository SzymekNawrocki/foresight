import { useQuery } from "@tanstack/react-query";
import { fetchEvents } from "./api.js";

// Czas zawsze po polsku, niezależnie od strefy przeglądarki — Zdarzenia porównujemy między sobą.
const time = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Warsaw",
});

// Treść z kanałów RSS jest niezaufana: React wstawia ją jako tekst, link przeszedł walidację https w schemacie.
export function EventList() {
  const events = useQuery({ queryKey: ["events"], queryFn: fetchEvents });

  if (events.isPending) return <p>Wczytuję Zdarzenia…</p>;
  if (events.isError) return <p>Nie udało się pobrać Zdarzeń.</p>;
  if (events.data.events.length === 0) return <p>Brak Zdarzeń.</p>;

  return (
    <ol>
      {events.data.events.map((event) => (
        <li key={event.id}>
          <a href={event.url} target="_blank" rel="noopener noreferrer">
            {event.title}
          </a>{" "}
          <small>
            <span>{event.source}</span> · <time dateTime={event.publishedAt}>{time.format(new Date(event.publishedAt))}</time>
          </small>
        </li>
      ))}
    </ol>
  );
}
