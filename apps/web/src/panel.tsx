import { type ReactNode, useId } from "react";

export function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="border border-line bg-panel/60">
      <h2 id={id} className="label flex items-center gap-2 border-b border-line px-3 py-2 text-fg">
        <span className="text-alert">■</span>
        {title}
        {aside && <span className="ml-auto text-dim normal-case tracking-normal">{aside}</span>}
      </h2>
      <div className="p-3">{children}</div>
    </section>
  );
}
