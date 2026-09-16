# #220 T11 승인 계획 — 인원 보정 표시·사망 태그

2026-09-11. **사용자가 전체 계획과 GitHub #220 게시를 명시적으로 승인했다. 제품 코드·테스트는 아직 변경하지 않았다.** 승인된 [spec T11의 M01–M08, D01–D04](../specs/issue-220-custom-grimoire.md)를 개발 단위에 대응한다. plan v3의 T11 구현 기준으로 확정한다. T10 결과와 기존 미완료 인수 범위는 유지한다.

## 조사 근거와 공통 계약

- Core `characters/{trouble_brewing,sects_and_violets}.rs`가 남작/팡 구/비고르모르티스의 보정을 소유한다. `registry.rs`가 실제 선택한 직업의 효과를 합산하고 `setup.rs`가 기본 분포의 한계로 최종 제한한다. 이 순서와 후보 부족 오류를 변경하지 않는다.
- 현재 `setupDistribution`은 최종 4종 인원만 반환한다. `CustomRoleSetup`은 원인을 표시하지 않으며 진행 중 직업 탭은 `setupConfirmed` 배역을 로컬 집계만 한다. 두 경로를 동일 Core projection으로 연결한다.
- BMR `GodfatherAdjustment`의 desktop 영역/compact 영역과 CSS를 원본으로 한다. 대부의 선택 동작은 official에 유지하고, 자동 보정은 동일 표현에서 정적 내용으로 렌더링한다. 새로운 카드 배치·클릭 가능한 가짜 버튼·SnV note로 대체하지 않는다.
- 사망 칩은 `CustomGrimoireBoard`의 `PlayerTokenDetailDialog.details`에만 별도로 추가돼 있다. BMR의 같은 dialog 호출에는 이 칩이 없다. 공유 `GrimoireSeatContent`의 묘비와 `snvDeadSeat`는 유지 대상이다.

### Setup projection 계약

기존 count 전용 `SetupDistribution`과 저장 사건 형태를 보존한다. 조회 응답인 `SetupDistributionResult`에만 필수 `adjustment`를 확장한다.

```ts
type SetupCountDelta = {
  Townsfolk: number; Outsider: number; Minion: number; Demon: number;
}; // 부호 있는 정수, count는 기존 비음수 정수
type SetupDistributionResult = SetupDistribution & {
  adjustment: {
    base: SetupDistribution;
    modifiers: Array<{ characterId: string; delta: SetupCountDelta }>;
    requestedDelta: SetupCountDelta;
    appliedDelta: SetupCountDelta;
    limited: boolean;
  };
};
```

- 최상위 4종 수는 최종 인원, modifiers는 중복 없는 실제 선택 직업의 규칙상 보정이다. 시나리오 캐릭터 배열 순서로 표시해 선택 클릭 순서와 무관하게 안정적으로 유지한다. 보정이 없으면 modifiers는 빈 배열, delta는 0이다.
- requestedDelta는 원인별 합, appliedDelta는 합산 후 제한한 실제 변화다. 최종은 base+appliedDelta, limited는 requested와 applied의 차이 여부다. 개별 직업에 제한량을 배분하지 않는다. 주민의 반대 부호도 Core가 공급한다.
- `parseSetupDistribution`은 count·signed delta·필수 필드·중복 원인·합계 일관성을 검증한다. malformed/누락 metadata를 정상 ‘보정 없음’으로 채우지 않는다. 이 검증은 DTO 일관성 검사이며 캐릭터 규칙을 웹에 복제하지 않는다.
- 기존 WASM `setup_distribution` export와 요청 인자를 유지한다. async/sync adapter가 동일한 확장 응답을 읽는다. WASM과 프런트를 함께 빌드한다. canonical GameFile, setup 사건, IndexedDB draft와 버전은 변경하지 않는다.
- 작성 시 `draft.playerCount/selectedIds`, 확정 이후에는 원래 definition과 최초 `setupConfirmed.payload.players`만 조회 입력으로 사용한다. replay의 현재 정체·보여준 직업·bluff는 보정 입력으로 사용하지 않는다.

