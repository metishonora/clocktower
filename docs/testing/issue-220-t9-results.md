# #220 T9 검증 — 미통과

2026-09-11. [승인된 T9](../plans/issue-220-custom-grimoire-plan-v3.md), [구현 기록](../implementation/issue-220-t9-fixes.md)을 기준으로 검사했다. 제품 코드는 수정하지 않았다. 공개 화면에 결함과 원본 차이가 남아 있어 전체 수용은 미통과다.

## 설계 및 기존 검사 정리

- 선택 완료 뒤 result handoff와 `finishHandoff()`를 요구하던 controller 검사는 사용자가 승인한 즉시 복귀 계약으로 변경했다. canonical 사건 1회 확정, 다음 역할 이동, 세레노버스 notification·공개·종료 후 복귀는 계속 검사한다.
- setup 계약 오류 해소 뒤 비활성 공개 버튼을 기대하던 검사는 대상 선택 상태를 기대하도록 변경했다. 후보 계약이 없을 때 오류·확정 차단·canonical 보존 검사는 유지했다.
- 세탁부 정상/중독/취함을 실제 WASM으로 재현하여 대상 전 입력 없음, 수락 후 유효 후보, 필요한 정답 지정, 공개 후 중복 select 없음, reminder 전달을 확인한다. 취함 fixture는 실제 주민/외지인 분포 및 악마 속임수 미사용 직업 조건을 유지한다.
- 설명 열기/닫기 후 draft 보존 검사를 추가했다.
- 브라우저는 사용자 시나리오 JSON에서 새 15인 배치 후 하수인→악마→독살범 선택→세레노버스 통지→중독 세탁부 준비/공개를 실제 클릭한다. 대상 강조는 클래스 존재 대신 계산된 7px 효과를 검사하고 desktop panel bounding box, 불필요한 다음 버튼 부재를 검사한다. force click은 사용하지 않는다.
- 공개 27사례는 실제 CustomReveal와 원본 TB/SnV/광기/정체 변경/쌍둥이 컴포넌트의 DOM을 생성한다. 내용 동일성, 닫기·포커스·이야기꾼 정보 숨김을 검사한다. 브라우저에서는 각각의 실제 production 페이지 stylesheet와 원본 application 조상 환경을 보존하고 이미지 로드 후 크기·상대 위치·글자 크기·내용 넘침·viewport 잘림을 비교한다. BMR 색상 변경은 동등성 비교에서 제외한다.
- 공개 fixture 렌더는 각 역할의 전체 게임 진행을 대신하지 않는다. 실조작 경로와 공개 표현 대조의 증거를 구분한다. 원본에 있던 넘침도 별도로 기록하여 깨진 원본 치수를 그대로 복제하는 것을 정답으로 삼지 않는다.

## 수용 항목 결과

| 항목 | 결과와 경계 |
|---|---|
| T9-1 직업 설명 | 통과: 실제 독살범 아이콘으로 설명 열기/닫기, 세탁부 draft 보존. 획득 역할 전체 조합의 실기기 검사는 미실행 |
| T9-2 선택 패널 | 통과: 1366px에서 board 오른쪽 panel, 320/390/820px에서 실제 선택 가능 |
| T9-3 강조 | 검사 범위 통과: 독살범 대상 7px 강조 및 actor/비선택 상태 캡처. 모든 대상 종류의 원본 시각 동등성 전체 판정은 아님 |
| T9-4 자동 복귀 | 통과: 직접 확정 후 진행 복귀, 추가 다음 버튼 없음. 세레노버스 필수 통지는 유지하고 닫은 뒤 세탁부로 복귀 |
| T9-5 세탁부 입력 시점 | 통과: 대상 선택 전 보여줄 캐릭터/공개 입력 없음, 수락 후 입력 |
| T9-6 공개 UI | 미통과: 아래 F1–F3. 공개 React 렌더 27건 성공과 UI 동등성은 별개 |
| T9-7 불필요한 선택 상자 | 정상/중독/취함 세탁부 검사 통과: 빈·선행·공개 후 중복 상자 없음, Core가 제공하는 실제 전달 후보 유지. 다른 역할의 모든 impairment 조합은 미검증 |

## 남은 결함

### F1. 공개 화면의 원본 크기·배치 차이

27사례 × 4폭(320/390/820/1366) 중 각 폭에서 15사례가 원본과 다르다. 시계공·수학자·신탁·저글러, 꽃팔이/포고꾼의 양쪽 결과, 꿈꾸는 자, 재봉사 양쪽 결과, 현자, 선/악 정체 변경, 쌍둥이다. TB 계열 11사례와 세레노버스의 내용 geometry는 대조되지만 세레노버스 320px 잘림은 별도 실패다.

