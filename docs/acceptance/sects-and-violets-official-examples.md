# 화단에 꽃피운 이단 공식 예시 분류

이 문서는 2026-07-22에 확인한 공식 영문 위키의 예시 79개를 구현 이슈와 검증 방식에 연결한다. 예시의 한국어 본문, 안정적인 예시 ID, 원문 리비전은 [`web/src/sectsAndVioletsCharacterRules.ts`](../../web/src/sectsAndVioletsCharacterRules.ts)가 단일 기준이다.

## 분류 기준

- `rust-regression`: 도메인 규칙의 결정적 입력/결과를 Rust 회귀 테스트로 고정한다.
- `web-regression`: 사용자 입력이나 화면 흐름을 웹 회귀 테스트로 고정한다.
- `json-acceptance`: 여러 캐릭터나 상태 전이를 포함한 시나리오를 저장·재생 가능한 JSON 인수 테스트로 고정한다.
- `manual-acceptance`: 이야기꾼의 사회적 판단이나 자유 형식 정보처럼 자동 판정하면 안 되는 흐름을 수동 인수 조건으로 확인한다.
- `out-of-scope`: 현재 기본 S&V 범위 밖인 여행자 판정·추방이 핵심인 예시다. 각 데이터 항목에 사유를 기록한다.

여러 캐릭터가 상호작용하는 예시는 원래 캐릭터 이슈에 소유권을 두고 `crossCharacterIssue: 111`도 함께 기록한다.

## 인벤토리

| 캐릭터 | 안정적인 예시 ID | 소유 이슈 | 분류 | 위키 리비전 |
|---|---|---:|---|---:|
| 시계공 | `clockmaker-example-1`–`clockmaker-example-3` | #96 | rust-regression 2, out-of-scope 1 | 2967 |
| 꿈꾸는 자 | `dreamer-example-1`–`dreamer-example-4` | #98 | rust-regression 1, json-acceptance 2, manual-acceptance 1 | 2904 |
| 뱀 조련사 | `snakeCharmer-example-1`–`snakeCharmer-example-3` | #101 | rust-regression 1, json-acceptance 2 | 2905 |
| 수학자 | `mathematician-example-1`–`mathematician-example-3` | #108 | rust-regression 1, json-acceptance 2 | 3109 |
| 꽃팔이 소녀 | `flowergirl-example-1`–`flowergirl-example-3` | #96 | rust-regression 2, out-of-scope 1 | 2907 |
| 포고꾼 | `townCrier-example-1`–`townCrier-example-2` | #96 | rust-regression 1, out-of-scope 1 | 2908 |
| 예언자 | `oracle-example-1`–`oracle-example-2` | #96 | rust-regression 1, out-of-scope 1 | 2909 |
| 백치천재 | `savant-example-1`–`savant-example-4` | #102 | manual-acceptance 4 | 2910 |
| 재봉사 | `seamstress-example-1`–`seamstress-example-3` | #98 | rust-regression 2, json-acceptance 1 | 1999 |
| 철학자 | `philosopher-example-1`–`philosopher-example-3` | #107 | json-acceptance 3 | 2421 |
| 화가 | `artist-example-1`–`artist-example-4` | #102 | manual-acceptance 4 | 1752 |
| 곡예사 | `juggler-example-1`–`juggler-example-2` | #102 | web-regression 1, json-acceptance 1 | 2401 |
| 현자 | `sage-example-1`–`sage-example-3` | #98 | rust-regression 1, json-acceptance 2 | 3009 |
| 변종 | `mutant-example-1`–`mutant-example-4` | #105 | manual-acceptance 4 | 1755 |
| 사랑꾼 | `sweetheart-example-1`–`sweetheart-example-3` | #103 | json-acceptance 3 | 2704 |
| 이발사 | `barber-example-1`–`barber-example-4` | #103 | web-regression 1, json-acceptance 3 | 1757 |
| 얼뜨기 | `klutz-example-1`–`klutz-example-2` | #103 | manual-acceptance 1, json-acceptance 1 | 1758 |
| 사악한 쌍둥이 | `evilTwin-example-1`–`evilTwin-example-4` | #106 | rust-regression 1, json-acceptance 3 | 3101 |
| 마녀 | `witch-example-1`–`witch-example-5` | #106 | rust-regression 3, json-acceptance 1, out-of-scope 1 | 2682 |
| 세레노버스 | `cerenovus-example-1`–`cerenovus-example-3` | #105 | manual-acceptance 3 | 3048 |
| 마귀할멈 | `pitHag-example-1`–`pitHag-example-4` | #104 | rust-regression 2, json-acceptance 2 | 2998 |
| 팡 구 | `fangGu-example-1` | #112 | json-acceptance 1 | 2974 |
| 비고르모르티스 | `vigormortis-example-1`–`vigormortis-example-3` | #110 | json-acceptance 3 | 3015 |
| 노 다시 | `noDashii-example-1`–`noDashii-example-2` | #110 | rust-regression 2 | 2950 |
| 보르톡스 | `vortox-example-1`–`vortox-example-5` | #109 | json-acceptance 4, out-of-scope 1 | 3017 |

합계: 예시 79개, 캐릭터 전용 표식 36개, 철학자 공용 표식 1개.