## 개발 단위와 순서

각 단위는 **test 단계에서 검사 설계·작성·검토와 예상 실패 확인 → implement에서 수정 및 관련 회귀** 순서로 수행한다. 파일명은 작업 책임 경계이며 내부 helper 분리는 기존 관례로 정한다.

### T11-1. Core 원인·실제 적용량 projection

- 파일: `crates/custom-domain/src/{setup.rs,contracts.rs}`, `characters/{registry.rs,trouble_brewing.rs,sects_and_violets.rs}`, `web/src/custom/core/{types.ts,validation.ts,wasmClient.ts,coreAdapter.ts}`. `crates/custom-wasm/src/lib.rs` export 경유 확인.
- 변경: 기존 규칙 함수의 원인 목록을 수집하고 **같은 계산 결과**에서 최종 수·요청 보정·적용 보정을 생성한다. 최종 분포 계산과 설명 생성을 별도의 규칙표로 복제하지 않는다. count 전용 타입 소비자를 응답 metadata로 오염시키지 않는다.
- 의존: 없음. T11-2/3의 공통 계약을 먼저 제공한다.
- 위험·제약: 보정 합산 전 개별 clamp, 선택 순서에 따른 결과 차이, 후보 부족 오류 은폐, 구 JSON 변경, adapter mock의 구 응답 수용. 기존 strict parser 및 필요한 test helper를 새 조회 계약으로 맞추되 저장 fixture는 보존한다.
- 검증: `issue194_custom_setup_scenarios.rs`의 기본/합산/0명 제한/순서 독립성/후보 부족, 웹 실제 WASM 경계 및 잘못된 응답 거부. M01–M05를 고정 값으로 확인한다. 최종 수와 metadata가 서로 다르면 실패해야 한다.
- 완료: 세 보정 직업 각각·혼합·무보정·제한 사례의 수와 원인을 모두 제공하고 기존 Setup 유효성 및 JSON replay가 유지됨.

### T11-2. BMR 보정 표현 공유와 설정 연결

- 파일: `web/src/badMoonRisingGame.tsx`, `badMoonRisingGame.css`, 새 `shared-ui/SetupAdjustment.tsx`, `shared-ui/SetupControls.tsx`, `grimoire-custom/{CustomRoleSetup.tsx,CustomGrimoireSetup.tsx}`, `custom/grimoire/setupController.ts`.
- 변경: BMR 대부의 desktop/compact 외곽·제목·값 배치·CSS를 controlled view로 추출해 official도 소비하게 한다. 선택형 option은 대부에 유지하고 자동 보정은 정적 값으로 표시한다. 상세 영역에 compact slot을 제공해 현재 선택한 설명 직업과 무관하게 모든 적용 원인을 표시한다.
- 표시: 직업명 보정, 외지인 증감·주민 반대 증감을 표시한다. limited이면 원인별 규칙은 유지하고 전체 실제 적용량 및 제한 사실을 짧게 함께 표시한다. 모바일은 BMR compact에서 주민 값을 반복하지 않되 실제 적용 제한과 원인을 숨기지 않는다. 복수 원인은 기존 영역 안에서 순서대로 배치하고 별도 합계 카드나 선택 화면을 만들지 않는다.
- 상태: `distribution`과 `adjustment`는 동일 최신 request의 원자적 응답으로 채택한다. 조회 시작/실패에는 함께 무효화한다. 인원 변경 후 기존 뒤쪽 초과 선택 정리와 재조회가 끝난 최종 배역 기준으로 표시한다. 무보정에서 불필요한 빈 보정 영역은 노출하지 않는다.
- 의존: T11-1. 위험: 대부 선택/모바일 확정 버튼 회귀, 긴 직업명 잘림, 조회 중 오래된 한도 사용, 한 원인 해제 후 다른 원인 소실.
- 검증: M01–M06/M08. 실제 설정 화면에서 각 직업 선택·해제, 인원 변경, 복수 보정, delayed/out-of-order/error/retry 조회를 검사. 원본 BMR 대부의 선택·compact 표시·확정 잠금 회귀를 실행한다.
- 완료: 보정 표시·최종 수·선택 한도가 일치하고 모바일/데스크톱에서 원본 배치를 유지하며 추가 입력이 없음.

