import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initSync, propose as wasmPropose, replay as wasmReplay } from "../web/src/generated/clocktower_wasm/clocktower_wasm.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = resolve(repositoryRoot, "fixtures/acceptance/sects-and-violets");
const wasmPath = resolve(repositoryRoot, "web/src/generated/clocktower_wasm/clocktower_wasm_bg.wasm");
const fixedTime = "2026-08-05T00:00:00.000Z";
initSync({ module: Uint8Array.from(readFileSync(wasmPath)) });

const source = {
  script: "https://wiki.bloodontheclocktower.com/Sects_%26_Violets",
  snakeCharmer: "https://wiki.bloodontheclocktower.com/Snake_Charmer",
  mathematician: "https://wiki.bloodontheclocktower.com/Mathematician",
  philosopher: "https://wiki.bloodontheclocktower.com/Philosopher",
  cerenovus: "https://wiki.bloodontheclocktower.com/Cerenovus",
  sweetheart: "https://wiki.bloodontheclocktower.com/Sweetheart",
  barber: "https://wiki.bloodontheclocktower.com/Barber",
  fangGu: "https://wiki.bloodontheclocktower.com/Fang_Gu",
  vigormortis: "https://wiki.bloodontheclocktower.com/Vigormortis",
  noDashii: "https://wiki.bloodontheclocktower.com/No_Dashii",
  vortox: "https://wiki.bloodontheclocktower.com/Vortox",
};

const cases = [];

function parseCoreResult(json, operation) {
  const result = JSON.parse(json);
  if (!result.ok) {
    throw new Error(`${operation}: ${result.error.code} ${result.error.messageKo}`);
  }
  return result.value;
}

function replay(game) {
  return parseCoreResult(wasmReplay(JSON.stringify(game)), `replay ${game.game.id}`);
}

function propose(game, command) {
  return parseCoreResult(
    wasmPropose(JSON.stringify(game), JSON.stringify(command)),
    `propose ${game.game.id} ${JSON.stringify(command)}`,
  );
}

function append(game, command) {
  const proposal = propose(game, command);
  game.game.events.push(proposal.event);
  return proposal;
}

function player(character, seat, name = character) {
  return {
    id: `player-${seat}`,
    seat,
    name,
    actualCharacter: character,
    shownCharacter: character,
  };
}

function game(id, characters, names = {}) {
  const players = characters.map((character, index) => player(character, index + 1, names[index + 1]));
  return {
    schemaVersion: 3,
    game: {
      id: `acceptance-${id}`,
      name: `Sects & Violets 인수 테스트 · ${id}`,
      scriptId: "sectsAndViolets",
      createdAt: fixedTime,
      updatedAt: fixedTime,
      events: [{
        id: `setup-${id}`,
        type: "setupConfirmed",
        phase: "setup",
        payload: { players },
        summary: `초기 설정 확정: ${players.length}명`,
        createdAt: fixedTime,
      }],
    },
  };
}

function confirmStep(step, input, extras = {}) {
  const payload = { stepId: step.id, ...extras };
  if (input !== undefined) payload.input = input;
  return { type: "confirmStep", payload };
}

function firstInformationChoice(step) {
  const check = step.informationPrompt?.targetChecks?.[0];
  if (!check) return undefined;
  const choice = check.choices.find(({ isComputed }) => isComputed) ?? check.choices[0];
  return { check, choice };
}

