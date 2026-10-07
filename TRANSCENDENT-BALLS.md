# 초월 왁뿌볼 — 로컬 검증

차원(화이트홀) 다음에 성광, 지옥불, 천국의 구름, 지옥의 불씨, 천국의 보석, 지옥의 핵, 심판의 구체, 천지의 구체, 영혼의 구체, 영겁의 왁스볼 순서로 추가했습니다.

가격·보상은 요청한 값 그대로이며 가격은 BigInt로 처리합니다. 필요 타격량은 360회에서 단계마다 두 배로 증가해 마지막은 184,320회입니다. 보석 코팅 활성 시 필요 타격량은 추가로 두 배, 보상은 세 배입니다. 환생·꿀·Gold 이벤트 배율도 함께 곱합니다.

로컬 서버에서 `/?preview=transcendent`를 열면 볼 선택과 마지막 한 타격 준비, 처음부터 타격, 정확한 가격으로 해금 테스트를 할 수 있습니다. 이 도구는 로컬 서버에서만 삽입되고 운영 계정과 연결되지 않습니다. 로컬 테스트 진행도는 미리보기 버튼으로 바뀝니다.

검증: 모바일 브라우저에서 10개 볼 해금·보상·재접속 저장, PostgreSQL에서 신규 ID와 큰 수 저장·마이그레이션 재적용·잘못된 ID 차단, 이벤트 보상 및 큰 수 표시 테스트 통과.

```powershell
node --test tools/transcendent-sql.test.mjs tools/coating.test.mjs tools/admin-ball-event.test.mjs tools/gold-format.test.mjs
python tools/transcendent-browser.py
```

운영 배포 전 `20261009_transcendent_balls.sql`을 적용해야 신규 볼 저장과 이벤트 기준 보상이 서버에서도 반영됩니다. 현재 운영 DB에는 적용하지 않았습니다.
