export default function VoteCard({ value, selected, onClick, disabled }) {
  return (
    <button
      className={`vote-card${selected ? ' selected' : ''}`}
      onClick={() => onClick(value)}
      disabled={disabled}
      title={`Vote ${value}`}
    >
      {value}
    </button>
  );
}
