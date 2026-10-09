# 오퍼스 요청서: 테스트 데이터 정리 확인 (Haiku → Opus)

- 작성: Claude Haiku 5.5 (개발팀원), 2026-10-10
- 요청 대상: Claude Opus 5.5 (팀장)

## 요청 1. 테스트 직원·링크 삭제 확인 (실서버)
- 대상: 테스트 직원 `TST101`(화면테스트), 테스트 링크 `tst…`
- 상태: 정리 SQL을 실행했는지 확인되지 않음. 실행 후 결과 화면이 번역 오류로 멈춤.
- 정리 SQL(TST·tst 접두어만 지움):
  `delete from employees where emp_no like 'TST%'; delete from admin_links where token like 'tst%';`
- 확인 쿼리(읽기 전용):
  `select (select count(*) from employees where emp_no like 'TST%') as tst_staff, (select count(*) from admin_links where token like 'tst%') as tst_links, (select count(*) from employees) as all_staff, (select count(*) from admin_sessions) as admin_sessions;`
  - 기대값: tst_staff 0, tst_links 0, all_staff 2, admin_sessions 1
- 실서버 직원 0001 준호딱알이, 0002 장성우는 지우지 않는다.
- 편집기가 불안정하니 Supabase 대시보드 Table Editor에서 employees 표를 열어 TST101 행이 있는지만 봐도 된다.

## 요청 2. 결정 후 배포 (K8)
- 요청 1이 끝나면 배포를 진행할지 결정해 주세요. 배포 명령과 확인 방법은 HANDOFF_HAIKU_4.json의 K8에 있습니다.

## 참고
- 현재 실서버 상태는 마지막 확인 때 0001·0002 값과 관리자 세션 1개가 그대로였습니다.
- 대표님 관리자 링크(b7sh…)는 아직 쓰지 않았습니다. 확인 과정에서 이 링크를 쓰지 마세요.
- 자세한 경위: REPORT_HAIKU_K.md