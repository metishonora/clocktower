import { characters } from "../setupDraft";

export function CharacterSelect({
  value,
  onChange,
  options = characters,
  includeEmpty = false,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options?: typeof characters;
  includeEmpty?: boolean;
  disabled?: boolean;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
      {includeEmpty ? <option value="">미배정</option> : null}
      {options.map((character) => (
        <option value={character.id} key={character.id}>
          {character.label}
        </option>
      ))}
    </select>
  );
}
