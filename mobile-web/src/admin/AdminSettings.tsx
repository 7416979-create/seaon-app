import { useEffect, useState } from 'react';
import { adminApi } from '../data/demoApi';
import type { Workplace } from '../data/types';
import { getPosition } from '../lib/geo';
import { useToast } from '../components/Toast';

export default function AdminSettings() {
  const toast = useToast();
  const [wp, setWp] = useState<Workplace>({ name: '본사', lat: 0, lng: 0, radius: 150 });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi.getWorkplace().then((w) => {
      if (w) {
        setWp(w);
        setSaved(true);
      }
    });
  }, []);

  async function here() {
    setBusy(true);
    try {
      const fix = await getPosition();
      setWp((w) => ({ ...w, lat: +fix.lat.toFixed(6), lng: +fix.lng.toFixed(6) }));
      toast(`현재 위치를 불러왔습니다 (정확도 ±${Math.round(fix.accuracy)}m). PC는 위치가 부정확할 수 있으니 지도에서 확인하세요.`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!wp.name.trim()) return toast('사업장 이름을 입력해 주세요.');
    if (!wp.lat || !wp.lng || Math.abs(wp.lat) > 90 || Math.abs(wp.lng) > 180) return toast('위도·경도를 올바르게 입력해 주세요.');
    if (wp.radius < 30 || wp.radius > 2000) return toast('반경은 30m ~ 2,000m 사이로 입력해 주세요.');
    await adminApi.setWorkplace({ ...wp, name: wp.name.trim() });
    setSaved(true);
    toast('사업장 위치를 저장했습니다. 직원 출퇴근에 바로 적용됩니다.');
  }

  const mapUrl = wp.lat && wp.lng ? `https://www.google.com/maps?q=${wp.lat},${wp.lng}` : null;

  return (
    <>
      <div className="admin-head">
        <h1>사업장 설정</h1>
        <span className={`chip ${saved ? 'chip-ok' : 'chip-warn'}`}>{saved ? '설정됨' : '미설정'}</span>
      </div>

      <div className="card stack" style={{ maxWidth: 640 }}>
        <div className="field">
          <label htmlFor="ws-name">사업장 이름</label>
          <input id="ws-name" className="input" value={wp.name} onChange={(e) => setWp({ ...wp, name: e.target.value })} />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="ws-lat">위도</label>
            <input id="ws-lat" className="input" inputMode="decimal" value={wp.lat || ''} onChange={(e) => setWp({ ...wp, lat: Number(e.target.value) })} placeholder="예) 37.566500" />
          </div>
          <div className="field">
            <label htmlFor="ws-lng">경도</label>
            <input id="ws-lng" className="input" inputMode="decimal" value={wp.lng || ''} onChange={(e) => setWp({ ...wp, lng: Number(e.target.value) })} placeholder="예) 126.978000" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="ws-radius">출퇴근 허용 반경 (m)</label>
          <input id="ws-radius" className="input" type="number" min={30} max={2000} value={wp.radius} onChange={(e) => setWp({ ...wp, radius: Number(e.target.value) })} />
          <span className="muted small">실내에서는 휴대폰 위치 오차가 30~100m 생길 수 있어 150m 이상을 권장합니다.</span>
        </div>
        <div className="notice notice-info small">
          위도·경도 찾는 법: 구글 지도에서 회사 건물을 <b>마우스 오른쪽 클릭</b> → 맨 위 숫자(예: 37.5665, 126.9780)를 누르면 복사됩니다. 앞 숫자가 위도, 뒤 숫자가 경도입니다.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={here} disabled={busy}>{busy ? '확인 중…' : '📍 현재 위치 불러오기'}</button>
          {mapUrl && <a className="btn btn-outline" href={mapUrl} target="_blank" rel="noreferrer">지도에서 확인</a>}
          <button className="btn btn-primary" onClick={save}>저장</button>
        </div>
      </div>
    </>
  );
}
