# 잭오랜턴 전용 타격·파괴음

Kenney의 Impact Sounds와 Sci-fi Sounds를 선별·가공한 전용 MP3 5개를 사용한다.
두 팩은 CC0-1.0이며 상업 이용·수정·재배포가 허용된다.

- https://kenney.nl/assets/impact-sounds
- https://kenney.nl/assets/sci-fi-sounds
- 원본 라이선스: `wakppuball/sounds/pumpkin/*-LICENSE.txt`
- 원본 파일·해시·믹스·출력 해시: 같은 폴더의 `sources.json`

초기 타격은 낮은 나무 두드림 2종을 번갈아 쓰고, 균열이 커질수록 파열음과 낮은 공명음을 더한다.
파괴음은 나무·유리 파열과 저음의 짧은 잔향을 조합한다. 비명·긴 배경음은 추가하지 않는다.
일반 타격 0.18~0.39초, 파괴 1.05초, 모노 22.05kHz/64kbps, 출력 피크 최대 0.62.
게임 볼륨 0.68, 기존 효과음 볼륨·음소거·백그라운드 정지를 그대로 따른다.
기존 30% 깜짝 연출과 전용 sting은 변경하지 않는다. 사탕·Gold·타격량·파괴 시간도 변경하지 않는다.

재생성: `python tools/build-pumpkin-sounds.py --source <impact와 scifi 폴더> --ffmpeg <ffmpeg 실행 파일>`
