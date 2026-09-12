# #220 인수 피드백 수정 — 2026-09-11

사용자가 지적한 “형태만 참고하고 세부는 다른 UI”를 수정했다. 직업 설정은 SnV Production, 배치·상세는 BMR Production의 실제 컴포넌트를 재사용한다. 최초 프로토타입 승인은 세부 차이의 승인으로 취급하지 않는다.

## 수정 내용

- `SetupControls` / `SetupRoleDetail`: SnV에서 플레이어 수·악마 선택·분포 카드·직업 설명·금색 확정 버튼을 분리해 SnV와 커스텀에서 함께 사용한다. 직업 설명의 상세 열기도 기존 `CharacterDetailButton`을 사용한다.
- `AssignmentSurface`: `badMoonRisingGame.tsx`의 Production 배치 UI를 분리해 BMR과 커스텀 설정/확정 마도서에서 함께 사용한다. 좌석/직업 토큰 선택, 배치 이동, 무작위 배치, 초기화, 좌석 이름, 하단 선택판과 `좌석 확정`을 유지한다. Core별 상태와 표시 배역 후보를 인자로 전달한다.
- `PlayerTokenDetailDialog`: BMR이 쓰는 실제 플레이어 상세를 커스텀에서도 사용한다. 커스텀의 실제/표시 배역·진영·생존·취함/중독 정보를 전달한다.
- 커스텀 전용으로 모든 버튼을 덮어쓰던 CSS를 제거해 기존 탭·좌석·선택·확정 스타일이 적용되게 했다. 진행 화면도 기존 SnV 섹션/행동 순서 스타일을 사용한다.
- 작성 2단계 모바일 목록은 최소 열 너비 88px, 12.8px 직업명, 줄바꿈과 넓은 간격을 사용한다. 320px에서는 2열, 390px에서는 3열이며 47개 직업을 스크롤할 수 있다.
- 설정 선택은 현재 custom Core 분포의 종류별/총 정원을 넘지 못한다. 분포 조회 중 추가 선택을 막고 인원/보정이 바뀌면 정원을 넘는 뒤쪽 선택과 해당 배치를 정리한다. 악마는 SnV처럼 별도 선택에서 교체한다.
- BMR의 781–900px 구간에서 하단 선택판만 나타나고 닫기 배경은 없던 breakpoint 불일치를 발견해 공통 BMR 스타일에서 수정했다.

Core 게임 규칙·저장 형식·자동 저장 대체 계약은 변경하지 않았다. 기존 review prototype는 보존했다. BMR 규칙/캐릭터를 커스텀에 추가한 것은 아니다.

## 검증

- `pnpm --dir web test:custom`: 161개 통과. 정원 초과/조회 중 중복 선택/인원 축소/악마 교체와 분포 보정/좌석 이동/무작위 중복 방지 회귀 검사 포함.
- SnV·BMR·shared presentation 집중 통합 검사: 4파일 44개 통과.
- `pnpm --dir web build`: 통과 (공식/custom WASM, TypeScript, Vite).
- Production 브라우저: 320/390/820/1366px 작성→설정→배치→플레이어 상세→첫날 밤→공개→reload→JSON 재개. 전체 47명 이름의 DOM 잘림·최소 글자 크기와 스크롤 검사 포함. 최종 24개 모두 통과.
- `check:architecture`, custom/official 경계 검사, `git diff --check`: 통과.

처음 브라우저 검사의 모바일 배치 입력은 데스크톱처럼 토큰을 먼저 찾던 잘못된 조작이었다. BMR 원래 동선인 좌석→하단 토큰 선택으로 수정했다. 그 뒤 820px에서 닫기 배경이 실제로 없음을 재현했고 CSS를 수정했다. 기대 동작을 낮추거나 timeout을 늘리지 않았다.

이 수정 기록은 앞선 테스트 결과를 대체하는 전체 수용 완료 선언이 아니다. 실기기 사용자 검토와 기존에 명시한 복합 사례의 미검증 경로는 남아 있다.


## 추가 인수 피드백 — 상단 유틸리티·진행 탭

사용자: “직업과 배치 부분까진 많이 된 거 같아. 우측 상단의 유틸리티 버튼들이 없고 진행 탭은 아직 개선 전 느낌이네.”

