import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom.js';
import VoteCard from '../components/VoteCard.jsx';
import ParticipantList from '../components/ParticipantList.jsx';

const VOTE_OPTIONS = ['1', '2', '3', '5', '8', '13', '21', '34', '?', '☕'];
const NUMERIC_VOTE_VALUES = [1, 2, 3, 5, 8, 13, 21, 34];

function roundUpToVote(avg) {
  return NUMERIC_VOTE_VALUES.find((v) => v >= avg) ?? NUMERIC_VOTE_VALUES.at(-1);
}

function CopyRoomBadge({ code }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button className="badge badge-btn" onClick={handleCopy} title="Copy room link">
      {copied ? 'Copied!' : `Room: ${code}`}
    </button>
  );
}

function TicketDisplay({ value, fallback = 'Untitled', className = 'ticket-display' }) {
  const text = value || fallback;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  if (parts.length === 1) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          return (
            <a key={i} className="ticket-link" href={part} target="_blank" rel="noopener noreferrer">
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export default function Room() {
  const { code } = useParams();
  const navigate = useNavigate();

  const [name, setName] = useState(() => sessionStorage.getItem('pokerName') || '');
  const [nameInput, setNameInput] = useState('');
  const organizerToken = sessionStorage.getItem(`pokerToken_${code}`) || undefined;
  const nameInputRef = useRef(null);

  const { roomState, connected, error, vote, reveal, setTicket, kick, kicked, reconnect, participantId } = useRoom(code, {
    name,
    organizerToken,
  });

  const [selectedVote, setSelectedVote] = useState(null);
  const [ticketInput, setTicketInput] = useState('');
  const [history, setHistory] = useState([]);
  const recordedRoundsRef = useRef(new Set());

  useEffect(() => {
    if (!name && nameInputRef.current) nameInputRef.current.focus();
  }, [name]);

  useEffect(() => {
    if (kicked) navigate('/');
  }, [kicked, navigate]);

  // Reset selected vote on every new vote round, even if the ticket text is unchanged
  useEffect(() => {
    setSelectedVote(null);
  }, [roomState?.vote_round]);

  // Record each revealed round into session history once
  useEffect(() => {
    const round = roomState?.vote_round;
    if (roomState?.status !== 'revealed' || round == null || recordedRoundsRef.current.has(round)) return;
    recordedRoundsRef.current.add(round);
    setHistory((prev) => [
      { ticket: roomState.ticket || 'Untitled', average: roomState.average, round },
      ...prev,
    ]);
  }, [roomState?.status, roomState?.vote_round]);

  function handleNameSubmit(e) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    sessionStorage.setItem('pokerName', trimmed);
    setName(trimmed);
  }

  const isOrganizer = !!organizerToken;
  const status = roomState?.status ?? 'waiting';
  const votingActive = status === 'voting';
  const revealed = status === 'revealed';

  function handleVote(value) {
    if (!votingActive) return;
    setSelectedVote(value);
    vote(value);
  }

  function handleSetTicket(e) {
    e.preventDefault();
    setTicket(ticketInput.trim());
    setTicketInput('');
  }

  const votedCount = roomState?.participants?.filter((p) => p.has_voted).length ?? 0;
  const totalCount = roomState?.participants?.length ?? 0;

  return (
    <div className="room-page">
      {!name && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Enter your name</h2>
            <p>You need a display name to participate in this room.</p>
            <form onSubmit={handleNameSubmit}>
              <div className="field" style={{ marginTop: 16 }}>
                <label>Your name</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  placeholder="Alice"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={50}
                  autoFocus
                />
              </div>
              <button className="btn btn-primary" type="submit" style={{ marginTop: 8 }}>
                Join Room
              </button>
            </form>
          </div>
        </div>
      )}
      <header className="room-header">
        <div className="room-header-brand">
          <img src="/logo.png" alt="" className="room-header-logo" />
          <span className="room-header-title">Air Poker</span>
        </div>
        <div className="room-header-meta">
          {connected ? (
            <span className="badge">
              <span className="conn-dot connected" />
              Connected
            </span>
          ) : (
            <button className="badge badge-btn" onClick={reconnect} title="Click to reconnect">
              <span className="conn-dot" />
              Disconnected — click to reconnect
            </button>
          )}
          <CopyRoomBadge code={code} />
          {isOrganizer && <span className="badge" style={{ color: 'var(--warning)' }}>Host</span>}
        </div>
      </header>

      {roomState?.room_name && (
        <div className="room-name-banner">{roomState.room_name}</div>
      )}

      <div className="room-body">
        <main className="room-main">
          {/* Ticket bar */}
          {isOrganizer ? (
            <div className="ticket-bar">
              <div className="ticket-bar-label">
                {votingActive || revealed ? 'Current ticket' : 'Start a vote'}
              </div>
              {votingActive || revealed ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <TicketDisplay value={roomState.ticket} />
                  <form onSubmit={handleSetTicket} style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Next ticket…"
                      value={ticketInput}
                      onChange={(e) => setTicketInput(e.target.value)}
                      style={{ width: 180 }}
                    />
                    <button className="btn btn-ghost" type="submit" style={{ width: 'auto' }}>
                      New Ticket
                    </button>
                  </form>
                </div>
              ) : (
                <form className="ticket-bar-row" onSubmit={handleSetTicket}>
                  <input
                    type="text"
                    placeholder="PROJ-123 or ticket description…"
                    value={ticketInput}
                    onChange={(e) => setTicketInput(e.target.value)}
                  />
                  <button className="btn btn-primary" type="submit">
                    Start Vote
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="ticket-bar">
              <div className="ticket-bar-label">Current ticket</div>
              {roomState?.ticket
                ? <TicketDisplay value={roomState.ticket} />
                : <span className="ticket-display">{status === 'waiting' ? 'Waiting for host to start…' : 'Untitled'}</span>
              }
            </div>
          )}

          {/* Voting cards */}
          {(votingActive || revealed) && (
            <div className="vote-section">
              <h3>Your vote {votingActive && `· ${votedCount}/${totalCount} voted`}</h3>
              <div className="vote-cards">
                {VOTE_OPTIONS.map((v) => (
                  <VoteCard
                    key={v}
                    value={v}
                    selected={selectedVote === v}
                    onClick={handleVote}
                    disabled={!votingActive}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {revealed && roomState.votes && (
            <div className="results-section">
              <h3>Results</h3>
              {roomState.average != null && (() => {
                const rounded = roundUpToVote(roomState.average);
                const isExact = rounded === roomState.average;
                return (
                  <>
                    <div className="results-average">{rounded}</div>
                    {isExact
                      ? <div className="results-average-label">average</div>
                      : <>
                          <div className="results-average-label">suggested estimate</div>
                          <div className="results-average-real">actual average: {roomState.average}</div>
                        </>
                    }
                  </>
                );
              })()}
              <div className="results-list">
                {roomState.votes.map((v) => (
                  <div key={v.id} className="result-row">
                    <span className="result-row-name">{v.name}</span>
                    <span className="result-row-value">{v.value}</span>
                  </div>
                ))}
                {roomState.votes.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No votes submitted</p>
                )}
              </div>
            </div>
          )}

          {/* Session history */}
          {history.length > 0 && (
            <div className="history-section">
              <h3>Session History</h3>
              {history.map((entry) => (
                <div key={entry.round} className="history-row">
                  <TicketDisplay value={entry.ticket} className="history-ticket" />
                  <span className="history-estimate">
                    {entry.average != null ? roundUpToVote(entry.average) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Waiting state for non-organizer */}
          {status === 'waiting' && !isOrganizer && (
            <div className="waiting-state">
              <p>Waiting for the host to start a vote…</p>
            </div>
          )}

          {error && <p className="error-msg">{error}</p>}
        </main>

        <aside className="room-sidebar">
          <ParticipantList
            participants={roomState?.participants}
            isOrganizer={isOrganizer}
            currentId={participantId}
            onKick={kick}
          />

          {isOrganizer && votingActive && (
            <div className="organizer-controls">
              <h3>Controls</h3>
              <button className="btn btn-danger" onClick={reveal}>
                Reveal Votes
              </button>
            </div>
          )}

          <div style={{ marginTop: 'auto' }}>
            <button className="btn btn-ghost" onClick={() => navigate('/')}>
              Leave Room
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
