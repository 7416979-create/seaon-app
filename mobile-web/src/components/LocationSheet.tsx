import { browserKind, deniedHelp } from '../lib/geo';

interface Props {
  mode: 'explain' | 'denied';
  onConfirm?: () => void;
  onClose: () => void;
}

export function LocationSheet({ mode, onConfirm, onClose }: Props) {
  const kind = browserKind();
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="loc-title" onClick={(e) => e.stopPropagation()}>
        {mode === 'explain' ? (
          <>
            <h2 id="loc-title">위치 확인이 필요해요</h2>
            <p className="muted" style={{ margin: 0 }}>
              출퇴근은 <b>사업장 반경 안</b>에서만 등록됩니다. 다음 화면에서 브라우저가 위치 권한을 물으면 <b>"허용"</b>을 눌러 주세요.
            </p>
            <div className="notice notice-info small">위치는 출근·퇴근 버튼을 누를 때 한 번만 확인하며, 그 외에는 수집하지 않습니다.</div>
            {(kind === 'kakao' || kind === 'naver') && (
              <div className="notice notice-warn small">
                지금 앱 내부 브라우저로 열려 있어요. 위치 확인이 안 되면 메뉴에서 <b>"다른 브라우저로 열기"</b>를 눌러 주세요.
              </div>
            )}
            <button className="btn btn-primary btn-block" onClick={onConfirm}>
              위치 확인하기
            </button>
            <button className="btn btn-outline btn-block" onClick={onClose}>
              취소
            </button>
          </>
        ) : (
          <>
            <h2 id="loc-title">위치 권한이 꺼져 있어요</h2>
            <p className="muted" style={{ margin: 0 }}>
              출퇴근을 등록하려면 위치 권한이 필요합니다. 아래 순서대로 권한을 켠 뒤 다시 시도해 주세요.
            </p>
            <div className="notice notice-warn">
              <ol>
                {deniedHelp(kind).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
            <button className="btn btn-primary btn-block" onClick={() => window.location.reload()}>
              새로고침
            </button>
            <button className="btn btn-outline btn-block" onClick={onClose}>
              닫기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
