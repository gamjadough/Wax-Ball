# 프로필 카드 · 로컬 미리보기

이번 작업은 디자인 및 동작 확인용 **격리된 로컬 구현**이다. 운영 HTML, 실제 랭킹/접속 상태, Supabase 데이터베이스는 변경하지 않는다. 운영 배포 및 실제 계정 저장 연결은 별도 승인 후 진행한다.

## 체험

- `WAKPPU_LOCAL_PROFILE_PREVIEW=1`, `WAKPPU_LOCAL_PORT=4190`, `WAKPPU_LOCAL_SLEEP_TIME=2026-10-23T03:00:00Z`를 지정하고 `node tools/local-server.mjs`를 실행한다.
- `http://127.0.0.1:4190/?preview=profiles`에서 빠른 시작 계정으로 자동 연결하고 랭킹을 연다. 비밀번호나 실제 계정 로그인은 필요 없다.
- 샘플 5명 중 온라인 3명, 오프라인 2명이다. 닉네임·Gold·환생·칭호·도감 수는 서버 시작 때 생성하며, 순위는 환생→Gold 순이다. 접속 표시는 고정된 시나리오이며 실제 사람의 활동 신호가 아니다.
- 닉네임을 누르면 기본 카드 이미지, 닉네임·칭호, 순위·Gold·환생·도감 수와 온라인 상태가 표시된다. 마지막 접속 시간, 이메일, 로그인 ID, 결제·제재 정보, 업로드 이미지, 대표 왁뿌볼은 표시하지 않는다.
- 인벤토리 → 프로필 카드에서 `왁스의 시작` 1종을 무료로 장착/해제하고 내 프로필을 확인한다. 기본 장착으로 시작하며 외형만 변경한다. 서버 프로세스가 유지되는 동안 새로고침 후에도 상태가 유지되며 프로세스를 재시작하면 샘플이 초기화된다.
- 다른 인벤토리 탭은 유지한다. 프로필을 닫으면 원래 버튼으로 포커스를 돌리고, Escape는 프로필만 닫는다. 계정 변경 시 열려 있던 프로필과 캐시를 닫는다.

## 분리와 검증

`tools/profile-preview-service.mjs`는 명시적인 로컬 서버 플래그에서만 연결한다. 프론트엔드 파일은 플래그와 `preview=profiles`가 함께 있을 때만 HTML에 주입한다. 실제 서버 역할이나 개인정보를 클라이언트가 판단하는 구현이 아니다. 정식 연결 시 공개 필드만 반환하는 프로필 API, 기존 서버 presence 판정, 계정별 카드 저장·권한 검증이 필요하다.

카드 장착은 다른 계정 대상 지정과 미보유 ID를 거절하며 Gold·해금·망치·인벤토리를 바꾸지 않는다. 기존 로컬 서버 인증·Origin·이용 제한 검사를 먼저 거친다. 내보내는 프로필은 명시적인 공개 필드 목록으로 한정한다. 닉네임은 HTML로 삽입하지 않는다.

`node --test tools/profile-preview.test.mjs` 및 `python tools/profile-preview-browser.py`로 5명/3온라인, 무료 장착·새로고침, 공개 필드, 잘못된 요청, 기본 비활성화, Escape·포커스·늦은 응답·다른 탭을 확인한다. 브라우저는 1200×900, 320×640, 844×390, 390×844(모션 줄이기) 터치 에뮬레이션이다. 실물 기기 검증은 아니다.

## 기본 카드 이미지

파일: `wakppuball/images/profile-cards/wax-beginning.png` (1536×1024 PNG). 내장 이미지 생성 도구로 새로 생성한 일러스트이며 외부 이미지나 커스텀 업로드를 사용하지 않는다. 하나의 정적 이미지를 공유하고 문구·숫자는 HTML로 표시한다. 카드가 없는 경우 이미지를 숨겨 기본 배경으로 표시한다. 프로필에 효과음·음악·반짝임 애니메이션을 추가하지 않는다.

최종 생성 프롬프트:

> Use case: stylized-concept. Asset type: original illustration banner for the FREE BASIC player profile card in a Korean browser game about cracking wax balls. Create exactly one polished landscape 3:2 raster illustration, not a UI screenshot or a mockup. Original art only. Subject: a simple tactile butter-yellow wax sphere resting on a low matte charcoal-purple plinth, fine natural wax texture and two subtle shallow hairline cracks, gentle warm light. The wax sphere sits in the RIGHT third, deliberately simple and friendly, no face, no character, no premium/cosmic/legendary motifs. Backdrop: restrained deep plum to charcoal gradient, tiny soft warm wax flakes near the base, delicate diffuse halo, lots of clean dark negative space on LEFT half. Refined soft 3D editorial game illustration, beautiful material and carefully controlled light, restrained detail, not toy plastic, not photoreal portrait. Match a minimalist dark purple game interface with warm pale gold accents. Entire canvas is the artwork, no card borders, no rounded external frame, no UI widgets, no text, no letters, no numbers, no logo, no watermark. Keep high contrast and coherent clean forms at small mobile sizes.
