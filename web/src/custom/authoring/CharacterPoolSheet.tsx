import { kindOrder, kindLabels, sourceLabels, type CatalogCharacter, type SourceFilter, type KindFilter, type ScriptSource } from './characterPresentation.js';
import type { CharacterKind } from '../characterCatalog.js';
export function CharacterPoolSheet({
  name,
  selectedIds,
  counts,
  activeKind,
  sourceFilter,
  query,
  characters: visibleCharacters,
  focusedCharacter,
  onNameChange,
  onActiveKindChange,
  onSourceFilterChange,
  onQueryChange,
  onToggleCharacter,
  onCloseCharacter,
  onBack,
  onContinue,
}: {
  name: string;
  selectedIds: string[];
  counts: Record<CharacterKind, number>;
  activeKind: KindFilter;
  sourceFilter: SourceFilter;
  query: string;
  characters: CatalogCharacter[];
  focusedCharacter?: CatalogCharacter;
  onNameChange: (name: string) => void;
  onActiveKindChange: (kind: CharacterKind) => void;
  onSourceFilterChange: (source: SourceFilter) => void;
  onQueryChange: (query: string) => void;
  onToggleCharacter: (characterId: string) => void;
  onCloseCharacter: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="issue200CharacterSheet" aria-labelledby="issue200-character-title">
      <header className="issue200CharacterHeader">
        <h1 id="issue200-character-title">Ⅱ. 캐릭터 선택</h1>
      </header>

      <div className="issue200CharacterFields">
        <label className="issue200CharacterName">
          <span>시나리오 이름</span>
          <input
            value={name}
            placeholder="이름을 입력하세요"
            onChange={(event) => onNameChange(event.target.value)}
          />
        </label>
        <label className="issue200CharacterSearch">
          <span>캐릭터 검색</span>
          <input
            type="search"
            value={query}
            placeholder="한글·영문 이름으로 찾기"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
      </div>

      <div className="issue200CharacterFilters">
        <div className="issue200CharacterKinds" role="tablist" aria-label="캐릭터 종류">
          {kindOrder.map((kind) => (
            <button
              key={kind}
              type="button"
              className={`kind-${kind.toLowerCase()}`}
              role="tab"
              aria-selected={activeKind === kind}
              onClick={() => onActiveKindChange(kind)}
            >{kindLabels[kind]} <small>{counts[kind]}</small></button>
          ))}
        </div>
        <div className="issue200CharacterSources" role="group" aria-label="원본 스크립트">
          {(["all", "troubleBrewing", "sectsAndViolets"] as SourceFilter[]).map((source) => (
            <button
              key={source}
              type="button"
              aria-pressed={sourceFilter === source}
              onClick={() => onSourceFilterChange(source)}
            >{source === "all" ? "전체" : sourceLabels[source]}</button>
          ))}
        </div>
      </div>

      <div className="issue200CharacterCatalog">
        <div className="issue200CharacterGrid" aria-live="polite">
          {visibleCharacters.map((character) => {
            const selected = selectedIds.includes(character.id);
            return (
              <button
                key={character.id}
                type="button"
                className={`kind-${character.kind.toLowerCase()}`}
                aria-pressed={selected}
                aria-describedby={focusedCharacter?.id === character.id ? "issue200-character-detail" : undefined}
                onClick={() => onToggleCharacter(character.id)}
              >
                <span>
                  {character.image ? <img src={character.image} alt="" /> : <b>{character.label[0]}</b>}
                  <i aria-hidden="true">✓</i>
                </span>
                <strong>{character.label}</strong>
              </button>
            );
          })}
          {visibleCharacters.length === 0 ? <p>검색 결과가 없습니다.</p> : null}
        </div>

      </div>

      <footer className={`issue200CharacterFooter${focusedCharacter ? " has-detail" : ""}`}>
        {focusedCharacter ? (
          <aside className={`issue200CharacterDetail kind-${focusedCharacter.kind.toLowerCase()}`} id="issue200-character-detail" aria-live="polite">
            <span className="issue200CharacterDetailToken">
              {focusedCharacter.image ? <img src={focusedCharacter.image} alt="" /> : <b>{focusedCharacter.label[0]}</b>}
            </span>
            <div>
              <header>
                <h2>{focusedCharacter.label}</h2>
                <small>{focusedCharacter.englishLabel} · {kindLabels[focusedCharacter.kind]} · {sourceLabels[focusedCharacter.source]}</small>
              </header>
              <p>{focusedCharacter.ability}</p>
            </div>
            <button type="button" aria-label="직업 요약 닫기" onClick={onCloseCharacter}>×</button>
          </aside>
        ) : null}
        <div>
          <button type="button" className="issue200CharacterBack" onClick={onBack}>이전으로</button>
          <button type="button" className="issue200CharacterContinue" onClick={onContinue}>선택 완료</button>
        </div>
      </footer>
    </section>
  );
}
