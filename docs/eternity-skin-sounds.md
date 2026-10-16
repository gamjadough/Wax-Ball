# 영겁 스킨 사운드 — 로컬 미리보기

`/?preview=skin-sounds`에서 5등급의 타격/균열/마지막 균열/파괴음을 비교한다.
선택 후 실제 영겁을 마지막 한 번 타격해 게임 파괴 연출과 함께 확인할 수 있다.
인벤토리에 아이템/스킨 버튼을 추가하고 스킨 5종 전체를 테스트용으로 제공한다.
장착/해제는 로컬 전용 키 wakppu-local-eternity-skin-v1에 저장된다.
은빛 무한 문양, 빙결 눈꽃, 불멸 불꽃, 시간 시계, 무한 궤도 문양의 SVG 외형이 적용된다.
균열·파편 색상은 스킨에 맞게 변경되며 파괴 속도·클릭 수·보상은 유지한다.
모든 로컬 테스트는 BGM을 생성/재생하지 않는다. 운영 BGM은 유지한다.
스킨 뽑기, 보유·장착 서버 저장, 전용 파괴 애니메이션은 아직 구현하지 않았다.
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