function defaultCommand(state, { demonTargets = ["player-1"] } = {}) {
  const step = state.currentStep;
  if (!step) throw new Error(`No current step in ${state.phase}`);
  const kind = step.requiredInput.kind;

  if (step.id === "firstNight:demonInfo") {
    return confirmStep(step, { characterIds: step.requiredInput.allowedCharacterIds.slice(0, 3) });
  }
  if (kind === "nomination") return { type: "skipStep", payload: { stepId: step.id } };
  if (kind === "executionDecision") return confirmStep(step, { execute: false });
  if (kind === "nominationVote") return confirmStep(step, { voterIds: [] });
  if (kind === "characterTransformation") {
    return confirmStep(step, { playerIds: [step.playerId], characterIds: ["pitHag"] });
  }
  if (kind === "madnessAssignment") {
    return confirmStep(step, {
      playerIds: [step.requiredInput.allowedPlayerIds[0]],
      characterId: step.requiredInput.allowedCharacterIds[0],
    });
  }
  if (step.support === "manual") {
    return { type: "resolveManualStep", payload: { stepId: step.id, outcome: "handled" } };
  }

  const information = firstInformationChoice(step);
  if (information) {
    return confirmStep(
      step,
      { playerIds: information.check.targetPlayerIds },
      {
        deliveredResult: information.choice.result,
        ...(information.choice.registrationJudgments?.length
          ? { registrationJudgments: information.choice.registrationJudgments }
          : {}),
      },
    );
  }
  if (step.informationPrompt?.computedResult) {
    const computed = step.informationPrompt.computedResult;
    const numberChoice = step.informationPrompt.numberChoices?.find(({ isComputed }) => isComputed)
      ?? step.informationPrompt.numberChoices?.[0];
    const booleanChoice = step.informationPrompt.booleanChoices?.find(({ isComputed }) => isComputed)
      ?? step.informationPrompt.booleanChoices?.[0];
    const deliveredResult = computed.kind === "number" && numberChoice
      ? { kind: "number", value: numberChoice.value }
      : computed.kind === "number" && step.informationPrompt.activeReasons?.some(({ type }) => type === "vortox")
        ? { kind: "number", value: computed.value === 0 ? 1 : 0 }
      : computed.kind === "boolean" && booleanChoice
        ? { kind: "boolean", value: booleanChoice.value }
        : computed.kind === "boolean" && step.informationPrompt.activeReasons?.some(({ type }) => type === "vortox")
          ? { kind: "boolean", value: !computed.value }
        : computed;
    return confirmStep(step, null, { deliveredResult });
  }
  if (kind === "playerIds") {
    const playerIds = step.id.includes(":demon:")
      ? demonTargets
      : step.requiredInput.allowedPlayerIds.slice(0, step.requiredInput.minSelections ?? 1);
    return confirmStep(step, { playerIds });
  }
  if (kind === "characterIds") {
    if (step.canSkip) return { type: "skipStep", payload: { stepId: step.id } };
    return confirmStep(step, { characterIds: step.requiredInput.allowedCharacterIds.slice(0, 1) });
  }
  if (kind === "executionDeathDecision" || kind === "slayerDeathDecision") {
    return confirmStep(step, { died: true });
  }
  if (step.canSkip) return { type: "skipStep", payload: { stepId: step.id } };
  return confirmStep(step, null);
}

function advanceUntil(gameFile, predicate, options = {}) {
  for (let index = 0; index < 160; index += 1) {
    const state = replay(gameFile);
    if (predicate(state)) return state;
    append(gameFile, defaultCommand(state, options));
  }
  throw new Error(`${gameFile.game.id} did not reach the requested checkpoint`);
}

