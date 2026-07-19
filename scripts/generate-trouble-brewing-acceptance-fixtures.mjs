import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initSync, propose as wasmPropose, replay as wasmReplay } from "../web/src/generated/clocktower_wasm/clocktower_wasm.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wasmPath = resolve(repositoryRoot, "web/src/generated/clocktower_wasm/clocktower_wasm_bg.wasm");
const fixtureRoot = resolve(repositoryRoot, "fixtures/acceptance/trouble-brewing");
initSync({ module: Uint8Array.from(readFileSync(wasmPath)) });

const source = {
  troubleBrewing: "https://wiki.bloodontheclocktower.com/Trouble_Brewing",
  glossary: "https://wiki.bloodontheclocktower.com/Glossary",
  washerwoman: "https://wiki.bloodontheclocktower.com/Washerwoman",
  librarian: "https://wiki.bloodontheclocktower.com/Librarian",
  investigator: "https://wiki.bloodontheclocktower.com/Investigator",
  chef: "https://wiki.bloodontheclocktower.com/Chef",
  empath: "https://wiki.bloodontheclocktower.com/Empath",
  fortuneTeller: "https://wiki.bloodontheclocktower.com/Fortune_Teller",
  undertaker: "https://wiki.bloodontheclocktower.com/Undertaker",
  monk: "https://wiki.bloodontheclocktower.com/Monk",
  ravenkeeper: "https://wiki.bloodontheclocktower.com/Ravenkeeper",
  virgin: "https://wiki.bloodontheclocktower.com/Virgin",
  slayer: "https://wiki.bloodontheclocktower.com/Slayer",
  soldier: "https://wiki.bloodontheclocktower.com/Soldier",
  mayor: "https://wiki.bloodontheclocktower.com/Mayor",
  butler: "https://wiki.bloodontheclocktower.com/Butler",
  drunk: "https://wiki.bloodontheclocktower.com/Drunk",
  recluse: "https://wiki.bloodontheclocktower.com/Recluse",
  saint: "https://wiki.bloodontheclocktower.com/Saint",
  poisoner: "https://wiki.bloodontheclocktower.com/Poisoner",
  spy: "https://wiki.bloodontheclocktower.com/Spy",
  scarletWoman: "https://wiki.bloodontheclocktower.com/Scarlet_Woman",
  baron: "https://wiki.bloodontheclocktower.com/Baron",
  imp: "https://wiki.bloodontheclocktower.com/Imp",
};

const cases = [];
const fixedTime = "2026-07-19T00:00:00.000Z";

function emptyGame(id) {
  return {
    schemaVersion: 2,
    game: {
      id: `acceptance-${id}`,
      name: `Trouble Brewing 인수 테스트 · ${id}`,
      createdAt: fixedTime,
      updatedAt: fixedTime,
      events: [],
    },
  };
}

function roster(characterIds, shownCharacters = {}) {
  return characterIds.map((actualCharacter, index) => ({
    id: `player-${index + 1}`,
    seat: index + 1,
    name: `플레이어 ${index + 1}`,
    actualCharacter,
    shownCharacter: shownCharacters[index + 1] ?? actualCharacter,
  }));
}

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

function appendCommand(game, command) {
  const proposal = propose(game, command);
  game.game.events.push(proposal.event);
  return proposal;
}

function createGame(id, players) {
  const game = emptyGame(id);
  appendCommand(game, { type: "createGame", payload: { players } });
  return game;
}

function confirmStep(stepId, input, extras = {}) {
  const payload = { stepId, ...extras };
  if (input !== undefined) payload.input = input;
  return { type: "confirmStep", payload };
}

function skipStep(stepId) {
  return { type: "skipStep", payload: { stepId } };
}

function defaultCommand(step) {
  if (step.canSkip) return skipStep(step.id);
  const required = step.requiredInput;
  switch (required.kind) {
    case "none":
    case "day":
    case "night":
      return confirmStep(step.id);
    case "characterIds":
      return confirmStep(step.id, { characterIds: [] });
    case "playerIds": {
      const count = required.minSelections ?? 1;
      const choices = required.allowedPlayerIds ?? [];
      if (choices.length < count) throw new Error(`No default player input for ${step.id}`);
      return confirmStep(step.id, { playerIds: choices.slice(0, count) });
    }
    case "nomination":
      return skipStep(step.id);
    case "nominationVote":
      return confirmStep(step.id, { voterIds: [] });
    case "executionDecision":
      return confirmStep(step.id, { execute: false });
    case "executionDeathDecision":
    case "slayerDeathDecision":
      return confirmStep(step.id, { died: true });
    case "demonSuccession": {
      const successorPlayerId = required.demonSuccession?.fixedSuccessorPlayerId
        ?? required.demonSuccession?.eligibleSuccessorPlayerIds?.[0];
      if (!successorPlayerId) throw new Error(`No default successor for ${step.id}`);
      return confirmStep(step.id, { successorPlayerId });
    }
    default:
      throw new Error(`No default command for ${step.id} (${required.kind})`);
  }
}

function advanceTo(game, targetStepId, overrides = {}) {
  for (let index = 0; index < 100; index += 1) {
    const state = replay(game);
    if (state.currentStep?.id === targetStepId) return state;
    if (!state.currentStep) throw new Error(`${game.game.id} ended before ${targetStepId}`);
    const override = overrides[state.currentStep.id];
    const command = typeof override === "function"
      ? override(state.currentStep, state, game)
      : override ?? defaultCommand(state.currentStep);
    appendCommand(game, command);
  }
  throw new Error(`${game.game.id} did not reach ${targetStepId}`);
}

function appendManualDeath(game, playerId) {
  const phase = replay(game).phase;
  game.game.events.push({
    id: `fixture-death-${game.game.events.length + 1}-${playerId}`,
    type: "deathConfirmed",
    phase,
    payload: { playerId },
    summary: `인수 테스트 사전 상태 · ${playerId} 사망`,
    createdAt: fixedTime,
  });
  replay(game);
}

function alivePlayerIds(game) {
  return replay(game).players.filter(({ alive }) => alive).map(({ id }) => id);
}

function startNomination(game, nominatorId, nomineeId, registrationJudgments = []) {
  const step = replay(game).currentStep;
  if (step?.requiredInput.kind !== "nomination") {
    throw new Error(`${game.game.id} is not at a nomination step`);
  }
  appendCommand(game, confirmStep(
    step.id,
    { nominatorId, nomineeId },
    registrationJudgments.length > 0 ? { registrationJudgments } : {},
  ));
}

function confirmNominationVote(game, voterIds) {
  const step = replay(game).currentStep;
  if (step?.requiredInput.kind !== "nominationVote") {
    throw new Error(`${game.game.id} is not at a nomination vote step`);
  }
  appendCommand(game, confirmStep(step.id, { voterIds }));
}

