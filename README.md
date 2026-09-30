# Wax-Ball

Wax-Ball의 간단한 랜딩 페이지와 왁뿌볼 게임입니다.

- `index.html`: 스타일을 포함한 단일 정적 HTML 랜딩 페이지. 별도 프레임워크, 설치 또는 빌드가 필요하지 않습니다.
- `wakppuball/`: 기존 왁뿌볼 게임. 랜딩 페이지의 시작 버튼으로 이동합니다.
- `.nojekyll`: GitHub Pages에서 Jekyll 처리 없이 정적 파일을 게시하도록 합니다.

## GitHub Pages 설정

저장소 관리자 또는 유지관리 권한이 있는 계정으로 다음을 설정하세요.

1. 저장소의 **Settings → Pages**로 이동합니다.
2. **Build and deployment → Source**에서 **Deploy from a branch**를 선택합니다.
3. 브랜치는 **main**, 폴더는 **/ (root)**를 선택합니다.
4. **Save**를 누릅니다.
5. **Actions**에서 Pages 배포가 완료됐는지 확인합니다.

설정 및 배포가 완료되면 다음 주소로 접속할 수 있습니다.

- 랜딩 페이지: https://gamjadough.github.io/Wax-Ball/
- 왁뿌볼 게임: https://gamjadough.github.io/Wax-Ball/wakppuball/

추가 워크플로 또는 `CNAME` 파일은 필요하지 않습니다. `.nojekyll` 파일만 추가해도 Pages 설정이 자동으로 켜지는 것은 아닙니다.

[GitHub Pages 게시 소스 설정 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
