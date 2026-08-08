import type { ReactNode, Ref } from "react";
import "./sectsAndVioletsReveal.css";

export function SectsAndVioletsReveal({
  dialogLabel,
  backdropAriaLabel,
  className,
  children,
  closeLabel,
  closeAriaLabel,
  closeButtonRef,
  onClose,
}: {
  dialogLabel: string;
  backdropAriaLabel?: string;
  className?: string;
  children: ReactNode;
  closeLabel: string;
  closeAriaLabel?: string;
  closeButtonRef?: Ref<HTMLButtonElement>;
  onClose: () => void;
}) {
  return (
    <div className="snvInformationRevealBackdrop" aria-label={backdropAriaLabel}>
      <section
        className={`snvInformationReveal${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel}
      >
        {children}
        <button ref={closeButtonRef} type="button" aria-label={closeAriaLabel} onClick={onClose}>
          {closeLabel}
        </button>
      </section>
    </div>
  );
}
