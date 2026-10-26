import { RotateCw } from "lucide-react";
import { type ReactNode, useId } from "react";
import { Button } from "./ui/button.js";
import { Card } from "./ui/card.js";

export function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <Card>
        <h2 id={id} className="flex flex-wrap items-baseline gap-x-3 border-b border-line px-4 py-3">
          <span className="label text-fg">{title}</span>
          {aside && <span className="ml-auto text-[13px] text-dim">{aside}</span>}
        </h2>
        <div className="p-4">{children}</div>
      </Card>
    </section>
  );
}

/** Page title with its one-line "what is this for". */
export function PageHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold">{title}</h1>
        <p className="mt-1 text-dim">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

/** An error says what happened and offers to try again. */
export function LoadError({ what, retry }: { what: string; retry: () => unknown }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-coral/40 bg-coral/5 p-4">
      <p className="text-coral">{`Nie udało się pobrać ${what}.`}</p>
      <Button size="sm" onClick={() => void retry()}>
        <RotateCw aria-hidden />
        Spróbuj ponownie
      </Button>
    </div>
  );
}
