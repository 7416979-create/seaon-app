import { Link, Navigate } from 'react-router-dom';
import { api, IS_DEMO, DEMO_EMPLOYEE_TOKEN, DEMO_ADMIN_TOKEN } from '../data/demoApi';
import { Logo } from '../components/Logo';

// No passwords: people are identified by the personal link the admin sends them.
export default function Login() {
  if (api.currentUser()) return <Navigate to="/home" replace />;

  return (
    <div className="page" style={{ paddingBottom: 32, justifyContent: 'center', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Logo size={72} />
        <div style={{ fontSize: 22, fontWeight: 800 }}>세아온 근태웹</div>
      </div>

      <div className="card stack" style={{ textAlign: 'center' }}>
        <b style={{ fontSize: 18 }}>개인 링크로 접속해 주세요</b>
        <div className="muted">
          관리자에게 받은 <b>나만의 링크</b>(카카오톡·문자)를 누르면 로그인 없이 바로 접속됩니다.
        </div>
        <div className="notice notice-info small">링크를 잃어버렸다면 관리자에게 새 링크를 요청하세요.</div>
      </div>

      {IS_DEMO && (
        <div className="card stack">
          <b>테스트용 바로가기</b>
          <Link className="btn btn-primary btn-block" to={`/e/${DEMO_EMPLOYEE_TOKEN}`}>직원(홍길동) 링크로 접속</Link>
          <Link className="btn btn-outline btn-block" to={`/a/${DEMO_ADMIN_TOKEN}`}>관리자 링크로 접속 (기기당 1회)</Link>
          <div className="muted small">테스트 버전에서만 보이는 버튼입니다.</div>
        </div>
      )}
    </div>
  );
}
