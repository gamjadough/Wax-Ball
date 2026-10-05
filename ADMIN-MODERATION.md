# 관리자 랭킹 숨김과 밴

관리자 패널에서 플레이어를 검색·선택한 뒤 **랭킹·이용 제한** 영역을 사용합니다.

- **랭킹 숨기기 / 랭킹 다시 표시**: 계정 진행도·플레이·저장은 유지합니다.
- **밴 적용**: 사유를 입력하고 1일·7일·30일 또는 영구 밴을 선택합니다. 적용 전에 확인 창이 표시됩니다.
- **밴 해제**: 이용 제한을 해제합니다. 별도로 설정한 랭킹 숨김은 유지됩니다.
- 기간제 밴은 종료 시각부터 자동으로 효력을 잃습니다. 관리자 계정은 밴할 수 없습니다.
- 밴된 계정은 랭킹에서 자동 제외되며, 서버가 게임 상태 조회·저장·닉네임 변경·랭킹 조회를 거절합니다. 상태 조회는 허용해 사유와 종료 시각을 보여줍니다. 접속 중인 화면은 상태 갱신 시 이용 제한 화면으로 전환됩니다.
- 관리자 기록에 대상·사유·변경 전후 상태가 남습니다. 계정 영구 삭제는 포함하지 않습니다.

## 운영 서버 적용

`supabase/migrations/20261005_ranking_visibility_bans.sql`을 기존 계정·관리자 DB에 적용해야 합니다. 플레이어의 `ranking_hidden` 칼럼을 추가하고 기존 `wakppu_api`의 랭킹 필터·권한·밴 처리를 확장합니다. 기존 공지 해제 기능과 골드 이벤트 래퍼가 있는 경우 이를 보존합니다.

프런트엔드 배포만으로 새 서버 기능이 활성화되지는 않습니다. 이번 작업의 검증은 로컬 샘플 서버와 분리된 PostgreSQL 엔진에서 수행했으며, 운영 DB에는 마이그레이션을 적용하지 않았습니다. 로컬 PostgreSQL 검증에는 저장소의 기존 테이블을 모델링한 스키마 fixture를 사용합니다.

## 검증

```powershell
node --test tools/admin-service.test.mjs tools/gold-format.test.mjs tools/guest-account.test.mjs
python tools/browser-check.py --node node
```

브라우저 테스트에는 Python Playwright와 Microsoft Edge가 필요합니다. 두 브라우저 세션으로 랭킹 숨김·복원, 기간제/영구 밴·해제, 실제 일반 유저 API 차단과 제한 화면 전환을 확인합니다.

실제 마이그레이션의 PostgreSQL 검증:

```powershell
New-Item -ItemType Directory -Force tools/test-results/sql-check
pnpm --dir tools/test-results/sql-check add @electric-sql/pglite
node --test tools/moderation-sql.test.mjs
```

권한 거절, 랭킹 필터, 밴 만료·해제, 관리자 보호, 잘못된 요청, 작업 기록, 기존 공지 기능과 래퍼 호환성을 검증합니다. 운영 계정과 서버에는 접속하지 않습니다.