function prepareExecutionDeath(game, nomineeId, { nominatorId, voterIds } = {}) {
  const alive = alivePlayerIds(game);
  const nominator = nominatorId ?? alive.find((id) => id !== nomineeId);
  const voters = voterIds ?? alive.slice(0, Math.ceil(alive.length / 2));
  startNomination(game, nominator, nomineeId);
  confirmNominationVote(game, voters);
  const nextNomination = replay(game).currentStep;
  appendCommand(game, skipStep(nextNomination.id));
  const execution = replay(game).currentStep;
  appendCommand(game, confirmStep(execution.id, { execute: true }));
  const deathStep = replay(game).currentStep;
  if (deathStep?.requiredInput.kind !== "executionDeathDecision") {
    throw new Error(`${game.game.id} did not reach execution death`);
  }
  return deathStep;
}

function confirmExecutionDeath(game) {
  const step = replay(game).currentStep;
  appendCommand(game, confirmStep(step.id, { died: true }));
}

async function addCase(metadata, build) {
  const game = await build();
  const state = replay(game);
  const entry = {
    ...metadata,
    file: `${metadata.id}.json`,
  };
  cases.push(entry);
  writeFileSync(resolve(fixtureRoot, entry.file), `${JSON.stringify(game, null, 2)}\n`);
  return state;
}

mkdirSync(fixtureRoot, { recursive: true });

await addCase({
  id: "setup-standard-distribution",
  category: "setup",
  characterIds: ["washerwoman", "librarian", "investigator", "chef", "empath", "poisoner", "imp"],
  officialSource: source.troubleBrewing,
  actionKo: "불러온 직후 7명 구성과 직업 분포 5/0/1/1을 확인하고 첫날 밤 진행을 시작한다.",
  expectedKo: "설정 경고 없이 7명이 좌석순으로 표시되고 첫 단계가 악의 팀 정보 단계다.",
  checkpoint: { phase: "firstNight", currentStepId: "firstNight:minionInfo" },
}, () => createGame("setup-standard-distribution", roster([
  "washerwoman", "librarian", "investigator", "chef", "empath", "poisoner", "imp",
])));

await addCase({
  id: "setup-baron-outsiders",
  category: "setup",
  characterIds: ["washerwoman", "chef", "empath", "butler", "saint", "baron", "imp"],
  officialSource: source.baron,
  actionKo: "구성에서 남작 때문에 주민 2명이 외지인 2명으로 교체되었는지 확인한다.",
  expectedKo: "7명 분포가 3/2/1/1이며 남작이 죽더라도 이 설정 효과는 되돌아가지 않는다.",
  checkpoint: { phase: "firstNight", currentStepId: "firstNight:minionInfo" },
}, () => createGame("setup-baron-outsiders", roster([
  "washerwoman", "chef", "empath", "butler", "saint", "baron", "imp",
])));

await addCase({
  id: "setup-drunk-shown-townsfolk",
  category: "setup",
  characterIds: ["drunk", "slayer", "poisoner", "imp"],
  officialSource: source.drunk,
  actionKo: "6번 플레이어의 실제 직업과 보여 준 직업을 비교한다.",
  expectedKo: "실제 직업은 Drunk이고 보여 준 직업은 Slayer이며 플레이어용 표시는 Slayer처럼 진행된다.",
  checkpoint: { phase: "firstNight", currentStepId: "firstNight:minionInfo", slayerAbilityPresent: false },
}, () => createGame("setup-drunk-shown-townsfolk", roster([
  "washerwoman", "chef", "empath", "fortuneTeller", "virgin", "drunk", "poisoner", "imp",
], { 6: "slayer" })));

await addCase({
  id: "setup-duplicate-character-warning",
  category: "setup",
  characterIds: ["washerwoman", "chef", "empath", "fortuneTeller", "poisoner", "imp"],
  officialSource: source.troubleBrewing,
  actionKo: "중복 실제 직업 경고를 확인한다.",
  expectedKo: "설정을 막지는 않지만 DUPLICATE_ACTUAL_CHARACTER 경고가 표시된다.",
  checkpoint: { phase: "firstNight", currentStepId: "firstNight:minionInfo", warningCodes: ["DUPLICATE_ACTUAL_CHARACTER"] },
}, () => createGame("setup-duplicate-character-warning", roster([
  "washerwoman", "washerwoman", "chef", "empath", "fortuneTeller", "poisoner", "imp",
])));

await addCase({
  id: "small-game-evil-info-known-deviation",
  category: "known-deviation",
  characterIds: ["washerwoman", "chef", "empath", "poisoner", "imp"],
  officialSource: source.glossary,
  actionKo: "5명 게임을 불러온 직후 현재 단계를 확인한다.",
  expectedKo: "공식 룰과 달리 앱이 Minion 정보 단계를 표시하는 현재 불일치를 재현한다.",
  checkpoint: { phase: "firstNight", currentStepId: "firstNight:minionInfo" },
  knownDeviation: {
    officialExpectationKo: "5~6명 게임에서는 Minion 정보와 Demon 정보 및 블러프 3개를 제공하지 않는다.",
    observedAppBehaviorKo: "현재 앱은 5명 게임에서도 firstNight:minionInfo와 firstNight:demonInfo를 생성한다.",
  },
}, () => createGame("small-game-evil-info-known-deviation", roster([
  "washerwoman", "chef", "empath", "poisoner", "imp",
])));

const standardInfoRoster = ["washerwoman", "chef", "empath", "fortuneTeller", "virgin", "poisoner", "imp"];

await addCase({
  id: "washerwoman-normal-information",
  category: "first-night-information",
  characterIds: ["washerwoman", "chef"],
  officialSource: source.washerwoman,
  actionKo: "요리사와 다른 플레이어를 선택하고 요리사 토큰을 전달한다.",
  expectedKo: "두 후보 중 실제 요리사가 정확히 한 명 포함된 고정 정보가 확정된다.",
  checkpoint: { phase: "firstNight", currentStepId: "firstNight:washerwoman" },
}, () => {
  const game = createGame("washerwoman-normal-information", roster(standardInfoRoster));
  advanceTo(game, "firstNight:washerwoman");
  return game;
});

await addCase({
  id: "washerwoman-spy-registration",
  category: "registration",
  characterIds: ["washerwoman", "spy"],
  officialSource: source.washerwoman,
  actionKo: "Spy를 후보에 넣고 원하는 Townsfolk로 등록시켜 정보를 확정한다.",
  expectedKo: "Spy가 그 검사에서만 good/Townsfolk 및 선택한 특정 Townsfolk로 등록될 수 있다.",
  checkpoint: { phase: "firstNight", currentStepId: "firstNight:washerwoman" },
}, () => {
  const game = createGame("washerwoman-spy-registration", roster([
    "washerwoman", "chef", "empath", "fortuneTeller", "virgin", "spy", "imp",
  ]));
  advanceTo(game, "firstNight:washerwoman");
  return game;
});

await addCase({
  id: "librarian-zero-outsiders",
  category: "first-night-information",
  characterIds: ["librarian"],
  officialSource: source.librarian,
  actionKo: "외지인 0명 옵션을 선택해 정보를 확정한다.",
  expectedKo: "실제 외지인이 없으므로 0명 정보가 고정 정보로 전달된다.",
  checkpoint: { phase: "firstNight", currentStepId: "firstNight:librarian" },
}, () => {
  const game = createGame("librarian-zero-outsiders", roster([
    "librarian", "washerwoman", "chef", "empath", "fortuneTeller", "poisoner", "imp",
  ]));
  advanceTo(game, "firstNight:librarian");
  return game;
});

