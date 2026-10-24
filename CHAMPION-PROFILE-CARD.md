# 황금의 정점 — 1위 기념 플레이어 카드

서버 랭킹 1위를 달성하면 계정에 한 번 지급되는 영구 꾸미기 카드다. 현재 1위도 배포 시 지급한다.
인벤토리 → 프로필 → 카드 선택에서 **황금의 정점**을 선택해 장착한다. 자동 장착하지 않는다.
순위가 내려가도 해제·재장착할 수 있으며 Gold, 환생, 도감, 보유 아이템, 후원 배율, 칭호에는 영향을 주지 않는다.

## 서버 동작

- 기존 랭킹과 동일하게 환생 내림차순 → 정확한 numeric Gold 내림차순 → user_id 오름차순으로 판정한다.
- 숨김, 밴/진행 중 정지, 자동 제외 기한이 지난 미플레이 게스트는 제외한다.
- 랭킹/프로필 조회 및 진행 상황·보상·관련 관리자 작업의 정상 완료 시 현재 1위를 기록한다.
- 자동 환생 안의 중첩 저장에서는 지급을 미루어 중간 상태를 1위로 기록하지 않는다.
- 소유 기록은 별도 비공개 테이블의 계정/카드 복합키로 중복 지급을 막는다. 지급일은 공개 프로필에 노출하지 않는다.
- 기존 점검·야간·정지·세션 검사와 관리자 콘텐츠 접근을 유지한다. 직접 테이블 접근이나 타인 장착 변경은 허용하지 않는다.
- 이전 1위 이력은 추측해 소급하지 않는다. 이 기능 적용 이후 서버에서 확인한 기록을 보관한다.

## 검증

`tools/champion-profile-card.test.mjs`: 실제 마이그레이션을 PGlite에 적용해 현재 1위 지급, 정확한 큰 수/동점 정렬, 영구 보관, 중복 요청, 중첩 저장, 제외 대상, 타 계정 변경 차단, 칭호·진행 상황 보존 및 권한을 확인한다.

`tools/champion-profile-card-browser.py`: 독립 로컬 서버와 가상 계정으로 1200×900, 320×640, 844×390, 390×844 터치 에뮬레이션에서 인벤토리·공개 프로필·재접속·순위 하락·스크롤·44px 버튼을 확인한다. 마지막 화면은 reduced motion을 사용한다. 실물 기기 검증은 아니다.

`tools/champion-profile-production-check.sql`: 운영의 실제 RPC를 사용해 임시 계정만 검증한 뒤 계정·지급·선택을 모두 롤백한다.

## 일러스트

기본 내장 image_gen 도구로 생성했다. 이미지 경로: `wakppuball/images/profile-cards/golden-champion.webp`.
1536×1024, 불투명 WebP 약 283KB로 압축해 모바일에서도 한 장만 로드한다. 동영상·새 효과·소리는 없다.
검은 배경, 황금 왕관, 월계관과 숫자 1을 사용하며 왼쪽은 실시간 닉네임을 위한 공간으로 남겼다.

최종 생성 프롬프트:

> Create a finished premium fantasy collectible player profile card BACKGROUND ART for a Korean wax-ball browser game. Horizontal 3:2 landscape, 1536x1024. A single majestic polished gold wax sphere with subtle cracks stands on a black onyx champion pedestal on the RIGHT third. An ornate solid-gold royal crown floats just above the sphere, framed by a tasteful gold laurel wreath and warm golden rays. A small elegant gold medallion on the pedestal shows the single readable numeral '1'. Rich metallic gold, champagne highlights, deep obsidian black and dark warm brown, luxurious cinematic 3D game item illustration, exquisite metal detail, celebratory but dignified, few tiny sparks. Fine elegant gilded border around all four edges, rounded-corner composition but fill the entire rectangular canvas with opaque background. Keep the LEFT HALF and bottom-left quiet, dark and uncluttered as live nickname UI will overlay there. Keep top-left relatively clear for a small live card title. Crown and orb should be fully inside safe margins, no clipping. Strong visual hierarchy, crisp and attractive even as mobile thumbnail. No other text, no usernames, no logos, no watermark, no interface mockup, no surrounding page. Original game reward artwork, not a photographed physical card.
