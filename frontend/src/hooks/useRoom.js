import { useEffect, useRef, useState, useCallback } from 'react';

const WS_BASE = import.meta.env.VITE_WS_BASE ?? 'ws://localhost:8000/ws/room';

export function useRoom(roomCode, { name, organizerToken } = {}) {
  const [roomState, setRoomState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [kicked, setKicked] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0);
  const wsRef = useRef(null);
  const joinSentRef = useRef(false);
  // Generate once per hook instance — stable identity the client sends to the server at join
  const participantIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!roomCode || !name) return;

    joinSentRef.current = false;
    const ws = new WebSocket(`${WS_BASE}/${roomCode}/`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      if (!joinSentRef.current) {
        joinSentRef.current = true;
        ws.send(JSON.stringify({
          type: 'join',
          name,
          organizer_token: organizerToken || '',
          participant_id: participantIdRef.current,
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'room_state') setRoomState(data);
        if (data.type === 'kicked') setKicked(true);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => setError('Connection error');
    ws.onclose = () => {
      setConnected(false);
      setRoomState(null);
    };

    return () => {
      ws.close();
    };
  }, [roomCode, name, organizerToken, reconnectKey]);

  const send = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const vote = useCallback((value) => send({ type: 'vote', value }), [send]);
  const reveal = useCallback(() => send({ type: 'reveal' }), [send]);
  const setTicket = useCallback((ticket) => send({ type: 'set_ticket', ticket }), [send]);
  const kick = useCallback((participant_id) => send({ type: 'kick', participant_id }), [send]);

  const reconnect = useCallback(() => setReconnectKey((k) => k + 1), []);

  return {
    roomState, connected, error, kicked,
    vote, reveal, setTicket, kick, reconnect,
    participantId: participantIdRef.current,
  };
}