await addCase({
  id: "librarian-spy-registration",
  category: "registration",
  characterIds: ["librarian", "spy"],
  officialSource: source.librarian,
  actionKo: "Spy를 후보에 넣고 특정 Outsider로 등록시켜 정보를 확정한다.",
  expectedKo: "Spy를 Outsider로 보는 선택지와 실제 외지인 0명 선택지가 모두 제공된다.",
  checkpoint: { phase: "firstNight", currentStepId: "firstNight:librarian" },
}, () => {
  const game = createGame("librarian-spy-registration", roster([
    "librarian", "washerwoman", "chef", "empath", "fortuneTeller", "spy", "imp",
  ]));
  advanceTo(game, "firstNight:librarian");
  return game;
});

await addCase({
  id: "investigator-recluse-registration",
  category: "registration",
  characterIds: ["investigator", "recluse", "poisoner"],
  officialSource: source.investigator,
  actionKo: "Recluse를 후보에 넣고 특정 Minion으로 등록시키거나 실제 Poisoner 정보를 선택한다.",
  expectedKo: "정상 정보와 Recluse의 검사별 Minion 등록 정보가 구분되어 선택된다.",
  checkpoint: { phase: "firstNight", currentStepId: "firstNight:investigator" },
}, () => {
  const game = createGame("investigator-recluse-registration", roster([
    "investigator", "washerwoman", "chef", "empath", "fortuneTeller", "recluse", "poisoner", "imp",
  ]));
  advanceTo(game, "firstNight:investigator");
  return game;
});

await addCase({
  id: "chef-evil-pairs-and-recluse",
  category: "registration",
  characterIds: ["chef", "recluse", "poisoner", "imp"],
  officialSource: source.chef,
  actionKo: "계산된 evil 인접쌍 수와 Recluse를 evil로 등록했을 때의 대체 수치를 비교한다.",
  expectedKo: "원형의 8번 Imp와 1번 Chef 경계도 인접으로 계산되며 Recluse 등록은 해당 검사에만 적용된다.",
  checkpoint: { phase: "firstNight", currentStepId: "firstNight:chef" },
}, () => {
  const game = createGame("chef-evil-pairs-and-recluse", roster([
    "chef", "recluse", "washerwoman", "empath", "fortuneTeller", "virgin", "poisoner", "imp",
  ]));
  advanceTo(game, "firstNight:chef");
  return game;
});

await addCase({
  id: "empath-alive-neighbors",
  category: "night-information",
  characterIds: ["empath", "imp"],
  officialSource: source.empath,
  actionKo: "1번 Empath의 계산값을 확인하고 그대로 전달한다.",
  expectedKo: "원형 좌우의 살아 있는 이웃 중 8번 Imp 한 명만 evil이므로 1을 받는다.",
  checkpoint: { phase: "firstNight", currentStepId: "firstNight:empath" },
}, () => {
  const game = createGame("empath-alive-neighbors", roster([
    "empath", "washerwoman", "chef", "fortuneTeller", "virgin", "poisoner", "librarian", "imp",
  ]));
  advanceTo(game, "firstNight:empath");
  return game;
});

await addCase({
  id: "fortune-teller-red-herring",
  category: "setup-information",
  characterIds: ["fortuneTeller"],
  officialSource: source.fortuneTeller,
  actionKo: "살아 있는 good 플레이어 한 명을 Red Herring으로 지정한다.",
  expectedKo: "같은 플레이어가 게임 내내 Red Herring으로 유지되고 Fortune Teller 자신도 선택할 수 있다.",
  checkpoint: { phase: "firstNight", currentStepId: "firstNight:fortuneTellerRedHerring" },
}, () => {
  const game = createGame("fortune-teller-red-herring", roster([
    "fortuneTeller", "washerwoman", "chef", "empath", "virgin", "poisoner", "imp",
  ]));
  advanceTo(game, "firstNight:fortuneTellerRedHerring");
  return game;
});

await addCase({
  id: "fortune-teller-recluse-registration",
  category: "registration",
  characterIds: ["fortuneTeller", "recluse", "imp"],
  officialSource: source.fortuneTeller,
  actionKo: "Recluse와 다른 플레이어를 선택하고 Recluse를 Demon으로 등록한 결과와 정상 결과를 비교한다.",
  expectedKo: "실제 Imp, Red Herring, Recluse 등록 각각이 yes를 만드는 이유로 분리되어 표시된다.",
  checkpoint: { phase: "firstNight", currentStepId: "firstNight:fortuneTeller" },
}, () => {
  const game = createGame("fortune-teller-recluse-registration", roster([
    "fortuneTeller", "washerwoman", "chef", "empath", "virgin", "recluse", "poisoner", "imp",
  ]));
  advanceTo(game, "firstNight:fortuneTeller", {
    "firstNight:fortuneTellerRedHerring": confirmStep("firstNight:fortuneTellerRedHerring", { playerIds: ["player-2"] }),
  });
  return game;
});

await addCase({
  id: "fortune-teller-detects-dead-demon",
  category: "night-information",
  characterIds: ["fortuneTeller", "imp"],
  officialSource: source.fortuneTeller,
  actionKo: "이미 죽은 8번 Imp와 다른 플레이어를 선택한다.",
  expectedKo: "죽은 Demon도 Demon으로 등록하므로 Fortune Teller 결과가 yes다.",
  checkpoint: {
    phase: "firstNight",
    currentStepId: "firstNight:fortuneTeller",
    warningCodes: ["DEMON_DEAD_GOOD_WIN"],
    deadPlayerIds: ["player-8"],
  },
}, () => {
  const game = createGame("fortune-teller-detects-dead-demon", roster([
    "fortuneTeller", "washerwoman", "chef", "empath", "virgin", "saint", "poisoner", "imp",
  ]));
  appendManualDeath(game, "player-8");
  advanceTo(game, "firstNight:fortuneTeller", {
    "firstNight:fortuneTellerRedHerring": confirmStep("firstNight:fortuneTellerRedHerring", { playerIds: ["player-2"] }),
  });
  return game;
});

await addCase({
  id: "empath-skips-dead-neighbors",
  category: "night-information",
  characterIds: ["empath", "imp", "poisoner"],
  officialSource: source.empath,
  actionKo: "1번 Empath의 양옆 dead 플레이어를 건너뛴 살아 있는 이웃 계산값을 확인한다.",
  expectedKo: "2번과 8번을 건너뛰어 3번 Imp와 7번 Poisoner를 이웃으로 보므로 2를 받는다.",
  checkpoint: { phase: "night", currentStepId: "night:empath", deadPlayerIds: ["player-2", "player-8"] },
}, () => {
  const game = createGame("empath-skips-dead-neighbors", roster([
    "empath", "washerwoman", "imp", "chef", "fortuneTeller", "virgin", "poisoner", "butler",
  ]));
  advanceTo(game, "day:toNight");
  appendManualDeath(game, "player-2");
  appendManualDeath(game, "player-8");
  advanceTo(game, "night:empath");
  return game;
});

