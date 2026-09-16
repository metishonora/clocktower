# #220 T11 테스트 준비

2026-09-11. **테스트 준비 완료. 제품 구현·기능 검증 완료가 아니다.** 승인된 [T11 계획](../plans/issue-220-t11-plan-draft.md)과 [spec M01–M08/D01–D04](../specs/issue-220-custom-grimoire.md)를 기준으로 테스트를 작성·검토하고 미구현에 따른 예상 실패를 확인했다. 제품 코드는 수정하지 않았다.

## 실행 결과

| 범위 | 결과 | 로그 |
| --- | --- | --- |
| Core 조회 계약 16 + 기존 setup 9 + mixed controller 6 | 예상 실패 9 / 통과 22 | [Core](issue-220-t11-evidence/core.log) |
| T11 설정 UI 12 + 사망 6 + 기존 복원/공개 6 | 예상 실패 16 / 통과 8 | [UI](issue-220-t11-evidence/ui.log) |
| 기존 BMR application/foundation 8 | 통과 8 | [BMR](issue-220-t11-evidence/bmr.log) |
| integration/custom-test TypeScript, diff check | 통과 | 최종 코드로 실행 |

합계 **25 예상 실패 / 38 통과**, 63개 독립 검사다. 새 T11 검사 34개는 25실패/9통과이고 기존 회귀 29개가 통과했다. 중복 재실행이나 soft assertion 실패 수를 테스트 건수에 더하지 않았다.

필요한 Red는 다음과 같이 구분한다.

- Core 7개: 기존 최종 인원은 맞지만 `adjustment` 원인·요청·적용량이 없음.
- parser 2개: 승인된 확장 응답 거부, metadata 누락 응답을 정상으로 수용.
- 설정/복원 UI 11개: 실제 보정이 적용된 수는 표시되지만 보정 원인이 표시되지 않음.
- 확정/복원 조회 오류 1개: 초기 구성 재조회 실패를 보여줄 경로가 없어 오류·재시도가 제공되지 않음.
- 사망 UI 4개: 변종 처형 및 토큰을 가진 정보 수신자의 상세에 중복 사망 칩이 남음. 앞의 3개는 Undo 뒤에도 빈 현재 상태 영역이 남는 것을 함께 확인.

## 수용 조건 → 개발 단위 → 검사 경계

| 조건 | 대상 | 준비한 자동 검사 및 구현 후 직접 확인 |
| --- | --- | --- |
| M01 | T11-1/2 | 실제 WASM 8인 비고르모르티스: 기본 5/1/1/1→최종 6/0/1/1, 원인 -1/+1. 실제 설정 controller·화면에서 선택·해제와 최종 수 |
| M02 | T11-1/2 | 7인: 규칙상 -1, 실제 0, limited=true와 5/0/1/1. 원인 제목과 값, 제한 사실의 가독성·compact 문구는 직접 대조 |
| M03 | T11-1/2 | 팡 구·남작 각각 실제 WASM 및 설정 선택/해제. 원인 직업·보정값·최종 수를 함께 요구하며 자동 보정 영역에 선택 버튼이 없어야 함 |
| M04 | T11-1/2 | 남작+비고르모르티스는 합산 후 제한해 4/1/1/1. 남작+팡 구는 2/3/1/1. 선택 순서/중복 ID 영향 없음, 한 원인 해제 시 다른 원인 유지 |
| M05 | T11-1/2 | 모든 지원 직업이 후보에 있어도 실제 선택 전 원인 표시 없음. 무보정 실제 배역 조회 metadata는 빈 원인/0 delta. shown/bluff는 조회 입력으로 쓰지 않는 것을 구현 diff와 복원 경로에서 추가 확인 |
| M06 | T11-2/3 | 실제 WASM 응답 전달 시점만 지연시켜 pending/error/retry와 인원 8→9 역순 응답 검사. 오래된 원인 숨김·최종 수 일치. 기존 controller의 초과 선택 차단/trimming/저장 실패 회귀 재사용 |
| M07 | T11-3 | 실제 설정 확정, JSON resume, IndexedDB restore, 배치 복귀를 각각 분리. 실제 뱀 조련사 교환 후 직업 조회. 초기 setup 표시와 canonical 사건 보존. 복원 projection 조회 실패를 오류로 표시하고 재시도해도 기록이 불변인 별도 검사 |
| M08 | T11-2/5 | 320/390/820/1366px, 긴 이름/복수 원인/0명 제한/확정 전후/밤낮, BMR desktop·compact 위치/스크롤/확정 버튼 접근은 구현 후 실제 production 대조. 문구·배치만을 위한 Red는 추가하지 않음 |
| D01 | T11-4 | 실제 변종 위반 판단·처형 명령 후 사망 사실/묘비 존재, 상세의 사망 칩 부재, 기록 유지 |
| D02 | T11-4 | 실제 처형 확인창 취소로 canonical·생존 보존. 실제 중독된 변종은 canExecute=false이며 생존·중독 정보 유지 |
| D03 | T11-4 | 처형한 게임의 live/JSON/autosave 세 경로와 각 Undo 후 생존·묘비 제거·기록 보존. 다른 원인의 사망은 구현 후 원본 상세와 대조할 공통 renderer 검토 항목으로 남김 |
| D04 | T11-4 | 실제 사서 준비→공개로 변종에 부착된 정보 토큰을 만든 뒤 처형. 토큰과 기록은 유지하고 사망 칩만 제거. 중독 정보 보존은 별도 검사. 취함/획득 능력 동시 표시는 구현 후 직접 대조 |

## 파일과 검토

