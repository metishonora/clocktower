# #232 자동 검증 및 사용자 인수 인계

## 현재 결과

47종 전부에 실제 능력·효과 검증 사례를 연결했다. 다섯 복합 게임에 80개 확인 사례, 시나리오 JSON 5개, 재현 게임 JSON 39개를 제공한다. 각 게임은 실제 Production 명령으로 생성했으며 첫날 밤·여러 낮과 밤·종료를 확인했다. 사용자 직접 인수 피드백을 반영했고, 2026-09-17 finalize 요청으로 합의 범위의 최종 승인을 받았다. 개별 사례 및 실기기의 미확인 기록은 유지한다.

- 기준 작업 커밋: `5e940ff` (`develop`). #231 완료 기준은 `ec92d37`이며 이 기준에 포함되어 있다.
- 변경: 복합 인수 자료, 인수 중 확인한 규칙·진행 UI·성능·Undo 수정, 승인된 예측불허의 죽음 단계와 코드 리뷰 후 구조 정리.
- 환경: macOS arm64, Node 26.5.0, 실제 custom WASM. Node 저장 테스트는 fake-indexeddb, 브라우저는 실제 IndexedDB.
- [사용자 절차](../../fixtures/acceptance/custom-composite/README.md), [47종 확인표](../../fixtures/acceptance/custom-composite/coverage.md), [80개 사례의 기대·수행 방법](../../fixtures/acceptance/custom-composite/cases.md), [manifest](../../fixtures/acceptance/custom-composite/manifest.json).
- 사례의 관찰은 manifest의 `checks[].observation`에 마지막 실제 사건·당시 정체·생존·중독 상태로 보존한다. 기대값은 실행 코드에서 독립적으로 작성하고 assertion으로 검증한다.

## 최초 인수 묶음 검증 기록

| 검증 | 결과 | 근거 |
| --- | --- | --- |
| Rust custom domain/WASM | 224 통과 (218+6) | `.codex-tmp/issue232-rust.log` |
| 복합 게임 G01–G05 | 5 통과, 사례 80개 | `.codex-tmp/issue232-games.log` |
| 배포할 모든 시나리오·게임 파일 재검증 | 통과 | `.codex-tmp/issue232-archive.log` |
| 전체 custom Node·UI | 348 통과 (54개 파일) | `.codex-tmp/issue232-custom.log` |
| Production 빌드·PWA 계약 | 통과 | `.codex-tmp/issue232-build.log`, `verify:pwa` |
| fixture 런타임 | 통과 (웹 13개 포함) | `.codex-tmp/issue232-runtime.log` |
| 공식 소스 없는 격리 빌드·테스트 | 통과 | `.codex-tmp/issue232-isolation.log` |
| Chromium 데스크톱 인수 | 6 통과 | `.codex-tmp/issue232-browser.log` |
| WebKit 390·820 인수 | 12 통과 | `.codex-tmp/issue232-webkit.log` |
| #231 PDF·징크스 회귀 | 7 통과, WebKit 오프라인 2개 제외 | `.codex-tmp/issue232-reference.log` |
| 공식 TB·SnV/BMR 진입·복원 및 custom 진입 | 9 통과 | `.codex-tmp/issue232-official-browser.log` |
| 기존 밤 순서·세 밤 UI 회귀 | 6 통과 | `.codex-tmp/issue232-orders.log` |
| TypeScript custom·browser | 통과 | 각 tsconfig의 `--noEmit` |

브라우저 검증은 명령·Core·PDF 생성을 대체하지 않는다. 실제 Production 앱에 이 묶음의 파일을 업로드하고 선택·공개·확정·reload·재불러오기·Undo를 조작한다. 다섯 후보 풀의 징크스 수와 배역 배정 전후 PDF 내용 일치를 확인한다. PDF 비교에서는 생성 시각 메타데이터만 정규화한다.

## 기존 근거를 재사용한 범위

