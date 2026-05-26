export default function ParticipantList({ participants, isOrganizer, currentId, onKick }) {
  if (!participants?.length) {
    return (
      <div className="participant-list">
        <h3>Participants</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No one here yet</p>
      </div>
    );
  }

  return (
    <div className="participant-list">
      <h3>Participants ({participants.length})</h3>
      {participants.map((p) => (
        <div key={p.id} className="participant-item">
          <span className={`participant-dot${p.has_voted ? ' voted' : ''}`} />
          <span className="participant-name">{p.name}</span>
          {p.is_organizer && <span className="participant-tag">host</span>}
          {isOrganizer && !p.is_organizer && p.id !== currentId && (
            <button
              className="kick-btn"
              onClick={() => onKick(p.id)}
              title={`Remove ${p.name}`}
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
