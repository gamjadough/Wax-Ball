# 영겁 스킨 사운드 — 로컬 미리보기

`/?preview=skin-sounds`에서 5등급의 타격/균열/마지막 균열/파괴음을 비교한다.
선택 후 실제 영겁을 마지막 한 번 타격해 게임 파괴 연출과 함께 확인할 수 있다.
외형은 기존 영겁이며, 이번 작업은 사운드 연결/청음용이다.
스킨 뽑기, 보유·장착 서버 저장, 전용 외형/애니메이션은 아직 구현하지 않았다.
운영 서버와 연결하지 않고 테스트 모드로 저장/보상을 차단한다.

## 무료 음원 출처

- Kenney Impact Sounds: https://kenney.nl/assets/impact-sounds
- Kenney Sci-fi Sounds: https://kenney.nl/assets/sci-fi-sounds
- CC0-1.0, 상업 이용·가공 허용. 원본 라이선스는 sounds/eternity/에 보존.
- 개별 원본 파일명/해시/믹스 비율/길이/피크: sounds/eternity/sources.json

부드러운 타격을 공통 바탕으로 나무 파열, 유리 파편, 불꽃, 종, 저주파 공간음을 조합했다.
일반/희귀의 파괴는 0.85초, 전설/초월은 1.15초 이하. 기본 타격은 0.18초.
최대 피크 0.72 이하, 게임 재생 볼륨 0.65. 크기 대신 레이어로 등급을 구분한다.
모바일 Safari 호환을 위해 OGG 원본을 모노 MP3로 변환했다.

## 재생성

두 원본 ZIP을 impact/, scifi/로 풀고 다음을 실행한다 (numpy 필요).

`python tools/build-skin-sounds.py --source <폴더> --ffmpeg <ffmpeg 실행파일>`
