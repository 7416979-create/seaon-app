import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { adminApi } from '../data';
import { MAX_EDIT_METERS, type Policy, type Workplace } from '../data/types';
import { DEFAULT_WORK_START } from '../lib/time';
import { getPosition } from '../lib/geo';
import { adminLink, copyText } from '../lib/links';
import { MapView } from '../components/MapView';
import { useToast } from '../components/Toast';

interface SearchHit {
  display_name: string;
  lat: string;
  lon: string;
}

export default function AdminSettings() {
  const toast = useToast();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [wp, setWp] = useState<Workplace>({ name: '본사', lat: 0, lng: 0, radius: 150 });
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [newAdminLink, setNewAdminLink] = useState('');
  const [pwStatus, setPwStatus] = useState<{ set: boolean; id: string } | null>(null);
  const [loginId, setLoginId] = useState('admin');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');

  const [workStartDraft, setWorkStartDraft] = useState(DEFAULT_WORK_START);

  useEffect(() => {
    adminApi.getPolicy().then((p) => {
      setPolicy(p);
      setWorkStartDraft(p.workStart ?? DEFAULT_WORK_START);
      if (p.workplace) setWp(p.workplace);
    });
    adminApi.passwordStatus().then((s) => {
      setPwStatus(s);
      setLoginId(s.id);
    });
  }, []);

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (pw1 !== pw2) return toast('비밀번호 두 칸이 서로 다릅니다.');
    try {
      await adminApi.setPassword(loginId.trim(), pw1);
      setPwStatus({ set: true, id: loginId.trim().toLowerCase() });
      setPw1('');
      setPw2('');
      toast('비상 로그인 비밀번호를 저장했습니다.');
    } catch (err) {
      toast((err as Error).message);
    }
  }

  const hasSpot = !!wp.lat && !!wp.lng;
  const circle = useMemo(() => (hasSpot ? { lat: wp.lat, lng: wp.lng, radius: wp.radius } : null), [hasSpot, wp.lat, wp.lng, wp.radius]);

  async function savePolicy(next: Policy, msg: string) {
    await adminApi.setPolicy(next);
    setPolicy(next);
    toast(msg);
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=kr&accept-language=ko&q=${encodeURIComponent(query.trim())}`;
      const res = await fetch(url);
      const list = (await res.json()) as SearchHit[];
      setHits(list);
      if (!list.length) toast('검색 결과가 없습니다. 도로명 주소나 건물 이름으로 다시 검색해 보세요.');
    } catch {
      toast('주소 검색에 실패했습니다. 지도에서 직접 클릭해 지정해 주세요.');
    } finally {
      setSearching(false);
    }
  }

  async function here() {
    try {
      const fix = await getPosition();
      setWp((w) => ({ ...w, lat: +fix.lat.toFixed(6), lng: +fix.lng.toFixed(6) }));
      toast(`현재 위치로 지정했습니다 (오차 ±${Math.round(fix.accuracy)}m). PC는 오차가 클 수 있어요.`);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function saveWorkplace() {
    if (!policy) return;
    if (!wp.name.trim()) return toast('회사(사업장) 이름을 입력해 주세요.');
    if (!hasSpot) return toast('지도를 클릭하거나 주소를 검색해 회사 위치를 지정해 주세요.');
    if (wp.radius < 30 || wp.radius > 2000) return toast('반경은 30m ~ 2,000m 사이로 입력해 주세요.');
    await savePolicy({ ...policy, workplace: { ...wp, name: wp.name.trim() } }, '회사 위치를 저장했습니다. 직원 출퇴근에 바로 적용됩니다.');
  }

  async function issueLink() {
    const token = await adminApi.issueAdminLink();
    const url = adminLink(token);
    setNewAdminLink(url);
    toast((await copyText(url)) ? '새 관리자 링크를 복사했습니다.' : '새 관리자 링크를 만들었습니다.');
  }

  if (!policy) return <div className="muted">불러오는 중…</div>;

  return (
    <>
      <div className="admin-head"><h1>설정</h1></div>

      <div className="card" style={{ maxWidth: 820 }}>
        <h3>근무 시간</h3>
        <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
          <div className="field">
            <label htmlFor="work-start">출근 기준 시각</label>
            <input id="work-start" className="input" type="time" value={workStartDraft} onChange={(e) => setWorkStartDraft(e.target.value)} />
          </div>
          <button className="btn btn-outline" onClick={() => savePolicy({ ...policy, workStart: workStartDraft }, '출근 기준 시각을 저장했습니다.')} disabled={!workStartDraft}>저장</button>
        </div>
        <div className="muted small">이 시각보다 늦게 출근하면 지각으로 집계합니다.</div>
      </div>

      <div className="card" style={{ maxWidth: 820 }}>
        <h3>위치 사용</h3>
        <div className="switch-row">
          <div>
            <b>출퇴근 위치 기록</b>
            <div className="muted small">출근·퇴근한 위치를 저장해 관리자 화면 지도에 표시합니다. 직원 화면에는 보이지 않습니다.</div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={policy.locationTracking}
              onChange={(e) => savePolicy({ ...policy, locationTracking: e.target.checked }, e.target.checked ? '위치 기록을 켰습니다.' : '위치 기록을 껐습니다.')} />
            <span />
          </label>
        </div>
        <div className="switch-row">
          <div>
            <b>회사 근처에서만 출퇴근 허용</b>
            <div className="muted small">아래 회사 위치 반경 밖에서는 출퇴근 버튼이 거부됩니다. (회사 위치 저장 필요)</div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={policy.geofence} disabled={!policy.workplace}
              onChange={(e) => savePolicy({ ...policy, geofence: e.target.checked }, e.target.checked ? '회사 근처에서만 출퇴근하도록 했습니다.' : '위치 제한을 껐습니다.')} />
            <span />
          </label>
        </div>
        <div className="switch-row">
          <div>
            <b>직원에게 내 위치 지도 보여주기</b>
            <div className="muted small">직원 홈 화면에 본인의 현재 위치와 회사 범위를 지도로 보여줍니다.</div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={policy.showEmployeeMap}
              onChange={(e) => savePolicy({ ...policy, showEmployeeMap: e.target.checked }, e.target.checked ? '직원 화면에 지도를 표시합니다.' : '직원 화면에서 지도를 숨겼습니다.')} />
            <span />
          </label>
        </div>
        <div className="switch-row">
          <div>
            <b>직원 위치 수정 허용</b>
            <div className="muted small">
              GPS가 부정확할 때 직원이 지도에서 위치를 옮길 수 있습니다. 실제 위치에서 {MAX_EDIT_METERS}m 이내만 가능하며, 수정한 기록은 "직원 수정"으로 표시됩니다. (위 지도 표시가 켜져 있어야 작동)
            </div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={policy.allowLocationEdit}
              onChange={(e) => savePolicy({ ...policy, allowLocationEdit: e.target.checked }, e.target.checked ? '직원 위치 수정을 허용했습니다.' : '직원 위치 수정을 막았습니다.')} />
            <span />
          </label>
        </div>
        {!policy.locationTracking && !policy.geofence && (
          <div className="notice notice-info small" style={{ marginTop: 8 }}>두 기능이 모두 꺼져 있으면 직원 휴대폰에 위치 권한을 묻지 않습니다.</div>
        )}
      </div>

      <div className="card stack" style={{ maxWidth: 820 }}>
        <div className="row">
          <h3 style={{ margin: 0 }}>회사 위치</h3>
          <span className={`chip ${policy.workplace ? 'chip-ok' : 'chip-warn'}`}>{policy.workplace ? '저장됨' : '미설정'}</span>
        </div>

        <form className="toolbar" onSubmit={search}>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="addr-q">주소 또는 건물 이름 검색</label>
            <input id="addr-q" className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="예) 서울특별시청, 세종대로 110" />
          </div>
          <button className="btn btn-outline" disabled={searching}>{searching ? '검색 중…' : '검색'}</button>
          <button type="button" className="btn btn-outline" onClick={here}>📍 현재 위치</button>
        </form>

        {hits.length > 0 && (
          <div className="list">
            {hits.map((h) => (
              <button key={h.lat + h.lon} className="list-item" style={{ background: 'none', border: 0, textAlign: 'left', cursor: 'pointer' }}
                onClick={() => { setWp((w) => ({ ...w, lat: +(+h.lat).toFixed(6), lng: +(+h.lon).toFixed(6) })); setHits([]); }}>
                <span className="small">{h.display_name}</span>
                <span className="chip chip-primary">선택</span>
              </button>
            ))}
          </div>
        )}

        <MapView circle={circle} height={360} onPick={(lat, lng) => setWp((w) => ({ ...w, lat: +lat.toFixed(6), lng: +lng.toFixed(6) }))} />
        <div className="muted small">지도를 클릭하면 그 자리가 회사 위치로 지정됩니다. 파란 원이 출퇴근 허용 범위입니다.</div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="ws-name">회사(사업장) 이름</label>
            <input id="ws-name" className="input" value={wp.name} onChange={(e) => setWp({ ...wp, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ws-radius">허용 반경 (m)</label>
            <input id="ws-radius" className="input" type="number" min={30} max={2000} step={10} value={wp.radius} onChange={(e) => setWp({ ...wp, radius: Number(e.target.value) })} />
          </div>
        </div>
        <div className="muted small">실내에서는 휴대폰 위치 오차가 30~100m 생길 수 있어 150m 이상을 권장합니다.</div>
        <div><button className="btn btn-primary" onClick={saveWorkplace}>회사 위치 저장</button></div>
      </div>

      <div className="card stack" style={{ maxWidth: 820 }}>
        <h3 style={{ margin: 0 }}>관리자 링크</h3>
        <div className="muted small">다른 PC·휴대폰에서도 관리자 화면을 쓰려면 새 관리자 링크를 만들어 그 기기에서 여세요. 관리자 링크는 <b>한 번만</b> 쓸 수 있습니다.</div>
        <div><button className="btn btn-outline" onClick={issueLink}>새 관리자 링크 만들기</button></div>
        {newAdminLink && (
          <div className="notice notice-info small" style={{ wordBreak: 'break-all' }}>{newAdminLink}</div>
        )}
      </div>

      <form className="card stack" style={{ maxWidth: 820 }} onSubmit={savePassword}>
        <div className="row">
          <h3 style={{ margin: 0 }}>비상 로그인</h3>
          {pwStatus && <span className={`chip ${pwStatus.set ? 'chip-ok' : 'chip-warn'}`}>{pwStatus.set ? '설정됨' : '미설정'}</span>}
        </div>
        <div className="muted small">관리자 링크를 모두 잃어버렸을 때 <b>/admin/login</b> 화면에서 쓰는 아이디와 비밀번호입니다. 비밀번호는 8자 이상으로 정해 주세요.</div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="adm-id">아이디</label>
            <input id="adm-id" className="input" autoComplete="username" value={loginId} onChange={(e) => setLoginId(e.target.value)} />
          </div>
          <div />
          <div className="field">
            <label htmlFor="adm-pw1">새 비밀번호</label>
            <input id="adm-pw1" className="input" type="password" autoComplete="new-password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="adm-pw2">새 비밀번호 확인</label>
            <input id="adm-pw2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
        </div>
        <div><button className="btn btn-outline" disabled={pw1.length < 8}>비밀번호 저장</button></div>
      </form>
    </>
  );
}
