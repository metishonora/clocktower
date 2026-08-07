import { characterAsset } from "../../characterAssets";
import { RoleCatalog, SetupPresentation } from "../../shared-ui/SetupPresentation";
import {
  characterKinds,
  characters,
  kindLabels,
  type CharacterKind,
} from "../../setupDraft";

export type TroubleBrewingDistribution = Record<CharacterKind, number>;

const playerCounts = Array.from({ length: 11 }, (_, index) => index + 5);

export function TroubleBrewingSetupPresentation({
  playerCount,
  selectedIds,
  selectedByKind,
  requiredByKind,
  activeCharacterId,
  rosterConfirmed,
  rosterComplete,
  busy,
  onPlayerCountSelect,
  onCharacterSelect,
  onConfirmRoster,
}: {
  playerCount: number;
  selectedIds: string[];
  selectedByKind: TroubleBrewingDistribution;
  requiredByKind: TroubleBrewingDistribution;
  activeCharacterId: string;
  rosterConfirmed: boolean;
  rosterComplete: boolean;
  busy: boolean;
  onPlayerCountSelect: (count: number) => void;
  onCharacterSelect: (characterId: string) => void;
  onConfirmRoster: () => void;
}) {
  const activeCharacter = characters.find((candidate) => candidate.id === activeCharacterId) ?? characters[0];
  const asset = characterAsset(activeCharacter.id);
  const hasBaron = selectedIds.includes("baron");

  return (
    <SetupPresentation
      ariaLabel="Trouble Brewing 직업 설정"
      className="snvSetupSurface snvTabPanel tbSetupSurface"
      controls={<div className="snvSetupControls tbSetupControls">
        <section className="snvControlCard">
          <span>플레이어</span>
          <div className="snvChoiceRow tbPlayerCounts">
            {playerCounts.map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={playerCount === count}
                disabled={rosterConfirmed || busy}
                onClick={() => onPlayerCountSelect(count)}
              >{count}명</button>
            ))}
          </div>
        </section>
        <section className="snvControlCard">
          <span>악마</span>
          <button
            type="button"
            className="tbPinnedDemon"
            aria-label="임프 직업 요약 보기"
            aria-pressed="true"
            onClick={() => onCharacterSelect("imp")}
          >
            {characterAsset("imp") ? <img src={characterAsset("imp")?.src} alt="" /> : null}
            <strong>임프</strong>
          </button>
        </section>
        <section className="snvDistributionFlow" aria-label="인원 구성">
          <DistributionValues values={requiredByKind} />
          <p className={`snvModifierNote ${hasBaron ? "active" : ""}`}>
            {hasBaron ? "남작 · 외지인 +2 / 주민 -2" : "남작 없음 · 인원 보정 없음"}
          </p>
        </section>
      </div>}
      catalog={<RoleCatalog
        ariaLabel="Trouble Brewing 직업 선택 패널"
        className={`snvCatalogPreview tbCatalog${rosterConfirmed ? " rosterConfirmed" : ""}`}
        groupsClassName="snvCatalogGroups"
        groups={characterKinds.map((kind) => ({
          id: kind,
          label: kindLabels[kind],
          selectedCount: selectedByKind[kind],
          requiredCount: requiredByKind[kind],
          roles: characters.filter((candidate) => candidate.kind === kind && candidate.id !== "imp").map((candidate) => {
            const selected = selectedIds.includes(candidate.id);
            const capacityReached = !selected && selectedByKind[kind] >= requiredByKind[kind];
            return {
              id: candidate.id,
              label: candidate.label,
              selected,
              disabled: busy || (!selected && (rosterConfirmed || capacityReached)),
              ariaLabel: candidate.label,
            };
          }),
        }))}
        onSelect={onCharacterSelect}
        renderRole={(role) => <>
          {characterAsset(role.id) ? <img src={characterAsset(role.id)?.src} alt="" /> : null}
          <span>{role.label}</span>
        </>}
      />}
      detail={<aside className="snvRoleDetail fixed floatingAction tbRoleDetail" aria-label="직업 설명">
        <div className="snvRoleDetailIdentity tbRoleIdentity">
          {asset ? <img className="snvRoleDetailIcon" src={asset.src} alt={`${activeCharacter.label} 공식 캐릭터 아이콘`} /> : null}
          <div className="snvRoleDetailCopy">
            <div><span>{kindLabels[activeCharacter.kind]}</span></div>
            <h2>{activeCharacter.label}</h2>
            <p>{activeCharacter.abilitySummary}</p>
          </div>
        </div>
        <div className="snvRoleDetailActions">
          <button
            type="button"
            className="snvConfirmRoster snvStageForward prominent"
            disabled={rosterConfirmed || !rosterComplete || busy}
            onClick={onConfirmRoster}
          >
            <span>{rosterConfirmed ? "확정된 직업" : "직업 선택 확정"}</span><small aria-hidden="true">마도서 →</small>
          </button>
        </div>
      </aside>}
    />
  );
}

function DistributionValues({ values }: { values: TroubleBrewingDistribution }) {
  return <div className="snvDistributionCard emphasized"><h2>인원 구성</h2><div className="snvDistributionValues">
    {characterKinds.map((kind) => (
      <div key={kind} aria-label={`인원 구성 ${kindLabels[kind]} ${values[kind]}명`}>
        <strong>{values[kind]}</strong><span>{kindLabels[kind]}</span>
      </div>
    ))}
  </div></div>;
}
