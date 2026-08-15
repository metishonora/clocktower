import type { RegistrationJudgment } from "../../core/types";

export type TeamTreatment = "good" | "evil";

export type TeamTreatmentOption = {
  team: TeamTreatment;
  label: "선" | "악";
  accessibleLabel: "선한 팀으로 취급" | "악한 팀으로 취급";
  className: "alignment-good" | "alignment-evil";
};

export const TEAM_TREATMENT_OPTIONS: readonly TeamTreatmentOption[] = [
  {
    team: "good",
    label: "선",
    accessibleLabel: "선한 팀으로 취급",
    className: "alignment-good",
  },
  {
    team: "evil",
    label: "악",
    accessibleLabel: "악한 팀으로 취급",
    className: "alignment-evil",
  },
];

export function teamTreatmentChoices<T>(
  canonicalTeam: TeamTreatment,
  canonicalChoice: T,
  registeredAs: RegistrationJudgment["registeredAs"],
  registeredChoice: T,
): Array<TeamTreatmentOption & { choice: T }> {
  const registeredTeam = registrationTreatmentTeam(registeredAs);
  if (canonicalTeam === registeredTeam) return [];
  return TEAM_TREATMENT_OPTIONS.flatMap((option) => {
    if (option.team === canonicalTeam) return [{ ...option, choice: canonicalChoice }];
    if (option.team === registeredTeam) return [{ ...option, choice: registeredChoice }];
    return [];
  });
}

function registrationTreatmentTeam(
  registeredAs: RegistrationJudgment["registeredAs"],
): TeamTreatment {
  return registeredAs === "good" || registeredAs === "townsfolk" || registeredAs === "outsider"
    ? "good"
    : "evil";
}