- 설정/플레이 양쪽에 기존 SnV의 `새 게임`, `저장 / 불러오기`, `버그 제보`를 연결했다. 새 게임은 같은 시나리오의 빈 Setup으로 이동한다. Setup 진입과 파일 검토만으로 기존 슬롯을 덮어쓰지 않고, 유효한 Setup 확정 또는 명시적 이어 쓰기에서 대체한다.
- 저장 화면은 기존 SnV 저장 카드 구조다. 플레이에서는 canonical 게임 JSON, 설정에서는 시나리오 JSON을 저장한다. JSON 불러오기는 실제 작성기의 최종 검토/오류 처리와 이어 쓰기에 연결했다.
- 버그 제보는 기존 `GameBugReportDialog`를 데이터 타입만 일반화해서 재사용한다. 커스텀 definition/게임 이벤트를 포함하고 기본 보고서에서는 이름·메모·자유 서술 이벤트 요약을 제거한다. 원본 포함은 사용자가 명시적으로 선택해야 한다. 실제 이메일을 발송하는 테스트는 하지 않았다.
- SnV의 실제 악의 팀 정보 UI를 `EvilInformationTask`로 분리해 공식/커스텀이 함께 사용한다. 깨울 플레이어, 속임수 3개 선택/무작위 추천, 공개/다음 버튼을 유지한다.
- BMR의 행동 카드 구조를 `NightTaskCard`로 분리했다. 커스텀 진행 화면은 직업 아이콘·상세·소유자·능력, 획득 능력 표시, 정보 준비, 입력/금색 공개 버튼, 진행 순서를 표시한다. `bmrPlayPrimary`를 사용해 데스크톱은 행동 카드/순서 2열, 모바일은 세로 배치다. 기록은 진행 헤더에서 연다.
- 정체·광기 통지와 행동 전 정체 공개를 진행 보조 영역에 유지한다. 공개 포털의 배경 숨김/키보드 격리, canonical 확정, Undo는 기존 경로를 사용한다.
- 실 렌더링에서 발견한 320px 전달 정보 라벨의 세로 꺾임, 악마 정보 버튼의 카드 이탈, 입력 그룹 제목의 과대 크기를 수정했다. 악마 정보의 작은 화면 보정은 SnV와 커스텀이 공유하는 CSS에 적용한다.

### 추가 검증 결과

- `pnpm --dir web build`: 통과 (최종 로그 `/tmp/issue220-utilities-build-final.log`).
- custom: 34파일 **161개 통과** (`/tmp/issue220-utilities-custom-final.log`).
- SnV/BMR/기존 버그 제보/악의 정보 집중 통합: 6파일 **45개 통과**. 새 커스텀 보고서 익명화/원본 opt-in 검사 **1개 통과**. 마지막 공유 CSS 수정 뒤 악의 정보와 커스텀 보고서 2개 재검사 통과.
- 최종 Production 브라우저: custom-grimoire 10개 + 기존 production 5개, **15개 모두 통과** (`/tmp/issue220-utilities-browser-complete.log`). 4개 너비의 전체 흐름, 악마 버튼의 카드 내 경계, 획득 세탁부 준비/전달/Undo, 쌍둥이 종료/Undo, Day 복원, 유틸리티 불러오기·새 게임의 저장 보존, 보고서 기본 익명화 포함.
- 작성기 브라우저 11개는 앞선 같은 변경 검증에서 모두 통과했다. 이후 변경은 진행 UI와 악의 정보 CSS에 한정된다.
- TypeScript app/integration/browser 검사, architecture/custom 경계 검사, diff whitespace 검사 통과.
- 320/390/820/1366px 렌더링 스크린샷을 `issue-220-ui-evidence/utilities-progress-*`에, 저장 화면과 획득 준비 화면도 같은 폴더에 보관했다.

첫 브라우저 검사에서 획득 준비 표시가 `requiredPreparation`에만 의존해 기본 `prepareInformation`을 누락한 문제를 수정했다. 획득 정보 전달도 명시적으로 `정보 공개`라고 표시한다. 종료 Undo 뒤 현재 단계는 하수인 정보로 돌아오고 선택적 변종 행동을 다시 고를 수 있으므로, 검사도 기존 fieldset 클래스 대신 실제 복원된 행동과 실행 체크 상태를 확인한다.

자동화·데스크톱 브라우저 렌더링 확인이며, 사용자 실기기 인수 판정을 대신하지 않는다. 기존 복합 사례의 미검증 경로는 앞선 결과표에 남겨 둔다.

