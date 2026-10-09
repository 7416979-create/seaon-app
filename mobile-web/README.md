# 세아온 근태관리 모바일 웹 (PWA)

- 접속 주소: https://7416979-create.github.io/seaon-app/
- 기술: React + TypeScript + Vite, vite-plugin-pwa (홈 화면 추가, 서비스워커 푸시 구조)
- 백엔드: Supabase (Postgres 함수 + RLS)

## 현재 상태
- `.env`에 Supabase 주소와 공개 키가 있으면 **서버 모드**로 동작합니다. 모든 데이터는 Supabase에 저장됩니다.
- `.env`가 없으면 **데모 모드**로 동작합니다. 데이터는 각 기기 브라우저(localStorage)에만 저장되고, 샘플 직원 5명이 들어 있습니다.
- 사업장 위치는 관리자 화면 → 설정 · 회사 위치에서 지정합니다.

## 서버 연결 방법
1. Supabase 프로젝트를 만듭니다. (리전: Northeast Asia (Seoul) 권장)
2. Supabase 대시보드 → **SQL Editor** → `supabase/schema.sql` 전체를 붙여 넣고 **Run**합니다.
   - 결과 표에 나온 **관리자 링크**를 복사해 둡니다. 1회용입니다.
   - 같은 파일을 다시 실행해도 안전합니다. 함수는 새로 덮어쓰고, 테이블은 없을 때만 만듭니다.
3. `.env.example`을 `.env`로 복사하고 값을 채웁니다.
   ```
   VITE_SUPABASE_URL=https://<프로젝트>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon 또는 publishable 키>
   ```
   - 공개 키만 넣습니다. `service_role` / `secret` 키는 넣지 않습니다.
   - `.env`는 git에 올라가지 않습니다 (`.gitignore`에 등록됨).
4. 복사해 둔 관리자 링크를 관리자 PC에서 엽니다 (`/?go=/a/<토큰>`).
5. 설정 → **비상 로그인**에서 아이디와 8자 이상 비밀번호를 정합니다. 관리자 링크를 모두 잃었을 때 `/#/admin/login`에서 쓰는 로그인입니다.
6. 직원 관리에서 직원을 등록하고, 표시된 **개인 링크**를 직원에게 보냅니다.

## 명령
```bash
npm install
npm run dev       # 개발 서버
npm run build     # dist/ 생성 (.env가 있으면 서버 모드로 빌드)
npm run icons     # public/icons 아이콘 재생성
```

## 배포
`npm run build` 후 `dist/` 내용을 `gh-pages` 브랜치에 올리면 GitHub Pages로 배포됩니다.
배포 전에 Supabase에 남은 테스트 데이터는 지워야 합니다.

## 구조
- `src/data/types.ts` — 화면이 사용하는 API 인터페이스
- `src/data/index.ts` — `.env` 값에 따라 서버 구현 또는 데모 구현을 선택
- `src/data/supabaseApi.ts` — 서버 구현 (Supabase RPC 호출)
- `src/data/demoApi.ts` — 데모 구현 (localStorage)
- `supabase/schema.sql` — 테이블, 보안 규칙, RPC 함수, 첫 관리자 링크
- `supabase/api-helpers.ps1` — PowerShell에서 RPC 함수를 직접 호출해 보는 도구
- `src/lib/geo.ts` — 위치 권한·거리 계산·브라우저별 권한 안내
- `src/lib/push.ts`, `src/sw.ts` — 알림 권한, 푸시 수신 처리 (VAPID 키·푸시 서버는 미연결)
