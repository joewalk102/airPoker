import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api';

export default function Home() {
  const navigate = useNavigate();

  const [createName, setCreateName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    if (!createName.trim()) return setCreateError('Enter your name');
    setCreateError('');
    setCreateLoading(true);
    try {
      const res = await fetch(`${API}/rooms/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName.trim() || 'Planning Poker' }),
      });
      if (!res.ok) throw new Error('Failed to create room');
      const data = await res.json();
      sessionStorage.setItem('pokerName', createName.trim());
      sessionStorage.setItem(`pokerToken_${data.code}`, data.organizer_token);
      navigate(`/room/${data.code}`);
    } catch {
      setCreateError('Could not create room. Is the server running?');
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!joinName.trim()) return setJoinError('Enter your name');
    if (!joinCode.trim()) return setJoinError('Enter a room code');
    const code = joinCode.trim().toUpperCase();
    setJoinError('');
    setJoinLoading(true);
    try {
      const res = await fetch(`${API}/rooms/${code}/`);
      if (res.status === 404) throw new Error('Room not found');
      if (!res.ok) throw new Error('Server error');
      sessionStorage.setItem('pokerName', joinName.trim());
      navigate(`/room/${code}`);
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setJoinLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <img src="/logo.png" alt="Air Poker" className="page-logo" />
        <h1>Air Poker</h1>
        <p>Collaborative planning poker for agile teams</p>
      </div>

      <div className="cards-row">
        <div className="card">
          <h2>Create a Room</h2>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label>Your name</label>
              <input
                type="text"
                placeholder="Alice"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="field">
              <label>Room name (optional)</label>
              <input
                type="text"
                placeholder="Sprint 42 Planning"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                maxLength={100}
              />
            </div>
            {createError && <p className="error-msg">{createError}</p>}
            <button className="btn btn-primary" type="submit" disabled={createLoading}>
              {createLoading ? 'Creating…' : 'Create Room'}
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Join a Room</h2>
          <form onSubmit={handleJoin}>
            <div className="field">
              <label>Your name</label>
              <input
                type="text"
                placeholder="Bob"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="field">
              <label>Room code</label>
              <input
                type="text"
                placeholder="ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
              />
            </div>
            {joinError && <p className="error-msg">{joinError}</p>}
            <button className="btn btn-ghost" type="submit" disabled={joinLoading}>
              {joinLoading ? 'Joining…' : 'Join Room'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
