"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@heroui/react";
import { Drawer } from "vaul";
import { useEffect, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { useIsMobileWorkspace } from "@/lib/use-media-query";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Max width utility class, e.g. "max-w-md" */
  width?: string;
  /** Render above another open modal (stacked / nested dialogs). */
  elevated?: boolean;
};

function ModalDesktop({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-md",
  elevated = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`julow-modal-overlay ${elevated ? "julow-modal-overlay--elevated" : ""}`.trim()}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`julow-modal glass-panel ${width}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-julow-glass-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs leading-relaxed text-julow-muted">
                {description}
              </p>
            )}
          </div>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label="Close"
            onPress={onClose}
          >
            <Icon icon={Cancel01Icon} size={16} />
          </Button>
        </header>

        <div className="px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-julow-glass-border px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

function ModalSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  elevated = false,
}: ModalProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      modal
    >
      <Drawer.Portal>
        <Drawer.Overlay
          className={`julow-sheet-overlay ${elevated ? "julow-sheet-overlay--elevated" : ""}`.trim()}
        />
        <Drawer.Content
          className="julow-sheet"
          data-vaul-custom-container="true"
        >
          <div className="julow-sheet-handle" aria-hidden />
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-julow-glass-border px-4 py-3">
            <div className="min-w-0">
              <Drawer.Title className="text-base font-semibold tracking-tight">
                {title}
              </Drawer.Title>
              {description && (
                <Drawer.Description className="mt-0.5 text-xs leading-relaxed text-julow-muted">
                  {description}
                </Drawer.Description>
              )}
            </div>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label="Close"
              onPress={onClose}
            >
              <Icon icon={Cancel01Icon} size={16} />
            </Button>
          </header>

          <div className="julow-sheet-body px-4 py-4">{children}</div>

          {footer && (
            <footer className="julow-sheet-footer flex shrink-0 items-center justify-end gap-2 border-t border-julow-glass-border px-4 py-3">
              {footer}
            </footer>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/**
 * Responsive dialog: centered modal on desktop, vaul bottom sheet on mobile.
 */
export function Modal(props: ModalProps) {
  const isMobile = useIsMobileWorkspace();

  if (isMobile) {
    return <ModalSheet {...props} />;
  }

  return <ModalDesktop {...props} />;
}