- `web/test/custom/issue220T11Distribution.test.ts`: raw WASM JSON과 frontend parser를 독립 검사. 유효 조회 contract fixture 및 누락/불일치/중복 원인/소수 delta/잘못된 limited flag 거부.
- `web/test/custom/issue220T11Support.ts`: 전체 지원 후보를 실제 Core로 계획·검증한 시나리오, 실제 application 설정·확정 helper. 미리 계산한 UI 응답이나 가짜 replay를 공급하지 않는다.
- `web/test/issue220T11Setup.test.tsx`: 실제 setup/play 화면과 controller/WASM, 지연 전달 adapter, 실제 초기 설정·JSON·자동 저장/재개.
- `web/test/issue220T11Death.test.tsx`: 실제 사건과 공개로 사망·정보 토큰을 생성한 후 상세·복원·Undo. 문자열만 사라져도 통과하지 않도록 사망 사실·묘비·토큰·기록 유지까지 검사한다.

검토에서 수정한 사항:

1. 숫자 기대는 고정된 spec 사례에서 가져왔다. Core의 첫 후보 또는 현재 응답을 기대값으로 되돌려 쓰지 않는다. 원인 제목만 보이게 한 구현을 막기 위해 원인 영역의 실제 외지인 증감과 조작 버튼 부재도 확인한다.
2. 후보 부족 검사는 처음에 실패 여부만 확인했지만 다른 시나리오 검증 오류도 통과할 수 있었다. 제외된 직업의 순서 항목도 제거하고 정확히 `INSUFFICIENT_SETUP_ROSTER`가 나오는지 확인하도록 보강했다.
3. 새 parser의 malformed metadata 검사 5개는 현재도 통과하지만, 현재 구현이 확장 응답 자체를 거부하기 때문일 수 있다. 유효 확장 응답을 수용하는 양성 검사와 반드시 함께 Green으로 확인해야 한다. 이 5개 통과만으로 새 parser 의미 검증을 완료했다고 판단하지 않는다.
4. async 검사는 실제 WASM 계산을 유지하고 전달 시점과 한 번의 오류만 통제한다. fake IndexedDB는 저장 API 환경을 제공한다. jsdom의 scrollTo만 no-op으로 처리했으며 스크롤/시각 검증을 했다고 주장하지 않는다.
5. 뱀 조련사 경로 초안에서 선행 독살범 단계를 빠뜨린 테스트 오류를 발견해 실제 순서대로 처리했다. 최종 실행은 실제 정체 교환까지 통과하고 보정 표시 누락에서 실패한다. 교환은 배역 총집합을 바꾸지 않으므로 모든 정체 변경 종류를 검증한 것으로 확대하지 않는다.
6. Testing Library role 옵션 타입 오류를 수정했고 최종 두 TS 설정이 통과했다. 초기 오류와 JSDOM 스크롤 경고를 제품 결함으로 집계하지 않았다.
7. soft assertion을 사용한 선택/해제·태그/Undo 검사는 앞선 예상 실패 뒤에도 후속 상태 보존을 확인했다. 반면 복원 화면의 보정 표시를 기다리는 검사, 현재 존재하지 않는 보정 값 DOM assertion은 Red로 막혀 이후 assertion에 도달하지 못한다. implement에서 같은 테스트 전체를 Green으로 실행해야 한다.

## 명령과 CI

workdir: `.worktrees/issue-220`, branch `codex/issue-220`. 이번에 제품 변경이 없어 직전 최종 build의 WASM을 사용했다. 테스트를 통과시키기 위한 제품 수정·build·서버 교체는 수행하지 않았다.

```sh
pnpm --dir web exec vitest run --config vitest.custom.config.ts \
  test/custom/issue220T11Distribution.test.ts \
  test/custom/grimoireSetup.test.ts \
  test/custom/issue220MixedController.test.ts

pnpm --dir web exec vitest run \
  test/issue220T11Setup.test.tsx test/issue220T11Death.test.tsx \
  test/issue220T10RecoveryContract.test.tsx test/issue220T10Acceptance.test.tsx

pnpm --dir web exec vitest run \
  test/badMoonRisingFoundation.integration.test.tsx test/badMoonRisingApp.test.tsx

pnpm --dir web exec tsc -p tsconfig.integration.json --noEmit
pnpm --dir web exec tsc -p tsconfig.custom-test.json --noEmit
git -c core.fsmonitor=false diff --check
```

`.github/workflows/validate.yml`은 custom WASM build 후 `web test:custom`으로 custom `.test.ts`를 수집하고, `web test`의 integration으로 새 `.test.tsx`를 수집한다. 별도 skip이나 CI 우회는 추가하지 않았다. 구현 전이므로 현재 T11 Red가 CI에 포함되는 것이 의도한 상태다.

## implement 인계

T11-1의 조회 계약과 strict parser를 함께 구현한 뒤 T11-2/3 설정·초기 기록 재조회, 독립 T11-4 태그 정리를 수행한다. metadata를 테스트 mock으로 채우거나 renderer에서 직업별 계산표를 추가해 Red만 없애지 않는다. 원본 BMR의 선택형 대부 UI는 유지한다.

필요한 예상 실패는 확인했다. 직접 시각 대조, 실제 production 새 설정부터 처형·복원까지의 브라우저 통합, 다른 사망 원인/취함·획득 공존, 새 projection 조회 실패 뒤 재시도 assertion까지의 통과는 구현 후 확인한다. 이 항목의 검증 공백을 완료로 바꾸지 않고 T11-5에서 기록한다. 다음 단계는 implement이며 이번 결과는 기능 인수 통과가 아니다.

## 후속 구현

위 내용은 수정 전 Red 기록이다. [T11 구현 후 결과](issue-220-t11-results.md)에서 후속 assertion 통과, 추가 dawn 회귀, 실제 production 대조와 남은 인수 범위를 확인한다.
