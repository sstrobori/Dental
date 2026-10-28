"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

type ConfirmationTone = "primary" | "warning" | "danger";

type ConfirmationModalProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  busyLabel?: string;
  confirmDisabled?: boolean;
  tone?: ConfirmationTone;
  error?: string;
  children?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  role?: "dialog" | "alertdialog";
  onConfirm: () => void;
  onCancel: () => void;
};

const confirmStyles: Record<ConfirmationTone, string> = {
  primary:
    "border-[#6D3AA8] bg-[#6D3AA8] text-white hover:border-[#572C87] hover:bg-[#572C87] focus-visible:ring-[#E4D5F6]",
  warning:
    "border-[#E2A84A] bg-[#FFF2D8] text-[#7C3E08] hover:bg-[#FDE7BD] focus-visible:ring-amber-100",
  danger:
    "border-[#C74652] bg-[#C74652] text-white hover:border-[#AC3642] hover:bg-[#AC3642] focus-visible:ring-red-100",
};

export default function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  busy = false,
  busyLabel = "Working…",
  confirmDisabled = false,
  tone = "primary",
  error,
  children,
  initialFocusRef,
  role = "alertdialog",
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const generatedId = useId().replace(/:/g, "");
  const titleId = `confirmation-${generatedId}-title`;
  const descriptionId = `confirmation-${generatedId}-description`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancelHandlerRef = useRef(onCancel);
  const busyRef = useRef(busy);

  useEffect(() => {
    cancelHandlerRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      initialFocusRef?.current?.focus();
      if (!initialFocusRef?.current) cancelRef.current?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        cancelHandlerRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const controls = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]'
        ) ?? []
      ).filter((element) => element.getClientRects().length > 0);

      if (controls.length === 0) {
        event.preventDefault();
        return;
      }

      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus();
    };
  }, [initialFocusRef, open]);

  if (!open) return null;

  const isDanger = tone === "danger";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#241334]/60 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={busy}
        className="my-auto w-full max-w-md rounded-2xl border border-[#E4D5F6] bg-white p-5 text-left text-[#2E1747] shadow-[0_24px_70px_rgba(40,20,50,0.25)] sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
              isDanger
                ? "bg-[#FFF0F1] text-[#B5414D]"
                : tone === "warning"
                  ? "bg-[#FFF2D8] text-[#92400E]"
                  : "bg-[#F2EAFF] text-[#6D3AA8]"
            }`}
            aria-hidden="true"
          >
            {isDanger ? (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4M12 17h.01" />
                <path d="M10.3 3.8 2.2 18.2A1.9 1.9 0 0 0 3.9 21h16.2a1.9 1.9 0 0 0 1.7-2.8L13.7 3.8a1.9 1.9 0 0 0-3.4 0Z" />
              </svg>
            ) : (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" />
              </svg>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-extrabold leading-7 sm:text-xl">
              {title}
            </h2>
            <div id={descriptionId} className="mt-1 text-sm leading-6 text-[#756581]">
              {description}
            </div>
          </div>
        </div>

        {children && <div className="mt-5">{children}</div>}
        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-[#E2DCE8] bg-white px-4 py-2.5 text-sm font-semibold text-[#49365E] transition hover:bg-[#F8F7FB] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy || confirmDisabled}
            aria-busy={busy}
            onClick={onConfirm}
            className={`min-h-11 rounded-xl border px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${confirmStyles[tone]}`}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
