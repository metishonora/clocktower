# #218 · v3 구성 재검토

## 사용자 피드백

v2(`354d4f7`)는 “테마가 더 퇴화했다”, “그냥 갈색 배경에 UI”라는 피드백을 받았다. 기능과 반응형 검증을 통과한 사실은 테마 적합성의 근거가 아니었다. v2는 최종 승인된 시안이 아니다.

첫 제작 때는 기존 시안 캡처와 뉴시나리오 원화를 확인했지만 레퍼런스의 실제 화면과 상호작용을 확인하지 않았다. 이번에는 아래 자료를 직접 확인한 뒤 구성을 다시 만들었다.

- [Potion Craft 공식 화면](https://www.potioncraft.com/): 글자, 삽화, 버튼 선이 같은 거친 잉크 재료를 사용한다.
- [The Boat](https://www.sbs.com.au/theboat/): 시작 화면을 통과하고 첫 장 The Storm을 스크롤하며 삽화 안에 글이 나타나는 구성을 확인했다. 게임 플레이 영상 전체를 검토했다는 의미는 아니다.
- 사용자 스케치 네 장: 제목 아래에서 서술과 인물 이름이 연결되고, 완료 문장 다음에 선택이 이어진다. 정보 공개는 별도 종이로 분리된다.
- 뉴시나리오 원화: 검은 공간, 의식의 문양, 오래된 마도서와 절제된 붉은색을 분위기 기준으로 삼았다.

## v3 변경

- 위아래로 구획한 진행 막대·현재 작업 제목·결과 상자를 제거했다. 진행 순서는 접근성용 구조에 남아 있고, 화면에는 다음 기록을 표시한다.
- 배역과 이름을 문장에 포함하고, 조작은 문장 끝의 밑줄·눈 표시·손으로 그은 선택으로 표현했다. 완료 문단도 같은 필사 흐름에 이어진다.
- 데스크톱 배치와 진행을 같은 책의 연속된 지면으로 구성했다. 책등의 음영과 종이 층을 CSS로 표현한다. 완성된 책 사진에 UI를 얹지 않았다.
- 기존 상단 앱 탭을 책 밖의 책갈피로 바꾸고, 모바일의 배치 종이는 계속 별도로 꺼내 사용한다.
- 삽화는 지면 여백과 도입 문장을 함께 구성하는 투명 잉크 이미지로 사용한다. 모바일에서는 글이 놓일 공간을 확보하고 줄바꿈을 따로 정리했다.
- 배역 그림과 선택 표시를 종이에 그린 잉크로 맞추고, 별도 인물·저장 화면도 같은 재료를 사용한다.
- 많은 인원에서는 배치 세로 간격을 늘려 긴 이름과 토큰을 함께 읽을 수 있도록 했다.

## 캡처 및 검증

[데스크톱](v3-desktop.png) · [모바일 본문](v3-mobile-story.png) · [속임수 선택](v3-mobile-selection.png) · [대상 선택](v3-mobile-targets.png) · [320px·15명·긴 이름·토큰](v3-mobile-stress.png) · [저장](v3-storage.png)

CUA에서 공개/가리기/복귀, 속임수 세 가지 제한, 배치에서 두 대상 선택 및 복귀, 결과 선택, 되돌리기 후 입력 보존, 기기 저장 시뮬레이션을 확인했다. 320px에서 가로 넘침 없음을 측정했고 콘솔 오류/경고가 없었다. `pnpm --dir web build`를 실행했다. 자동 테스트는 작성하거나 실행하지 않았다.

`prototype_reviewer`는 최신 데스크톱·390px·320px 캡처를 사용자 스케치와 대조했다. 문장·삽화·조작 구성의 변경, 읽기와 겹침, 범위·격리성·검토 도구 분리를 확인했다. 이는 사용자 최종 디자인 승인이 아니다.

## 생성 삽화

- 실행 방식: imagegen 스킬, 내장 `image_gen` 도구.
- 저장 경로: `web/src/prototypes/issue218/assets/night-woodcut-v3.png` (1536×1024, alpha 있음).
- 원본: `/Users/sg/.codex/generated_images/01a08605-5507-7182-bfab-f5cd25714427/exec-b5eb78e4-faf2-48f1-acdd-4d526f395cd4.png`.
- 생성 후 픽셀 편집 없이 복사했고, 반응형 위치·혼합·마스크는 CSS로 처리했다. 참고 사이트의 그림은 제품 에셋으로 복사하지 않았다.

최종 생성 프롬프트:

> Use case: illustration-story. Asset type: transparent ink illustration to be composed WITH live Korean manuscript text in an interactive sinister grimoire, NOT a UI mockup or a complete book background. Create a horizontal 1536x1024 or similar aspect illustration, actual transparent background. A haunted medieval clocktower and crooked village roofs at night, with a huge thin crescent moon partially eclipsed behind clouds, black ravens and tangled thorn branches in the margin. Extremely refined 16th-century woodcut / copperplate etching, irregular dry black ink, fine crosshatching, worn engraved marks and sparse dark oxblood red hand-drawn alchemical orbital lines. Sinister occult manuscript, adult dark fantasy, not cute or fairy-tale. Composition: clocktower and densely engraved architecture occupy the RIGHT HALF and LOWER THIRD, the LEFT HALF dissolves into sparse smoke and fine ink flecks with lots of completely transparent space for live text. Tower leans subtly inward to frame a paragraph at its left. Organic silhouette and feathered ink boundaries, no rectangular border, no background color or paper, no book, no desk, no candle photo, no interface controls, no lettering, no printed text, no modern vector icons, no gradients or 3D. A richly authored narrative drawing, not a small decorative logo. Keep the transparent open areas truly empty. Palette: near-black ink with tiny dark oxblood red accents only.
