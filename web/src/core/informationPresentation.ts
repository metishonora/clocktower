import type {
  BooleanInformationRevealPayload,
  NumericInformationRevealPayload,
  RevealPayload,
} from "./types.js";

import { isScalarInformationCharacterId, scalarInformationLabel, scalarInformationUnit, scalarInformationValueLabel, type ScalarInformationCharacterId } from "../shared-ui/scalarInformationPresentation.js";
export { isScalarInformationCharacterId, scalarInformationLabel, scalarInformationUnit, scalarInformationValueLabel, type ScalarInformationCharacterId };

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
