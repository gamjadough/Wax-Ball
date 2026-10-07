# 500환생 로컬 검토

주소: http://127.0.0.1:4188/?preview=rebirth500

최초 접속 시 샘플 관리자 계정을 자동으로 준비합니다. 499환생과 다음 환생 비용을 지급하므로 상단 환생 버튼 → 환생하기로 500환생을 시험하세요. 왼쪽 아래 준비 버튼으로 다시 시작할 수 있습니다. 새로고침은 진행도를 유지하지만 서버 재시작 시 샘플 서버 데이터는 초기화됩니다. 운영 계정/DB와 연결되지 않습니다.

재실행(PowerShell, 프로젝트 폴더):

```powershell
$env:WAKPPU_LOCAL_PORT='4188'
node tools/local-server.mjs
```

- 기존 1~100환생 비용 유지, 101~500은 매회 ×2(10회마다 ×1,024).
- 기본 보상 및 환생 배율 `2^환생횟수` 유지.
- Gold 정수 저장 한도: 0~10^1000−1. 서버는 숫자 문자열로 주고받고 클라이언트는 BigInt 계산.
- 기존 단위 유지, short scale 이름을 Ce(centillion, 10^303)까지 확장. 축약 철자는 게임 자체 규칙이며 국제 공통 단위가 아닙니다. 이후에는 지수 표기.
- 참고: https://mathworld.wolfram.com/LargeNumber.html
- 운영 DB 적용용: `supabase/migrations/20261011_rebirth_500_big_gold.sql`. 기존 100환생 마이그레이션이 선행되어야 합니다. 로컬 PostgreSQL 검증만 완료했으며 운영 DB에는 적용하지 않았습니다.

검증:

```powershell
node --test tools/admin-service.test.mjs tools/gold-format.test.mjs tools/rebirth-500.test.mjs tools/rebirth-500-sql.test.mjs
python tools/rebirth-500-browser.py
```

브라우저 검증에는 `tools/.test-deps`의 Python Playwright 및 Google Chrome과 실행 중인 4188 서버가 필요합니다. 데스크톱/모바일 화면, 환생 499→500, 저장·새로고침, 1,000자리 Gold 저장·새로고침, JS 오류/가로 넘침을 검증합니다.