function clone(value) {
  return structuredClone(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hasImpairment(state, expected) {
  return (state.ruleState.activeImpairments ?? []).some((impairment) =>
    Object.entries(expected).every(([key, value]) => impairment[key] === value));
}

function addCase(metadata, gameFile, checkpoint = {}) {
  const state = replay(gameFile);
  const entry = {
    ...metadata,
    file: `${metadata.id}.json`,
    checkpoint: {
      phase: state.phase,
      currentStepId: state.currentStep?.id ?? null,
      ...checkpoint,
    },
  };
  cases.push(entry);
  writeFileSync(resolve(fixtureRoot, entry.file), `${JSON.stringify(gameFile, null, 2)}\n`);
}

mkdirSync(fixtureRoot, { recursive: true });

const fangGuSetup = game("setup-fang-gu-plus-outsider", [
  "clockmaker", "dreamer", "seamstress", "juggler", "mutant", "sweetheart", "pitHag", "fangGu",
]);
addCase({
  id: "setup-fang-gu-plus-outsider",
  categories: ["setup", "first-night"],
  characterIds: ["clockmaker", "dreamer", "seamstress", "juggler", "mutant", "sweetheart", "pitHag", "fangGu"],
  officialSources: [source.script, source.fangGu],
  reproductionStepsKo: [
    "JSON을 불러온 뒤 마도서와 직업 구성을 확인한다.",
    "진행 탭에서 첫날 밤의 첫 단계를 확인한다.",
  ],
  expectedResultsKo: [
    "8명 구성이 주민 4명, 외지인 2명, 하수인 1명, 악마 1명으로 표시된다.",
    "팡 구의 외지인 +1 설정 경고가 없고 첫날 밤 진행이 가능하다.",
  ],
}, fangGuSetup);

const vigormortisSetup = game("setup-vigormortis-no-outsider", [
  "flowergirl", "townCrier", "oracle", "savant", "artist", "sage", "evilTwin", "vigormortis",
]);
addCase({
  id: "setup-vigormortis-no-outsider",
  categories: ["setup"],
  characterIds: ["flowergirl", "townCrier", "oracle", "savant", "artist", "sage", "evilTwin", "vigormortis"],
  officialSources: [source.script, source.vigormortis],
  reproductionStepsKo: ["JSON을 불러온 뒤 직업 구성과 설정 경고를 확인한다."],
  expectedResultsKo: [
    "8명 구성이 주민 6명, 외지인 0명, 하수인 1명, 악마 1명으로 표시된다.",
    "비고르모르티스의 외지인 -1 설정이 적용되고 설정 경고가 없다.",
  ],
}, vigormortisSetup);

const madness = game("cerenovus-madness-assignment", [
  "mutant", "artist", "dreamer", "seamstress", "savant", "witch", "cerenovus", "vortox",
], { 1: "민지", 2: "현우", 7: "하린" });
advanceUntil(madness, (state) =>
  state.currentStep?.character === "cerenovus"
    && state.currentStep.requiredInput.kind === "madnessAssignment");
addCase({
  id: "cerenovus-madness-assignment",
  categories: ["first-night", "day", "madness"],
  characterIds: ["mutant", "artist", "dreamer", "seamstress", "savant", "witch", "cerenovus", "vortox"],
  officialSources: [source.script, source.cerenovus],
  reproductionStepsKo: [
    "집착 지정에서 2번 현우를 고르고 집착할 캐릭터로 시계공을 선택해 확정한다.",
    "공개를 눌러 플레이어용 집착 안내를 확인한 뒤 첫날 밤을 끝까지 진행한다.",
    "낮에 세레노버스 집착 확인을 열어 충분히 집착함과 위반을 각각 기록해 본다.",
  ],
  expectedResultsKo: [
    "공개 화면에는 2번 현우와 내일 시계공이라고 집착해야 한다는 문구만 표시된다.",
    "낮의 판정은 마지막 선택으로 교체되며 이벤트 로그와 자동 저장에도 남는다.",
  ],
}, madness);

const snakeSwap = game("snake-charmer-vigormortis-swap", [
  "snakeCharmer", "clockmaker", "dreamer", "seamstress", "mathematician", "pitHag", "vigormortis",
], { 1: "뱀 조련사", 7: "비고르모르티스" });
advanceUntil(snakeSwap, (state) => state.currentStep?.character === "snakeCharmer");
const swapVerification = clone(snakeSwap);
append(swapVerification, confirmStep(replay(swapVerification).currentStep, { playerIds: ["player-7"] }));
const swapped = replay(swapVerification);
assert(swapped.players[0].actualCharacter === "vigormortis" && swapped.players[0].alignment === "evil", "Snake Charmer did not become evil Vigormortis");
assert(swapped.players[6].actualCharacter === "snakeCharmer" && swapped.players[6].alignment === "good", "old Demon did not become good Snake Charmer");
assert(hasImpairment(swapped, { playerId: "player-7", kind: "poisoned", sourceCharacterId: "snakeCharmer" }), "new Snake Charmer poison missing");
addCase({
  id: "snake-charmer-vigormortis-swap",
  categories: ["first-night", "character-change", "impairment", "persistence"],
  characterIds: ["snakeCharmer", "clockmaker", "dreamer", "seamstress", "mathematician", "pitHag", "vigormortis"],
  officialSources: [source.snakeCharmer, source.vigormortis],
  reproductionStepsKo: [
    "대상으로 7번 비고르모르티스를 선택해 확정한다.",
    "두 역할 공개를 순서대로 완료하고 마도서에서 두 플레이어를 확인한다.",
    "JSON으로 내보내 다시 불러온 뒤 Undo를 실행한다.",
  ],
  expectedResultsKo: [
    "1번은 악한 비고르모르티스, 7번은 선한 중독된 뱀 조련사가 된다.",
    "역할 공개 순서는 1번 다음 7번이며 같은 밤에 새 뱀 조련사가 다시 행동하지 않는다.",
    "재import 뒤 상태가 같고 Undo하면 두 역할·진영·중독이 모두 원래대로 돌아간다.",
  ],
}, snakeSwap);

const overlap = game("overlapping-no-dashii-sweetheart", [
  "clockmaker", "sweetheart", "barber", "oracle", "savant", "pitHag", "noDashii",
]);
advanceUntil(overlap, (state) => state.phase === "night" && state.currentStep?.id.includes(":demon:"), { demonTargets: ["player-2"] });
append(overlap, confirmStep(replay(overlap).currentStep, { playerIds: ["player-2"] }));
let overlapState = replay(overlap);
const sweetheart = overlapState.pendingDeathConsequences?.find(({ kind }) => kind === "sweetheart");
assert(sweetheart, "Sweetheart consequence missing");
append(overlap, {
  type: "resolveSweetheartConsequence",
  payload: {
    stepId: sweetheart.stepId,
    targetPlayerId: "player-1",
    expectedEventCount: overlap.game.events.length,
  },
});
overlapState = replay(overlap);
assert(hasImpairment(overlapState, { playerId: "player-1", kind: "poisoned", sourceCharacterId: "noDashii" }), "No Dashii poison missing");
assert(hasImpairment(overlapState, { playerId: "player-1", kind: "drunk", sourceCharacterId: "sweetheart" }), "Sweetheart drunk missing");
addCase({
  id: "overlapping-no-dashii-sweetheart",
  categories: ["night", "death", "impairment", "persistence"],
  characterIds: ["clockmaker", "sweetheart", "barber", "oracle", "savant", "pitHag", "noDashii"],
  officialSources: [source.sweetheart, source.noDashii],
  reproductionStepsKo: [
    "마도서에서 1번 시계공의 상태 토큰과 상세를 확인한다.",
    "최근 행동 Undo를 한 번 실행하고 다시 1번 상태를 확인한다.",
    "Undo 전 JSON을 export/import해 중첩 상태가 보존되는지도 확인한다.",
  ],
  expectedResultsKo: [
    "1번에는 노 다시 중독과 사랑꾼 취함이 동시에 존재하며 각각의 출처가 구분된다.",
    "Undo하면 사랑꾼 취함만 사라지고 노 다시 중독은 유지된다.",
    "export/import 뒤에도 두 원인과 토큰의 활성 상태가 동일하다.",
  ],
}, overlap, {
  deadPlayerIds: ["player-2"],
  impairments: [
    { playerId: "player-1", kind: "poisoned", sourceCharacterId: "noDashii" },
    { playerId: "player-1", kind: "drunk", sourceCharacterId: "sweetheart" },
  ],
});

const vortoxMath = game("vortox-mathematician-false-number", [
  "mathematician", "evilTwin", "clockmaker", "cerenovus", "vortox", "pitHag", "savant", "oracle",
]);
advanceUntil(vortoxMath, (state) => state.currentStep?.character === "clockmaker");
let mathState = replay(vortoxMath);
const clockTruth = mathState.currentStep.informationPrompt.computedResult.value;
append(vortoxMath, confirmStep(mathState.currentStep, null, {
  deliveredResult: { kind: "number", value: clockTruth + 1 },
}));
advanceUntil(vortoxMath, (state) => state.currentStep?.character === "mathematician");
mathState = replay(vortoxMath);
assert(mathState.currentStep.informationPrompt.computedResult.value === 1, "Mathematician truthful audit should be 1");
const mathVerification = clone(vortoxMath);
append(mathVerification, confirmStep(replay(mathVerification).currentStep, null, {
  deliveredResult: { kind: "number", value: 0 },
}));
addCase({
  id: "vortox-mathematician-false-number",
  categories: ["first-night", "night", "information"],
  characterIds: ["mathematician", "evilTwin", "clockmaker", "cerenovus", "vortox", "pitHag", "savant", "oracle"],
  officialSources: [source.mathematician, source.vortox],
  reproductionStepsKo: [
    "수학자 감사 내역을 펼쳐 시계공의 보르톡스 거짓 정보 기록을 확인한다.",
    "실제 계산값 1과 다른 합법적인 값 0을 전달하고 공개 화면을 완료한다.",
  ],
  expectedResultsKo: [
    "감사 내역은 시계공 한 명을 정확히 한 번만 세고 실제 계산값은 1이다.",
    "수학자에게 전달하는 값은 0으로 기록되며 실제 계산값 1은 이야기꾼 화면에만 남는다.",
  ],
}, vortoxMath);

const multipleDeaths = game("sweetheart-barber-follow-up-order", [
  "sweetheart", "barber", "klutz", "townCrier", "oracle", "pitHag", "witch", "noDashii",
]);
advanceUntil(multipleDeaths, (state) => state.phase === "night" && state.currentStep?.character === "pitHag", { demonTargets: ["player-4"] });
append(multipleDeaths, confirmStep(replay(multipleDeaths).currentStep, {
  playerIds: ["player-5"],
  characterIds: ["vortox"],
}));
advanceUntil(multipleDeaths, (state) => state.currentStep?.id.endsWith("pitHagArbitraryDeaths"), { demonTargets: ["player-4"] });
append(multipleDeaths, confirmStep(replay(multipleDeaths).currentStep, { playerIds: ["player-1", "player-2"] }));
const deathState = replay(multipleDeaths);
assert(deathState.pendingDeathConsequences?.map(({ kind }) => kind).join(",") === "sweetheart,barber", "death consequence order should be Sweetheart then Barber");
addCase({
  id: "sweetheart-barber-follow-up-order",
  categories: ["night", "death", "character-change"],
  characterIds: ["sweetheart", "barber", "klutz", "townCrier", "oracle", "pitHag", "witch", "noDashii"],
  officialSources: [source.sweetheart, source.barber],
  reproductionStepsKo: [
    "첫 후속 처리에서 사랑꾼의 취함 대상을 2번 이발사로 지정한다.",
    "이어지는 이발사 후속 처리에서 악마 선택자와 교환 가능 대상을 확인한 뒤 교환하지 않음을 선택한다.",
  ],
  expectedResultsKo: [
    "사랑꾼 후속 처리가 먼저, 이발사 후속 처리가 두 번째로 제시된다.",
    "이발사는 사망 시점에 정상 상태였으므로 이후 사랑꾼에게 취해도 후속 능력이 취소되지 않는다.",
    "두 후속 처리가 끝난 뒤에만 일반 밤 진행으로 복귀한다.",
  ],
}, multipleDeaths, {
  deadPlayerIds: ["player-1", "player-2"],
  pendingDeathConsequenceKinds: ["sweetheart", "barber"],
});

const fangJump = game("fang-gu-first-outsider-jump", [
  "clockmaker", "dreamer", "artist", "klutz", "sweetheart", "pitHag", "fangGu",
]);
advanceUntil(fangJump, (state) => state.phase === "night" && state.currentStep?.id === "night:demon:player-7");
const jumpVerification = clone(fangJump);
append(jumpVerification, confirmStep(replay(jumpVerification).currentStep, { playerIds: ["player-5"] }));
const jumped = replay(jumpVerification);
assert(jumped.players[6].alive === false, "old Fang Gu should die");
assert(jumped.players[4].actualCharacter === "fangGu" && jumped.players[4].alignment === "evil", "Sweetheart should become evil Fang Gu");
addCase({
  id: "fang-gu-first-outsider-jump",
  categories: ["night", "death", "character-change", "persistence"],
  characterIds: ["clockmaker", "dreamer", "artist", "klutz", "sweetheart", "pitHag", "fangGu"],
  officialSources: [source.fangGu],
  reproductionStepsKo: [
    "공격 대상으로 살아 있는 외지인 5번 사랑꾼을 선택한다.",
    "공개 안내와 새 팡 구 역할 공개를 완료하고 마도서를 확인한다.",
    "export/import 후 Undo를 실행한다.",
  ],
  expectedResultsKo: [
    "5번은 죽지 않고 악한 팡 구가 되며 기존 7번 팡 구가 대신 죽는다.",
    "5번에 한 번 토큰이 생기고 사랑꾼 사망 후속 처리는 발생하지 않는다.",
    "재import 결과가 같고 Undo하면 기존 팡 구와 사랑꾼 상태가 함께 복원된다.",
  ],
}, fangJump);

const vigorAttack = game("vigormortis-kills-minion", [
  "flowergirl", "townCrier", "oracle", "savant", "artist", "pitHag", "vigormortis",
]);
advanceUntil(vigorAttack, (state) => state.phase === "night" && state.currentStep?.id === "night:demon:player-7");
const vigorVerification = clone(vigorAttack);
append(vigorVerification, confirmStep(replay(vigorVerification).currentStep, { playerIds: ["player-6", "player-5"] }));
const vigorAfter = replay(vigorVerification);
assert(vigorAfter.players[5].alive === false, "Vigormortis target Minion should die");
assert(hasImpairment(vigorAfter, { playerId: "player-5", kind: "poisoned", sourceCharacterId: "vigormortis" }), "Vigormortis poison missing");
addCase({
  id: "vigormortis-kills-minion",
  categories: ["night", "death", "impairment"],
  characterIds: ["flowergirl", "townCrier", "oracle", "savant", "artist", "pitHag", "vigormortis"],
  officialSources: [source.vigormortis],
  reproductionStepsKo: [
    "공격 대상으로 6번 마귀할멈을 선택한다.",
    "연동 선택에서 5번 화가를 중독 대상으로 선택하고 확정한다.",
    "마도서에서 6번과 5번의 토큰을 확인한다.",
  ],
  expectedResultsKo: [
    "6번은 죽지만 능력 있음 토큰을 유지한다.",
    "5번에는 비고르모르티스 출처의 중독이 생기며 다른 이웃은 선택할 수 있어도 동시에 둘을 고를 수 없다.",
  ],
}, vigorAttack);

const philosopherMath = game("philosopher-mathematician-duplicate", [
  "philosopher", "artist", "clockmaker", "oracle", "snakeCharmer", "mathematician", "cerenovus", "fangGu",
]);
advanceUntil(philosopherMath, (state) => state.currentStep?.character === "philosopher");
append(philosopherMath, confirmStep(replay(philosopherMath).currentStep, { characterIds: ["mathematician"] }));
advanceUntil(philosopherMath, (state) =>
  state.currentStep?.character === "mathematician" && state.currentStep.playerId === "player-6");
const philosopherState = replay(philosopherMath);
assert(hasImpairment(philosopherState, { playerId: "player-6", kind: "drunk", sourceCharacterId: "philosopher" }), "original Mathematician duplicate drunk missing");
const philosopherVerification = clone(philosopherMath);
append(philosopherVerification, confirmStep(replay(philosopherVerification).currentStep, null, {
  deliveredResult: { kind: "number", value: 1 },
}));
const acquiredMath = replay(philosopherVerification);
assert(acquiredMath.currentStep?.character === "mathematician" && acquiredMath.currentStep.playerId === "player-1", "acquired Mathematician step missing");
assert(acquiredMath.currentStep.informationPrompt.computedResult.value === 1, "acquired Mathematician should count original instance once");
addCase({
  id: "philosopher-mathematician-duplicate",
  categories: ["first-night", "information", "impairment", "persistence"],
  characterIds: ["philosopher", "artist", "clockmaker", "oracle", "snakeCharmer", "mathematician", "cerenovus", "fangGu"],
  officialSources: [source.philosopher, source.mathematician],
  reproductionStepsKo: [
    "현재 원래 수학자에게 실제 값과 다른 1을 전달한다.",
    "다음 철학자 소유 수학자 단계에서 감사 내역과 계산값을 확인한다.",
    "JSON export/import 후 같은 두 능력 인스턴스와 취함 출처가 복원되는지 확인한다.",
  ],
  expectedResultsKo: [
    "6번 원래 수학자는 철학자 중복 때문에 취해 있고 거짓 1을 받을 수 있다.",
    "1번 철학자가 얻은 수학자 능력은 원래 수학자의 비정상 작동을 한 번 세어 실제 값 1을 표시한다.",
    "두 수학자 능력 인스턴스, 취함과 감사 근거가 재import 후 동일하다.",
  ],
}, philosopherMath, {
  impairments: [{ playerId: "player-6", kind: "drunk", sourceCharacterId: "philosopher" }],
});

const vortoxWin = game("vortox-no-execution-win", [
  "clockmaker", "dreamer", "seamstress", "juggler", "mutant", "evilTwin", "vortox",
]);
advanceUntil(vortoxWin, (state) => state.phase === "day" && state.currentStep?.requiredInput.kind === "nomination");
const winVerification = clone(vortoxWin);
append(winVerification, { type: "skipStep", payload: { stepId: replay(winVerification).currentStep.id } });
append(winVerification, confirmStep(replay(winVerification).currentStep, { execute: false }));
assert(replay(winVerification).pendingGameEnd?.cause === "vortoxNoExecution", "Vortox no-execution win missing");
addCase({
  id: "vortox-no-execution-win",
  categories: ["day", "win"],
  characterIds: ["clockmaker", "dreamer", "seamstress", "juggler", "mutant", "evilTwin", "vortox"],
  officialSources: [source.vortox],
  reproductionStepsKo: [
    "지명 종료를 선택하고 처형 없음을 확정한다.",
    "악 진영 승리 확인 창에서 사유를 확인한 뒤 게임 종료를 확정한다.",
    "Undo 후 같은 낮 상태로 복원되는지 확인한다.",
  ],
  expectedResultsKo: [
    "보르톡스가 존재하지만 처형이 없었다는 사유의 악 진영 승리 확인이 나타난다.",
    "종료 확정 후 마도서는 읽기 전용이 되고 Undo하면 승리 확정 전 상태로 돌아간다.",
  ],
}, vortoxWin);

const requiredCategories = [
  "setup",
  "first-night",
  "day",
  "night",
  "information",
  "madness",
  "character-change",
  "impairment",
  "death",
  "win",
  "persistence",
];

const manifest = {
  schemaVersion: 2,
  script: "sectsAndViolets",
  issue: 111,
  generatedAt: fixedTime,
  officialSources: [...new Set([source.script, ...cases.flatMap(({ officialSources }) => officialSources)])],
  requiredCategories,
  cases,
};

writeFileSync(resolve(fixtureRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${cases.length} Sects & Violets issue 111 acceptance fixtures.`);
