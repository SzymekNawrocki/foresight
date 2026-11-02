import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

/** A modal dialog: focus is trapped inside and Escape closes it (Base UI). */
export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger render={trigger} />
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 bg-bg opacity-80 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <DialogPrimitive.Popup className="fixed top-[12vh] left-1/2 grid max-h-[76vh] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 grid-rows-[auto_minmax(0,1fr)] gap-3 frame frame-lg brackets p-4 transition data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <div className="flex items-start gap-3">
            <div>
              <DialogPrimitive.Title className="font-display text-xl font-semibold tracking-[0.04em] uppercase">{title}</DialogPrimitive.Title>
              {description && <DialogPrimitive.Description className="text-base text-muted">{description}</DialogPrimitive.Description>}
            </div>
            <DialogPrimitive.Close aria-label="Zamknij" className="ml-auto grid size-9 place-items-center text-muted hover:bg-hover hover:text-fg">
              <X aria-hidden className="size-4" />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