await addCase({
  id: "poisoner-false-empath-information",
  category: "impairment",
  characterIds: ["poisoner", "empath"],
  officialSource: source.poisoner,
  actionKo: "poisoned Empath에게 계산값과 다른 수치를 선택해 전달한다.",
  expectedKo: "Empath는 정상적으로 깨어나지만 선택 가능한 거짓 정보가 poison 사유와 함께 기록된다.",
  checkpoint: { phase: "firstNight", currentStepId: "firstNight:empath", activePoisonTargetId: "player-1" },
}, () => {
  const game = createGame("poisoner-false-empath-information", roster([
    "empath", "washerwoman", "chef", "fortuneTeller", "virgin", "poisoner", "librarian", "imp",
  ]));
  advanceTo(game, "firstNight:empath", {
    "firstNight:poisoner": confirmStep("firstNight:poisoner", { playerIds: ["player-1"] }),
  });
  return game;
});

await addCase({
  id: "poisoner-expiry-at-next-dusk",
  category: "impairment",
  characterIds: ["poisoner", "empath"],
  officialSource: source.poisoner,
  actionKo: "새 밤의 Poisoner 단계에서 이전 독 상태가 사라졌는지 확인한 뒤 새 대상을 고른다.",
  expectedKo: "첫날 밤에 지정한 독은 다음 낮까지 유지되지만 다음 dusk에 해제되어 activePoison이 비어 있다.",
  checkpoint: { phase: "night", currentStepId: "night:poisoner", activePoisonTargetId: null },
}, () => {
  const game = createGame("poisoner-expiry-at-next-dusk", roster([
    "empath", "washerwoman", "chef", "fortuneTeller", "virgin", "poisoner", "librarian", "imp",
  ]));
  advanceTo(game, "night:poisoner", {
    "firstNight:poisoner": confirmStep("firstNight:poisoner", { playerIds: ["player-1"] }),
  });
  return game;
});

await addCase({
  id: "poisoner-death-ends-poison",
  category: "impairment",
  characterIds: ["poisoner", "empath"],
  officialSource: source.poisoner,
  actionKo: "poisoned Empath가 있는 상태에서 처형된 Poisoner의 사망을 확정한다.",
  expectedKo: "Poisoner가 죽는 즉시 지속 중인 독 효과가 끝나고 Empath가 healthy가 된다.",
  checkpoint: { phase: "day", currentStepId: "day:executionDeath", activePoisonTargetId: "player-1" },
}, () => {
  const game = createGame("poisoner-death-ends-poison", roster([
    "empath", "washerwoman", "chef", "fortuneTeller", "virgin", "saint", "poisoner", "imp",
  ]));
  advanceTo(game, "day:nomination:1", {
    "firstNight:poisoner": confirmStep("firstNight:poisoner", { playerIds: ["player-1"] }),
  });
  prepareExecutionDeath(game, "player-7");
  return game;
});

await addCase({
  id: "spy-grimoire-reveal",
  category: "night-information",
  characterIds: ["monk", "poisoner", "spy"],
  officialSource: source.spy,
  actionKo: "Spy 단계를 확정해 플레이어 전용 Grimoire 공개 화면을 연다.",
  expectedKo: "현재 밤의 중독·보호와 실제 직업·생사·유령 투표만 보이고 이전 밤 상태와 수동 토큰·Notes는 숨겨진다.",
  checkpoint: {
    phase: "night",
    currentStepId: "night2:spy",
    activePoisonTargetId: "player-1",
    activeProtectionTargetId: "player-4",
    deadPlayerIds: ["player-6"],
    ghostVoteUsedPlayerIds: ["player-6"],
    spyReveal: {
      visibleReminderTokens: [
        { seat: 1, tokens: ["poisoned"] },
        { seat: 4, tokens: ["protected"] },
      ],
      hiddenReminderTokenSeats: [2, 3, 7],
      excludedText: ["abilitySpent", "redHerring", "safe", "INF-05 비공개 Storyteller Notes"],
    },
  },
}, () => {
  const game = createGame("spy-grimoire-reveal", roster([
    "washerwoman", "chef", "empath", "fortuneTeller", "monk",
    "virgin", "mayor", "poisoner", "spy", "imp",
  ]));
  appendCommand(game, {
    type: "updatePlayerAnnotations",
    payload: {
      playerId: "player-7",
      expectedEventCount: game.game.events.length,
      systemTokenIds: ["protected", "abilitySpent"],
      scriptTokens: [
        { characterId: "poisoner", tokenId: "poisoned" },
        { characterId: "monk", tokenId: "safe" },
        { characterId: "fortuneTeller", tokenId: "redHerring" },
      ],
      notes: "INF-05 비공개 Storyteller Notes",
    },
  });
  advanceTo(game, "day:nomination:1", {
    "firstNight:poisoner": confirmStep("firstNight:poisoner", { playerIds: ["player-2"] }),
  });
  appendManualDeath(game, "player-6");
  startNomination(game, "player-1", "player-2");
  confirmNominationVote(game, ["player-6"]);
  advanceTo(game, "night2:spy", {
    "night:poisoner": confirmStep("night:poisoner", { playerIds: ["player-2"] }),
    "night:monk": confirmStep("night:monk", { playerIds: ["player-3"] }),
    "night:imp": confirmStep("night:imp", { playerIds: ["player-6"] }),
    "night2:poisoner": confirmStep("night2:poisoner", { playerIds: ["player-1"] }),
    "night2:monk": confirmStep("night2:monk", { playerIds: ["player-4"] }),
    "night2:imp": confirmStep("night2:imp", { playerIds: ["player-6"] }),
  });
  return game;
});

await addCase({
  id: "butler-master-selection",
  category: "voting",
  characterIds: ["butler"],
  officialSource: source.butler,
  actionKo: "Butler 자신이 아닌 플레이어를 Master로 지정한다.",
  expectedKo: "내일 Master가 투표 중이거나 이미 집계된 경우에만 Butler가 투표하며 앱은 부정 투표를 강제로 무효화하지 않는다.",
  checkpoint: { phase: "firstNight", currentStepId: "firstNight:butler" },
}, () => {
  const game = createGame("butler-master-selection", roster([
    "washerwoman", "chef", "empath", "fortuneTeller", "virgin", "butler", "poisoner", "imp",
  ]));
  advanceTo(game, "firstNight:butler");
  return game;
});

const nightRoster = ["monk", "soldier", "mayor", "ravenkeeper", "empath", "poisoner", "librarian", "imp"];

await addCase({
  id: "monk-protection-before-imp",
  category: "night-action",
  characterIds: ["monk", "imp"],
  officialSource: source.monk,
  actionKo: "Monk 자신이 아닌 플레이어를 보호하고 다음 Imp 단계에서 그 대상을 공격한다.",
  expectedKo: "공격 대상이 죽지 않고 Demon은 다른 대상을 다시 고르지 못한다.",
  checkpoint: { phase: "night", currentStepId: "night:monk", activeProtectionTargetId: null },
}, () => {
  const game = createGame("monk-protection-before-imp", roster(nightRoster));
  advanceTo(game, "night:monk");
  return game;
});

