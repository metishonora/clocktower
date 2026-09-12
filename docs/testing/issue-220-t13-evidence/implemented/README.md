# T13 구현 후 검증 증거

- `production/`: T10 실제 입력/선택/공개·원본 TB 및 T9/V3 새 게임 회귀.
- `final-reference/`: 최신 T13 입력/통지/Undo/새 시나리오, 원본 TB/SnV, T11 보정/변종, 마지막 수학자·낮 전환 검사.
- `*-final.log`, `browser-tail.log`: 명령 결과. browser-final/reference-final 로그의 원본 전용 locator/선행 안내 오류는 결과 문서에 설명했고 tail에서 남은 4건을 통과시켰다.
- `integration-load-timeouts.log`: 무거운 browser 동시 실행 시 발생한 시간 제한 기록. `integration-final.log`는 시간 제한 변경 없이 독립 실행한 780개 통과 결과다.

최종 판정과 action별 연결은 [결과 문서](../../issue-220-t13-results.md)를 기준으로 한다. 이 디렉터리 밖의 이전 Red는 테스트 준비 당시 기록이다.

화면 증거 408개는 크기/색상/투명도 등 픽셀을 바꾸지 않은 lossless WebP로 보관한다. 저장 후 RGBA 바이트가 원본 PNG와 정확히 같은지 전부 확인했다. 테스트 로그의 원래 `.png` 이름은 같은 경로의 `.webp`에 대응한다.
