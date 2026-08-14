import type {
  BooleanInformationRevealPayload,
  NumericInformationRevealPayload,
  RevealPayload,
} from "./types.js";

export type ScalarInformationCharacterId =
  | NumericInformationRevealPayload["characterId"]
  | BooleanInformationRevealPayload["characterId"];

type ScalarInformationPresentation = Readonly<{
  label: string;
  unit?: string;
  trueLabel?: string;
  falseLabel?: string;
}>;

const scalarInformationPresentations = {
  chef: { label: "서로 이웃한 악한 팀", unit: "쌍" },
  empath: { label: "양옆 이웃 중 악한 팀", unit: "명" },
  clockmaker: { label: "악마와 하수인의 거리", unit: "칸" },
  mathematician: { label: "비정상적으로 작동한 능력", unit: "개" },
  oracle: { label: "죽은 악한 플레이어", unit: "명" },
  juggler: { label: "맞힌 추측", unit: "개" },
  flowergirl: {
    label: "오늘 악마가…",
    trueLabel: "투표함",
    falseLabel: "투표하지 않음",
  },
  townCrier: {
    label: "오늘 하수인이…",
    trueLabel: "지목함",
    falseLabel: "지목하지 않음",
  },
} satisfies Record<ScalarInformationCharacterId, ScalarInformationPresentation>;

export function isScalarInformationCharacterId(
  characterId: string,
): characterId is ScalarInformationCharacterId {
  return Object.hasOwn(scalarInformationPresentations, characterId);
}

export function scalarInformationLabel(characterId: ScalarInformationCharacterId): string {
  return scalarInformationPresentations[characterId].label;
}

export function scalarInformationUnit(characterId: ScalarInformationCharacterId): string {
  const presentation: ScalarInformationPresentation = scalarInformationPresentations[characterId];
  return presentation.unit ?? "";
}

export function scalarInformationValueLabel(
  characterId: ScalarInformationCharacterId,
  value: number | boolean,
): string {
  const presentation: ScalarInformationPresentation = scalarInformationPresentations[characterId];
  if (typeof value === "number") return `${value}${presentation.unit ?? ""}`;
  return value ? presentation.trueLabel ?? "예" : presentation.falseLabel ?? "아니요";
}

type AutomatedInformationRevealPayload = Extract<RevealPayload, {
  kind:
    | "numericInformation"
    | "booleanInformation"
    | "dreamerInformation"
    | "seamstressInformation"
    | "sageInformation";
}>;

export function automatedInformationCharacterId(
  payload: AutomatedInformationRevealPayload,
): string {
  if (payload.kind === "numericInformation" || payload.kind === "booleanInformation") {
    return payload.characterId;
  }
  if (payload.kind === "dreamerInformation") return "dreamer";
  if (payload.kind === "seamstressInformation") return "seamstress";
  return "sage";
}
