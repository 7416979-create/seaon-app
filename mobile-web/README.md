# 세아온 근태관리 모바일 웹 (PWA)

React + Vite + TypeScript 기반 모바일 웹. Android APK를 대체합니다.

- 테스트 URL: https://7416979-create.github.io/seaon-app/
- 지원 브라우저: Chrome, Safari, Samsung Internet (iOS / Android)

## 로컬 실행

```bash
cd mobile-web
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ 생성
npm run lint
```

환경 변수는 `.env.example` 참고 (`.env.local`에 작성, 커밋 금지). `VITE_API_BASE_URL`이 비어 있으면 테스트 모드(로컬 목업 데이터)로 동작합니다.

## 구조

| 경로 | 내용 |
|---|---|
| `src/pages/` | Splash, Login, Home, Records(근태기록), Requests(신청/연차), MyPage |
| `src/components/TabLayout.tsx` | 하단 탭 네비게이션 |
| `src/auth/` | 로그인 세션 (목업 / API 전환 지점: `authService.ts`) |
| `src/services/attendance.ts` | 출퇴근 기록 (현재 localStorage 목업) |
| `src/services/geolocation.ts` | Geolocation API, 사업장 반경 계산 (GPS 출퇴근 단계에서 연결) |
| `src/services/push.ts`, `src/sw.ts` | 알림 권한, Web Push 구독, 서비스워커 push 핸들러 |
| `src/services/install.ts` | 홈 화면에 추가 안내 |

## 배포

`.github/workflows/mobile-web.yml`이 빌드 후 `gh-pages` 브랜치에 배포합니다.
최초 1회: 저장소 Settings → Pages → Source: "Deploy from a branch", Branch: `gh-pages` / `(root)`.
