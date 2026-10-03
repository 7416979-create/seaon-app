# 세아온 근태관리 모바일 웹 (PWA)

- 접속 주소: https://7416979-create.github.io/seaon-app/
- 기술: React + TypeScript + Vite, vite-plugin-pwa (홈 화면 추가, 서비스워커 푸시 구조)

## 현재 상태 (테스트 버전)
- 데이터는 각 기기 브라우저(localStorage)에만 저장됩니다. 서버 연동 전입니다.
- 데모 계정: 사원번호 `1001` / 비밀번호 `1234` (`src/data/demoApi.ts`)
- 사업장 위치는 마이페이지에서 직접 지정합니다.

## 명령
```bash
npm install
npm run dev       # 개발 서버
npm run build     # dist/ 생성
npm run icons     # public/icons 아이콘 재생성
```

## 배포
`npm run build` 후 `dist/` 내용을 `gh-pages` 브랜치에 올리면 GitHub Pages로 배포됩니다.

## 구조
- `src/data/types.ts` — 화면이 사용하는 API 인터페이스. 서버 연동 시 `demoApi` 대신 서버 구현으로 교체
- `src/lib/geo.ts` — 위치 권한·거리 계산·브라우저별 권한 안내
- `src/lib/push.ts`, `src/sw.ts` — 알림 권한, 푸시 수신 처리 (VAPID 키·푸시 서버는 미연결)