| 항목 | 기존 테스트 근거 |
| --- | --- |
| 분포 보정·후보 풀 비적용 | `issue220T11Distribution.test.ts` |
| 정보·등록·취함/중독·능력 출처 | `issue209MixedFirstNight.test.ts`, `issue209Provenance.test.ts` |
| 세 징크스의 사건 당시 근거와 비적용 | `issue213Jinxes.test.ts` |
| 동률·유령표·낮 능력·광기·승리 | `issue223Day.test.ts` |
| 획득·후속·역사 정보·오래된 밤 명령 | `issue225Nights.test.ts` |
| 오래된 명령·변조 파일·저장본 보호 | `storageReplay.test.ts`, `issue209RoundTrip.test.ts` |
| 저장 실패·재시도·후속 통지 | `issue222ResultCheckpoints.test.ts`, `issue220Application.test.ts` |
| 독립 밤 순서 편집·복원·파일 왕복 | `issue222-other-nights.spec.ts` |
| 긴 PDF·전체 47종·한글·페이지 나눔·오프라인 | `scenarioReference.spec.ts` |

이 근거와 주요 분기 목록은 개별 검증 범위만 의미한다. 각 캐릭터×모든 중독 원인×모든 정체 변경 시점의 전체 조합을 확인한 것은 아니다. 새 캐릭터를 추가하면 기존 목록과 구체 사례를 대조해 추가 분기를 작성한다.

## 결함과 남은 확인

[D01·D02](issue-232-defects.md): 성결자·집착 처형을 장의사가 놓치는 문제, 기존 악마를 다른 악마로 바꿀 때 마귀할멈의 임의 사망 판단을 놓치는 문제를 수정했다. 두 결함 모두 작은 Rust 회귀와 실제 복합 게임으로 재검증했다. 별도 GitHub 수정 이슈 연결은 아직 하지 않았다.

다음은 미확인으로 유지한다.

- 80개 사례 각각의 직접 수행 결과는 전부 수집하지 않았다. 대화의 직접 테스트·수정 피드백 및 최종 승인과 개별 사례 통과 기록을 구분한다.
- 실제 iPhone/iPad Safari의 터치·시스템 인쇄/PDF 저장·설치 앱 오프라인 재시작. 자동 WebKit의 오프라인 시험은 기존 도구 제약으로 제외하며 실제 Safari 확인을 대신하지 않는다.
- 주요 분기 목록 중 복합 게임에 직접 배치하지 않은 조합의 사용자 확인. 기존 자동 테스트의 통과를 직접 인수로 옮겨 적지 않는다.
- 과거 잘못된 규칙으로 확정한 파일의 migration은 제외 범위다. 이번 파일은 수정된 규칙으로 새로 만들었다.

#232는 대화에서 요청한 수정과 최종 구조 개선을 완료했고, 사용자 finalize 요청에 따라 저장소 마무리를 진행한다. 실기기 및 미기록 개별 사례는 통과로 바꾸지 않는다. #191 인계 시 G01·G02·G05를 빠른 회귀로, 최종 검증에서는 다섯 게임 전체와 CI 브라우저 묶음을 재사용한다.

## 최초 인수 묶음 규칙 소스의 SHA-256

- `crates/custom-domain/src/characters/trouble_brewing.rs`: `0ff2b6c4c3407dd5d33b48c3cebd97cac5616c4dea33b3437a17fbd08e1cfa8b`
- `crates/custom-domain/src/characters/sects_and_violets.rs`: `884508ff7b1e9cbcf0e1504e9f980143e0f1ce209fd275bba48715907824e476`


## 최종 구현 검증 및 인계 (2026-09-17)

- Rust custom-domain 225개, custom-wasm 6개 통과.
- custom 웹 55개 파일 353개, 관련 제품 UI 5개 파일 34개 통과.
- custom/integration TypeScript, 아키텍처 검사, custom/official 경계 검사, 웹 빌드 통과.
- 공식 소스 없는 전체 격리 Rust/WASM·TypeScript·웹 검증 통과.
- 새 회귀는 CI의 Rust, custom 웹, 제품 UI, 복합 브라우저 작업에 연결했다.
- 상세 구조 변경과 검증은 [코드 리뷰 후 조치](issue-232-code-review.md)에 기록했다.
- G05 안내는 최종 UI의 유발자 표시로 갱신했다. 기존 JSON 및 수동 사례 수는 유지한다. 게시 당시 고정 커밋 링크의 파일은 당시 안내를 보존하며, 저장소의 G05 ZIP이 최신 안내다.
- #191에서는 위 회귀와 복합 게임을 재사용한다. 실기기 Safari/PDF/설치 앱 오프라인 및 미기록 수동 사례는 별도 확인 범위로 남긴다.