### T11-3. 확정·복원 후 보정 조회

- 파일: `web/src/custom/grimoire/firstNightController.ts`, `grimoire-custom/CustomGrimoirePlay.tsx`, `custom/grimoire/setupController.ts`의 initialDraft/배치 복귀 경로. 테스트 경계는 `web/test/custom/{grimoireSetup.test.ts,issue220Application.test.ts}` 및 복원 integration.
- 변경: controller에 초기 Setup 조회 상태(result/pending/error)와 재시도를 둔다. 확정 상태 진입/파일 교체 시 원래 setup 사건을 입력으로 동일 Core 조회를 수행하고 controller 수명·최신 request를 확인해 채택한다. 현재 replay 변경만으로 초기 보정을 다시 계산하지 않는다. 기존 최초 setup가 유지되는 Undo도 같은 결과를 유지한다.
- 화면: `CustomGrimoirePlay`의 `countsFor(originalDraft.selectedIds)`만으로 결과를 만드는 경로를 조회 projection으로 교체한다. 조회 실패는 기존 오류·재시도 표현을 사용하고 보정 없음으로 오표시하지 않는다. 확정 뒤 보정 영역은 조회 전용이다.
- 의존: T11-1/2. 위험: 새 조회가 게임 명령·저장 사건을 발생시키거나 초기 배역 대신 현재 정체를 사용, 잘못된 파일 결과 늦게 채택, 기록 없이 초기 상태를 임의 추정.
- 검증: M07 및 M06. 새 확정·자동 저장 reload·JSON 왕복·배치 복귀 각각, 진행 중 악마 정체 변경 뒤 직업 탭, Undo를 실제 session/controller로 확인한다. 게임 파일과 저장 버전이 불변인지 검증한다.
- 완료: 모든 진입에서 원래 확정 설정의 원인·수를 유지하고 게임 진행과 저장 계약을 변경하지 않음.

### T11-4. 중복 사망 텍스트 칩 제거

- 파일: `web/src/grimoire-custom/CustomGrimoireBoard.tsx`. 유지 대조: `shared-ui/GrimoireSeatContent.tsx`, `features/grimoire/{playerTokenPresentation.tsx,SeatStateIcons.tsx}`, `badMoonRisingGame.tsx`. Core·사망 아이콘·기록 코드는 수정 대상이 아니다.
- 변경: 상세의 별도 사망 span만 제거하고 남은 중독/취함 정보가 없으면 빈 `현재 상태` 컨테이너를 렌더하지 않는다. 획득 능력·토큰·정체 비교는 유지한다. `CustomStepInputs`의 의미 있는 사망/처형 결과 문구를 전역 삭제하지 않는다.
- 의존: 다른 단위와 독립. 위험: 태그 제거를 사망 정보 전체 삭제로 확대하거나 변종에만 예외 분기 추가.
- 검증: D01–D04. 실제 변종 처형→마도서→좌석 상세, 취소·사망하지 않는 결과, 다른 원인의 사망, Undo·JSON/자동 저장 복원, 중독/취함/획득 능력·토큰 공존. 태그 부재와 함께 실제 사망 상태·묘비·기록 보존을 확인한다.
- 완료: 생존/사망 중복 칩과 빈 상태 영역이 없고 원본 사망 표시 및 다른 필요한 정보가 그대로임.

### T11-5. 통합 검증·원본 대조

