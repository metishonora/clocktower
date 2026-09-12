# #220 기존 마도서 UI/UX 재사용 전면 조사

2026-09-11 · 구현 전 조사. 이 문서는 테스트 통과 보고서가 아니다.

결론: 공용 shell을 사용하지만 실제 직업별 콘텐츠와 상태 전환을 상당 부분 custom에서 다시 만들었다. QF1만 고쳐서는 기존 UI/UX로 돌아가지 않는다. 교체 작업은 [후속 계획 v3](issue-220-custom-grimoire-plan-v3.md)를 따른다.

## 근거와 확인 범위

- 코드 기준: `codex/issue-220`, HEAD `e7d7c0f`, 기존 미커밋 구현 포함. 로컬 develop의 BMR 관련 최신 변경도 확인했으며 BMR production 파일은 `612e95d` 기반이다. 다른 작업 트리의 미완성 UI를 완성된 기준으로 채택하지 않는다.
- BMR 시각/상호작용 기준: `web/src/badMoonRisingGame.tsx`, `badMoonRisingGame.css`, [#179 최종 승인](../prototypes/issue-179-final-prototype.md). BMR production의 직업 행동은 현재 manual 경로가 많다. TB/SnV 자동화 UI가 BMR에 이미 존재한다고 가정하지 않는다.
- 직업별 기준: 실제 production의 `TroubleBrewingProgress`, `TroubleBrewingLiveGrimoire`, `TroubleBrewingRevealScreen`, `sectsAndVioletsGame`, `sectsAndVioletsLivePhase`, 각 직업 정보/통지 컴포넌트. 기존 동작을 BMR 테마로 표현한다. BMR 규칙을 custom에 추가하지 않는다.
- 실제 화면 조사: 기존 preview 10220의 `/clocktower/bad-moon-rising/`, `/clocktower/sects-and-violets/`, `/clocktower/trouble-brewing/`를 별도 조사 탭에서 조작했다. 사용자 custom 저장본은 변경하지 않았다. 새 서버/새 production 빌드는 만들지 않았다.
- BMR: 7인 직업→무작위 배치→좌석 확정→진행→하수인 공개까지 직접 확인. SnV: 7인 시계공/꿈꾸는 자/수학자/재봉사/변종/세레노버스/팡 구, 하수인·악마 공개→세레노버스 지정·통지·복귀→시계공 공개→꿈꾸는 자 대상 선택·복귀를 직접 확인. TB: 5인 세탁부/사서/수사관/첩자/임프, 하수인·악마 공개→세탁부 대상 2명·캐릭터 선택·공개를 직접 확인.
- 직업별 나머지는 호출부·상태 흐름·스타일의 코드 대조다. 모든 29행의 모든 상태를 브라우저에서 실행했다고 주장하지 않는다. 변경 후 전체 연결 검증과 모바일/태블릿 대조는 v3의 T7 완료 조건이다.

## 실제 조작으로 확인한 차이

1. **세탁부는 하나의 직업 단계다.** TB 목록은 `세탁부` 한 행. 진행의 `대상 선택`→마도서의 `세탁부 능력` 패널에서 2명 선택→`선택 확정`→진행의 대상 요약과 `보여줄 캐릭터`→`정보 공개`다. 캐릭터를 마도서에서 먼저 요구하지 않는다. 공개는 후보 좌석 카드 2개, `둘 중 한 명은`, 직업 아이콘·이름, `확인했으면 눈을 감으세요`로 구성된다.
2. **세레노버스는 별도 통지 흐름이다.** SnV `집착 지정`→마도서의 `세레노버스 집착 지정`, 행동자/대상, `집착할 캐릭터`, 대상 이름이 들어간 확정 버튼→마도서 중앙 `집착 안내`/`공개`→`세레노버스가 당신을 선택했습니다.`와 `내일 …이라고 집착해야 합니다.`→닫은 뒤 마도서 복귀. custom의 자동 공개와 진행 탭의 통지 목록/범용 수정·다음 버튼은 같은 흐름이 아니다.
3. **모든 선택이 같은 완료 경로를 쓰지 않는다.** 직접 행동·결과는 기존 `completedSelection`/결과 패널과 `다음 →`를 보존한다. 반면 직접 확인한 TB 세탁부와 SnV 꿈꾸는 자의 정보 대상 수락은 진행의 정보 편집으로 돌아간다. 세레노버스는 통지 우선이다. 모든 직업에 일괄적으로 결과 화면을 끼워 넣거나 즉시 복귀시켜서는 안 된다.
4. **BMR 하수인 공개는 제목·좌석 카드·닫기 문구까지 정해져 있다.** 실제 화면의 `당신은 하수인입니다`, 악마 좌석 카드, 넓은 `확인했으면 눈을 감으세요` 버튼과 custom의 단순 제목·이름 목록·`가리기`는 다르다. payload에 다른 정보가 더 있다는 이유로 공개 항목을 늘리지 않는다.

## 전체 화면/상태 대조

| 영역 | 기존 근거 | 현재 custom의 차이 / 처리 |
| --- | --- | --- |
| 작성·최종 검토·로딩 | #205 승인, spec 2–5 | 승인된 custom 작성 흐름 유지. BMR 비교를 이유로 작성기를 다시 디자인하지 않음. 오류·저장 복구도 승인된 요구 유지 |
| 헤더·혈월·Undo·유틸리티·탭 | BMR shell, `ProductionApplicationShell` | 구조는 공유. custom의 별도 padding/절대 위치/버튼 스타일을 상태별 대조. 이미 승인된 버그 제보·기록 기능은 유지 |
| 직업·인원·구성·상세·확정 | BMR Setup, 기존 #220 U01–U04 | `CustomRoleSetup`의 별도 악마 선택/아이콘/상세 DOM과 broad CSS override 남음. 공용 표현의 실제 BMR 소비자와 비교. 초과 선택 차단·비활성 상세 조회·확정 잠금 회귀 유지 |
| 배치·확정 좌석·상세 | BMR `AssignmentSurface`, PlayerTokenDetailDialog | 배치는 실질 공유. play board는 별도 좌석 마크업. 실제/표시 정체·획득 표시·토큰 위치를 TB/SnV 정책에 맞춰 연결. 임의 생존 요약/평행 상태 카드는 제거 대상 |
| 선택 강조 | `sectsAndVioletsSeatStates.css`, TB/SnV live board | custom 루트에 `.issue116GrimoireSurface`가 없어 그 아래로 제한된 actor/target 강조 규칙이 매칭되지 않음. 일반 selected와 target을 동시에 붙이며 중독 대상·선택 불가·확정 후 비대상 흐림·좌석별 상태 라벨도 누락 |
| 마도서 선택/결과 | TB SelectionPanel, SnV live handoff, #179 ordered outcomes | custom은 고정 `대상 선택`/번호 목록, `completed` 미사용, 항상 진행 화살표, 확정 직후 `onSelectionDone`. 행동별 제목/행동자/대상/결과/잠금/취소/다음 의미가 소실됨 |
| 정보 입력 위치·복귀 | TB Progress/SetupInformationEditor, SnV InformationTask | custom이 requiredInput 종류로 일괄 폼 생성. 세탁부 캐릭터 입력이 마도서로 이동했고 돌아와서도 범용 선택 버튼·확인·수정이 남음. 대상/진실/전달 위계와 직업별 문구 복원 |
| 준비·전달 단계 | 실제 TB 세탁부, 사용자 후속 지시 | `phaseOverview`와 `stage`를 그대로 노출해 `세탁부 준비`/`세탁부`로 나눔. 내부 준비 기록과 사용자 단계는 분리해야 함. QF1 준비 사실 연결 오류도 함께 수정 |
| 진행 순서·자유 행동 | TB compact list, SnV MadnessActionDock | `CustomPhaseOrder`가 `controller.steps` 전체를 pill 버튼으로 렌더링해 변종 처형 판단이 정규 행동 옆 탭처럼 나옴. 선택적 행동은 기존 dock으로 연결; 정규 목록/현재 카드와 분리 |
| 직업별 task identity | BMR ManualTask + 각 직업 Task | custom은 모든 역할에 같은 card/능력 본문/확인 버튼. BMR #179에서 제외한 진행 직업 상세 진입도 `CharacterDetailButton`으로 추가됨. 기존에 승인된 직업 탭/좌석 상세와 구분하여 제거·대조 |
| 공개 전체 | BMR Reveal + TB/SnV 직업별 콘텐츠 | `CustomReveal`의 `RevealContent`, `People`, `Character`, 숫자/boolean/팀/쌍둥이/광기/변종/Spy JSX를 새로 작성. 바깥 `BmrRevealSurface` 사용만으로 재사용이 아님. 공개 제목·문구·아이콘·좌석 카드·결과 크기·닫기·복귀를 기존 경로에서 추출 |
| 후속 통지·획득/모의 | CerenovusMadnessReveal/Prompt, CharacterChangeReveal, EvilTwinReveal, AcquiredAbilityPresentation | `CustomNightNotifications`의 별도 목록과 generic 공개 버튼, `획득 능력` 작은 텍스트로 치환. 기존 수신자 안내/순차 공개/Actual와 능력 위계로 복구 |
| 숫자·진실·등록·감사 | TB scalar editor, SnV information task | 숫자 입력 수정만으로 parity 완료 아님. custom은 영향 badge를 일괄 금색으로 덮고 수학자 행의 모든 evidence를 별도 JSX로 나열. 기존 단위·잠금·오류·원인·최신 근거 행 표현을 공용화; 규칙/집계는 custom 소유 |
| 기록·저장·Undo·오류 | BMR Storage, EventHistoryList, 승인 S1/U10/U12 | 기록 위치는 유지. `CustomEventLog`/utilities의 독자 wrapper와 문구·버튼·dialog/scroll/복귀 대조. 기존 파일 계약과 저장 실패 복구 삭제 금지 |
| responsive·접근성·테마 | BMR CSS, 각 기존 표현 CSS | class 이름 재사용/색상 두 개만으로 판정 금지. DOM 조상 선택자, portal, disabled/pressed/current/focus, dialog, 긴 이름·15인, 낮/밤 대조. custom broad override와 dead selectors를 제거/축소 |

## 29개 등록 행동의 UI 원본 대응

아래는 개별 확인 단위다. 준비/전달의 두 Core action이 두 UI step을 뜻하지 않는다. `코드`는 원본 경로를 조사했다는 뜻이며 실제 UI 완료 판정이 아니다. 공통 BMR 외관은 모든 행에 적용한다.

| ID | Core action | 기존 표현/동작 근거 | 교체/연결할 지점 · 조사 |
| --- | --- | --- | --- |
| R01 | system.dusk | BMR/TB 밤 진입 | 독립 custom 준비 화면 추가 금지. Core 진입 보존 · 코드 |
| R02 | system.minionInfo | BMR EvilInformationTask/Reveal | 제목·수신자·좌석 카드·공개/닫기/다음 · BMR/TB/SnV 실제 |
| R03 | system.demonInfo | BMR EvilInformationTask/Reveal | bluff 카드·3개 제한·선택 후 상태·속임수 공개 · TB/SnV 실제, BMR 코드 |
| R04 | system.dawn | BMR TransitionTask/TB 낮 시작 | 원래 전환 버튼과 Day 정지 범위 · 코드 |
| R05 | fortuneTeller.assignRedHerring | TB live selection/selectionPresentation | 기존 붉은 청어 선택·결과·진행 복귀, Core 초기 준비 출처 · 코드 |
| R06 | washerwoman.prepareInformation | TB 세탁부 setup info 흐름 | 두 대상은 마도서, 보여줄 캐릭터는 진행. 별도 준비 행/확인 없음 · 실제 |
| R07 | librarian.prepareInformation | TB 사서 setup info 흐름 | 0명과 후보/등록 입력, 독립 준비 행 없음 · 코드 |
| R08 | investigator.prepareInformation | TB 수사관 setup info 흐름 | 하수인 표시와 관련 등록 입력, 독립 준비 행 없음 · 코드 |
| R09 | drunk.assignShownCharacter | TB 배치 Shown/AbilityPresentation | 원래 Setup/모의 능력 맥락 유지. generic 능력 폼으로 치환 금지 · 코드 |
| R10 | poisoner.choosePoisonTarget | TB live target selection/completedSelection | 중독 대상 라벨·강조·결과·다음. 범용 진행 확인 삭제 · 코드 |
| R11 | butler.chooseMaster | TB live target selection/completedSelection | 주인 라벨·선택 결과·다음 · 코드 |
| R12 | snakeCharmer.choosePlayer | SnV live handoff/CharacterChangeReveal | 선택 결과, 교환 시 수신자 순차 정체 통지 · 코드 |
| R13 | witch.chooseCursedPlayer | SnV live handoff | 저주 대상/확정/결과 · 코드 |
| R14 | evilTwin.assignTwin | SnV live handoff/EvilTwinRevealPrompt | 쌍둥이 지정·관계 공개·재지정 출처 · 코드 |
| R15 | washerwoman.learnTownsfolk | TB Progress/RevealScreen setupInformation | R06과 하나의 사용자 단계, 좌석 카드·둘 중 한 명·직업 · 실제 |
| R16 | librarian.learnOutsider | TB Progress/RevealScreen setupInformation | R07과 하나의 사용자 단계, 0명/외지인 공개 · 코드 |
| R17 | investigator.learnMinion | TB Progress/RevealScreen setupInformation | R08과 하나의 사용자 단계, 하수인 공개 · 코드 |
| R18 | chef.learnEvilPairs | TB ScalarInformationEditor/RevealScreen | 쌍 단위·진실/전달·등록·영향·읽기 전용 공개 후속 · 코드 |
| R19 | empath.learnEvilNeighbors | TB ScalarInformationEditor/RevealScreen | 명 단위·진실/전달·이웃 등록 · 코드 |
| R20 | clockmaker.learnSteps | SnV InformationTask/ProductionInformationRevealContent | 칸 단위·진실·직업 아이콘·공개 후 버튼 · 실제 |
| R21 | mathematician.learnCount | SnV InformationTask/MathematicianAuditDisclosure | 감사 접기/행·원인·시점·숫자 위계 · 코드 |
| R22 | fortuneTeller.checkDemon | TB target selection/Progress/FortuneTellerContent | 두 대상·진실/취급·있음/없음·대상 좌석 공개 · 코드 |
| R23 | dreamer.learnCharacters | SnV InformationTask/DreamerEditor/RevealContent | 1명→진행 대상/진실·선악 쌍·실제 직업 잠금·또는 · 선택/복귀 실제, 공개 코드 |
| R24 | seamstress.compareAlignments | SnV InformationTask/SeamstressEditor/RevealContent | 2명→같은/다른 진영·오늘 사용하지 않음 · 코드 |
| R25 | philosopher.chooseAbility | SnV PhilosopherAbilityTask/AcquiredAbilityPresentation | 기존 능력 선택/보류/획득 identity, 필요한 후속 연결 · 코드 |
| R26 | cerenovus.assignMadness | SnV live handoff/CerenovusMadnessReveal{Prompt} | 집착 지정→마도서 안내→공개→마도서 복귀. 범용 통지 목록 삭제 · 실제 |
| R27 | evilTwin.learnTwin | SnV EvilTwinReveal | 쌍둥이 플레이어/직업/진영·재통지·닫기 · 코드 |
| R28 | mutant.resolveMadnessExecution | SnV MadnessActionDock/Panel/ExecutionDialog | 독립 진행 pill 제거, 자유 행동 dock. 판단 기록/처형 계약 차이는 결정 R3 · 코드 |
| R29 | spy.inspectGrimoire | TB main.tsx의 실제 잠긴 LiveFlow/LiveGrimoire | 같은 shell·좌석·토큰 badge·토큰 상세 열람·중앙 확인 완료. `revealMode` 전용 화면을 원본으로 삼았던 기준 정정. 실제 JSON→공개→좌석 열람→닫기 browser 대조 |

## 삭제와 유지 경계

- 삭제/교체: 자체 공개 콘텐츠, 범용 현재 행동 폼/버튼 묶음, 목록 위 action pills, 독립 `… 준비` 행, 단일 고정 선택 패널, 진행 탭 통지 목록, 원본과 겹치는 custom 스타일.
- 유지/보완: custom Core, session/storage, occurrence identity와 출처, 시나리오 순서, 과거 payload, 입력 최신성/실패 복구, 공유된 작성·배치·상세의 승인 동작. custom adapter 자체를 삭제하지 않는다.
- 새 UI 금지: 기존에 없는 선택지/카드/탭/문구/상태 화면이 필요하면 원본과 차이·이유·구체적 제안·영향을 제시하고 사용자 승인 전 구현하지 않는다. 공용 컴포넌트 추출은 같은 UI를 보존하는 내부 작업이다.

## 이전 검증의 해석 정정

Q 보고서의 Rust/회귀 통과는 당시 규칙과 실행에 대한 근거다. 이번 UI 대조의 통과를 뜻하지 않는다. `bmr` 클래스 사용, 버튼 존재, 입력 가능, Day 도달만 확인한 검사로 U05/U07/U11/A03/A04 재사용 완료를 판정하지 않는다. 독립 준비 행을 기대하는 기존 검사는 새 요구에 따라 변경할 대상이다. QF1은 계속 미해결이며 이번 조사에서 제품 코드/테스트를 수정하지 않았다.
