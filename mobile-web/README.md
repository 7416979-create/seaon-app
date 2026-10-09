# 세아온 근태관리 모바일 웹 (PWA)

- 접속 주소: https://7416979-create.github.io/seaon-app/
- 기술: React + TypeScript + Vite, vite-plugin-pwa (홈 화면 추가, 서비스워커 푸시 구조)
- 백엔드: Supabase (Postgres 함수 + RLS)

## 현재 상태
- `.env`에 Supabase 주소와 공개 키가 있으면 **서버 모드**로 동작합니다. 모든 데이터는 Supabase에 저장됩니다.
- `.env`가 없으면 **데모 모드**로 동작합니다. 데이터는 각 기기 브라우저(localStorage)에만 저장되고, 샘플 직원 5명이 들어 있습니다.
- 사업장 위치는 관리자 화면 → 설정 · 회사 위치에서 지정합니다.
- 출근 기준 시각(지각 기준)은 관리자 화면 → 설정 · 근무 시간에서 바꿉니다. 기본값은 09:00입니다.
- 직원 여러 명은 관리자 화면 → 직원 관리 → **여러 명 등록**에서 엑셀 명단을 붙여 넣어 한 번에 등록합니다.
- **전체 링크 복사**는 재직 중인 모든 직원의 개인 링크를 한 번에 복사합니다.
- **출퇴근 정정:** 직원이 퇴근 누락이나 잘못된 시각을 신청하면 관리자가 신청 승인 화면에서 승인하거나 반려합니다. 승인하면 기록에 "정정됨" 표시가 붙습니다.
- **공휴일:** 설정 화면에서 공휴일을 입력하면 근무일 계산에서 빠집니다. 실제 공휴일은 관리자가 직접 입력합니다.
- **월별 근태 요약:** 근태 기록 화면에서 근무일수, 출근일수, 지각, 휴가, 결근을 월별로 보고 CSV로 내려받을 수 있습니다.
- **큰 글씨 보기:** 마이페이지에서 켜면 직원 화면의 글자와 버튼이 커집니다. 이 휴대폰에만 저장됩니다.
- **데이터 백업:** 설정 화면에서 전체 데이터를 JSON 파일 하나로 내려받습니다. 개인 링크는 포함되지 않습니다.
- **6차 변경:** 큰 글씨 보기가 하단 탭·통계 칸·신청 화면 버튼까지 적용됩니다. 정정 신청 화면에 그날의 현재 기록이 표시됩니다. 지도는 필요할 때 불러와 첫 화면이 가벼워졌습니다.

## 서버 연결 방법
- 새로 설치할 때: `supabase/schema.sql`을 SQL Editor에서 실행한 뒤, `supabase/migrations/` 폴더의 파일을 **날짜(파일 이름) 순서대로** 모두 실행합니다.
- 이미 운영 중일 때: 새로 추가된 마이그레이션 파일만 실행합니다. 같은 파일은 여러 번 실행해도 안전합니다.

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
npm run dev:demo  # 데모 모드 개발 서버 (.env를 읽지 않음, 화면 확인용)
npm run check:summary  # 월별 요약 계산 규칙 점검 (lib/summary.ts)
npm run icons     # public/icons 아이콘 재생성
```

## 배포
`scripts/deploy.ps1`이 빌드부터 `gh-pages` 게시까지 한 번에 합니다.

```
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -CoAuthor "이름 <메일>"
```

스크립트가 하는 일:
1. `.env`에 서버 값이 있는지 확인 (값은 출력하지 않음)
2. 커밋되지 않은 변경이 있으면 중단
3. 서버 모드로 빌드하고, 번들에 서버 주소가 들어갔는지 확인
4. `gh-pages`를 새로 받아 웹 빌드 파일만 교체 (`.nojekyll` 포함)
5. 커밋하고 푸시한 뒤 임시 작업 폴더를 정리

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
