import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  sectsAndVioletsRulesFor,
  type SectsAndVioletsCharacterRules,
} from "./sectsAndVioletsCharacterRules";
import { sectsAndVioletsCharacterAsset } from "./sectsAndVioletsCharacterAssets";
import {
  sectsAndVioletsCharacters,
  type SectsAndVioletsCharacterKind,
} from "./sectsAndVioletsCharacters";
import "./issue114CharacterDetailsPrototype.css";

type PrototypeTab = "roles" | "grimoire" | "progress";

type PrototypePlayer = {
  seat: number;
  name: string;
  characterId: string;
  tokens: string[];
};

const kindLabels: Record<SectsAndVioletsCharacterKind, string> = {
  townsfolk: "주민",
  outsider: "외지인",
  minion: "하수인",
  demon: "악마",
};

const roleChoices = ["philosopher", "dreamer", "mutant", "witch", "pitHag", "vortox"];

const prototypePlayers: PrototypePlayer[] = [
  { seat: 1, name: "민서", characterId: "clockmaker", tokens: [] },
  { seat: 2, name: "준호", characterId: "mutant", tokens: ["집착"] },
  { seat: 3, name: "서준", characterId: "fangGu", tokens: ["한 번"] },
  { seat: 4, name: "지우", characterId: "philosopher", tokens: ["철학자임"] },
  { seat: 5, name: "현우", characterId: "witch", tokens: ["저주"] },
  { seat: 6, name: "유나", characterId: "dreamer", tokens: ["중독", "쌍둥이"] },
];