await addCase({
  id: "monk-cannot-protect-self",
  category: "invalid-input",
  characterIds: ["monk"],
  officialSource: source.monk,
  actionKo: "Monk 자신을 선택하려 한 뒤 다른 플레이어를 선택한다.",
  expectedKo: "자기 자신은 허용 대상에 없고 확정할 수 없으며 다른 플레이어만 보호할 수 있다.",
  checkpoint: { phase: "night", currentStepId: "night:monk" },
}, () => {
  const game = createGame("monk-cannot-protect-self", roster(nightRoster));
  advanceTo(game, "night:monk");
  return game;
});

await addCase({
  id: "soldier-safe-from-imp",
  category: "night-action",
  characterIds: ["soldier", "imp"],
  officialSource: source.soldier,
  actionKo: "Imp로 2번 Soldier를 공격한다.",
  expectedKo: "sober/healthy 실제 Soldier는 죽지 않고 그 밤의 다른 희생자도 없다.",
  checkpoint: { phase: "night", currentStepId: "night:imp" },
}, () => {
  const game = createGame("soldier-safe-from-imp", roster(nightRoster));
  advanceTo(game, "night:imp");
  return game;
});

await addCase({
  id: "soldier-poisoned-dies",
  category: "impairment",
  characterIds: ["soldier", "poisoner", "imp"],
  officialSource: source.soldier,
  actionKo: "Imp로 poisoned 2번 Soldier를 공격한다.",
  expectedKo: "독 때문에 Soldier 능력이 없어져 사망 처리와 밤 사망 미발표 상태가 생성된다.",
  checkpoint: { phase: "night", currentStepId: "night:imp", activePoisonTargetId: "player-2" },
}, () => {
  const game = createGame("soldier-poisoned-dies", roster(nightRoster));
  advanceTo(game, "night:imp", {
    "night:poisoner": confirmStep("night:poisoner", { playerIds: ["player-2"] }),
  });
  return game;
});

await addCase({
  id: "mayor-dies-or-bounces",
  category: "storyteller-decision",
  characterIds: ["mayor", "imp"],
  officialSource: source.mayor,
  actionKo: "Imp로 3번 Mayor를 공격하고 파일을 다시 불러오며 Mayor 사망과 다른 대상 bounce를 각각 시험한다.",
  expectedKo: "Storyteller가 Mayor 사망 또는 다른 roster 플레이어로 bounce를 선택하며 독립적인 nobody dies 선택지는 없다.",
  checkpoint: { phase: "night", currentStepId: "night:imp" },
}, () => {
  const game = createGame("mayor-dies-or-bounces", roster(nightRoster));
  advanceTo(game, "night:imp");
  return game;
});

await addCase({
  id: "mayor-bounce-dead-or-protected",
  category: "storyteller-decision",
  characterIds: ["mayor", "monk", "soldier", "imp"],
  officialSource: source.mayor,
  actionKo: "Mayor 공격을 5번 dead 플레이어 또는 Monk가 보호한 2번 Soldier로 bounce한다.",
  expectedKo: "두 경우 모두 bounce는 유효하지만 대상은 죽지 않아 결과적으로 밤 사망이 없다.",
  checkpoint: {
    phase: "night",
    currentStepId: "night:imp",
    activeProtectionTargetId: "player-2",
    deadPlayerIds: ["player-5"],
  },
}, () => {
  const game = createGame("mayor-bounce-dead-or-protected", roster(nightRoster));
  advanceTo(game, "day:toNight");
  appendManualDeath(game, "player-5");
  advanceTo(game, "night:imp", {
    "night:monk": confirmStep("night:monk", { playerIds: ["player-2"] }),
  });
  return game;
});

await addCase({
  id: "mayor-poisoned-has-no-bounce",
  category: "impairment",
  characterIds: ["mayor", "poisoner", "imp"],
  officialSource: source.mayor,
  actionKo: "Imp로 poisoned 3번 Mayor를 공격한다.",
  expectedKo: "Mayor 결정 UI 없이 Mayor가 죽으며 bounce 선택이 적용되지 않는다.",
  checkpoint: { phase: "night", currentStepId: "night:imp", activePoisonTargetId: "player-3" },
}, () => {
  const game = createGame("mayor-poisoned-has-no-bounce", roster(nightRoster));
  advanceTo(game, "night:imp", {
    "night:poisoner": confirmStep("night:poisoner", { playerIds: ["player-3"] }),
  });
  return game;
});

await addCase({
  id: "ravenkeeper-night-death-trigger",
  category: "night-trigger",
  characterIds: ["ravenkeeper", "imp"],
  officialSource: source.ravenkeeper,
  actionKo: "죽은 Ravenkeeper로 살아 있거나 죽은 플레이어 한 명을 선택해 실제 직업을 확인한다.",
  expectedKo: "Imp 공격 직후 같은 밤에 Ravenkeeper 후속 단계가 생기며 선택한 대상의 실제 직업을 공개한다.",
  checkpoint: {
    phase: "night",
    currentStepId: "night:ravenkeeper",
    warningCodes: ["NIGHT_DEATH_UNANNOUNCED"],
    deadPlayerIds: ["player-4"],
  },
}, () => {
  const game = createGame("ravenkeeper-night-death-trigger", roster(nightRoster));
  advanceTo(game, "night:imp");
  appendCommand(game, confirmStep("night:imp", { playerIds: ["player-4"] }));
  return game;
});

await addCase({
  id: "ravenkeeper-spy-recluse-registration",
  category: "registration",
  characterIds: ["ravenkeeper", "spy", "recluse", "imp"],
  officialSource: source.ravenkeeper,
  actionKo: "이미 죽은 Spy와 Recluse를 각각 선택해 실제 직업과 등록 가능한 good/evil 직업 선택지를 비교한다.",
  expectedKo: "죽은 Spy는 특정 Townsfolk/Outsider, 죽은 Recluse는 특정 Minion/Demon으로 검사별 등록될 수 있다.",
  checkpoint: {
    phase: "night",
    currentStepId: "night:ravenkeeper",
    warningCodes: ["NIGHT_DEATH_UNANNOUNCED"],
    deadPlayerIds: ["player-1", "player-6", "player-8"],
  },
}, () => {
  const game = createGame("ravenkeeper-spy-recluse-registration", roster([
    "ravenkeeper", "washerwoman", "chef", "empath", "fortuneTeller", "recluse", "saint", "spy", "imp",
  ]));
  advanceTo(game, "day:toNight");
  appendManualDeath(game, "player-6");
  appendManualDeath(game, "player-8");
  advanceTo(game, "night:imp");
  appendCommand(game, confirmStep("night:imp", { playerIds: ["player-1"] }));
  return game;
});

await addCase({
  id: "imp-self-kill-minion-successor",
  category: "demon-succession",
  characterIds: ["imp", "poisoner", "spy"],
  officialSource: source.imp,
  actionKo: "Imp가 자신을 공격한 뒤 살아 있는 Minion 한 명을 새 Imp로 선택한다.",
  expectedKo: "기존 Imp가 죽고 Scarlet Woman 자동 승계가 없으면 살아 있는 실제 Minion 중 하나가 Imp가 된다.",
  checkpoint: { phase: "night", currentStepId: "night:imp" },
}, () => {
  const game = createGame("imp-self-kill-minion-successor", roster([
    "washerwoman", "librarian", "investigator", "chef", "empath", "fortuneTeller", "virgin", "poisoner", "spy", "imp",
  ]));
  advanceTo(game, "night:imp");
  return game;
});

