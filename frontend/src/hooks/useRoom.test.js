import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRoom } from '../hooks/useRoom';

// WebSocket constants
const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSING = 2;
const WS_CLOSED = 3;

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WS_CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    this.sent = [];
  }

  send(data) {
    this.sent.push(data);
  }

  close() {
    this.readyState = WS_CLOSED;
    if (this.onclose) {
      this.onclose();
    }
  }

  // Simulate server messages
  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  simulateOpen() {
    this.readyState = WS_OPEN;
    if (this.onopen) {
      this.onopen();
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror();
    }
  }
}

let mockWsInstance;
let webSocketCallCount = 0;

// Create a wrapper class that delegates to MockWebSocket
class GlobalMockWebSocket extends MockWebSocket {
  constructor(url) {
    super(url);
    mockWsInstance = this;
    webSocketCallCount++;
  }
}

// Add WebSocket constants to the class
GlobalMockWebSocket.CONNECTING = WS_CONNECTING;
GlobalMockWebSocket.OPEN = WS_OPEN;
GlobalMockWebSocket.CLOSING = WS_CLOSING;
GlobalMockWebSocket.CLOSED = WS_CLOSED;

// Use the class directly without vi.spyOn
global.WebSocket = GlobalMockWebSocket;

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'mock-uuid-1234',
  },
  writable: true,
});

