초월 등급 기본 볼 10종은 materials/transcendent-asmr/의 균열·버터·꿀·얼음·키캡 동시 혼합음을 사용합니다. 전용 스킨 음원은 유지합니다.
차원 등급(블랙홀·화이트홀)은 materials/honey-wax-butter/의 꿀+왁스+버터 질감 동시 혼합음을 사용합니다.
우주 등급(행성·태양)은 materials/honey-keycap/의 키캡+꿀 질감 혼합음을 사용합니다.
보석 등급(에메랄드·다이아몬드)은 materials/keycap/의 실제 기계식 키보드 단일 키 입력음을 사용합니다.
자연 등급(무지개·물)은 materials/ice-wax/의 얼음 균열+왁스 혼합음을 사용합니다.
간식 등급(초콜릿·도넛)은 materials/honey-wax/의 균열+꿀 짜기 혼합음을 사용합니다. 실제 꿀 왁스를 부순 녹음은 아닙니다.
과일 등급(딸기·사과)은 materials/fruit-wax/의 왁스 버터 스타일 균열+부드러운 눌림 혼합음을 사용합니다. 실제 왁스 버터 녹음은 아닙니다.
일반 볼 공통 왁스 균열음: materials/wax/early.wav, tap.wav, mid.wav, late.wav, final.wav
노란 볼을 제외한 일반 23종 · 노란 볼의 무료 균열 원음을 짧게 편집한 공통 효과음 (라이선스: materials/CREDITS.txt) · 타격→균열→파열→파괴
기존 노란/관리자/푸른 수정/한정/스킨 음원은 유지합니다.
제작과 라이선스: materials/README.md, materials/sources.json

여기에 효과음(mp3)을 넣으세요. 파일 이름은 아래와 똑같이 맞춰야 해요.

  yellow-crack-482875.mp3  사용자 제공 원본 보관 (게임에서는 전체 재생하지 않음)
  원본: dragon-studio-bones-cracking-482875.mp3
  yellow-crack-1.wav ~ yellow-crack-5.wav  클릭마다 순서대로 재생, 새 볼에서 1번으로 복귀
  원본 구간(초): 0 / 0.373 / 0.714 / 1.207 / 1.482 / 1.920
  각 경계에 3ms 페이드 적용, 음원의 순서·속도 유지

  tap1.mp3     톡     (초반)
  tap2.mp3     툭     (초반)
  tap3.mp3     딱     (초반~중반)
  crack1.mp3   쩍     (중반~후반)
  crack2.mp3   와작   (후반)
  break.mp3    강한 왁스 파괴음 (마지막 클릭)

- 파일이 없는 소리는 임시 합성음이 대신 나와요.
  (임시음을 끄려면 js/balls-data.js 의 usePlaceholderSound 를 false 로)
- 소리 종류를 늘리고 싶다면 js/balls-data.js 의 DEFAULT_SOUNDS 목록에
  새 이름(예: tap4)을 추가하고 sounds/tap4.mp3 를 넣으면 돼요.
- 볼마다 다른 소리/피치를 쓰고 싶다면 각 볼의 sound: { ... } 에 지정하세요.