await addCase({
  id: "imp-poisoned-no-kill",
  category: "impairment",
  characterIds: ["imp", "poisoner"],
  officialSource: source.imp,
  actionKo: "poisoned Imp로 살아 있는 플레이어를 공격한다.",
  expectedKo: "대상은 죽지 않고 NIGHT_ACTION_NO_EFFECT 경고가 제안 확인 화면에 표시된다.",
  checkpoint: { phase: "night", currentStepId: "night:imp", activePoisonTargetId: "player-8" },
}, () => {
  const game = createGame("imp-poisoned-no-kill", roster(nightRoster));
  advanceTo(game, "night:imp", {
    "night:poisoner": confirmStep("night:poisoner", { playerIds: ["player-8"] }),
  });
  return game;
});

await addCase({
  id: "imp-attacks-dead-player",
  category: "night-action",
  characterIds: ["imp"],
  officialSource: source.imp,
  actionKo: "Imp로 이미 죽은 5번 플레이어를 공격한다.",
  expectedKo: "선택은 허용되지만 추가 사망은 없고 already dead 경고가 표시된다.",
  checkpoint: { phase: "night", currentStepId: "night:imp", deadPlayerIds: ["player-5"] },
}, () => {
  const game = createGame("imp-attacks-dead-player", roster(nightRoster));
  advanceTo(game, "day:toNight");
  appendManualDeath(game, "player-5");
  advanceTo(game, "night:imp");
  return game;
});

const virginRoster = ["washerwoman", "undertaker", "virgin", "empath", "fortuneTeller", "poisoner", "imp"];

await addCase({
  id: "virgin-townsfolk-nomination",
  category: "day-trigger",
  characterIds: ["virgin", "washerwoman"],
  officialSource: source.virgin,
  actionKo: "1번 actual Townsfolk로 3번 Virgin을 지명하고 즉시 처형 사망을 확정한다.",
  expectedKo: "Virgin 능력이 소비되고 지명자가 즉시 처형되며 그날의 지명·투표가 끝난다.",
  checkpoint: { phase: "day", currentStepId: "day:nomination:1", virginSpent: false },
}, () => {
  const game = createGame("virgin-townsfolk-nomination", roster(virginRoster));
  advanceTo(game, "day:nomination:1");
  return game;
});

await addCase({
  id: "virgin-outsider-spends-without-execution",
  category: "day-trigger",
  characterIds: ["virgin", "butler"],
  officialSource: source.virgin,
  actionKo: "actual Outsider인 6번 Butler로 3번 Virgin을 지명한다.",
  expectedKo: "Virgin 능력은 소비되지만 지명자는 처형되지 않고 정상 투표 단계로 이어진다.",
  checkpoint: { phase: "day", currentStepId: "day:nomination:1", virginSpent: false },
}, () => {
  const game = createGame("virgin-outsider-spends-without-execution", roster([
    "washerwoman", "undertaker", "virgin", "empath", "fortuneTeller", "butler", "poisoner", "imp",
  ]));
  advanceTo(game, "day:nomination:1");
  return game;
});

await addCase({
  id: "virgin-poisoned-spends-without-execution",
  category: "impairment",
  characterIds: ["virgin", "poisoner"],
  officialSource: source.virgin,
  actionKo: "Townsfolk로 poisoned Virgin을 지명한다.",
  expectedKo: "Virgin 능력은 소비되지만 독 때문에 지명자가 처형되지 않고 투표가 계속된다.",
  checkpoint: {
    phase: "day",
    currentStepId: "day:nomination:1",
    activePoisonTargetId: "player-3",
    virginSpent: false,
  },
}, () => {
  const game = createGame("virgin-poisoned-spends-without-execution", roster(virginRoster));
  advanceTo(game, "day:nomination:1", {
    "firstNight:poisoner": confirmStep("firstNight:poisoner", { playerIds: ["player-3"] }),
  });
  return game;
});

await addCase({
  id: "virgin-spy-registers-townsfolk",
  category: "registration",
  characterIds: ["virgin", "spy"],
  officialSource: source.virgin,
  actionKo: "6번 Spy로 Virgin을 지명하고 이 검사에서 Townsfolk 등록을 선택한다.",
  expectedKo: "Spy가 실제 Townsfolk처럼 즉시 처형되며 등록 선택 없이 다시 불러오면 정상 투표로 진행된다.",
  checkpoint: { phase: "day", currentStepId: "day:nomination:1", virginSpent: false },
}, () => {
  const game = createGame("virgin-spy-registers-townsfolk", roster([
    "washerwoman", "undertaker", "virgin", "empath", "fortuneTeller", "spy", "imp",
  ]));
  advanceTo(game, "day:nomination:1");
  return game;
});

const slayerRoster = ["slayer", "washerwoman", "chef", "empath", "fortuneTeller", "poisoner", "librarian", "imp"];

await addCase({
  id: "slayer-shoots-imp",
  category: "public-ability",
  characterIds: ["slayer", "imp"],
  officialSource: source.slayer,
  actionKo: "낮 토론 중 actual Slayer로 살아 있는 Imp를 공개 지목하고 사망을 확정한다.",
  expectedKo: "능력이 즉시 소비되고 Imp 사망 후 good 승리 확인 경고가 표시된다.",
  checkpoint: { phase: "day", currentStepId: "day:discussion", slayerAbilityPresent: true },
}, () => {
  const game = createGame("slayer-shoots-imp", roster(slayerRoster));
  advanceTo(game, "day:discussion");
  return game;
});

await addCase({
  id: "slayer-recluse-as-demon",
  category: "registration",
  characterIds: ["slayer", "recluse"],
  officialSource: source.slayer,
  actionKo: "actual Slayer로 Recluse를 지목하고 Imp로 등록시키는 선택을 시험한다.",
  expectedKo: "Recluse를 Demon으로 등록하면 죽일 수 있고 canonical 등록을 택하면 아무 일도 없다.",
  checkpoint: { phase: "day", currentStepId: "day:discussion", slayerAbilityPresent: true },
}, () => {
  const game = createGame("slayer-recluse-as-demon", roster([
    "slayer", "washerwoman", "chef", "empath", "fortuneTeller", "recluse", "poisoner", "imp",
  ]));
  advanceTo(game, "day:discussion");
  return game;
});

await addCase({
  id: "slayer-poisoned-spends-no-effect",
  category: "impairment",
  characterIds: ["slayer", "poisoner", "imp"],
  officialSource: source.slayer,
  actionKo: "poisoned actual Slayer로 Imp를 지목한다.",
  expectedKo: "Imp는 죽지 않지만 once-per-game 능력은 소비되어 다시 사용할 수 없다.",
  checkpoint: {
    phase: "day",
    currentStepId: "day:discussion",
    activePoisonTargetId: "player-1",
    slayerAbilityPresent: true,
  },
}, () => {
  const game = createGame("slayer-poisoned-spends-no-effect", roster(slayerRoster));
  advanceTo(game, "day:discussion", {
    "firstNight:poisoner": confirmStep("firstNight:poisoner", { playerIds: ["player-1"] }),
  });
  return game;
});

