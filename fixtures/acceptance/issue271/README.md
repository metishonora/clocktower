# #271 Everyone Can Play — BMR 6종 인수

프로덕션 Custom Scenario용 파일이다. 기본 8개 파일은 전체 24종 풀에서 주민 7·외지인 2·하수인 2·악마 1의 합법적인 12인 명단을 배정한다. 중독 할머니 회귀 파일은 같은 풀의 합법적인 7인 명단이다. 밤에 중독된 달의 자손 회귀 파일은 별도의 합법적인 9인 명단이다. 새 전용 프리셋이나 공식 BMR 런타임을 추가하지 않는다.

`Custom Scenario 선택 → 파일에서 불러온다 → 아래 게임 파일 → 마도서 이어 쓰기`로 연다. 이전 행동의 결과가 복구되면 `진행으로 →` 또는 `다음 →`를 눌러 해당 체크포인트로 이동한다.

| 파일 | 조작과 기대 결과 |
| --- | --- |
| [advocate.game.json](advocate.game.json) | 보호 대상 선택 → 3번 어릿광대 → 선택 확정. 마도서에서 보호 결과를 보고 진행으로 이동한다. 다음 밤에는 같은 대상을 고를 수 없다. |
| [grandmother.game.json](grandmother.game.json) | 손주 지정 → 5번 화가 → 선택 확정 → 정보 공개. 할머니 아이콘, `당신의 손주`, 사람·직업 두 상자. 닫으면 별도 ‘정보 전달 완료’ 단계가 없다. |
| [poisoned-grandmother.game.json](poisoned-grandmother.game.json) | 손주 지정 → 2번 화가 → 전달 대상 7번 임프·전달 직업 화가. 공개에는 7번/화가만 나오고 실제 손주는 2번으로 남는다. |
| [gambler.game.json](gambler.game.json) | 사람·직업 선택 → 8번 은둔자 + 임프. `임프로 취급`을 고르면 정답·생존, 기본 취급이면 오답·도박사 사망. 은둔자를 추측한 뒤 `다른 직업` → 임프를 골라도 오답이 된다. 같은 마도서에서 결과를 보고 진행으로 누르면 수도사 차례다. |
| [execution.game.json](execution.game.json) | 생존 예상 카드와 변호사·어릿광대 효과 칩. 처형 확정 한 번이면 낮 종료. 어릿광대의 방지 능력은 남아 있다. |
| [grandmother-chain.game.json](grandmother-chain.game.json) | 임프 공격 대상 선택 → 5번 화가 → 선택 확정. 손주와 할머니의 사망 카드 두 장이 같은 결과 패널에 나온다. 되돌리면 두 사망이 함께 취소된다. |
| [assassin.game.json](assassin.game.json) | 암살 대상 선택 → 3번 어릿광대 → 공격 확정. 보호를 우회한 사망과 암살 능력 사용 완료가 마도서에 표시된다. `오늘 사용하지 않음`은 결과 확인 없이 다음 순서로 간다. 사용한 암살자는 다음 밤부터 빠진다. |
| [moonchild.game.json](moonchild.game.json) | 밤 사망 발표 직후 공개 선택 기록 → 8번 은둔자. 선/악 취급을 기록하고 마도서에서 예약 결과를 확인한다. 진행으로 누르면 낮의 다음 단계다. |
| [moonchild-night.game.json](moonchild-night.game.json) | 3번 어릿광대 생존 예상 카드와 확정 버튼 하나. 확정하면 방지 능력이 소모되고 낮 시작으로 넘어간다. 추가 결과 화면은 없다. |
| [moonchild-night-poisoned.game.json](moonchild-night-poisoned.game.json) | 직전 임프 결과에서 진행으로 → 달의 자손 확정. 현재 중독으로 1번 화가는 생존하고 새벽으로 이동한다. 사망 원인을 보존한 기록이 한 번만 추가되며 실제 앱 저장 복원·JSON 왕복·Undo가 정상이다. |

모든 파일은 실제 WASM 명령으로 생성했다. 기본 9개 파일의 `issue271Acceptance.test.ts`는 파싱·재생 결과를 동일한 명령으로 만든 게임과 대조한다. 날짜를 고정해 파일과 재생 체크포인트의 비교를 재현 가능하게 한다. 추가 B20 파일은 `issue271Bmr.test.tsx`에서 실제 앱 불러오기와 확정·저장 복원·JSON 왕복·Undo를 검증한다.

## 자동 검증과 확인 상태

| 대상 | 자동 검증 | 사용자 | 실기기 |
| --- | --- | --- | --- |
| 할머니 | 정상·거짓 사람/직업 전달과 관계 분리, 파일 복원·재공개, 악마/비악마 원인, 연쇄 Undo, 현재 취함·중독/능력 상실, 철학자 획득, 공개 2상자 | 미확인 | 미확인 |
| 도박사 | 정답/오답/자기 선택, 은둔자·첩자의 양방향 취급, 중독·주정뱅이, 획득 어릿광대 보호, 마도서 결과·파일 복원 | 미확인 | 미확인 |
| 어릿광대 | 임프·처형·마녀·도박사·달의 자손 경로, 반복 시도, 중독 사망 소모, 다른 보호 우선, 암살자 우회, 과학자 획득 임프의 자해·승계 | 미확인 | 미확인 |
| 달의 자손 | 사망 발표 직후 선택, 선악 취급 저장, 선택 당시 진영 보존, 밤의 중독·능력 상실·대상 사망·보호, 결과 패널/단일 밤 확정 | 미확인 | 미확인 |
| 악마의 변호사 | 생존 후보·지난밤 대상 제외, 처형 생존, 어릿광대 우선순위·효과 만료, 성자 승리/장의사 정보 미발동, 보호된 선한 쌍둥이 처형 승리 | 미확인 | 미확인 |
| 암살자 | 미사용/일회 소모/중독, 보호 우회, 전도사 억제, 비고르모르티스 사후 보유, 마귀할멈 예약 중 즉시 사망 | 미확인 | 미확인 |

Chromium 390px·1280px의 18개 브라우저 사례를 자동 실행하고 스크린샷을 검토했다. 실제 iPhone·iPad·Safari·오프라인 확인을 뜻하지 않는다. 위 표는 연결된 사례의 범위이며 지원 캐릭터의 모든 순열을 인수했다는 뜻은 아니다. Pixie의 새 6종 획득을 조합한 별도 사례는 아직 없으며 기존 source-bound grant 회귀를 재사용한다. 공식 BMR 미지원 캐릭터나 부활 규칙은 추가하지 않았다.

## 재현

```sh
cargo test -p clocktower-custom-domain -p clocktower-custom-wasm
pnpm --dir web build
pnpm --dir web test:custom
pnpm test:custom-runtime
pnpm --dir web exec vitest run test/issue271Bmr.test.tsx
PLAYWRIGHT_BASE_URL=http://127.0.0.1:10274/clocktower/ pnpm --dir web exec playwright test issue271-bmr.spec.ts --workers=2
```

검토 서버 시작·종료는 프로젝트 수명주기 관리자를 사용한다. 파일을 다시 만들 때만 `WRITE_ISSUE271=1 pnpm --dir web exec vitest run --config vitest.custom.config.ts test/custom/issue271Acceptance.test.ts`를 실행한다. CI 범위는 변경하지 않았다.

규칙·설계·호환성 근거는 [구현 기록](../../../docs/implementation/issue-271-bmr.md)에 있다.
