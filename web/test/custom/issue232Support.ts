import { expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { CustomCanonicalSession } from '../../src/custom/session.js';
import { IndexedDbCustomWebSessionStorageDriver } from '../../src/custom/storage/sessionStorage.js';
import { exportGameFileJson, parseGameFileJson } from '../../src/custom/storage/gameFile.js';
import { customFirstNightPlan, customOtherNightPlan, setupDistribution } from '../../src/custom/core/wasmClient.js';
import { realWasmCore, replayOrThrow } from './realCustomWasmHarness.js';
import type { Command, CustomScriptDefinition, GameFile, InformationResult, PhaseStepInput, RegistrationJudgment } from '../../src/custom/core/types.js';
import type { DayInput, DayAbilityInput } from '../../src/custom/core/dayTypes.js';
import { characterRequirements } from './issue232Coverage.js';

export const FIXED_TIME = new Date('2026-09-16T12:00:00Z');
export const names = Object.fromEntries(characterRequirements.map(r => [r.characterId, r.nameKo]));
type Trace = { index: number; checkpoint: string; phase: string; night: number; instructionKo: string; command: unknown; eventId?: string; checks: string[] };
export type Check = { id: string; requirements: string[]; expectedKo: string; checkpoint: string; traceIndex: number; eventCount: number; automatic: 'passed'; user: 'unverified'; device: 'unverified'; observation: unknown };
export type GameSpec = { id: string; name: string; roster: string[]; extra: string[]; bluff: string[]; shown?: Record<string, string>; edit?: (d: CustomScriptDefinition) => void };

/** Explicit acceptance commands over the existing production session; no rule fallbacks. */
export class AcceptanceGame {
  trace: Trace[] = [];
  checks: Check[] = [];
  files = new Map<string, GameFile>();
  checkpointId = '';
  constructor(readonly spec: GameSpec, readonly definition: CustomScriptDefinition,
    public session: CustomCanonicalSession<unknown, unknown>,
    readonly storage: IndexedDbCustomWebSessionStorageDriver<unknown, unknown>) {}

  static async start(spec: GameSpec) {
    const core = realWasmCore();
    const draft = { id: `issue232-${spec.id}`, name: spec.name, characterIds: [...new Set([...spec.roster, ...spec.extra, ...spec.bluff, ...Object.values(spec.shown ?? {})])] };
    const [first, other] = await Promise.all([customFirstNightPlan(draft), customOtherNightPlan(draft)]);
    if (!first.ok || !other.ok) throw Error(`${spec.id}: invalid authoring plan`);
    const definition = { ...draft, firstNightOrder: first.value.plan, otherNightOrder: other.value.plan };
    spec.edit?.(definition);
    const distribution = await setupDistribution({customDefinition:definition,playerCount:15,actualCharacters:spec.roster});
    expect(distribution.ok).toBe(true);
    if(distribution.ok) expect(distribution.value).toMatchObject({Townsfolk: spec.id==='G01'?7:spec.id==='G04'?8:spec.id==='G05'?10:9,Outsider:spec.id==='G01'?4:spec.id==='G04'?3:spec.id==='G05'?1:2,Minion:3,Demon:1});
    // Validate edited complete arrays, never repair them while loading.
    for (const plan of [await customFirstNightPlan(definition), await customOtherNightPlan(definition)]) {
      expect(plan.ok).toBe(true);
      if (plan.ok) expect(plan.value.source).toBe('definition');
    }
    const players = spec.roster.map((actualCharacter, i) => ({ id: `p${i + 1}`, seat: i + 1, name: `${i + 1}번`, actualCharacter,
      ...(spec.shown?.[actualCharacter] ? { shownCharacter: spec.shown[actualCharacter] } : {}) }));
    const storage = new IndexedDbCustomWebSessionStorageDriver<unknown, unknown>(definition.id, new IDBFactory());
    const session = CustomCanonicalSession.create({ definition, core, storage, setupDraft: { players }, presentation: {}, gameId: `issue232-${spec.id}`, now: FIXED_TIME });
    const g = new AcceptanceGame(spec, definition, session, storage);
    await g.execute({ type: 'createGame', payload: { players } }, '표의 15명 배역을 1–15번 좌석에 배치하고 확정한다.');
    g.checkpoint('start');
    g.check(['shared-setup'], '15명의 실제 배정과 좌석을 검증한 첫날 밤이며 미배정 후보가 능력을 얻지 않는다.', () => {
      expect(g.state.players.map(p => p.actualCharacter)).toEqual(spec.roster);
      expect(g.state.phase).toBe('firstNight');
      expect(g.state.players).toHaveLength(15);
    });
    return g;
  }
  get state() { return this.session.replay!; }
  get file() { return this.session.snapshot.canonical; }
  player(seat: number) { return this.state.players.find(p => p.id === `p${seat}`)!; }
  checkpoint(name: string) {
    this.checkpointId = `${this.spec.id}-${name}`;
    expect(this.files.has(this.checkpointId)).toBe(false);
    this.files.set(this.checkpointId, this.file);
  }
  check(requirements: string[], expectedKo: string, assert: () => void) {
    assert();
    const id = `${this.spec.id}-C${String(this.checks.length + 1).padStart(2, '0')}`;
    this.checks.push({ id, requirements, expectedKo, checkpoint: this.checkpointId, traceIndex: this.trace.length,
      eventCount: this.file.game.events.length, automatic: 'passed', user: 'unverified', device: 'unverified',
      observation: {phase:this.state.phase,night:this.state.nightNumber,players:this.state.players.map(p=>({id:p.id,actualCharacter:p.actualCharacter,alignment:p.alignment,alive:p.alive})),impairments:this.state.ruleState.activeImpairments??[],lastEvent:this.file.game.events.at(-1)} });
    this.trace.at(-1)?.checks.push(id);
  }
  async execute(command: Command, instructionKo: string) {
    const phase = this.session.replay?.phase ?? 'setup';
    const night = this.session.replay?.nightNumber ?? 0;
    const r = await this.session.execute(command);
    if (!r.ok) throw Error(`${this.spec.id} ${instructionKo}: ${r.error.code} ${r.error.messageKo}\n${JSON.stringify(command)}\ncurrent=${JSON.stringify(this.session.replay?.currentStep?.actionRef)}`);
    expect(await r.value.autosave).toBe(true);
    this.trace.push({ index: this.trace.length + 1, checkpoint: this.checkpointId, phase, night,
      instructionKo, command, eventId: r.value.proposal.event.id, checks: [] });
    return r.value;
  }
  async night(character: string, action: string, input: PhaseStepInput = null, deliveredResult?: InformationResult,
    registrationJudgments?: RegistrationJudgment[], owner?: number, optional = false, instruction?: string) {
    const step = optional ? this.state.availableActions?.find(s => s.actionRef?.kind === 'character' && s.actionRef.characterId === character && s.actionRef.actionId === action) : this.state.currentStep;
    const ref = step?.actionRef;
    expect(ref, `${this.spec.id}: ${character}.${action}; actual=${JSON.stringify(ref)}`).toEqual(character === 'system'
      ? { kind: 'system', actionId: action } : { kind: 'character', characterId: character, actionId: action });
    if (owner !== undefined) expect(step?.abilityUse?.ownerPlayerId ?? step?.simulationSource?.sourceAbilityUse.ownerPlayerId).toBe(`p${owner}`);
    const actor = step?.abilityUse?.ownerPlayerId ?? step?.simulationSource?.sourceAbilityUse.ownerPlayerId;
    return this.execute({ type: 'confirmStep', payload: { stepId: step!.id, expectedEventCount: this.file.game.events.length, input,
      ...(deliveredResult ? { deliveredResult } : {}), ...(registrationJudgments ? { registrationJudgments } : {}) } },
      instruction ?? `${actor ? `${actor.slice(1)}번 ` : ''}${names[character] ?? character}: ${action} — ${JSON.stringify(input)}${deliveredResult ? ` / 전달 ${JSON.stringify(deliveredResult)}` : ''}`);
  }
  async system() {
    await this.night('system', 'minionInfo', null, undefined, undefined, undefined, false, '하수인 정보를 공개하고 닫은 뒤 확정한다.');
    await this.night('system', 'demonInfo', { characterIds: this.spec.bluff }, undefined, undefined, undefined, false,
      `악마의 속임수로 ${this.spec.bluff.map(c => names[c]).join('·')}를 선택하고 정보를 공개·확정한다.`);
  }
  async day(input: DayInput, instruction?: string) {
    expect(this.state.phase).toBe('day');
    return this.execute({ type: 'confirmDay', payload: { stepId: this.state.day!.stepId, expectedEventCount: this.file.game.events.length, input } }, instruction ?? `낮: ${JSON.stringify(input)}`);
  }
  async ability(character: string, record: DayAbilityInput, owner?: number) {
    const action = this.state.day!.availableActions.find(a => a.characterId === character && (owner === undefined || a.actorPlayerId === `p${owner}`));
    expect(action, `${this.spec.id}: missing day ability ${character}`).toBeDefined();
    return this.day({ kind: 'useAbility', actionId: action!.id, record }, `${names[character]}의 낮 행동: ${JSON.stringify(record)}`);
  }
  async nominations() {
    expect(this.state.day?.stage).toBe('announcement');
    for (const label of ['사망 발표 완료', '공개 토론으로', '지명 및 투표로']) await this.day({ kind: 'advance' }, label);
    expect(this.state.day?.stage).toBe('nomination');
  }
  async nominate(nominator: number, nominee: number, voters: number[]) {
    await this.day({ kind: 'nominate', nominatorId: `p${nominator}`, nomineeId: `p${nominee}`, spyAsTownsfolk: false }, `${nominator}번이 ${nominee}번을 지명한다.`);
    await this.day({ kind: 'vote', voterIds: voters.map(n => `p${n}`) }, `${voters.join('·')}번의 찬성표를 확정한다.`);
  }
  async closeDay() {
    await this.day({ kind: 'closeNominations' }, '지명을 종료한다.');
    await this.day({ kind: 'confirmExecution' }, '표결에 따른 처형 또는 처형 없음을 확인한다.');
  }
  async beginNight() { await this.day({ kind: 'beginNight' }, '다음 밤으로 진행한다.'); }
  async dawn() { await this.night('system', 'dawn', null, undefined, undefined, undefined, false, '밤을 마치고 낮을 시작한다.'); }
  async death() { await this.day({ kind: 'confirmDeath' }, '사망과 필요한 후속을 확인한다.'); }
  async undo(expectedEvents?: number) {
    const unit = this.state.latestUndoUnit!;
    expect(unit).toBeTruthy();
    if (expectedEvents !== undefined) expect(unit.eventIds).toHaveLength(expectedEvents);
    const r = await this.session.undo(unit.id);
    if (!r.ok) throw Error(r.error.code);
    expect(await r.value.autosave).toBe(true);
    this.trace.push({ index: this.trace.length + 1, checkpoint: this.checkpointId, phase: this.state.phase, night: this.state.nightNumber,
      instructionKo: `최근 행동 되돌리기: ${unit.eventIds.length}개 사건으로 구성된 원인·후속 묶음을 확인하고 되돌린다.`,
      command: { type: 'undo', expectedUnitId: unit.id, eventIds: unit.eventIds }, checks: [] });
  }
  async roundTrip() {
    const file = parseGameFileJson(exportGameFileJson(this.file, FIXED_TIME));
    expect(await replayOrThrow(file)).toEqual(await replayOrThrow(this.file));
    const fresh = new IndexedDbCustomWebSessionStorageDriver<unknown, unknown>(this.definition.id, new IDBFactory());
    const imported = await CustomCanonicalSession.fromFile(file, { core: realWasmCore(), storage: fresh, setupDraft: {}, presentation: {} });
    if (!imported.ok) throw Error(imported.error.code);
    expect(await imported.value.retrySave()).toBe(true);
    const loaded = await CustomCanonicalSession.load({ core: realWasmCore(), storage: fresh });
    if (loaded.status !== 'loaded') throw Error(loaded.status);
    expect(loaded.session.replay).toEqual(imported.value.replay);
    expect(loaded.session.replay).toEqual(this.session.replay);
    this.session = loaded.session;
  }
  async restore(name: string) {
    const key = `${this.spec.id}-${name}`;
    const file = this.files.get(key);
    if (!file) throw Error(`Unknown checkpoint ${key}`);
    const storage = new IndexedDbCustomWebSessionStorageDriver<unknown, unknown>(this.definition.id, new IDBFactory());
    const loaded = await CustomCanonicalSession.fromFile(parseGameFileJson(exportGameFileJson(file, FIXED_TIME)), {
      core: realWasmCore(), storage, setupDraft: {}, presentation: {},
    });
    if (!loaded.ok) throw Error(loaded.error.code);
    this.session = loaded.value;
    expect(await this.session.retrySave()).toBe(true);
    this.checkpointId = key;
    this.trace.push({ index:this.trace.length+1,checkpoint:key,phase:this.state.phase,night:this.state.nightNumber,
      instructionKo:`${key}.game.json을 불러오고 마도서 이어 쓰기를 선택한다.`,command:{type:'loadCheckpoint',file:`${key}.game.json`},checks:[] });
  }
  async end(alignment: 'good'|'evil', reason?: string) {
    expect(this.state.day?.pendingGameEnd).toMatchObject({ winningAlignment: alignment, ...(reason ? { reason } : {}) });
    await this.day({ kind: 'confirmGameEnd' }, `${alignment === 'good' ? '선' : '악'}의 승리를 확인하고 게임을 종료한다.`);
    this.check(['shared-end-game'], `${alignment === 'good' ? '선' : '악'} 승리가 확정되고 이후 밤 진행을 거부한다.`, () => expect(this.state.gameEnd?.winningAlignment).toBe(alignment));
    const rejected = await this.session.execute({ type: 'confirmDay', payload: { stepId: this.state.day!.stepId, expectedEventCount: this.file.game.events.length, input: { kind: 'beginNight' } } });
    expect(rejected.ok).toBe(false);
    await this.roundTrip();
    this.checkpoint(`end-${this.files.size}`);
  }
}

export const ids = (...seats: number[]) => ({ playerIds: seats.map(n => `p${n}`) });
export const number = (value: number): InformationResult => ({ kind: 'number', value });
export const boolean = (value: boolean): InformationResult => ({ kind: 'boolean', value });