## BMR 전체 테마 + TB 방식의 간결한 진행 순서

사용자 추가 요청에 따라 마도서 전체 시각 테마를 BMR로 통일했다. 이어서 “진행 순서 부분 내용이 너무 길어. TB 마도서 참고” 요청을 반영했다. 이 기준이 앞선 SnV 테마 재사용 기록보다 우선한다.

### 화면 변경

- 설정/직업 목록/배치/진행/기록/저장/제보/로딩·오류에 BMR 색과 서체 계층을 적용했다. 밤은 혈월과 붉은 패널, 낮은 해와 따뜻한 밝은 패널, 주요 행동은 금색이다.
- `bmrProductionShell`, `bmrSetupControls`, `bmrCatalog`, `bmrRoleDetail`, `bmrPlaySurface`, `bmrCurrentStep`, `bmrStorage` 등 실제 BMR 테마를 사용한다. 공통 레이아웃에서 상속되던 보라색은 `customBmrTheme.css`의 BMR 토큰으로 대체했다.
- 실제 BMR 악의 팀 정보/공개 프레임을 `BmrInformationTask`, `BmrRevealSurface`로 분리해 공식 BMR과 커스텀이 공유한다. 커스텀의 무작위 추천/다시 공개와 공개 포털의 숨김·키보드 격리는 유지한다.
- 직업 상세에 `bmr-night`/`bmr-day`를 추가했다. 플레이어 상세에서 연 내부 직업 상세도 BMR appearance를 따른다. 제보는 전용 BMR 테마를 받는다.
- 배치 전 빈 좌석, 좌석 편집판, 마도서 중앙 원과 진행 버튼, 플레이어 상태 배지까지 테마를 맞췄다. 실제 캐릭터 아이콘과 종류/진영의 의미 색은 유지한다.
- 동적 시나리오 이름이 혈월/되돌리기와 겹치지 않도록 헤더 여백을 조정했다.
- TB Production의 `phaseOverviewTitle(..., false)`와 진행 목록 마크업을 확인했다. 목록은 **상태 + 직업명**으로 줄이고, 이름/좌석/장황한 행동 문구는 현재 카드에 남겼다. `하수인`, `악마`, `독살범`, `요리사`, `초공감자`, `시계공`, `낮 시작`처럼 표시한다.
- 획득/표시 능력은 `철학자 · 세탁부`, `주정뱅이 · 초공감자`로 식별한다. 실제 단계 ID·준비/전달 행은 합치지 않는다. 여러 행동을 고르는 버튼에서는 `철학자 · 세탁부 준비`처럼 최소한의 구분을 남기고 전체 설명은 접근성 이름/툴팁으로 보존한다. TB의 녹색 테마는 가져오지 않는다.

### 검증

- 최종 `pnpm --dir web build` 통과: `/tmp/issue220-bmr-theme-build-final.log`.
- 관련 공식 BMR/SnV·악의 정보·제보 통합 5파일 **44개 통과**: `/tmp/issue220-bmr-theme-integration.log`.
- compact label 회귀 포함 custom 35파일 **163개 통과**: `/tmp/issue220-compact-order-custom.log`.
- BMR 테마 전체 1차 Production browser **15개 통과** (custom 10 + 기존 production 5). 마지막 테마/간결한 목록 보정 후 custom 전체 **10개 모두 통과**: `/tmp/issue220-compact-order-browser.log`.
- 브라우저 검사는 320/390/820/1366px의 전체 Setup→배치→밤 흐름, BMR 계산 색/중앙 버튼 색, 플레이어/직업 상세, 정보 공개, 기록, JSON 왕복, 획득 준비/전달/Undo, 종료/Undo, BMR 낮과 낮 상세, 저장/제보를 포함한다.
- app/integration/browser TypeScript, architecture/custom 경계, diff whitespace 검사를 통과했다.

Core·canonical event·자동 저장 대체 규칙은 그대로다. 이 결과는 자동화 및 브라우저 렌더링 검증이며 사용자 실기기 인수 완료를 뜻하지 않는다.

최종 BMR/간결한 목록 렌더링 근거는 `issue-220-bmr-theme-evidence/`에 보관했다. Preview 10220 running/verified/keep=true, 최신 JS/CSS HTTP 200 및 dist 본문 일치를 확인했다.