예: 1366px 시계공 custom 680×525.625, 원본 826×666. custom role shell의 명시적 border-box와 원본의 content-box 환경, 원본 모바일 backdrop의 12px 규칙과 custom padding 경로가 다르다. `BmrRevealSurface`, `bmrRolePresentation.css`, 원본 reveal/evil-information CSS의 shell 계약을 다시 정리해야 한다. 원본 자체에도 모바일 넘침이 측정되므로 원본 숫자를 무조건 복제하는 수정은 적절하지 않다. 원본 동등성 불일치와 읽을 수 없는 잘림을 구분해 수리해야 한다.

### F2. 320px 공개 화면 오른쪽 잘림

세레노버스, 선/악 정체 변경에서 dialog가 viewport 오른쪽을 벗어난다. 세레노버스는 실제 새 게임 진행 캡처에서도 재현된다. 원본 통지의 최소 버튼 폭/내용 최소 폭과 padding을 BMR shell 안에서 수용하지 못한다. 원본 쪽에도 같은 종류의 좁은 화면 문제가 관찰되었다.

증거: [실제 세레노버스](issue-220-t9-evidence/browser-final/issue220-t9-acceptance-T9--6ba1b-Washerwoman-reveal-at-320px/cerenovus-reveal.png), [정체 변경](issue-220-t9-evidence/reveal-verified/issue220-t9-reveal-T9-6-original-role-geometry-at-320px/characterChange-good-custom.png).

### F3. 쌍둥이 공개 내용이 카드 밖으로 넘침

1366px 쌍둥이 공개에서 제목과 오른쪽 정체 카드가 720px dialog 밖으로 나온다. `scrollWidth > clientWidth`로 검출했고 캡처에서도 확인했다. 원본은 더 넓은 외곽 크기를 사용한다. CSS 공유만으로 내부 최소 크기와 새 shell 폭의 계약이 맞춰지지 않았다.

증거: [쌍둥이 공개](issue-220-t9-evidence/reveal-verified/issue220-t9-reveal-T9-6-original-role-geometry-at-1366px/evilTwin-custom.png).

## 실행 결과

| 명령·범위 | 결과 |
|---|---|
| cargo test --workspace | 532 통과 |
| pnpm --dir web test:custom | 최종 38파일/179 통과 |
| pnpm --dir web test:unit | 166 통과 |
| vitest run --maxWorkers=2 | 89파일/643 통과. 이후 추가한 취함·draft 검사는 해당 파일 재실행 11/11 통과 |
| 공개 matrix + 정보 UI 집중 실행 | 38/38 통과 |
| issue220-t9-acceptance.spec.ts | 4폭 실조작 4/4 통과 |
| issue220-t9-reveal.spec.ts | 4폭 모두 실패. 108사례의 치수/위치/넘침 증거 기록 |
| custom boundary + detector / architecture / PWA | 통과, detector 10건 |
| integration/browser TypeScript / diff check | 통과 |

구현 단계의 필수 web build 결과물을 검사했다. 이번 단계 제품 소스 변경이 없으므로 WASM/Vite 재빌드는 반복하지 않았다. operator가 preview 10220의 HTTP 200 및 issue-220 worktree 빌드 일치를 확인했고 서버를 유지했다.

## 검출력·CI·공백

- 공개 테스트는 현재 남은 실제 결함에 실패하므로 추가 임의 mutation은 하지 않았다. 잘못된 result 대기 기대값은 승인 근거에 따라 제거했으며 사용자 동작을 약화시키지 않았다.
- 초기 테스트의 세레노버스 버튼 이름과 중독 공개 버튼 이름, fixture의 이미지 base 경로 및 원본 stylesheet/조상 문맥 오류를 고쳤다. 그 실행은 제품 판정 근거에서 제외했다. 최종 근거는 `browser-final`과 `reveal-verified`다.
- validate workflow의 custom/integration/browser 수집 glob에 새 검사가 포함된다. browser 공개 비교의 beforeAll이 현재 소스로 matrix DOM을 생성하므로 고정된 과거 HTML을 정답으로 재사용하지 않는다. product build 후 실행되는 기존 `pnpm test:browser` 연결을 사용한다.
- 물리 모바일, 모든 역할의 실제 Core→공개 전체 경로, 스파이 마도서 공개의 이번 실조작, T7의 71조건/29action 전체 UI 동등성, 기존 전체 browser locator 이전은 미완료다. 이번 성공 건수로 전체 인수를 완료 처리하지 않는다.

검증 소스 상태: [파일 hash](issue-220-t9-evidence/tested-state.json). 실행 로그: [logs](issue-220-t9-evidence/logs/). 제품 소스가 미커밋인 상태를 그대로 보존했다.

## T10 후속 정정

[추가 인수 조사](issue-220-t10-findings.md)에서 중독/취함 정답 플레이어 선택을 요구했던 기대값을 철회했다. T9-7의 해당 통과는 원본 UI 수용 근거로 사용할 수 없다. T9-3은 두 명 중 한 명만 선택했을 때의 실패, T9-6은 모바일 악마 공개 및 첩자 공개의 누락된 대조가 추가되었다.