await addCase({
  id: "slayer-shoots-dead-imp",
  category: "public-ability",
  characterIds: ["slayer", "imp"],
  officialSource: source.slayer,
  actionKo: "actual Slayer로 이미 죽은 8번 Imp를 공개 지목한다.",
  expectedKo: "죽은 플레이어는 다시 죽지 않으므로 아무 효과가 없지만 Slayer 능력은 소비된다.",
  checkpoint: {
    phase: "day",
    currentStepId: "day:discussion",
    warningCodes: ["DEMON_DEAD_GOOD_WIN"],
    deadPlayerIds: ["player-8"],
    slayerAbilityPresent: true,
  },
}, () => {
  const game = createGame("slayer-shoots-dead-imp", roster(slayerRoster));
  appendManualDeath(game, "player-8");
  advanceTo(game, "day:discussion");
  return game;
});

await addCase({
  id: "drunk-shown-slayer-has-no-ability",
  category: "impairment",
  characterIds: ["drunk", "slayer"],
  officialSource: source.drunk,
  actionKo: "낮 토론 화면에서 6번 Drunk-shown-Slayer에게 실제 Slayer 공개 능력 조작이 없는지 확인한다.",
  expectedKo: "Drunk는 Slayer 능력을 소유하거나 소비하지 않으며 공개 발언을 해도 앱 규칙 상태가 바뀌지 않는다.",
  checkpoint: { phase: "day", currentStepId: "day:discussion", slayerAbilityPresent: false },
}, () => {
  const game = createGame("drunk-shown-slayer-has-no-ability", roster([
    "washerwoman", "chef", "empath", "fortuneTeller", "virgin", "drunk", "poisoner", "imp",
  ], { 6: "slayer" }));
  advanceTo(game, "day:discussion");
  return game;
});

await addCase({
  id: "undertaker-learns-executed-drunk",
  category: "night-information",
  characterIds: ["undertaker", "drunk"],
  officialSource: source.undertaker,
  actionKo: "Undertaker 정보를 확정해 전날 처형되어 죽은 6번 플레이어의 실제 직업을 본다.",
  expectedKo: "보여 준 Slayer가 아니라 실제 Drunk 토큰이 공개된다.",
  checkpoint: { phase: "night", currentStepId: "night:undertaker", deadPlayerIds: ["player-6"] },
}, () => {
  const game = createGame("undertaker-learns-executed-drunk", roster([
    "undertaker", "washerwoman", "chef", "empath", "fortuneTeller", "drunk", "poisoner", "imp",
  ], { 6: "slayer" }));
  advanceTo(game, "day:nomination:1");
  prepareExecutionDeath(game, "player-6");
  confirmExecutionDeath(game);
  advanceTo(game, "night:undertaker");
  return game;
});

await addCase({
  id: "undertaker-omitted-without-executed-death",
  category: "night-information",
  characterIds: ["undertaker"],
  officialSource: source.undertaker,
  actionKo: "처형 사망 없이 밤으로 넘어온 phase overview를 확인한다.",
  expectedKo: "Undertaker 정보 단계가 생성되지 않으며 별도 빈 정보를 보여 주지 않아도 된다.",
  checkpoint: { phase: "night", currentStepId: "night:imp", absentStepIds: ["night:undertaker"] },
}, () => {
  const game = createGame("undertaker-omitted-without-executed-death", roster([
    "undertaker", "washerwoman", "chef", "empath", "fortuneTeller", "saint", "poisoner", "imp",
  ]));
  advanceTo(game, "night:imp");
  return game;
});

await addCase({
  id: "saint-execution-evil-win-warning",
  category: "win-condition",
  characterIds: ["saint"],
  officialSource: source.saint,
  actionKo: "처형된 actual Saint의 사망을 확정한 뒤 evil 승리 경고에서 악팀 승리를 수동 확정한다.",
  expectedKo: "SAINT_EXECUTED_EVIL_WIN 경고가 표시되지만 앱은 Storyteller의 명시적 게임 종료 확정을 기다린다.",
  checkpoint: { phase: "day", currentStepId: "day:executionDeath" },
}, () => {
  const game = createGame("saint-execution-evil-win-warning", roster([
    "washerwoman", "chef", "empath", "fortuneTeller", "virgin", "saint", "poisoner", "imp",
  ]));
  advanceTo(game, "day:nomination:1");
  prepareExecutionDeath(game, "player-6");
  return game;
});

await addCase({
  id: "saint-poisoned-no-win-warning",
  category: "impairment",
  characterIds: ["saint", "poisoner"],
  officialSource: source.saint,
  actionKo: "poisoned Saint의 처형 사망을 확정한다.",
  expectedKo: "Saint가 죽지만 능력이 없어 evil 승리 경고가 생기지 않고 게임이 계속된다.",
  checkpoint: { phase: "day", currentStepId: "day:executionDeath", activePoisonTargetId: "player-6" },
}, () => {
  const game = createGame("saint-poisoned-no-win-warning", roster([
    "washerwoman", "chef", "empath", "fortuneTeller", "virgin", "saint", "poisoner", "imp",
  ]));
  advanceTo(game, "day:nomination:1", {
    "firstNight:poisoner": confirmStep("firstNight:poisoner", { playerIds: ["player-6"] }),
  });
  prepareExecutionDeath(game, "player-6");
  return game;
});

await addCase({
  id: "scarlet-woman-succeeds-at-five-plus",
  category: "demon-succession",
  characterIds: ["scarletWoman", "imp"],
  officialSource: source.scarletWoman,
  actionKo: "7명 생존 상태에서 처형된 Imp의 사망을 확정하고 고정 Scarlet Woman 승계를 확정한다.",
  expectedKo: "Imp 사망 직전 생존자가 5명 이상이므로 살아 있고 sober/healthy인 Scarlet Woman이 새 Imp가 된다.",
  checkpoint: { phase: "day", currentStepId: "day:executionDeath" },
}, () => {
  const game = createGame("scarlet-woman-succeeds-at-five-plus", roster([
    "washerwoman", "librarian", "chef", "empath", "fortuneTeller", "scarletWoman", "imp",
  ]));
  advanceTo(game, "day:nomination:1");
  prepareExecutionDeath(game, "player-7");
  return game;
});

await addCase({
  id: "scarlet-woman-no-succession-below-five",
  category: "demon-succession",
  characterIds: ["scarletWoman", "imp"],
  officialSource: source.scarletWoman,
  actionKo: "4명 생존 상태에서 처형된 Imp의 사망을 확정한다.",
  expectedKo: "Scarlet Woman 승계 단계 없이 DEMON_DEAD_GOOD_WIN 경고가 표시되고 선팀 승리를 수동 확정할 수 있다.",
  checkpoint: {
    phase: "day",
    currentStepId: "day:executionDeath",
    deadPlayerIds: ["player-1", "player-2", "player-3"],
  },
}, () => {
  const game = createGame("scarlet-woman-no-succession-below-five", roster([
    "washerwoman", "librarian", "chef", "empath", "fortuneTeller", "scarletWoman", "imp",
  ]));
  advanceTo(game, "day:nomination:1");
  appendManualDeath(game, "player-1");
  appendManualDeath(game, "player-2");
  appendManualDeath(game, "player-3");
  prepareExecutionDeath(game, "player-7", {
    nominatorId: "player-4",
    voterIds: ["player-4", "player-5"],
  });
  return game;
});