- 의존: T11-1–4. 테스트 파일은 기존 Core/setup/controller/browser 경계에 필요한 사례를 더하고 새 `issue220T11…` 파일로 분리할 수 있다. 테스트를 먼저 작성하는 작업은 test 단계이며 이 계획 단계에서는 실행 결과를 만들지 않는다.
- M01–M08/D01–D04 전부 연결한 수용 표를 작성한다. 실제 production 경로로 새 설정→배역 확정→진행→변종 처형→상세→Undo·저장/복원까지 수행한다. 준비 checkpoint만으로 새 설정과 보정 선택을 대체하지 않는다.
- 320/390/820/1366px의 desktop/compact, 긴 비고르모르티스 이름, 복수 보정·0명 제한, 확정 전후, 밤/낮 직업 조회를 BMR 실제 화면과 비교한다. 키보드 접근·스크롤·하단 버튼 가림도 확인한다. 기기 실물과 viewport 결과를 구분한다.
- 회귀: official BMR 대부 ±1 선택·인원 구성·확정, custom 분포 trimming/시나리오 후보 부족, 기존 TB/SnV 첫날 밤·자유 행동·사망·Undo·JSON, setup 응답 strict parser/초기화, 공개 payload 비공개 경계.
- 필수 명령: `cargo test --workspace`, `pnpm --dir web test:unit`, `test:custom`, `test:integration:run`, 관련 Playwright, `pnpm --dir web build`, architecture/custom 경계·PWA·diff check. 현재 변경에 유효한 결과는 재사용하며 변경 후 영향 범위는 재실행한다. 리뷰 서버는 지정 operator/manager로 최신 자산을 검증하고 keep:true 유지한다.
- 완료: 선행 Red와 후속 assertion이 통과, 모든 M/D 기대 결과 및 관련 원본 대조에 증거가 있으며 남은 실패·미검증을 구분해 보고한다. T7 전체 71개 조건/29행과 사용자 인수는 별도 상태다.

## 승인 기록

승인된 자동 보정 표시 및 기존 원본 복원 범위로 계획했다. 사용자 UI·규칙·저장 아키텍처에 대한 추가 미결정은 없다. 사용자가 공통 조회 계약, 원본 표현 추출, 복원 경로와 태그 제거를 포함한 **전체 계획 및 GitHub #220 게시를 승인했다.** 다음 단계는 구현 전 test 준비다. 기존 문서 링크를 보존하기 위해 파일명은 유지한다.

승인된 전체 spec·plan 게시: [#220 승인 기록](https://github.com/metishonora/clocktower/issues/220#issuecomment-5631577454).

## test 준비 완료

[2026-09-11 검사 준비·예상 실패·회귀·인계 기록](../testing/issue-220-t11-test-preparation.md). 25 예상 실패/38 통과. 다음 단계는 implement이며 제품 검증 완료가 아니다.

## T11 구현 및 후속 검증 — 2026-09-11

T11-1–4 구현을 반영했다. [구현 기록](../implementation/issue-220-t11-fixes.md), [검증 결과·인수 범위](../testing/issue-220-t11-results.md)를 최신 상태로 따른다. 위의 수정 전 상태는 당시 기록이다.

T11-5의 실제 낮 화면 검증에서 system.dawn의 day 입력을 화면 검사가 거부하는 기존 연결 결함을 발견했다. 기존 버튼/규칙을 유지해 정확한 입력 계약만 연결하고 실제 UI Red→Green 회귀를 추가한다. 같은 검증에서 낮 보정 제목의 밤 색상을 기존 BMR 낮 색상으로 보완했다. 새 제품 동작이나 UI 선택은 추가하지 않았다.

실행한 자동 검사와 네 너비의 production/BMR 대조 결과는 검증 문서에 기록한다. 사용자/실물 기기 인수 및 다른 사망 원인·모든 효과 공존의 직접 시각 대조는 별도 남은 범위로 유지한다.
