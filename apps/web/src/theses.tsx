import { type AnalyzedEvent, Direction, Horizon, INSTRUMENTS, Instrument, NewThesis, type Thesis } from "@foresight/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { fetchTheses, postThesis } from "./api.js";
import { THESIS_DIRECTION_LABEL } from "./labels.js";
import { useSession } from "./session.js";

const date = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeZone: "Europe/Warsaw" });
const HORIZONS = Horizon.options.map((o) => o.value);

export function useTheses() {
  const token = useSession();
  return useQuery({ queryKey: ["theses", token], queryFn: fetchTheses, enabled: token !== null });
}

const field = "w-full border border-line bg-ink px-2 py-1.5 text-fg focus:border-alert";

/** Formularz Tezy pod Zdarzeniem — widoczny tylko dla zalogowanego właściciela. */
export function ThesisForm({ event }: { event: AnalyzedEvent }) {
  const token = useSession();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: postThesis,
    onSuccess: () => {
      setOpen(false);
      void client.invalidateQueries({ queryKey: ["theses"] });
    },
    onError: () => setError("Nie udało się zapisać Tezy."),
  });

  if (!token) return null;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="label mt-3 border border-alert/60 px-2 py-1 text-alert hover:bg-alert hover:text-ink">
        {create.isSuccess ? "Teza zapisana · postaw kolejną" : "Postaw Tezę"}
      </button>
    );

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const parsed = NewThesis.safeParse({
      eventId: event.id,
      instrument: data.get("instrument"),
      direction: data.get("direction"),
      horizonDays: Number(data.get("horizonDays")),
      rationale: data.get("rationale"),
    });
    if (!parsed.success) return setError("Uzupełnij wszystko; Uzasadnienie ma mieć 10–1000 znaków.");
    setError(null);
    create.mutate(parsed.data);
  }

  return (
    <form onSubmit={submit} aria-label="Nowa Teza" className="mt-3 grid gap-3 border border-alert/40 bg-ink/60 p-3 md:grid-cols-3">
      <label className="grid gap-1">
        <span className="label">Instrument</span>
        <select name="instrument" required className={field} defaultValue="">
          <option value="" disabled>
            — wybierz —
          </option>
          {Instrument.options.map((i) => (
            <option key={i} value={i}>
              {INSTRUMENTS[i]}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="grid gap-1">
        <legend className="label">Kierunek</legend>
        <div className="flex flex-wrap gap-3 pt-1">
          {Direction.options.map((d) => (
            <label key={d} className="flex items-center gap-1.5">
              <input type="radio" name="direction" value={d} required className="accent-alert" />
              {THESIS_DIRECTION_LABEL[d]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1">
        <span className="label">Horyzont</span>
        <select name="horizonDays" className={field} defaultValue="30">
          {HORIZONS.map((h) => (
            <option key={h} value={h}>
              {h} dni
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 md:col-span-3">
        <span className="label">Uzasadnienie</span>
        <textarea name="rationale" required minLength={10} maxLength={1000} rows={3} className={field} />
      </label>
      <div className="flex items-center gap-3 md:col-span-3">
        <button type="submit" disabled={create.isPending} className="label border border-alert bg-alert px-3 py-1.5 text-ink disabled:opacity-50">
          {create.isPending ? "Zapisuję…" : "Zapisz Tezę"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="label hover:text-fg">
          Anuluj
        </button>
        {error && <p className="text-alert">{error}</p>}
      </div>
    </form>
  );
}

function Outcome({ thesis }: { thesis: Thesis }) {
  if (thesis.status === "open") return <span className="label text-amber">Otwarta · rozstrzygnięcie {date.format(new Date(thesis.resolveAt))}</span>;
  return thesis.hit ? <span className="label text-ok">Trafiona</span> : <span className="label text-alert">Nietrafiona</span>;
}

export function ThesisList({ theses, empty }: { theses: Thesis[]; empty: string }) {
  if (theses.length === 0) return <p className="label">{empty}</p>;
  return (
    <ol className="grid gap-2">
      {theses.map((t) => (
        <li key={t.id} className="border-l-2 border-line bg-panel/80 p-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <strong className="font-display text-base">{INSTRUMENTS[t.instrument]}</strong>
            <span>
              {THESIS_DIRECTION_LABEL[t.direction]} · {t.horizonDays} dni
            </span>
            <span className="ml-auto">
              <Outcome thesis={t} />
            </span>
          </div>
          <p className="mt-1 text-[12px] text-dim">Zdarzenie: {t.eventTitle}</p>
          <p className="mt-1">{t.rationale}</p>
        </li>
      ))}
    </ol>
  );
}