await addCase({
  id: "scarlet-woman-poisoned-no-succession",
  category: "impairment",
  characterIds: ["scarletWoman", "poisoner", "imp"],
  officialSource: source.scarletWoman,
  actionKo: "10명 생존 상태에서 Imp 처형 사망을 확정한다.",
  expectedKo: "Scarlet Woman이 poisoned 상태라 승계하지 않고 DEMON_DEAD_GOOD_WIN 경고가 표시된다.",
  checkpoint: { phase: "day", currentStepId: "day:executionDeath", activePoisonTargetId: "player-9" },
}, () => {
  const game = createGame("scarlet-woman-poisoned-no-succession", roster([
    "washerwoman", "librarian", "investigator", "chef", "empath", "fortuneTeller", "virgin", "poisoner", "scarletWoman", "imp",
  ]));
  advanceTo(game, "day:nomination:1", {
    "firstNight:poisoner": confirmStep("firstNight:poisoner", { playerIds: ["player-9"] }),
  });
  prepareExecutionDeath(game, "player-10");
  return game;
});

await addCase({
  id: "mayor-three-alive-no-execution",
  category: "win-condition",
  characterIds: ["mayor"],
  officialSource: source.mayor,
  actionKo: "지명을 종료하고 처형 없음으로 확정한 뒤 good 승리 경고에서 선팀 승리를 수동 확정한다.",
  expectedKo: "sober/healthy actual Mayor를 포함해 정확히 3명이 살아 있고 그날 처형이 없으므로 MAYOR_GOOD_WIN 경고가 표시된다.",
  checkpoint: { phase: "day", currentStepId: "day:nomination:1", deadPlayerIds: ["player-2", "player-4", "player-5", "player-6"] },
}, () => {
  const game = createGame("mayor-three-alive-no-execution", roster([
    "mayor", "washerwoman", "chef", "empath", "fortuneTeller", "poisoner", "imp",
  ]));
  advanceTo(game, "day:nomination:1");
  for (const id of ["player-2", "player-4", "player-5", "player-6"]) appendManualDeath(game, id);
  return game;
});

await addCase({
  id: "demon-dead-good-win-warning",
  category: "win-condition",
  characterIds: ["imp"],
  officialSource: source.glossary,
  actionKo: "불러온 직후 Demon 사망 경고를 확인하고 선팀 승리를 수동 확정한다.",
  expectedKo: "DEMON_DEAD_GOOD_WIN 경고가 표시되며 자동 종료 대신 Storyteller 확정을 기다린다.",
  checkpoint: {
    phase: "firstNight",
    currentStepId: "firstNight:minionInfo",
    warningCodes: ["DEMON_DEAD_GOOD_WIN"],
    deadPlayerIds: ["player-7"],
  },
}, () => {
  const game = createGame("demon-dead-good-win-warning", roster(standardInfoRoster));
  appendManualDeath(game, "player-7");
  return game;
});

await addCase({
  id: "two-alive-evil-win-warning",
  category: "win-condition",
  characterIds: ["imp"],
  officialSource: source.glossary,
  actionKo: "생존자 2명 경고를 확인하고 악팀 승리를 수동 확정한다.",
  expectedKo: "Demon과 다른 한 명만 살아 있으므로 TWO_LIVING_PLAYERS_EVIL_WIN 경고가 표시된다.",
  checkpoint: {
    phase: "firstNight",
    currentStepId: "firstNight:minionInfo",
    warningCodes: ["TWO_LIVING_PLAYERS_EVIL_WIN"],
    deadPlayerIds: ["player-1", "player-2", "player-3", "player-4", "player-5"],
  },
}, () => {
  const game = createGame("two-alive-evil-win-warning", roster(standardInfoRoster));
  for (const id of ["player-1", "player-2", "player-3", "player-4", "player-5"]) appendManualDeath(game, id);
  return game;
});

await addCase({
  id: "ghost-vote-spending",
  category: "voting",
  characterIds: ["imp"],
  officialSource: source.glossary,
  actionKo: "지명 후 투표에서 죽은 2번 플레이어를 포함해 유령 투표를 확정한다.",
  expectedKo: "죽은 플레이어의 유령 투표가 한 번만 소비되고 이후 투표 선택에서 제외된다.",
  checkpoint: { phase: "day", currentStepId: "day:nomination:1", deadPlayerIds: ["player-2"], ghostVoteUsedPlayerIds: [] },
}, () => {
  const game = createGame("ghost-vote-spending", roster(standardInfoRoster));
  advanceTo(game, "day:nomination:1");
  appendManualDeath(game, "player-2");
  return game;
});

await addCase({
  id: "tied-votes-no-execution-candidate",
  category: "voting",
  characterIds: ["imp"],
  officialSource: source.glossary,
  actionKo: "현재 지명을 종료하고 처형 단계에서 동률 때문에 처형 후보가 없는지 확인한다.",
  expectedKo: "최고 득표 4표가 동률이므로 누구도 about-to-die가 아니며 처형 없음만 확정할 수 있다.",
  checkpoint: { phase: "day", currentStepId: "day:nomination:3" },
}, () => {
  const game = createGame("tied-votes-no-execution-candidate", roster([
    "washerwoman", "chef", "empath", "fortuneTeller", "virgin", "saint", "poisoner", "imp",
  ]));
  advanceTo(game, "day:nomination:1");
  startNomination(game, "player-1", "player-7");
  confirmNominationVote(game, ["player-1", "player-2", "player-3", "player-4"]);
  startNomination(game, "player-2", "player-8");
  confirmNominationVote(game, ["player-1", "player-2", "player-3", "player-4"]);
  return game;
});

await addCase({
  id: "night-death-public-announcement",
  category: "phase-flow",
  characterIds: ["imp", "ravenkeeper"],
  officialSource: source.glossary,
  actionKo: "낮 시작의 사망 발표를 확정한다.",
  expectedKo: "밤중에는 사망이 숨겨진 상태로 유지되고 발표 이벤트를 확정한 뒤 NIGHT_DEATH_UNANNOUNCED 경고가 사라진다.",
  checkpoint: {
    phase: "day",
    currentStepId: "day2:announceDeaths",
    warningCodes: ["NIGHT_DEATH_UNANNOUNCED"],
    deadPlayerIds: ["player-4"],
  },
}, () => {
  const game = createGame("night-death-public-announcement", roster(nightRoster));
  advanceTo(game, "night:imp");
  appendCommand(game, confirmStep("night:imp", { playerIds: ["player-4"] }));
  advanceTo(game, "day2:announceDeaths");
  return game;
});

const manifest = {
  schemaVersion: 1,
  script: "troubleBrewing",
  generatedAt: fixedTime,
  officialSources: [...new Set([source.troubleBrewing, source.glossary, ...cases.map(({ officialSource }) => officialSource)])],
  cases,
};

writeFileSync(resolve(fixtureRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${cases.length} Trouble Brewing acceptance fixtures.`);
