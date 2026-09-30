/* ==========================================================================
   balls-data.js  —  왁뿌볼 데이터 (여기만 고치면 밸런스/디자인을 바꿀 수 있어요)
   --------------------------------------------------------------------------
   ■ 새 왁뿌볼 추가하는 법
     1) 아래 WAKPPU_BALLS 배열의 "맨 끝"에 객체 하나를 복사해서 붙여넣기
     2) name / grade / price / clicks / reward 를 원하는 값으로 수정
     3) design.art 를 기존 디자인 이름(plain, strawberry, chocolate, rainbow,
        diamond, planet) 중 하나로 두거나, 직접 만든 이미지를 쓰려면
        image: 'images/내이미지.png' 로 지정 (image 가 있으면 그림이 우선 사용돼요)
     ※ 해금 순서는 배열 순서와 같아요. (앞의 볼을 해금해야 다음 볼을 살 수 있음)
   ========================================================================== */

/* ---------- 효과음 공통 설정 ---------- */
const SOUND_SETTINGS = {
  folder: 'sounds/',          // 음원이 들어있는 폴더
  extension: '.mp3',          // 음원 확장자
  poolSize: 4,                // 같은 소리를 겹쳐 재생할 수 있는 개수
  // true: 음원 파일이 없는 소리는 임시 합성음으로 대신 재생 (테스트용)
  // false: 음원 파일이 없으면 무음
  usePlaceholderSound: true,
};

/* 진행도(0~1)에 따라 어떤 소리 그룹을 쓸지 정하는 경계값
   early(초반) → mid(중반) → late(후반) → final(마지막 클릭) */
const SOUND_PHASE_LIMITS = { early: 0.35, mid: 0.7 };

/* 왁뿌볼별 sound 설정에서 따로 지정하지 않으면 쓰이는 기본값 */
const DEFAULT_SOUNDS = {
  early: ['tap1', 'tap2', 'tap3'],   // 톡 / 툭 / 딱
  mid:   ['tap3', 'crack1'],         // 딱 / 쩍
  late:  ['crack1', 'crack2'],       // 쩍 / 와작
  final: ['break'],                  // 강한 왁스 파괴음
  pitch: 1.0,          // 기본 재생 속도(피치). 1보다 크면 높고 가벼운 소리
  pitchRandom: 0.06,   // 매번 ±6% 랜덤으로 피치 변화
  volume: 0.9,         // 기본 볼륨 (0~1)
  volumeRandom: 0.1,   // 매번 ±10% 랜덤으로 볼륨 변화
};

