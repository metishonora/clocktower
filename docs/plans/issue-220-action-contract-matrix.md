# #220 action별 화면·상태 계약

2026-09-12. [T13 spec 개정안](../specs/issue-220-t13-action-contracts-draft.md)의 부속 계약표. 2026-09-12 사용자 승인 완료이며 제품 구현/검증 완료를 뜻하지 않는다. 의존 선언·UI 계약 모두 전체 plan의 작업 범위다.

근거: 기존 원본 대응표의 production 호출부, TB main.tsx::confirmTroubleBrewingSelection, SnV sectsAndVioletsGame.tsx::confirmLiveHandoff/acknowledgeIdentityReveal, 사용자 후속 지시(T10–T13). 초기 대응표의 ‘독살범 결과/다음’ 등 표현은 최신 실제 TB 경로의 직접 진행 복귀와 충돌해 아래로 정정했다.

모든 행의 취소는 미확정 입력을 폐기하고 해당 원본 진입 화면으로 복귀한다. 이미 확정된 사건을 선택 취소로 지우지 않는다. 입력 실패는 현재 화면/선택을 보존하고 Core 오류를 표시한다. 공개에는 proposal/confirmedEventReveal의 허용 payload만 사용한다.

| ID | action 키 | 입력·완료·공개·복귀 계약 | 원본 |
| --- | --- | --- | --- |
| R01 | `system.dusk` | Core 밤 진입을 반영한다. 독립 준비 카드/추가 확인을 만들지 않는다. | BMR/TB 밤 진입 |
| R02 | `system.minionInfo` | 진행에서 수신자 확인→BMR 하수인 공개→원본 닫기→진행의 다음으로. 수신자는 Core 공개 payload만 사용한다. | BMR EvilInformationTask/Reveal |
| R03 | `system.demonInfo` | 진행에서 속임수 3개 선택→BMR 악마 공개→원본 닫기→진행의 다음으로. 후보/3개 한도는 Core 기준이다. | BMR EvilInformationTask/Reveal |
| R04 | `system.dawn` | 진행의 낮 시작 버튼→Core day 전환. 첫날 낮 도착 후 이번 범위 밖 행동을 생성하지 않는다. | BMR TransitionTask/TB 낮 시작 |
| R05 | `fortuneTeller.assignRedHerring` | 착각 지정의 원본 마도서 선택 UI에서 합법 1명을 확정→Core가 연결한 현재 판정의 두 대상 선택으로 이어진다. 불필요한 진행 왕복 없이 입력 상태를 새로 만들며 checkDemon 대상과 혼용하지 않는다. 독립 재지정이면 원본 진입 화면으로 돌아간다. | TB live selection/selectionPresentation |
| R06 | `washerwoman.prepareInformation` | 진행에서 대상 선택→마도서에서 합법 2명 수락→진행의 보여줄 캐릭터/정보 공개. 별도 세탁부 준비 행/추가 확인은 없다. | TB 세탁부 setup info 흐름 |
| R07 | `librarian.prepareInformation` | 진행의 0명/대상 선택 분기→필요하면 마도서에서 합법 2명 수락→진행의 원본 정보 입력/공개. 0명은 Core 허용 시만 가능하다. | TB 사서 setup info 흐름 |
| R08 | `investigator.prepareInformation` | 진행에서 대상 선택→마도서에서 합법 2명 수락→진행의 하수인 정보 입력/공개. 별도 수사관 준비 행은 없다. | TB 수사관 setup info 흐름 |
| R09 | `drunk.assignShownCharacter` | 획득한 주정뱅이 능력의 준비에서 원본 실제/보여준 배역 표현으로 Core의 보여줄 직업 후보를 선택한다. 초기 배치 화면을 새로 열지 않는다. Core가 즉시 연결한 모의 action은 그 action adapter로 이어지고, 지연 배정이면 해당 순서를 기다린다. | TB 배치 Shown/AbilityPresentation |
| R10 | `poisoner.choosePoisonTarget` | 진행의 대상 선택→마도서에서 합법 1명 확정→진행 복귀. 사망 공격용 결과/다음 패널을 끼우지 않는다. | TB live target selection/completedSelection |
| R11 | `butler.chooseMaster` | 진행의 주인 선택→마도서에서 합법 1명 확정→진행 복귀. 별도 추가 진행 확인은 없다. | TB live target selection/completedSelection |
| R12 | `snakeCharmer.choosePlayer` | 진행→마도서 1명 지정. 교환이 없으면 기존 결과/복귀 동작, 교환하면 원본 수신자별 정체 통지를 마도서에서 순차 제공한다. 마지막 닫기 후 마도서. | SnV live handoff/CharacterChangeReveal |
| R13 | `witch.chooseCursedPlayer` | 진행→마도서 1명 저주 확정. 원본 마도서의 결과/복귀 동작을 쓰고 독자 공개 화면을 만들지 않는다. | SnV live handoff |
| R14 | `evilTwin.assignTwin` | 진행→마도서 쌍둥이 1명 지정. 후속 통지가 Core 현재 action일 때 진행 탭을 끼우지 않고 마도서의 원본 공개 안내로 연결한다. 다른 action을 앞당기지 않는다. | SnV live handoff/EvilTwinRevealPrompt |
| R15 | `washerwoman.learnTownsfolk` | 현재 소유자의 준비 결과로 TB 세탁부 공개를 구성한다. 공개를 닫은 뒤 현재 정보 흐름을 마치고 Core 다음 action으로 간다. 별도 준비 행/다른 소유자 공개를 끼우지 않는다. | TB Progress/RevealScreen setupInformation |
| R16 | `librarian.learnOutsider` | 현재 소유자의 준비 결과로 TB 사서 0명/2명 공개. 닫기/완료 후 Core 다음 action. 실제 사서와 주정뱅이 사서를 각각 자기 준비에 연결한다. | TB Progress/RevealScreen setupInformation |
| R17 | `investigator.learnMinion` | 현재 소유자의 준비 결과로 TB 수사관 공개. 닫기/완료 후 Core 다음 action. 비활성 상태에서도 불필요한 정답 플레이어 질문을 만들지 않는다. | TB Progress/RevealScreen setupInformation |
| R18 | `chef.learnEvilPairs` | 진행의 TB 요리사 판정 입력→쌍 단위 결과 공개→닫기/완료. 첩자/은둔자 취급은 Core의 유효 선택지만 원본 UI로 표시한다. | TB ScalarInformationEditor/RevealScreen |
| R19 | `empath.learnEvilNeighbors` | 진행의 TB 공감능력자 판정 입력→명 단위 결과 공개→닫기/완료. 이웃·등록 판정은 Core 기준이다. | TB ScalarInformationEditor/RevealScreen |
| R20 | `clockmaker.learnSteps` | 진행의 SnV 시계공 정보 입력→칸 단위 공개→닫기/완료. 기존 합의한 이번 판정의 XXX 취급/실제 판정값 표현을 유지한다. | SnV InformationTask/ProductionInformationRevealContent |
| R21 | `mathematician.learnCount` | 진행의 SnV 수학자 감사 접기/판정/숫자→공개→닫기/완료. 전체 generic 감사 JSON이나 새 설명 카드를 만들지 않는다. | SnV InformationTask/MathematicianAuditDisclosure |
| R22 | `fortuneTeller.checkDemon` | 진행→마도서 두 대상 및 TB 악마 여부 취급→유효 선택 수락 후 진행의 판정/공개→닫기/완료. 초기 착각 대상을 판정 대상 선택과 혼용하지 않는다. | TB target selection/Progress/FortuneTellerContent |
| R23 | `dreamer.learnCharacters` | 진행→마도서 1명 수락→진행의 선/악 직업 쌍 입력·공개→닫기/완료. 실제 직업 잠금과 Core 후보를 유지한다. | SnV InformationTask/DreamerEditor/RevealContent |
| R24 | `seamstress.compareAlignments` | 진행에서 사용/보류. 사용 시 마도서 2명 수락→진행의 같은/다른 진영 입력·공개→닫기/완료. 소모 여부는 Core 결과다. | SnV InformationTask/SeamstressEditor/RevealContent |
| R25 | `philosopher.chooseAbility` | 진행의 원본 능력 선택/보류→Core 획득/실패 처리. 획득한 능력은 해당 action adapter로 실행하며 소유자·능력 인스턴스를 보존한다. | SnV PhilosopherAbilityTask/AcquiredAbilityPresentation |
| R26 | `cerenovus.assignMadness` | 진행→마도서 대상/집착 직업 지정→마도서의 원본 집착 안내→공개→닫으면 마도서. generic 통지 목록과 중간 진행 복귀는 없다. | SnV live handoff/CerenovusMadnessReveal{Prompt} |
| R27 | `evilTwin.learnTwin` | Core 관계 payload로 마도서 원본 쌍둥이 공개 안내→공개→닫으면 마도서. 지정과 별도 카드로 진행 탭을 거치지 않는다. | SnV EvilTwinReveal |
| R28 | `mutant.resolveMadnessExecution` | 원본 자유 행동 dock에서 집착 판단/처형 확인. 정규 진행 행/탭을 만들지 않는다. 실제 사망·생존과 종료는 Core 결과이며 중복 상태 칩은 없다. | SnV MadnessActionDock/Panel/ExecutionDialog |
| R29 | `spy.inspectGrimoire` | TB production의 잠긴 마도서 공개. 허용된 좌석/토큰 상세 열람만 가능하고 중앙 확인 완료로 닫는다. 원래 shell 및 비활성 utility를 유지한다. | TB main.tsx의 실제 잠긴 LiveFlow/LiveGrimoire |

