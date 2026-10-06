import { formatDuration, hhmm, workedMinutes } from '../lib/time';
import type { AttendanceRecord } from '../data/types';

interface Props {
  kind: 'in' | 'out';
  record: AttendanceRecord;
  onClose: () => void;
}

export function ResultPopup({ kind, record, onClose }: Props) {
  const isIn = kind === 'in';
  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="popup" role="dialog" aria-modal="true" aria-labelledby="popup-title" onClick={(e) => e.stopPropagation()}>
        <div className={`popup-icon ${isIn ? 'in' : 'out'}`} aria-hidden="true">
          {isIn ? '☀️' : '🌙'}
        </div>
        <h2 id="popup-title">{isIn ? '출근되었습니다' : '고생하셨어요'}</h2>
        <p className="popup-sub">{isIn ? '오늘도 좋은 하루 되세요!' : '오늘 하루도 수고 많으셨습니다.'}</p>
        <div className="popup-time">
          <span>{isIn ? '출근 시간' : '퇴근 시간'}</span>
          <b>{hhmm(isIn ? record.checkIn : record.checkOut)}</b>
        </div>
        {!isIn && (
          <div className="popup-time">
            <span>오늘 근무</span>
            <b>{formatDuration(workedMinutes(record.checkIn, record.checkOut))}</b>
          </div>
        )}
        <button className="btn btn-primary btn-block" onClick={onClose} autoFocus>
          확인
        </button>
      </div>
    </div>
  );
}
