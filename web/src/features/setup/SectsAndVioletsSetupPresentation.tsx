import { sectsAndVioletsCharacterDetail } from "../../characterDetails";
import { CharacterDetailButton } from "../../components/CharacterRulesCard";
import { RoleCatalog, SetupPresentation } from "../../shared-ui/SetupPresentation";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import {
  sectsAndVioletsCharacters,
  type SectsAndVioletsCharacter,
  type SectsAndVioletsCharacterKind,
} from "../../sectsAndVioletsCharacters";
import {
  sectsAndVioletsBaseDistribution,
  sectsAndVioletsDemonChoices,
  sectsAndVioletsKindLabels,
  sectsAndVioletsKindOrder,
  type SectsAndVioletsDemonChoice,
} from "./sectsAndVioletsSetupAdapter";

export function SectsAndVioletsSetupPresentation({
  playerCount,
  demon,
  selectedIds,
  activeCharacterId,
  selectedByKind,
  requiredByKind,
  distribution,
  storageLoading,
  rosterConfirmed,
  rosterComplete,
  theme,
  onPlayerCountSelect,
  onDemonSelect,
  onCharacterSelect,
  onConfirmRoster,
}: {
  playerCount: number;
  demon: SectsAndVioletsDemonChoice;
  selectedIds: string[];
  activeCharacterId: string;
  selectedByKind: Record<SectsAndVioletsCharacterKind, number>;
  requiredByKind: Record<SectsAndVioletsCharacterKind, number>;
  distribution: { final: [number, number, number, number]; delta: [number, number, number, number] };
  storageLoading: boolean;
  rosterConfirmed: boolean;
  rosterComplete: boolean;
  theme: "snv-day" | "snv-night";
  onPlayerCountSelect: (count: number) => void;
  onDemonSelect: (demon: SectsAndVioletsDemonChoice) => void;
  onCharacterSelect: (character: SectsAndVioletsCharacter) => void;
  onConfirmRoster: () => void;
}) {
  const activeCharacter = sectsAndVioletsCharacters.find(
    (character) => character.id === activeCharacterId,
  ) ?? sectsAndVioletsCharacters[0];
  const activeCharacterAsset = sectsAndVioletsCharacterAsset(activeCharacter.id);
  const selectedDemon = sectsAndVioletsDemonChoices.find((choice) => choice.id === demon)
    ?? sectsAndVioletsDemonChoices[0];

  return (
    <SetupPresentation
      className="snvSetupSurface snvTabPanel"
      ariaLabel="S&V 설정 검토"
      controls={<div className="snvSetupControls">
        <section className="snvControlCard">
          <span>플레이어</span>
          <div className="snvChoiceRow">
            {Object.keys(sectsAndVioletsBaseDistribution).map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={playerCount === Number(count)}
                disabled={storageLoading || rosterConfirmed}
                onClick={() => onPlayerCountSelect(Number(count))}
              >{count}명</button>
            ))}
          </div>
        </section>
        <section className="snvControlCard">
          <span>악마 선택</span>
          <div className="snvChoiceRow">
            {sectsAndVioletsDemonChoices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                aria-pressed={demon === choice.id}
                disabled={storageLoading || rosterConfirmed}
                onClick={() => onDemonSelect(choice.id)}
              >{choice.name}</button>
            ))}
          </div>
        </section>
        <section className="snvDistributionFlow" aria-label="인원 구성">
          <DistributionValues values={distribution.final} />
          <p className="snvModifierNote">
            {distribution.delta[0] === 0 && distribution.delta[1] === 0
              ? `${selectedDemon.name} · 인원 보정 없음`
              : `${selectedDemon.name} 보정 · 마을 주민 ${signed(distribution.delta[0])} · 외부인 ${signed(distribution.delta[1])}`}
          </p>
        </section>
      </div>}
      catalog={<RoleCatalog
        className={`snvCatalogPreview${rosterConfirmed ? " rosterConfirmed" : ""}`}
        groupsClassName="snvCatalogGroups"
        ariaLabel="직업 선택 패널"
        groups={sectsAndVioletsKindOrder.map((kind) => ({
          id: kind,
          label: sectsAndVioletsKindLabels[kind],
          selectedCount: selectedByKind[kind],
          requiredCount: requiredByKind[kind],
          roles: sectsAndVioletsCharacters.filter((character) => character.kind === kind).map((character) => {
            const selected = selectedIds.includes(character.id);
            const demonLocked = kind === "demon";
            const capacityReached = !selected && selectedByKind[kind] >= requiredByKind[kind];
            return {
              id: character.id,
              label: character.name,
              selected,
              disabled: storageLoading || demonLocked || capacityReached,
              ariaLabel: demonLocked
                ? character.id === demon ? `${character.name} 고정됨` : `${character.name} 악마 선택에서 변경`
                : character.name,
            };
          }),
        }))}
        onSelect={(characterId) => onCharacterSelect(
          sectsAndVioletsCharacters.find((character) => character.id === characterId)!,
        )}
        renderRole={(role) => <>
          {sectsAndVioletsCharacterAsset(role.id)
            ? <img src={sectsAndVioletsCharacterAsset(role.id)?.src} alt="" />
            : null}
          <span>{role.label}</span>
        </>}
      />}
      detail={<aside className="snvRoleDetail fixed floatingAction" aria-label="직업 설명">
        <CharacterDetailButton
          details={sectsAndVioletsCharacterDetail(activeCharacter.id)}
          className="snvRoleDetailIdentity"
          theme={theme}
        >
          {activeCharacterAsset ? (
            <img
              className="snvRoleDetailIcon"
              src={activeCharacterAsset.src}
              alt={`${activeCharacter.name} 공식 캐릭터 아이콘`}
            />
          ) : null}
          <div className="snvRoleDetailCopy">
            <div><span>{sectsAndVioletsKindLabels[activeCharacter.kind]}</span></div>
            <h2>{activeCharacter.name}</h2>
            <p>{activeCharacter.ability}</p>
          </div>
        </CharacterDetailButton>
        <div className="snvRoleDetailActions">
          <button
            type="button"
            className="snvConfirmRoster snvStageForward prominent"
            disabled={storageLoading || !rosterComplete}
            onClick={onConfirmRoster}
          >
            <span>직업 선택 확정</span><small aria-hidden="true">마도서 →</small>
          </button>
        </div>
      </aside>}
    />
  );
}

function DistributionValues({ values }: { values: [number, number, number, number] }) {
  return (
    <div className="snvDistributionCard emphasized">
      <h2>인원 구성</h2>
      <div className="snvDistributionValues">
        {values.map((value, index) => (
          <div
            key={sectsAndVioletsKindOrder[index]}
            aria-label={`인원 구성 ${sectsAndVioletsKindLabels[sectsAndVioletsKindOrder[index]]} ${value}명`}
          >
            <strong>{value}</strong>
            <span>{sectsAndVioletsKindLabels[sectsAndVioletsKindOrder[index]]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}
