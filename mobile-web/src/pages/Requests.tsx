import PageHeader from '../components/PageHeader'

const types = [
  { label: '연차 신청', desc: '연차 · 반차 사용 신청' },
  { label: '외출 신청', desc: '근무 중 외출 신청' },
  { label: '조퇴 신청', desc: '조기 퇴근 신청' },
]

// Placeholder: request forms and approval status are implemented in the leave/requests step.
export default function Requests() {
  return (
    <>
      <PageHeader title="신청/연차" subtitle="연차 및 외출·조퇴 신청" />
      <ul className="card list">
        {types.map((t) => (
          <li key={t.label}>
            <div>
              <strong>{t.label}</strong>
              <p className="muted">{t.desc}</p>
            </div>
            <span className="badge soon">준비 중</span>
          </li>
        ))}
      </ul>
    </>
  )
}
