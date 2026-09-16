# #208 TB·SnV 첫날 밤 수용 계약

기준 commit: `f6acdac` (origin/develop, 2026-09-08).
[승인 Plan](https://github.com/metishonora/clocktower/issues/208#issuecomment-5584542039), [승인 Spec](https://github.com/metishonora/clocktower/issues/208#issuecomment-5582320434).

상태: 구현 및 수용 검증 완료. 구현 전 test_contract_reviewer의 경로 구분과 음성 대조를 반영했다. 아래 기대값은 구현 출력을 복사한 golden이 아니며 실행 증거는 문서 끝에 기록한다.

## 검증 경로

- Production: public propose/replay JSON, 실제 generated custom WASM, canonical session, IndexedDB 저장·복원·Undo. Setup부터 명시된 입력으로 실행하며 예상하지 못한 Step은 건너뛰지 않는다.
- 제한된 내부 사실: 현재 지원 명령으로 생성 불가능한 죽은 대상, 다중 출처, 임의 능력 상실/회복 등만 Rust 사실 구성으로 검증한다. 이를 Production 획득·사망 수용으로 보고하지 않는다.
- 거부 검증: 정상 prefix에서 대상/결과/출처/원인을 각각 변조하고 원자적 거부 및 원본 불변을 확인한다.
- 호환성: 기존 `compatibility/` 자료를 보존한다. 새 준비가 필요한 과거 Twin 기록은 명시적으로 거부하고 가짜 이벤트로 보완하지 않는다.

## 관찰 가능한 수용 조건


| ID | 입력·상황 | 관찰할 결과 |
|---|---|---|
| A01 | 기존 firstNightOrder와 새 준비 Action 등록 | 순서 필드 수정 없이 준비 후 정규 실행. 준비 ID를 순서에 넣으면 거부 |
| A02 | pool에만 있고 실제 출처/안내가 없는 캐릭터 | 불필요한 Step 없음. 필요한 handler 누락은 명시적 오류 |
| A03 | 같은 행동의 원래 능력+획득 능력 | 기존 #206/#207 순서와 출처별 완료 유지 |
| P01 | 실제 점쟁이와 점쟁이 능력을 얻은 Philosopher | 각각 지정·checkDemon·정보 이력. 같은 가짜 악마 허용 |
| P02 | 가짜 악마 자격 상실, 임시 중독, 준비/원인 Undo | 자격 상실만 재지정, 임시 무효로 지정 변경 없음, prefix대로 복원 |
| P03 | WW/Lib/Inv 준비 뒤 먼저 Spy 실행 | 확정된 사전 표식이 보이고 아직 전달하지 않은 정보는 전달 완료가 아님 |
| P04 | 준비 뒤 캐릭터·중독·Vortox 상태 변경 | 전달 시 재검증, 필요한 준비 수정. 이전 Spy snapshot 보존 |
| E01 | Twin 최초 지정·통지, 상대의 Snake Charmer 교환 | 단계별 완료와 원인별 재지정·통지. 교체된 미전달 관계는 전달하지 않음 |
| S01 | Drunk가 TB/SnV 주민을 믿음 | 적절한 입력·보류·정보 안내, 실제 능력 효과 없음 |
| S02 | Drunk→모의 Philosopher 선택 / 실제 Philosopher→Drunk 획득 | 서로 다른 근거의 안내 연결. 실제 사용권 복원이나 가짜 grant 없음 |
| S03 | 실패한 Philosopher 안내 근거의 회복/상실 | 미완료 안내 제거, 이미 전달한 정보와 실제 소모 기록 보존 |
| F01 | 겹친 독, 출처 사망/상실, 정상 시작 후 중단/회복, 최초 실패 | 다른 독 보존, 최초 실패의 뒤늦은 성공 없음, Day에 유효한 독 유지 |
| F02 | 자기 중독, 출처 순열·반복 조회 | 진동/무한 반복 없이 동일 효과 |
| F03 | No Dashii 이웃의 실제/획득 Soldier | 유효 보호로 중독 방지. 외부 무효화 반영. 다음 주민으로 독 이동 없음 |
| I01 | 세 시작 정보가 SnV 캐릭터를 제시, 자신 포함, Lib zero | pool·종류·정상 명제/오등록에 맞으면 확정 가능 |
| I02 | 악–Recluse–악, 원형 양 끝, 죽은 이웃 | Chef 쌍별 1, Empath 현재 생존 이웃·중복 제외 |
| I03 | Fortune Teller의 자신·죽은 악마·가짜 악마 선택 | 규칙에 맞는 판정. 중독된 악마도 악마 사실 유지 |
| I04 | 정보 형태별 건강/무효/Vortox/오등록 | 허용 결과만 수락. Vortox 실제 사실 기준과 전체 명제 거짓 유지 |
| I05 | 정상처럼 나온 중독 정보와 실제 오작동, Drunk Jinx | 중독만으로 집계하지 않음. 실제 근거·사람별 중복 제거·자기 제외·과거 숫자 고정 |
| G01 | 실제 마도서/무효 Spy 대체 전달 후 상태 변경 | 전달 snapshot 보존, 게임 사실 불변, 다른 Reveal로 유출 없음 |
| B01 | Butler 선택 후 Day | 주인·출처·낮 사실 유지. 자기 선택 거부 |
| T01 | 시작 정보 획득, 일반 능력 순서 전/후 획득 | 준비→즉시→복귀 / 남은 순서 참여 / 지난 순서 재삽입 없음 |
| M01 | 일반 Step 중 Mutant 판단 선택 | 별도 판단만 확정, 필요한 결과 처리 후 일반 진행 재개 |
| M02 | 처형하지 않음·무효 능력·같은 요청 중복 | 실제 처형 없음, 미래 별도 판단 가능, 같은 occurrence 중복 거부 |
| M03 | 유효 Twin의 선한 상대 Mutant 처형 | 승패·공개 결과, currentStep/availableActions 없음, Day 강제 진입 없음 |
| M04 | 처형 뒤 진행/Undo | 다음 낮 처형 미소모, 효과·대기·종료까지 prefix와 동일 복원 |
| R01 | 모든 대표 prefix 저장·reload·Undo | 같은 사실·현재 Step·선택 가능 행동·과거 Reveal |
| R02 | target/result/source/cause/Step 변조·오래된 optional 요청 | 원자적 거부, 사용·상태·이벤트·저장 원본 보존 |
| R03 | 새 준비가 빠진 과거 Twin 등 기록 | 명시적 복원 실패. 자동 이벤트 생성이나 부분 import 없음 |
| R04 | 무관한 기존 SnV/system 기록, official 경계, fixture 결과 | 기존 의미 유지. 공식 fallback과 Production fixture 결과 수락 없음 |
| R05 | 필수 준비/후속 대기가 있는 Dawn 및 종료 뒤 요청 | 조기 종료·후속 확정 거부. 선택하지 않은 optional 후보만으로 Dawn을 막지 않음 |

TB 22개·SnV 25개 전체 coverage 표를 수용 문서에 둔다. 위 행동 외의 Baron/No Dashii/Vortox/등록/보호는 관련 자동 규칙으로, Undertaker·Monk·악마 공격·낮 전용 능력 등은 이번 실제 실행 경로 밖으로 명시한다. Ravenkeeper/Sage/Sweetheart/Barber/Klutz처럼 조건부인 캐릭터는 '정규 첫날 wake 없음'과 '사망 조건이 성립하지 않음'을 구분해 기록한다.


## 하위 사례별 검증 경로와 독립 관찰값

| 수용 ID | Production 증거 | 제한된 내부 사실 증거 |
|---|---|---|
| A01–A03 | explicit definition/Setup/propose/replay, 원래/획득 출처 | 의도적으로 빠진 registry handler |
| P01–P04 | assignRedHerring와 checkDemon 완료 각각 1회; 원래/획득별 다른 출처, 같은 RH 허용. 세 정보 준비→먼저 Spy→아직 learn 미완료→learn. 준비 수정 후 과거 Spy 불변 | 현재 지원 원인으로 만들 수 없는 임의 대상 자격 변화 |
| E01 | assignTwin 완료만으로 통지 없음; learnTwin 별도 1회; Snake Charmer 교환 후 관계 재지정과 통지 | 상대 이름/생존만의 임의 변경 |
| S01–S02 | 실제 Drunk TB/SnV 안내; 모의 Philosopher; 실제 Philosopher→Drunk와 명시적 shown 안내 | 임의 중첩 출처는 별도 표기 |
| S03 | No Dashii 교환으로 실패 Philosopher 회복 | 임의 근거 상실·외부 취함 회복 |
| F01–F02 | Poisoner 선택·자기 중독·Day 지속; Mutant/Philosopher 사망 시 관련 효과; 선택 시 무효의 최초 실패 | 임의 출처 사망·상실·회복, 다중 출처 순열 |
| F03 | 실제 Soldier 보호와 외부 Poisoner에 의한 보호 무효 | 건강하게 얻은 Soldier의 보호; 획득 source 상실을 직접 구성한 경우 |
| I01–I02 | SnV 후보·자기 포함·Lib zero·Chef 쌍별 1 | 임의 사망 이웃·동일 이웃 중복 |
| I03 | 살아 있는 실제 악마·자신·능력별 RH | 죽고 중독된 악마 (다른 RH/오등록 없이) |
| I04–I05 | 건강/중독/Vortox/등록, 실제 오작동. Drunk 오정보→1뿐 아니라 정상 정보→0, 모의 효과 실패→1을 각각 확인 | 임의 동시 출처 audit 중복은 별도 표기 |
| G01/B01 | Spy 실제/대체 전달, snapshot 보존; Butler Day 보존·자기 거부 | 없음 |
| T01 | 실제 Philosopher 획득 전/후 순서와 즉시 복귀 | 합성 activation은 scheduler 계약으로만 보고 |
| M01–M04 | 실제/획득 Mutant 집행, 비처형·무효·새 판단·동일 occurrence 거부. 종료 reason=goodTwinExecuted, 원인은 집행 사건. Undo 뒤 생존·관계·currentStep·availableActions·gameEnd를 직전 prefix와 각각 비교 | 추가 임의 source/life 조합 |
| R01–R05 | 실제 WASM/session 저장·불러오기·Undo·원자적 거부·구기록 실패·Dawn/종료 차단 | missing registry 테스트와 dependency guard는 별도 증거 |

수학자의 Reveal에서는 인원수만 검사한다. `mathematicianSubjects`는 이야기꾼용 `informationPrompt.mathematicianAudit`, 실제 이웃 수는 제한된 규칙 검증 또는 공개 replay의 실제 좌석·진영 사실과 독립 기대값으로 검사하며 Reveal에 내부 audit를 넣지 않는다.

`availableActions`의 빈 배열과 필드 생략은 모두 후보 없음이다. wire literal 모양을 불필요하게 고정하지 않는다. 위 경로는 최소 증거이며 실제 Production으로 생성 가능한 사례를 bounded-facts만으로 대체하지 않는다.

## 캐릭터 전체 적용 위치

| Script | Character | 첫날 밤 적용 위치 |
|---|---|---|
| trouble_brewing | washerwoman | prepareInformation → learnTownsfolk |
| trouble_brewing | librarian | prepareInformation → learnOutsider |
| trouble_brewing | investigator | prepareInformation → learnMinion |
| trouble_brewing | chef | learnEvilPairs |
| trouble_brewing | empath | learnEvilNeighbors |
| trouble_brewing | fortuneTeller | assignRedHerring → checkDemon |
| trouble_brewing | undertaker | 첫날 밤 실행 없음; 낮/이후 밤 전용 동작은 범위 밖 |
| trouble_brewing | monk | 첫날 밤 실행 없음; 낮/이후 밤 전용 동작은 범위 밖 |
| trouble_brewing | ravenkeeper | 정규 첫날 행동 없음; 현재 지원 원인으로 조건 성립 여부 확인 (무관한 사망 발동 합성 금지) |
| trouble_brewing | virgin | 첫날 밤 실행 없음; 낮/이후 밤 전용 동작은 범위 밖 |
| trouble_brewing | slayer | 첫날 밤 실행 없음; 낮/이후 밤 전용 동작은 범위 밖 |
| trouble_brewing | soldier | 악마의 해로운 효과 보호 |
| trouble_brewing | mayor | 첫날 밤 실행 없음; 낮/이후 밤 전용 동작은 범위 밖 |
| trouble_brewing | butler | chooseMaster |
| trouble_brewing | drunk | Setup 안내 / 획득 assignShownCharacter / 모의 행동 |
| trouble_brewing | recluse | 판정별 오등록 |
| trouble_brewing | saint | 첫날 밤 실행 없음; 낮/이후 밤 전용 동작은 범위 밖 |
| trouble_brewing | poisoner | choosePoisonTarget 및 지속 중독 |
| trouble_brewing | spy | inspectGrimoire 및 오등록 |
| trouble_brewing | scarletWoman | 정규 첫날 행동 없음; 현재 지원 원인으로 조건 성립 여부 확인 (무관한 사망 발동 합성 금지) |
| trouble_brewing | baron | 기존 Setup 분포 |
| trouble_brewing | imp | 첫날 밤 실행 없음; 낮/이후 밤 전용 동작은 범위 밖 |
| sects_and_violets | clockmaker | learnSteps |
| sects_and_violets | dreamer | learnCharacters |
| sects_and_violets | snakeCharmer | choosePlayer / 교환·영구 중독 |
| sects_and_violets | mathematician | learnCount / Jinx·오작동 집계 |
| sects_and_violets | flowergirl | 첫날 밤 실행 없음; 낮/이후 밤 전용 동작은 범위 밖 |
| sects_and_violets | townCrier | 첫날 밤 실행 없음; 낮/이후 밤 전용 동작은 범위 밖 |
| sects_and_violets | oracle | 첫날 밤 실행 없음; 낮/이후 밤 전용 동작은 범위 밖 |
| sects_and_violets | savant | 첫날 밤 실행 없음; 낮/이후 밤 전용 동작은 범위 밖 |
| sects_and_violets | seamstress | compareAlignments |
| sects_and_violets | philosopher | chooseAbility / 능력 획득·취함·모의 안내 |
| sects_and_violets | artist | 첫날 밤 실행 없음; 낮/이후 밤 전용 동작은 범위 밖 |
| sects_and_violets | juggler | 첫날 밤 실행 없음; 낮/이후 밤 전용 동작은 범위 밖 |
| sects_and_violets | sage | 정규 첫날 행동 없음; 현재 지원 원인으로 조건 성립 여부 확인 (무관한 사망 발동 합성 금지) |
| sects_and_violets | mutant | 선택적 resolveMadnessExecution / 사망 |
| sects_and_violets | sweetheart | 정규 첫날 행동 없음; 현재 지원 원인으로 조건 성립 여부 확인 (무관한 사망 발동 합성 금지) |
| sects_and_violets | barber | 정규 첫날 행동 없음; 현재 지원 원인으로 조건 성립 여부 확인 (무관한 사망 발동 합성 금지) |
| sects_and_violets | klutz | 정규 첫날 행동 없음; 현재 지원 원인으로 조건 성립 여부 확인 (무관한 사망 발동 합성 금지) |
| sects_and_violets | evilTwin | assignTwin → learnTwin / 관계·승패 |
| sects_and_violets | witch | chooseCursedPlayer |
| sects_and_violets | cerenovus | assignMadness (다음 낮) |
| sects_and_violets | pitHag | 첫날 밤 실행 없음; 낮/이후 밤 전용 동작은 범위 밖 |
| sects_and_violets | fangGu | 기존 Setup 분포; 이후 밤 공격 제외 |
| sects_and_violets | vigormortis | 기존 Setup 분포; 이후 밤 살해 효과 제외 |
| sects_and_violets | noDashii | 이웃 중독 / Soldier 보호 적용 |
| sects_and_violets | vortox | 정보 거짓 효과 |

## 테스트 위치와 증거 기준

- A01–A03: `issue208_contracts.rs`, `issue208_scheduler.rs`, `tbSnvContracts.test.ts`.
- P01–P04/E01: `issue208_preparations.rs`, `issue208_twins.rs`, `issue208_information.rs`, `tbSnvFirstNight.test.ts`.
- S01–S03: `issue208_simulation.rs`, `tbSnvFirstNight.test.ts`.
- F01–F03: `issue208_effects.rs` 및 Production 정상 생성 경로.
- I01–I05/G01/B01: `issue208_information.rs`, `issue208_preparations.rs`, 기존 `issue207_mathematician.rs`, `tbSnvFirstNight.test.ts`, `revealBoundary.test.ts`.
- T01/R05: `issue208_scheduler.rs` 및 Production 밤 진행.
- M01–M04: `issue208_mutant.rs`, `tbSnvFirstNight.test.ts`.
- R01–R04: `tbSnvFirstNight.test.ts`, `storageReplay.test.ts`, 기존 compatibility 자료와 boundary/isolation guard.

각 테스트는 명시적 입력과 독립적인 기대 사실·완료 횟수·전달값을 사용한다. 같은 구현 함수를 호출해 정답을 계산하지 않는다. 매 prefix replay 비교와 Undo 비교는 의미 기대값 검증을 대체하지 않는다.

## 실행 기록

- 기준선 `f6acdac`: `cargo test -p clocktower-custom-domain -p clocktower-custom-wasm` 통과 (domain 106개, WASM 6개). 기존 unused/dead-code 경고 존재.
- 아래 진행 기록은 작업 트리의 구현 상태다. 최종 수용 검증과 구분한다.
- 최종 기록에는 실행 commit, 명령, 결과와 Production/제한된 내부 사실 경로를 구별한다.

## 2026-09-08 최종 실행 기록

실행 기준: `codex/issue-208` 작업 트리, 기반 `f6acdac`. 아직 커밋하지 않은 구현 diff에서 실행했다.

- GitHub 승인 Plan §3.4.1: 수학자 audit의 computedResult 의존성 제거. 캐릭터의 실제 전달·비정상 작동 판정·원인을 사용한다. 별도 참·거짓 타입을 추가하지 않았으며 캐릭터 자체 계산은 유지한다.
- 정규 18개와 추가 7개가 Production registry에 각각 한 번 등록됨을 검사했다. TB 정규 9개 전체를 실제 WASM/session으로 실행해 Dawn, Day의 Poisoner/Butler 지속 사실, 저장 후 동일 복원을 확인했다.
- `cargo test -p clocktower-custom-domain -p clocktower-custom-wasm`: 도메인 134개, WASM 경계 6개 통과.
- `pnpm --dir web test:custom`: 실제 Production WASM을 사용하는 테스트 포함 79개 통과. Drunk–Math 오정보 1/정상 정보 0, Chef 인접 쌍 판정, Mutant 종료/reload/Undo, Spy 실제·대체 전달 및 실제 상태 불변을 검증했다.
- `pnpm test:custom-runtime`: fixture Rust/WASM 및 TypeScript 13개 통과. Dawn 뒤 NO_CURRENT_STEP과 잘못된 replay 출처 오류를 보존했다.
- `pnpm --dir web build`: Production WASM 포함 전체 웹 빌드 통과. `pnpm --dir web verify:pwa`: 통과.
- `node scripts/check-custom-boundaries.mjs`와 negative test 10개 통과. 공식 구현 소스는 변경하지 않았다.
- `node scripts/verify-custom-runtime-isolation.mjs`: 공식 소스·WASM 없는 임시 작업공간에서 custom Rust, Production/fixture WASM, TypeScript, IndexedDB/session 전체 통과.
- `cargo fmt --all -- --check`, `git diff --check`: 통과.

Production Rust JSON 보완: 실제/획득 FT의 동일 RH, Philosopher→Drunk→모의 Philosopher→Chef, 획득 세탁부 준비→즉시 전달, Lib zero와 실제 Drunk/Vortox, Snake Charmer 교환으로 세탁부 회복→강제 재준비→SnV 캐릭터 전달. 회복 전 Spy 사건 snapshot 불변을 확인했다.

제한된 내부 사실 보완: 죽고 중독된 실제 악마와 건강한 FT 자기 선택, RH 자격 상실/일시 actor 중독, 실제·획득 Soldier와 외부 중독/회복, 중독 출처 사망/회복·순열·최초 실패, 죽은 Spy/Recluse·이웃 같은 기존 #207 경계 사례. 합성 사실 검증을 실제 게임 사망/획득 시나리오로 표시하지 않았다.

호환성: 기존 compatibility 자료 원본은 보존했다. 미구현 TB 오류 기대값은 새 준비 Step으로, Twin의 통합 선택/통지 기대값은 명시적 지정 후 통지로 수정했다. 오래된 준비 누락/변조 기록은 전체 거부하며 이벤트를 합성하지 않는다.