## 전수 검증 적용

각 action에 정상 실행·해당 없는/비활성·합법/불법 입력·취소·실패·저장/JSON 복원·Undo를 검증한다. Core가 지원하는 경우에만 중독/취함/획득/주정뱅이/재준비·재지정을 추가하며 N/A는 근거와 함께 표시한다.

29개 키 누락/중복, 같은 표시 직업의 다른 소유자, action 전환 중 stale 응답, 공개 중 조작 잠금, 두 대상 선택의 부분/불법 조합, 사용자 정의 순서 보존을 공통 회귀로 검사한다. Undo 기대값은 T13 spec D2–D4의 공통 의존 실행 기준에서 도출한다. action 이름이나 조합별 예외로 다르게 하지 않는다.

## D. action 소유 의존 선언 전수표

이 표는 구현할 각 ActionSpec의 선언 내용이다. 별도 런타임 묶음 whitelist로 만들지 않는다. `I`는 캐릭터 action이 자기 생성 출처에 대한 의존을 선언한다는 뜻이다. 기존 activation이 `RunImmediately`이고 현재 실행의 검증된 생성 사건/모의 parent를 가리킬 때만 연결한다. `JoinPendingOrder/Defer/NoAction`, initialDrunk/setup, 과거 source는 현재 연결이 아니다. 모든 I는 같은 resolver를 재사용한다. `P`는 해당 소비 action의 새 필수 준비 선언이다. 두 선언이 있으면 준비를 먼저 실행하고 소비 action은 그 준비 사건을 직접 parent로 사용한다. 필요한 준비는 생성 parent에 이어지므로 이중 부모로 묶지 않는다.