export function Issue114CharacterDetailsPrototype() {
  const [activeTab, setActiveTab] = useState<PrototypeTab>("roles");
  const [selectedRoleId, setSelectedRoleId] = useState("philosopher");
  const [selectedPlayer, setSelectedPlayer] = useState<PrototypePlayer>();
  const [openCharacterId, setOpenCharacterId] = useState<string>();
  const characterTriggerRef = useRef<HTMLElement | null>(null);
  const seatRefs = useRef(new Map<number, HTMLButtonElement>());
  const selectedRole = characterFor(selectedRoleId);

  function openCharacter(characterId: string, trigger: HTMLElement) {
    characterTriggerRef.current = trigger;
    setOpenCharacterId(characterId);
  }

  function closeCharacter() {
    const trigger = characterTriggerRef.current;
    setOpenCharacterId(undefined);
    requestAnimationFrame(() => trigger?.focus());
  }

  function closePlayer() {
    const seat = selectedPlayer?.seat;
    setSelectedPlayer(undefined);
    requestAnimationFrame(() => seat && seatRefs.current.get(seat)?.focus());
  }

  return (
    <main className="issue114Prototype" aria-label="이슈 114 캐릭터 상세 프로토타입">
      <header className="issue114Header">
        <div>
          <span>ISSUE 114 · CHARACTER DETAILS</span>
          <h1>Sects &amp; Violets</h1>
          <p>캐릭터 아이콘과 이름에서 여는 공용 규칙 패널</p>
        </div>
        <div className="issue114PhaseMark" aria-label="2일차 밤"><b>2</b><span>밤</span></div>
      </header>

      <nav className="issue114Tabs" aria-label="캐릭터 상세 진입점">
        <button type="button" aria-pressed={activeTab === "roles"} onClick={() => setActiveTab("roles")}>직업</button>
        <button type="button" aria-pressed={activeTab === "grimoire"} onClick={() => setActiveTab("grimoire")}>마도서</button>
        <button type="button" aria-pressed={activeTab === "progress"} onClick={() => setActiveTab("progress")}>진행</button>
      </nav>

      {activeTab === "roles" && selectedRole ? (
        <section className="issue114Surface issue114Roles" role="region" aria-label="직업 탭 캐릭터 상세 시료">
          <div className="issue114RoleCatalog">
            <header><span>직업 선택</span><strong>6 / 7</strong></header>
            <div>
              {roleChoices.map((characterId) => {
                const character = characterFor(characterId)!;
                const asset = sectsAndVioletsCharacterAsset(characterId);
                return (
                  <button
                    type="button"
                    className={selectedRoleId === characterId ? "selected" : ""}
                    aria-pressed={selectedRoleId === characterId}
                    aria-label={`${character.name} 선택`}
                    onClick={() => setSelectedRoleId(characterId)}
                    key={characterId}
                  >
                    {asset ? <img src={asset.src} alt="" /> : null}
                    <span>{character.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <aside className="issue114SelectedRole" aria-label="현재 선택한 캐릭터">
            <span>{kindLabels[selectedRole.kind]}</span>
            <CharacterIdentityButton characterId={selectedRole.id} onOpen={openCharacter} />
            <p>{selectedRole.ability}</p>
            <button type="button" className="issue114PrimaryAction">직업 선택 확정</button>
          </aside>
        </section>
      ) : null}

      {activeTab === "grimoire" ? (
        <section className="issue114Surface issue114Grimoire" role="region" aria-label="캐릭터 상세 마도서 시료">
          <div className="issue114GrimoireCenter"><strong>2일차 밤</strong><span>12:38</span></div>
          {prototypePlayers.map((player) => {
            const character = characterFor(player.characterId)!;
            const asset = sectsAndVioletsCharacterAsset(player.characterId);
            return (
              <button
                ref={(node) => {
                  if (node) seatRefs.current.set(player.seat, node);
                  else seatRefs.current.delete(player.seat);
                }}
                type="button"
                className={`issue114Seat issue114Seat${player.seat}`}
                aria-label={`${player.seat}번 ${player.name} 좌석, ${character.name}`}
                onClick={() => setSelectedPlayer(player)}
                key={player.seat}
              >
                <span>{player.seat}</span>
                {asset ? <img src={asset.src} alt="" /> : null}
                <strong>{player.name}</strong>
                <small>{character.name}</small>
                {player.tokens.length ? <em>+{player.tokens.length}</em> : null}
              </button>
            );
          })}
        </section>
      ) : null}

      {activeTab === "progress" ? (
        <section className="issue114Surface issue114Progress" role="region" aria-label="캐릭터 상세 진행 시료">
          <header><button type="button">← 마도서</button><h2>2일차 밤</h2></header>
          <div className="issue114ProgressWorkspace">
            <article className="issue114CurrentTask">
              <span>현재 할 일</span>
              <CharacterIdentityButton characterId="vortox" onOpen={openCharacter} />
              <p>{characterFor("vortox")!.ability}</p>
              <div><button type="button" className="issue114PrimaryAction">공격 대상 선택</button></div>
            </article>
            <ol aria-label="이후 밤 순서">
              <li className="complete"><span>완료</span><strong>마녀</strong></li>
              <li className="current"><span>현재</span><strong>보르톡스</strong></li>
              <li><span>대기</span><strong>꿈꾸는 자</strong></li>
              <li><span>대기</span><strong>수학자</strong></li>
            </ol>
          </div>
        </section>
      ) : null}

      {selectedPlayer ? (
        <PrototypePlayerDetail
          player={selectedPlayer}
          suspended={Boolean(openCharacterId)}
          onOpenCharacter={openCharacter}
          onClose={closePlayer}
        />
      ) : null}

      {openCharacterId ? (
        <CharacterDetailDrawer characterId={openCharacterId} onClose={closeCharacter} />
      ) : null}
    </main>
  );
}

function CharacterIdentityButton({
  characterId,
  onOpen,
}: {
  characterId: string;
  onOpen: (characterId: string, trigger: HTMLElement) => void;
}) {
  const character = characterFor(characterId);
  const asset = sectsAndVioletsCharacterAsset(characterId);
  if (!character) return null;
  return (
    <button
      type="button"
      className="issue114CharacterIdentity"
      aria-label={`${character.name} 캐릭터 상세 열기`}
      aria-haspopup="dialog"
      onClick={(event) => onOpen(characterId, event.currentTarget)}
    >
      {asset ? <img src={asset.src} alt="" /> : null}
      <span>{character.name}</span>
    </button>
  );
}

function PrototypePlayerDetail({
  player,
  suspended,
  onOpenCharacter,
  onClose,
}: {
  player: PrototypePlayer;
  suspended: boolean;
  onOpenCharacter: (characterId: string, trigger: HTMLElement) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const character = characterFor(player.characterId)!;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useDialogKeyboard(dialogRef, closeRef, suspended, onClose);

  return createPortal(
    <div
      className="issue114PlayerBackdrop"
      aria-hidden={suspended || undefined}
      onMouseDown={(event) => event.target === event.currentTarget && !suspended && onClose()}
    >
      <section
        ref={dialogRef}
        className="issue114PlayerDetail"
        role="dialog"
        aria-modal="true"
        aria-label={`${player.seat}번 ${player.name} 플레이어 상세`}
      >
        <header>
          <div><span>좌석 {player.seat}</span><h2>{player.name}</h2></div>
          <button ref={closeRef} type="button" aria-label="플레이어 상세 닫기" onClick={onClose}>×</button>
        </header>
        <div className="issue114PlayerBody">
          <section>
            <span>캐릭터</span>
            <CharacterIdentityButton characterId={player.characterId} onOpen={onOpenCharacter} />
            <p>{character.ability}</p>
          </section>
          {player.tokens.length ? (
            <section className="issue114AttachedTokens">
              <span>현재 토큰</span>
              <ul aria-label={`현재 토큰 ${player.tokens.length}개`}>
                {player.tokens.map((token) => <li key={token}>{token}</li>)}
              </ul>
            </section>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function CharacterDetailDrawer({ characterId, onClose }: { characterId: string; onClose: () => void }) {
  const rules = sectsAndVioletsRulesFor(characterId);
  const character = characterFor(characterId);
  const asset = sectsAndVioletsCharacterAsset(characterId);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useDialogKeyboard(dialogRef, closeRef, false, onClose);

  if (!rules || !character) return null;
  return createPortal(
    <div className="issue114CharacterBackdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        ref={dialogRef}
        className="issue114CharacterDrawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`issue114-${characterId}-title`}
      >
        <header>
          {asset ? <img src={asset.src} alt="" /> : null}
          <div><span>{kindLabels[character.kind]}</span><h2 id={`issue114-${characterId}-title`}>{rules.label} 캐릭터 상세</h2></div>
          <button ref={closeRef} type="button" aria-label="캐릭터 상세 닫기" onClick={onClose}>×</button>
        </header>
        <CharacterDetailContents rules={rules} />
      </section>
    </div>,
    document.body,
  );
}

function CharacterDetailContents({ rules }: { rules: SectsAndVioletsCharacterRules }) {
  return (
    <div className="issue114CharacterContents">
      <section className="issue114OfficialAbility"><h3>공식 능력</h3><p>{rules.ability}</p></section>
      <section><h3>핵심 판정</h3><ul>{rules.rulings.map((ruling) => <li key={ruling}>{ruling}</li>)}</ul></section>
      <section><h3>진행 방법</h3><ol>{rules.howToRun.map((step) => <li key={step}>{step}</li>)}</ol></section>
      {rules.reminders.length ? (
        <section className="issue114Reminders">
          <h3>리마인더</h3>
          <ul aria-label={`${rules.label} 공식 리마인더`}>
            {rules.reminders.map((reminder) => (
              <li key={`${reminder.scope}-${reminder.label}`}>
                <div><strong>{reminder.label}</strong><span>× {reminder.count}</span></div>
                <p>{reminder.description}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <details className="issue114Examples">
        <summary>공식 예시 {rules.examples.length}개 보기</summary>
        <ol>{rules.examples.map((example) => <li key={example.id}>{example.text}</li>)}</ol>
      </details>
      <a href={rules.source.url} target="_blank" rel="noreferrer">공식 규칙 열기 <span aria-hidden="true">↗</span></a>
    </div>
  );
}

function useDialogKeyboard(
  dialogRef: RefObject<HTMLElement | null>,
  fallbackRef: RefObject<HTMLElement | null>,
  suspended: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (suspended) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], summary") ?? [],
      );
      const first = focusable[0] ?? fallbackRef.current;
      const last = focusable.at(-1) ?? fallbackRef.current;
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialogRef, fallbackRef, onClose, suspended]);
}

function characterFor(characterId: string) {
  return sectsAndVioletsCharacters.find((character) => character.id === characterId);
}
