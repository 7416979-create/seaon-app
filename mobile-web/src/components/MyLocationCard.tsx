import { useCallback, useEffect, useMemo, useState } from 'react';
import { MAX_EDIT_METERS, type Workplace } from '../data/types';
import { distanceM, getPosition, locationPermission, type Fix } from '../lib/geo';
import { MapView } from './LazyMap';
import { IN_COLOR, OUT_COLOR } from '../lib/mapColors';

interface Props {
  workplace: Workplace | null;
  allowEdit: boolean;
  manual: { lat: number; lng: number } | null;
  onManual: (p: { lat: number; lng: number } | null) => void;
}

export function MyLocationCard({ workplace, allowEdit, manual, onManual }: Props) {
  const [fix, setFix] = useState<Fix | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  const locate = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      setFix(await getPosition());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  // Only auto-locate when permission was already given, so opening the page never pops a prompt.
  useEffect(() => {
    locationPermission().then((p) => {
      if (p === 'granted') locate();
    });
  }, [locate]);

  function pick(lat: number, lng: number) {
    if (!editing || !fix) return;
    const d = distanceM(fix.lat, fix.lng, lat, lng);
    if (d > MAX_EDIT_METERS) {
      setError(`실제 위치에서 ${MAX_EDIT_METERS}m 이내로만 옮길 수 있습니다.`);
      return;
    }
    setError('');
    onManual({ lat, lng });
  }

  const points = useMemo(() => {
    if (!fix) return [];
    if (manual) {
      return [
        { lat: fix.lat, lng: fix.lng, color: '#9aa4b8', label: 'GPS 위치' },
        { lat: manual.lat, lng: manual.lng, color: OUT_COLOR, label: '내가 지정한 위치' },
      ];
    }
    return [{ lat: fix.lat, lng: fix.lng, color: IN_COLOR, label: '내 위치' }];
  }, [fix, manual]);
  const circle = useMemo(() => (workplace ? { lat: workplace.lat, lng: workplace.lng, radius: workplace.radius } : null), [workplace]);

  return (
    <section className="card stack" aria-label="내 위치">
      <div className="row">
        <h3 style={{ margin: 0 }}>내 위치</h3>
        <button className="btn btn-sm btn-outline" onClick={locate} disabled={busy}>{busy ? '확인 중…' : fix ? '새로고침' : '내 위치 보기'}</button>
      </div>
      {fix ? (
        <MapView points={points} circle={circle} height={220} onPick={allowEdit ? pick : undefined} />
      ) : (
        <div className="muted small">{error || '"내 위치 보기"를 누르면 지도에 현재 위치가 표시됩니다.'}</div>
      )}
      {fix && error && <div className="notice notice-danger small">{error}</div>}
      {fix && allowEdit && (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="muted small">
            {editing ? `지도를 눌러 위치를 옮기세요 (${MAX_EDIT_METERS}m 이내).` : manual ? '수정한 위치로 출퇴근이 기록됩니다.' : 'GPS가 정확하지 않으면 위치를 고칠 수 있어요.'}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {manual && <button className="btn btn-sm btn-outline" onClick={() => { onManual(null); setEditing(false); }}>원래대로</button>}
            <button className={`btn btn-sm ${editing ? 'btn-primary' : 'btn-outline'}`} onClick={() => setEditing((v) => !v)}>
              {editing ? '수정 완료' : '위치 수정'}
            </button>
          </div>
        </div>
      )}
      {fix && workplace && !editing && <div className="muted small">파란 원 안이 회사 범위입니다.</div>}
    </section>
  );
}