/* ---------- 왁뿌볼 목록 ---------- */
const WAKPPU_BALLS = [
  /* 1. 일반 · 초록 ---------------------------------------------------------- */
  {
    id: 'green',
    name: '초록 왁뿌볼',
    grade: '일반',
    gradeColor: '#8fd19a',         // 등급 배지 색
    theme: '초록 기본',
    difficulty: '매우 쉬움',
    price: 0,                      // 해금 가격 (0 = 기본 해금)
    clicks: 6,                     // 깨지는 데 필요한 클릭 횟수
    reward: 10,                    // 깨면 얻는 골드
    image: null,                   // 직접 만든 이미지를 쓰려면 'images/green.png' 처럼 지정
    design: {
      art: 'plain',                // 그림 종류 (ball-art.js 의 ART 목록)
      shape: 'circle',             // 모양 (ball-art.js 의 SHAPES 목록)
      colors: { light: '#c9f8b6', mid: '#5fcf63', dark: '#2a8a3f' },
      crack: { dark: '#1c5a2a', light: '#eaffe3' },   // 금 색(어두운 선 / 밝은 선)
      chip: '#55c25c',             // 튀는 왁스 조각 색
    },
    sound: {},                     // 비워두면 DEFAULT_SOUNDS 사용
  },

  /* 2. 희귀 · 딸기 ---------------------------------------------------------- */
  {
    id: 'strawberry',
    name: '딸기 왁뿌볼',
    grade: '희귀 (Rare)',
    gradeColor: '#f08a9b',
    theme: '딸기',
    difficulty: '쉬움',
    price: 100,
    clicks: 9,
    reward: 30,
    image: null,
    design: {
      art: 'strawberry',
      shape: 'strawberry',
      colors: { light: '#ff9c9c', mid: '#e8283f', dark: '#9a1128' },
      seed: '#ffe58c',
      leaf: ['#78d95f', '#2e8c3c'],
      crack: { dark: '#4a0613', light: '#ffd6d6' },
      chip: ['#e8283f', '#ff7a86'],
    },
    sound: { pitch: 1.04 },
  },

  /* 3. 초희귀 · 초콜릿 ------------------------------------------------------ */
  {
    id: 'chocolate',
    name: '초콜릿 왁뿌볼',
    grade: '초희귀',
    gradeColor: '#b98461',
    theme: '초콜릿',
    difficulty: '보통',
    price: 500,
    clicks: 14,
    reward: 100,
    image: null,
    design: {
      art: 'chocolate',
      shape: 'chocolate',
      colors: { light: '#a2683c', mid: '#6b3a1c', dark: '#2f1509' },
      crack: { dark: '#170802', light: '#e6b48a' },
      chip: ['#5a2f17', '#7b4526'],
    },
    sound: { pitch: 0.94 },
  },

  /* 4. 영웅 · 무지개 -------------------------------------------------------- */
  {
    id: 'rainbow',
    name: '무지개 왁뿌볼',
    grade: '영웅',
    gradeColor: '#ffab5e',
    theme: '무지개',
    difficulty: '어려움',
    price: 2500,
    clicks: 22,
    reward: 400,
    image: null,
    design: {
      art: 'rainbow',
      shape: 'circle',
      colors: ['#ff5f6d', '#ffa24a', '#ffe45c', '#5ee07a', '#4aa8ff', '#a56bff'],
      crack: { dark: '#3a2a66', light: '#ffffff' },
      chip: ['#ff5f6d', '#ffe45c', '#5ee07a', '#4aa8ff'],
    },
    sound: { pitch: 1.06 },
  },

  /* 5. 신화 · 다이아 -------------------------------------------------------- */
  {
    id: 'diamond',
    name: '다이아 왁뿌볼',
    grade: '신화',
    gradeColor: '#7fd6ff',
    theme: '다이아몬드',
    difficulty: '매우 어려움',
    price: 15000,
    clicks: 32,
    reward: 2000,
    image: null,
    design: {
      art: 'diamond',
      shape: 'diamond',
      crack: { dark: '#2f5f9e', light: '#ffffff' },
      chip: ['#d9f6ff', '#ffffff', '#8ad4ff'],
    },
    sound: { pitch: 1.22, volume: 0.95 },   // 유리 같은 높은 소리
  },

  /* 6. 전설 · 행성 ---------------------------------------------------------- */
  {
    id: 'planet',
    name: '행성 왁뿌볼',
    grade: '전설',
    gradeColor: '#b79bff',
    theme: '행성',
    difficulty: '매우 어려움',
    price: 100000,
    clicks: 45,
    reward: 10000,
    image: null,
    design: {
      art: 'planet',
      shape: 'circle',
      colors: { light: '#8468ff', mid: '#3a2390', dark: '#0c0632' },
      // 행성 표면 줄무늬 [색, 투명도] — 위에서 아래로
      bands: [['#9a7dff', 0.55], ['#ff8fcf', 0.42], ['#43d3dc', 0.45], ['#ffb862', 0.40], ['#8468ff', 0.50]],
      crack: { dark: '#08031c', light: '#e2d6ff' },
      chip: ['#8468ff', '#43d3dc', '#ffb862'],
    },
    sound: { pitch: 0.8, volume: 1.0 },     // 묵직하고 낮은 소리
  },
];
