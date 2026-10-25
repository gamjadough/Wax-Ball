# 후원자 전용 프로필 카드

응원팩에는 은은한 호박빛 **따뜻한 응원**, 프리미엄 후원팩에는 화려한 보석·성좌 디자인의 **찬란한 성좌**를 추가했다. 프리미엄은 후원자 카드도 포함한다.
기존 구매자는 추가 주문·입금 없이 인벤토리 → 프로필 → 카드 선택에서 장착할 수 있다. 기존 장착 카드와 칭호를 자동 변경하지 않는다.

## 권한과 결제

- 기존의 실제 `wakppu_purchase_entitlements`를 조회하므로 과거·신규 구매 모두 즉시 적용된다. 별도 중복 구매나 지급 기록을 만들지 않는다.
- 응원팩 1,100원, 프리미엄 10,000원, 기존 응원팩 보유자의 업그레이드 8,900원을 유지한다.
- 골드 보너스는 기존 +5% / +30%를 유지한다. 카드를 장착해도 추가 보너스·능력치·소모품 효과는 없다.
- 환생으로 카드를 잃지 않는다. 환불/관리자 지급 회수로 보유 권한이 사라지면 해당 카드를 회수하고 잘못 장착된 선택만 기본 카드로 정리한다.
- 프리미엄 회수 후 응원팩 권한이 남아 있다면 후원자 카드는 계속 사용 가능하다. 1위 기념 카드의 영구 보관은 그대로 유지한다.
- 서버의 기존 점검·야간·정지·계정 검사를 유지하고, 타 계정 장착 변경을 거부한다. 비공개 소유 확인 함수는 클라이언트가 직접 호출할 수 없다.
- 비익명 관리자는 기존 공유 콘텐츠 접근 검사를 통해 두 카드를 바로 사용할 수 있다. 익명/권한 회수된 관리자에게는 우회 권한이 없다.
- 상품 설명과 보유 혜택에 카드 이름·장착 위치·기존 구매자 적용을 안내한다.

## 검증

`tools/supporter-profile-cards.test.mjs`: 실제 결제/프로필 마이그레이션을 적용한 PGlite에서 기존 구매, 실제 주문 승인, 차액 업그레이드, 환불·관리자 지급 회수, 타 계정 차단, 관리자/익명/권한 회수, 칭호·진행 상태·보너스 보존을 검증한다.

`tools/supporter-profile-cards-browser.py`: 운영과 연결되지 않는 가짜 은행 + 실제 SQL을 사용한다. PC 1200×900, 터치 에뮬레이션 320×640 / 844×390 / 390×844에서 승인·장착·공개 프로필·새로고침·환불, 가로 넘침과 44px 버튼을 확인한다. 마지막 화면은 reduced motion을 사용한다. 실물 휴대폰 테스트는 아니다.

`tools/supporter-profile-production-check.sql`: 운영의 실제 RPC를 임시 계정으로 확인한 뒤 계정·주문·장착 등 테스트 변경을 모두 롤백한다. 배포 후 기존 구매자의 소유 확인 함수도 집계로 검증한다.

## 일러스트 제작

내장 image_gen 도구로 각각 생성했다. 원본을 새로 생성했으며 기존 카드 이미지를 덮어쓰지 않았다. 모바일 전송을 위해 1536×1024 WebP로 압축했다.

- `wakppuball/images/profile-cards/supporter-glow.webp` — 136,298 bytes.
- `wakppuball/images/profile-cards/premium-celestial.webp` — 509,664 bytes.

선택한 카드 한 장만 로드하며 새로운 반복 애니메이션이나 소리를 추가하지 않는다.

최종 후원자 카드 생성 프롬프트:

> Finished collectible player profile card background ART for Korean wax-ball browser game. Landscape 3:2, 1536x1024, opaque rectangular background. Cinematic high-quality 3D fantasy game reward illustration. One polished wax sphere on a pedestal on the RIGHT THIRD, the LEFT HALF dark and uncluttered for live player nickname, top-left clear for small card name. Keep ornaments within safe margins. Fine elegant full-frame decorative border. No text, no letters, no numbers, no watermark, no logos, no interface mockup. Regular supporter edition, tasteful gentle warm light rather than a champion trophy. A honey-amber wax sphere with a few delicate cracks, soft peach-gold internal glow, on a small brushed bronze pedestal. A small four-point amber crystal star floating above the orb, a graceful silver-gold arc and a few restrained glowing motes. Dark plum and warm charcoal backdrop, amber, champagne and bronze palette, quiet elegance, subtle sheen, inviting and grateful mood. Slim understated border with tiny star corner details. No crown, no laurel wreath, no massive light explosion. Premium enough to feel special, with restrained luminosity.

최종 프리미엄 카드 생성 프롬프트:

> Finished collectible player profile card background ART for Korean wax-ball browser game. Landscape 3:2, 1536x1024, opaque rectangular background. Cinematic high-quality 3D fantasy game reward illustration. One polished wax sphere on a pedestal on the RIGHT THIRD, the LEFT HALF dark and uncluttered for live player nickname, top-left clear for small card name. Keep ornaments within safe margins. Fine elegant full-frame decorative border. No text, no letters, no numbers, no watermark, no logos, no interface mockup. Top-tier PREMIUM supporter edition, extraordinarily magnificent, comparable in prestige and visual richness to a first-place gold champion card, with its own distinct celestial identity. A luminous faceted amethyst-and-opal wax sphere with fine glowing seams floats above an elaborate black onyx and platinum pedestal. A brilliant large diamond star suspended above it, sweeping jeweled platinum-gold celestial wings and concentric orbital halos surround the sphere, rainbow prism glints, violet-blue nebula, rich champagne-gold filigree, lavish gemstone frame, luminous white-gold shafts of light, exquisite material detail. Opulent grand cosmic palace atmosphere, spectacular but readable. Dominant royal violet, platinum, iridescent crystal and refined gold. Sparse elegant distant stars on the left; keep bottom-left dark for readable nickname. No royal crown or rank numeral, no laurel wreath, so it remains distinct from the first-place card.
