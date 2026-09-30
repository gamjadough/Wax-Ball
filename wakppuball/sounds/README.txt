여기에 효과음(mp3)을 넣으세요. 파일 이름은 아래와 똑같이 맞춰야 해요.

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
