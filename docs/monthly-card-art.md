# 월간 수상 카드 — 달의 시간

내장 image_gen 도구와 imagegen 스킬로 제작했다. 기존 golden-champion.webp는 금속 질감·광채·완성도 참고로만 사용했고, 구도를 복제하지 않았다. 최종 월간 카드는 초승달이 빛나는 왁스 구체를 감싸고 시간의 고리와 별자리가 둘러싼 천문 장식이다. 기존 전체 랭킹 카드의 큰 왕관·월계관·대리석 받침대 구성과 구분한다. 전체 랭킹 1위 카드는 수정하지 않는다.

프로젝트 저장 파일:

| 파일 | 크기 | 용량 |
|---|---|---|
| wakppuball/images/profile-cards/monthly-gold.webp | 1536×1024 | 380,394 bytes |
| wakppuball/images/profile-cards/monthly-silver.webp | 1536×1024 | 359,924 bytes |
| wakppuball/images/profile-cards/monthly-bronze.webp | 1536×1024 | 349,432 bytes |

생성 그림과 해상도를 유지하고 배포 인코딩만 WebP quality 88로 압축했다. 선택된 카드 한 장만 로드하며 추가 애니메이션을 넣지 않는다. 수상 월·닉네임·칭호·배지는 서버 데이터와 HTML로 표시한다.

## 최종 프롬프트 세트

공통 지시: Use case: stylized-concept. Premium fantasy game monthly competition profile card, 1536x1024 landscape. Reference the existing champion image ONLY for luxurious cinematic rendering quality and metallic richness, NOT for objects or composition. Clearly different art direction: “Lunar Chronometer”. An exquisite metallic crescent moon cradles a glowing cracked wax sphere at the right center, floating in a deep cosmic observatory. Two interlocking astronomical time rings sweep diagonally around them. Constellation lines, minute marks, suspended faceted stars, moon dust and elegant light trails express a month of achievement. Detailed engraved and brushed metal with restrained cinematic bloom. Left 45% is dark quiet space for nickname. Bottom-right faceted seal bears only rank numeral. Border is a thin modern constellation line and four angular jewel corners. No crown, laurel wreath, marble stepped podium, throne, copied royal trophy layout, calendar UI, cartoon/vector, watermark, other text or multiple cards.

색상별 생성 지시:

- Gold / rank 1: radiant warm gold and champagne highlights on midnight indigo, luminous honey-gold wax orb.
- Silver / rank 2: luminous polished silver and frosty moonlight on deep midnight blue, pearlescent silver wax orb.
- Bronze / rank 3: rich burnished copper and rose-gold highlights on dark plum, radiant amber-bronze wax orb.

세 요청은 각각 내장 image_gen 도구를 사용했다. 모바일 세로·가로와 데스크톱 실제 프로필에서 이미지 디코딩 완료 후 그림, 숫자, 닉네임과 칭호·배지의 가독성을 확인한다. 저장 경로와 카드 소유권·보상 조건은 디자인 교체로 바꾸지 않는다.
