# #218 · 마도서 전체 테마 검토 시작점

#205에서 분리된 이야기형 콘솔 시안이다. 사용자 평가는 “시안으로선 무난”이며 최종 디자인 승인이 아니다. #218 테마 검토 완료 후 #205 Production UI 연결을 재개한다.

## 레퍼런스

1. [Potion Craft](https://www.potioncraft.com/): 동화 같은 종이·잉크 질감.
3. [The Boat](https://www.sbs.com.au/theboat/): 문장과 그림이 이어지는 인터랙티브 서사 구성.

사용자 스케치: [본문](user-sketch-1.jpg), [하수인에게 공개](user-sketch-2.jpg), [속임수 선택](user-sketch-3.jpg), [악마에게 공개](user-sketch-4.jpg).

## 보존된 시안

진입 HTML: `web/issue-218-story.html`
소스: `web/src/prototypes/issue218/StoryConsole.tsx`, `storyConsole.css`

하수인 정보 공개 → 가리기·전달 완료 → 속임수 3개 선택 → 악마 정보 공개 → 가리기·전달 완료 → 다음 문단. 공개 중에는 본문을 렌더하지 않는다. 예시 사람·정보와 로컬 상태만 사용한다. 실제 게임·저장·로딩 전환은 연결하지 않는다.

검토 서버는 프로젝트 수명 주기 관리자와 지정 server operator를 통해 실행한다. Vite 전용 profile `prototype:issue-200-custom-script`를 사용하며 서버의 `/clocktower/issue-218-story.html`로 접근한다.

기존 #205 경로로 촬영한 스냅샷: [본문](story-desktop.png), [모바일 선택](story-selection-mobile.png), [모바일 정보 공개](story-reveal-mobile.png). 이미지 속 #205 표기는 분리 전 검토 도구의 라벨이다.

기존 캐릭터 catalog와 NanumPenScript를 재사용한다. 독립 HTML·prototype 파일 외 제품·공용 설정 변경 없음. 전체 예시 흐름과 모바일/데스크톱 수동 확인, TypeScript 진단 및 prototype_reviewer preflight 통과. 자동 테스트·Production build는 실행하지 않았다.
