import type { Proposal, RevealPayload } from "./core/types.js";

export function proposalRevealPayload(proposal?: Proposal): RevealPayload | undefined {
  if (!proposal?.revealPayload) return undefined;
  return isRevealPayload(proposal.revealPayload) ? proposal.revealPayload : undefined;
}

export function isRevealPayload(value: unknown): value is RevealPayload {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    value !== null &&
    "messageKo" in value &&
    typeof value.messageKo === "string" &&
    value.messageKo.trim().length > 0
  );
}

export function RevealPreview({
  payload,
  onShow,
  disabled = false,
}: {
  payload: RevealPayload;
  onShow: () => void;
  disabled?: boolean;
}) {
  return (
    <section className="revealPreview" aria-label="Reveal 미리보기">
      <div className="sectionHeader compact">
        <div>
          <p className="eyebrow">Reveal 미리보기</p>
          <h2>플레이어에게 보일 내용</h2>
        </div>
      </div>
      <p className="revealPreviewMessage">{payload.messageKo}</p>
      <button type="button" className="primaryButton" onClick={onShow} disabled={disabled}>
        플레이어에게 공개
      </button>
    </section>
  );
}

export function RevealScreen({ payload, onClose }: { payload: RevealPayload; onClose: () => void }) {
  return (
    <main className="revealShell" aria-label="플레이어 공개 화면">
      <section className="revealCard">
        <p>{payload.messageKo}</p>
        <button type="button" className="revealCloseButton" onClick={onClose}>
          확인했다면 눈을 감으세요
        </button>
      </section>
    </main>
  );
}