| ID | action | 필수 선행 선언 P | 생성 출처 선언 I / 독립 |
| --- | --- | --- | --- |
| R01 | system.dusk | 없음 | 독립 |
| R02 | system.minionInfo | 없음 | 독립 |
| R03 | system.demonInfo | 없음 | 독립 |
| R04 | system.dawn | 없음 | 독립/phase 경계 |
| R05 | fortuneTeller.assignRedHerring | 없음 | I, 새 필수 준비는 R22 실행의 시작 |
| R06 | washerwoman.prepareInformation | 없음 | I, 새 필수 준비는 R15 실행의 시작 |
| R07 | librarian.prepareInformation | 없음 | I, 새 필수 준비는 R16 실행의 시작 |
| R08 | investigator.prepareInformation | 없음 | I, 새 필수 준비는 R17 실행의 시작 |
| R09 | drunk.assignShownCharacter | 없음 | I, 실제 능력 grant의 생성 사건; 이후 모의 source로 연결 |
| R10 | poisoner.choosePoisonTarget | 없음 | I, 그 외 독립 |
| R11 | butler.chooseMaster | 없음 | I, 그 외 독립 |
| R12 | snakeCharmer.choosePlayer | 없음 | I, 그 외 독립; 같은 사건의 정체 통지는 UI 단계 |
| R13 | witch.chooseCursedPlayer | 없음 | I, 그 외 독립 |
| R14 | evilTwin.assignTwin | 없음 | I, 새 필수 지정은 R27 실행의 시작 |
| R15 | washerwoman.learnTownsfolk | R06, 실제 preparationEventId | I |
| R16 | librarian.learnOutsider | R07, 실제 preparationEventId | I |
| R17 | investigator.learnMinion | R08, 실제 preparationEventId | I |
| R18 | chef.learnEvilPairs | 없음 | I, 그 외 독립 |
| R19 | empath.learnEvilNeighbors | 없음 | I, 그 외 독립 |
| R20 | clockmaker.learnSteps | 없음 | I, 그 외 독립 |
| R21 | mathematician.learnCount | 없음 | I, 그 외 독립 |
| R22 | fortuneTeller.checkDemon | R05, 현재 판정이 사용하는 준비 사건 | I |
| R23 | dreamer.learnCharacters | 없음 | I, 그 외 독립 |
| R24 | seamstress.compareAlignments | 없음 | I, 그 외 독립 |
| R25 | philosopher.chooseAbility | 없음 | I, 모의 선택 parent 포함; 그 외 독립 |
| R26 | cerenovus.assignMadness | 없음 | I, 그 외 독립; 같은 사건의 공개는 UI 단계 |
| R27 | evilTwin.learnTwin | R14, 실제 relationshipEventId | I |
| R28 | mutant.resolveMadnessExecution | 없음 | 자유 행동은 독립. 집착 부여 사건은 판단 데이터 참조 |
| R29 | spy.inspectGrimoire | 없음 | I, 그 외 독립 |

