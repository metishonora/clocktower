# #271 Everyone Can Play의 BMR 6종

[승인된 이슈 계획](https://github.com/metishonora/clocktower/issues/271#issuecomment-6055658798)에 따라 Custom runtime에 할머니·도박사·어릿광대·달의 자손·악마의 변호사·암살자를 연결했다. 지원 목록은 61종이며 Everyone Can Play의 24종이 모두 포함된다. 한국어 설명과 토큰은 기존 BMR 자료를 재사용한다.

## 규칙 출처

2026-10-08 확인한 공식 Wiki 고정판:

| 캐릭터 | 근거 | 적용 |
| --- | --- | --- |
| 할머니 | [oldid 2978](https://wiki.bloodontheclocktower.com/index.php?title=Grandmother&oldid=2978) | 선한 손주 관계와 최초 전달 정보를 원래 능력 출처에 묶는다. 악마가 실제로 손주를 죽인 경우에만 자신의 능력에 의한 후속 사망. 할머니의 현재 유효성을 확인한다. |
| 도박사 | [oldid 3073](https://wiki.bloodontheclocktower.com/index.php?title=Gambler&oldid=3073) | 이후 밤에 죽은 사람·자신도 선택 가능. 취급을 적용한 실제 직업과 비교하며 정오 판정은 진행자 마도서에만 표시한다. |
| 어릿광대 | [oldid 2636](https://wiki.bloodontheclocktower.com/index.php?title=Fool&oldid=2636) | 다른 보호가 먼저 막으면 소모하지 않는다. 자신의 방지가 발동하거나, 중독·우회로 첫 실제 사망을 겪으면 사용 기록을 남긴다. |
| 달의 자손 | [oldid 1783](https://wiki.bloodontheclocktower.com/index.php?title=Moonchild&oldid=1783) | 사망 인지 직후 생존 대상을 공개 선택. 진영은 선택 당시 고정하고, 다음 밤 자신의 능력 유효성과 대상 생존·보호를 평가한다. 선택 당시 중독은 선택 기록을 막지 않는다. |
| 악마의 변호사 | [oldid 2594](https://wiki.bloodontheclocktower.com/index.php?title=Devil%27s_Advocate&oldid=2594) | 지난밤과 다른 생존 대상. 다음 낮 처형은 발생하지만 보호가 유효하면 사망하지 않는다. |
| 암살자 | [oldid 1786](https://wiki.bloodontheclocktower.com/index.php?title=Assassin&oldid=1786) | 일회성, 중독 중 사용도 소모. 정상 사용의 사망은 보호를 우회한다. 미사용은 소모하지 않는다. |

밤 순서는 프로젝트의 [TPI nightsheet 고정판](https://github.com/ThePandemoniumInstitute/botc-release/blob/3d6d930a9e600321f93b2567a2e88948a675bc1e/resources/data/nightsheet.json)을 따른다. 첫날 변호사는 Snake Charmer 뒤, 할머니는 Empath 뒤다. 이후 밤은 도박사 → 수도사 → 변호사 → 임프 → 암살자 → 달의 자손 → Empath → 장의사 순서다(해당 풀만 발췌). 할머니의 후속 사망은 독립 선택 행동이 아니라 실제 악마 사망에 결합한다.

[Jinx 고정판](https://github.com/ThePandemoniumInstitute/botc-release/blob/f10cd02e3401af227ce406287eaae7bb99a06a42/resources/data/jinxes.json)에서 새 6종과 기존 지원 캐릭터의 추가 공식 쌍은 없다. 할머니–Leviathan/Riot는 상대가 미지원이므로 이슈 범위에서 제외한다. 암살자–Pit-Hag의 공식 Jinx도 없다. 사용자 확인에 따라 암살자는 즉시 사망시키고 기본 `resolveNightDeaths` 순서는 암살자 뒤로 배치한다. 저장된 명시적 밤 순서는 재작성하지 않는다.

6종 자체의 인원 분포 수정과 새 승리 규칙은 없다. 성자·붉은 여인·장의사는 실제 사망 여부를 사용한다. 선한 쌍둥이의 패배는 처형 사실을 사용하므로 어릿광대나 변호사가 사망을 막아도 적용한다.

## 구현 경계

- `death.rs`는 캐릭터 모듈이 등록한 방지·소모·후속 사망·오작동 근거를 호출한다. 범용 규칙 언어나 새 스케줄러는 만들지 않았다. Imp/SnV 악마·처형·마녀·처단자·집착 처형·예약 사망 경로가 공통 판정을 사용한다. 기존 Soldier/Monk/Mayor 판정은 먼저 수행한다.
- 실제 죽음마다 출처를 보존한다. 손주의 악마 사망과 할머니의 자기 능력 사망은 서로 다른 원인이고 같은 확정 이벤트/Undo 단위다. 암살자는 예약 사망에 합류하지 않는다.
- 고유 규칙, reminder, 능력 획득 시 즉시 실행은 `characters/bad_moon_rising.rs`에 있다. 획득 능력·일시 억제·취함/중독·사용 소모를 구분한다. 수학자 근거는 실제 실패가 발생한 경우에만 추가하며, 시뮬레이션에는 기존 주정뱅이–수학자 징크스를 재사용한다.
- 할머니의 `손주 지정`은 실제 관계 선택이다. 거짓 정보를 전달할 때는 사람과 직업을 따로 고를 수 있으며, 실제 손주 관계와 공개 정보는 구분해서 저장된다. 가장 위 아이콘과 사람/직업 두 상자를 사용하고 완료 확인 단계를 추가하지 않는다.
- 도박사의 사람·직업과 취급 판단을 한 마도서에서 기록한다. 은둔자·첩자의 본래 직업을 추측해도 다른 직업으로 취급하여 오답으로 판정할 수 있다. 새 6종의 결과는 사람별 카드가 먼저이고 추측·판정·소모 같은 보조 정보는 줄 목록이다. 결과를 닫으면 다음 행동으로 간다.
- 어릿광대/변호사의 처형 예상 결과는 Core가 제공한다. 처형 확정 한 번으로 처리하며 별도의 결과 공개는 없다. 달의 자손 밤 단계도 예상 카드와 확정 한 번이다.
- 자동 reminder는 관계·현재 효과 수명·소모 기록에서 재생한다. 변호사 보호는 다음 밤에 만료된다. 도박사는 지속 상태가 없어 별도 자동 reminder가 없다.

## 저장 호환성

사용자가 승인한 유일한 입력 확장은 `DayInput.resolveConsequence.registrationJudgments` 선택 필드다. 생략 시 빈 배열이며 빈 배열은 직렬화에서 생략한다. 달의 자손은 은둔자·스파이의 선악 취급만 허용하고 다른 consequence에는 비어 있지 않은 값을 거부한다. GameFile은 v5를 유지한다.

새 action result 변형과 Core의 읽기 전용 사망·예약·처형 예상 결과를 추가했다. 할머니의 다른 사람 전달은 `InformationResult.playerCharacter`로 기록하며, 기존 `character` 값은 같은 사람의 직업 전달로 그대로 재생한다. 실제 손주는 `GrandmotherLearned.targetPlayerId`에 남으므로 공개 정보가 연쇄 사망 대상을 바꾸지 않는다. 읽기 전용 값은 GameFile에 저장하지 않는다. 기존 호환성 fixture를 덮어쓰지 않고 새 지원 목록만 갱신했다. 낮 선택, 밤 처리, 원인별 소모는 저장된 명령으로 재계산되며 Undo는 기존 인과 단위를 따른다.

## 검증

[인수 파일과 캐릭터별 확인표](../../fixtures/acceptance/issue271/README.md)에 12인 게임, 각 화면의 시작점, 자동/사용자/실기기 상태와 남은 조합 범위를 기록했다.

- `issue271_bmr.rs`: 원인별 사망 방지, 실제 사망 소모, 중독/주정뱅이, 취급, 공개 선택 시점, 능력 상실·획득, 변호사 수명과 성자/장의사, 암살자–Pit-Hag·Preacher·Vigormortis, 수학자 근거, replay/Undo.
- `issue271Acceptance.test.ts`: 전체 풀의 합법적 배정, 9개 파일 체크포인트의 재생·파일 왕복.
- `issue271Bmr.test.tsx`: 실제 WASM+저장소+프로덕션 UI의 선택·결과·다음 단계, 결과 체크포인트 복원.
- `issue271-bmr.spec.ts`: Chromium 390px·1280px 화면 18개 사례. 스크린샷에서 아이콘·상자·결과 카드·효과 칩·줄 목록과 가로 넘침을 확인.
- 기존 custom-domain/custom-wasm, custom web, fixture runtime, 경계/아키텍처 검사와 필수 `pnpm --dir web build` 실행. CI는 변경하지 않았다.

사용자 검토와 실제 iPhone/iPad/Safari 검증은 미확인이다. 검토 서버는 수명주기 관리자가 유지한다.

### 실행 결과 (2026-10-08)

| 검증 | 결과 |
| --- | --- |
| custom-domain / custom-wasm | 327 / 6 통과 |
| custom web / 관련 UI 회귀 | 381 / 82 통과 |
| fixture Rust / fixture WASM 웹 | 111 / 13 통과 |
| Chromium 390px·1280px | 18 통과 |
| Rust/TypeScript 경계 음성 테스트 | 10 통과 |
| 브라우저·통합 테스트 타입 검사 / 아키텍처 검사 | 통과 |
| 웹 프로덕션 빌드 / PWA 산출물 검사 | 통과 |

리뷰의 네 지적에 대해 보호된 선한 쌍둥이의 일반·처녀·집착 처형, 과학자가 어릿광대를 부여한 임프의 첫 자해와 이후 승계, 도박사의 양방향 취급, 할머니의 거짓 사람·역할 전달과 실제 관계·수학자·파일 복원·Undo를 검증했다. 임프의 승계 후보 투영은 실제 사망 확정과 같은 공통 방지 판정을 사용한다. 기존 번들 크기 안내와 Rust의 기존 unused/dead-code 경고는 남아 있으며 실패는 아니다.

### 인수 후속 수정 (2026-10-10)

B20의 밤 중독 판정에서 `actionCause`를 지워 오작동 근거의 행동 출처가 원래 확정 행동과 달라졌고, reducer가 이를 올바르게 거절했다. 현재 밤의 취함·중독을 계산하는 헬퍼를 분리하여 원래 사망 원인과 행동 occurrence를 그대로 보존했다. 까마귀지기의 사망 당시 판정 경로는 유지한다.

- 사망 시점/현재 밤의 중독 조합 세 가지, JSON 재생과 Undo를 domain 회귀로 검증했다.
- B20 인수 파일을 실제 ApplicationController로 불러와 화면 확정 한 번, 대상 생존·새벽 진행, 저장 복원·JSON 재불러오기·Undo를 검증했다.
- 쌍둥이의 기존 3단계 공개 흐름과 추가 행동 어댑터 목록에 맞춰 계약 테스트 기대값을 갱신했다.
- BMR 6종의 규칙 카드에 핵심 판정·앱 진행 방법·리마인더·공식 예시와 출처를 추가했다.
- custom-domain 328, custom-wasm 6, custom web 381, 웹 통합 955 통과. 웹 타입 검사와 프로덕션 빌드 통과.

전체 8종의 구현과 인수 자료는 `codex/issue-271-integration`에 합쳤다. [통합 검증 기록](../../fixtures/acceptance/issue271-all/verification.md)과 [교차 시나리오](../../fixtures/acceptance/issue271-all/integrated.md)를 함께 확인한다. 사용자·실기기 인수는 별도다.