describe('useRoom Hook', () => {
  beforeEach(() => {
    mockWsInstance = null;
    webSocketCallCount = 0;
    vi.clearAllMocks();
  });

  it('should not connect without roomCode and name', () => {
    const { result } = renderHook(() => useRoom(null, { name: null }));

    expect(result.current.connected).toBe(false);
    expect(result.current.roomState).toBe(null);
    expect(webSocketCallCount).toBe(0);
  });

  it('should connect and send join message', async () => {
    const { result } = renderHook(() =>
      useRoom('ABC123', { name: 'Alice', organizerToken: undefined })
    );

    expect(result.current.connected).toBe(false);

    act(() => {
      mockWsInstance.simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    expect(mockWsInstance.sent.length).toBeGreaterThan(0);
    const joinMessage = JSON.parse(mockWsInstance.sent[0]);
    expect(joinMessage.type).toBe('join');
    expect(joinMessage.name).toBe('Alice');
    expect(joinMessage.participant_id).toBeDefined();
  });

  it('should handle room state updates', async () => {
    const { result } = renderHook(() =>
      useRoom('ABC123', { name: 'Alice' })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    const roomState = {
      type: 'room_state',
      room_name: 'Test Room',
      ticket: 'PROJ-123',
      status: 'voting',
      vote_round: 1,
      participants: [
        { id: '1', name: 'Alice', is_organizer: true, has_voted: false }
      ],
      votes: null,
      average: null,
    };

    act(() => {
      mockWsInstance.simulateMessage(roomState);
    });

    await waitFor(() => {
      expect(result.current.roomState).toEqual(roomState);
    });
  });

  it('should send vote message', async () => {
    const { result } = renderHook(() =>
      useRoom('ABC123', { name: 'Alice' })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    act(() => {
      result.current.vote('5');
    });

    await waitFor(() => {
      const voteMessage = mockWsInstance.sent.find(msg =>
        JSON.parse(msg).type === 'vote'
      );
      expect(voteMessage).toBeDefined();
      expect(JSON.parse(voteMessage)).toEqual({
        type: 'vote',
        value: '5',
      });
    });
  });

  it('should send reveal message', async () => {
    const { result } = renderHook(() =>
      useRoom('ABC123', { name: 'Alice', organizerToken: 'token' })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    act(() => {
      result.current.reveal();
    });

    await waitFor(() => {
      const revealMessage = mockWsInstance.sent.find(msg =>
        JSON.parse(msg).type === 'reveal'
      );
      expect(revealMessage).toBeDefined();
    });
  });

  it('should send setTicket message', async () => {
    const { result } = renderHook(() =>
      useRoom('ABC123', { name: 'Alice', organizerToken: 'token' })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    act(() => {
      result.current.setTicket('PROJ-999');
    });

    await waitFor(() => {
      const ticketMessage = mockWsInstance.sent.find(msg =>
        JSON.parse(msg).type === 'set_ticket'
      );
      expect(ticketMessage).toBeDefined();
      expect(JSON.parse(ticketMessage)).toEqual({
        type: 'set_ticket',
        ticket: 'PROJ-999',
      });
    });
  });

  it('should send kick message', async () => {
    const { result } = renderHook(() =>
      useRoom('ABC123', { name: 'Alice', organizerToken: 'token' })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    act(() => {
      result.current.kick('participant-id-123');
    });

    await waitFor(() => {
      const kickMessage = mockWsInstance.sent.find(msg =>
        JSON.parse(msg).type === 'kick'
      );
      expect(kickMessage).toBeDefined();
      expect(JSON.parse(kickMessage)).toEqual({
        type: 'kick',
        participant_id: 'participant-id-123',
      });
    });
  });

  it('should handle WebSocket error', async () => {
    const { result } = renderHook(() =>
      useRoom('ABC123', { name: 'Alice' })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    act(() => {
      mockWsInstance.simulateError();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Connection error');
    });
  });

  it('should handle WebSocket close', async () => {
    const { result } = renderHook(() =>
      useRoom('ABC123', { name: 'Alice' })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    act(() => {
      mockWsInstance.close();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(false);
      expect(result.current.roomState).toBe(null);
    });
  });

  it('should handle kicked message', async () => {
    const { result } = renderHook(() =>
      useRoom('ABC123', { name: 'Alice' })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    act(() => {
      mockWsInstance.simulateMessage({ type: 'kicked' });
    });

    await waitFor(() => {
      expect(result.current.kicked).toBe(true);
    });
  });

  it('should not send message if not connected', () => {
    const { result } = renderHook(() =>
      useRoom('ABC123', { name: 'Alice' })
    );

    // Don't simulate open, so not connected
    act(() => {
      result.current.vote('5');
    });

    const voteMessage = mockWsInstance.sent.find(msg =>
      JSON.parse(msg).type === 'vote'
    );
    expect(voteMessage).toBeUndefined();
  });

  it('should include organizer token in join message', async () => {
    const { result } = renderHook(() =>
      useRoom('ABC123', { name: 'Alice', organizerToken: 'secret-token' })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    const joinMessage = JSON.parse(mockWsInstance.sent[0]);
    expect(joinMessage.organizer_token).toBe('secret-token');
  });

  it('should maintain stable participant ID', () => {
    const { result: result1 } = renderHook(() =>
      useRoom('ABC123', { name: 'Alice' })
    );

    const participantId1 = result1.current.participantId;

    act(() => {
      mockWsInstance.simulateOpen();
    });

    const participantId2 = result1.current.participantId;

    expect(participantId1).toBe(participantId2);
  });

  it('should handle reconnection', async () => {
    const { result, rerender } = renderHook(
      ({ roomCode, opts }) => useRoom(roomCode, opts),
      {
        initialProps: {
          roomCode: 'ABC123',
          opts: { name: 'Alice' }
        }
      }
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    const firstWsInstance = mockWsInstance;

    act(() => {
      result.current.reconnect();
    });

    // After reconnect, should have a new WebSocket instance
    await waitFor(() => {
      expect(mockWsInstance).not.toBe(firstWsInstance);
    });
  });

  it('should ignore malformed JSON messages', async () => {
    const { result } = renderHook(() =>
      useRoom('ABC123', { name: 'Alice' })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    // Simulate invalid JSON
    act(() => {
      if (mockWsInstance.onmessage) {
        mockWsInstance.onmessage({ data: 'invalid json {' });
      }
    });

    // Should not crash, roomState should remain null
    expect(result.current.roomState).toBe(null);
  });

  it('should send only one join message on connection', async () => {
    const { result } = renderHook(() =>
      useRoom('ABC123', { name: 'Alice' })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    const joinMessages = mockWsInstance.sent.filter(msg =>
      JSON.parse(msg).type === 'join'
    );

    expect(joinMessages.length).toBe(1);
  });
});