과거에 완료된 준비/관계가 유효하면 P를 새로 실행하거나 과거 Undo에 편입하지 않는다. `requiredPreparation`의 trigger와 previousPreparationEventId는 필요/재준비 근거이며 그것만으로 과거 사건을 병합하지 않는다. 자유 재지정이 소비 action의 새 필수 준비인지 여부도 기존 규칙과 현재 실행 문맥으로 정한다. 등록에 없는 동적 선행 action, 존재하지 않는 event, 다른 source, 자기 참조/순환을 오류로 검증한다.

검증 기록은 각 R행에 A01–A12의 적용 여부, 정상·영향/소유자 변형, 원본 호출 경로, 자동 테스트명, 직접 관찰 결과, N/A 이유를 연결한다. 정상 행 하나가 통과해도 해당 action 전체 완료로 표시하지 않는다.

## T13 test 연결 — 2026-09-12

[테스트 준비 기록의 R01–R29 추적표](../testing/issue-220-t13-test-preparation.md)에 실제 Core 도달성·action별 공개/완료·선택 흐름·Undo/복원·기존 변형 검사와 구현 후 네 너비 원본 대조를 연결했다. 테스트 준비 완료이며 UI 전수 인수 완료가 아니다.


## T13 구현 및 검증 기록 — 2026-09-12

승인 범위 P1–P5 구현 완료. [구현 기록](../implementation/issue-220-t13-implementation.md)과 [P6 실행 결과·R01–R29 추적·사용자 인수 항목](../testing/issue-220-t13-results.md)을 연결했다. 기존 test 준비 Red 기록은 당시 상태로 보존한다. 현재 검증 결과는 결과 문서를 기준으로 보며 사용자 인수 승인은 별도다.
