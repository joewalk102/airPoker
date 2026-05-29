import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Room from '../pages/Room';

// Mock the useRoom hook
vi.mock('../hooks/useRoom', () => ({
  useRoom: vi.fn(),
}));

import { useRoom } from '../hooks/useRoom';

const mockUseRoom = useRoom;

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ code: 'ABC123' }),
  };
});

describe('Room Page', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockNavigate.mockClear();
    mockUseRoom.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render name input modal when no name is set', () => {
    mockUseRoom.mockReturnValue({
      roomState: null,
      connected: false,
      error: null,
      kicked: false,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    expect(screen.getByText('Enter your name')).toBeInTheDocument();
  });

  it('should store name in session storage after submitting', async () => {
    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: '',
        status: 'waiting',
        vote_round: 0,
        participants: [],
        votes: null,
        average: null,
      },
      connected: true,
      error: null,
      kicked: false,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    const nameInput = screen.getByPlaceholderText('Alice');
    await userEvent.type(nameInput, 'Alice');

    const joinButton = screen.getByText('Join Room');
    await userEvent.click(joinButton);

    expect(sessionStorage.getItem('pokerName')).toBe('Alice');
  });

  it('should not show name modal when name is in session storage', () => {
    sessionStorage.setItem('pokerName', 'Alice');

    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: '',
        status: 'waiting',
        vote_round: 0,
        participants: [],
        votes: null,
        average: null,
      },
      connected: true,
      error: null,
      kicked: false,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    expect(screen.queryByText('Enter your name')).not.toBeInTheDocument();
  });

  it('should show connection status', () => {
    sessionStorage.setItem('pokerName', 'Alice');

    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: '',
        status: 'waiting',
        vote_round: 0,
        participants: [],
        votes: null,
        average: null,
      },
      connected: true,
      error: null,
      kicked: false,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('should show disconnected status when not connected', () => {
    sessionStorage.setItem('pokerName', 'Alice');

    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: '',
        status: 'waiting',
        vote_round: 0,
        participants: [],
        votes: null,
        average: null,
      },
      connected: false,
      error: null,
      kicked: false,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    expect(screen.getByText(/Disconnected/)).toBeInTheDocument();
  });

  it('should show room code badge', () => {
    sessionStorage.setItem('pokerName', 'Alice');

    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: '',
        status: 'waiting',
        vote_round: 0,
        participants: [],
        votes: null,
        average: null,
      },
      connected: true,
      error: null,
      kicked: false,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    expect(screen.getByText(/Room: ABC123/)).toBeInTheDocument();
  });

  it('should show host badge for organizers', () => {
    sessionStorage.setItem('pokerName', 'Alice');
    sessionStorage.setItem('pokerToken_ABC123', 'organizer-token');

    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: '',
        status: 'waiting',
        vote_round: 0,
        participants: [],
        votes: null,
        average: null,
      },
      connected: true,
      error: null,
      kicked: false,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    expect(screen.getByText('Host')).toBeInTheDocument();
  });

  it('should show voting interface when status is voting', () => {
    sessionStorage.setItem('pokerName', 'Alice');

    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: 'PROJ-123',
        status: 'voting',
        vote_round: 1,
        participants: [{ id: '1', name: 'Alice', is_organizer: false, has_voted: false }],
        votes: null,
        average: null,
      },
      connected: true,
      error: null,
      kicked: false,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    // Should show vote cards
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('should call vote function when vote card clicked', async () => {
    sessionStorage.setItem('pokerName', 'Alice');

    const vote = vi.fn();
    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: 'PROJ-123',
        status: 'voting',
        vote_round: 1,
        participants: [{ id: '1', name: 'Alice', is_organizer: false, has_voted: false }],
        votes: null,
        average: null,
      },
      connected: true,
      error: null,
      kicked: false,
      vote,
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    const voteButton = screen.getAllByRole('button').find(btn => btn.textContent === '5');
    await userEvent.click(voteButton);

    expect(vote).toHaveBeenCalledWith('5');
  });

  it('should show reveal button when organizer and voting', () => {
    sessionStorage.setItem('pokerName', 'Alice');
    sessionStorage.setItem('pokerToken_ABC123', 'organizer-token');

    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: 'PROJ-123',
        status: 'voting',
        vote_round: 1,
        participants: [{ id: '1', name: 'Alice', is_organizer: true, has_voted: true }],
        votes: null,
        average: null,
      },
      connected: true,
      error: null,
      kicked: false,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    expect(screen.getByText('Reveal Votes')).toBeInTheDocument();
  });

  it('should call reveal when reveal button clicked', async () => {
    sessionStorage.setItem('pokerName', 'Alice');
    sessionStorage.setItem('pokerToken_ABC123', 'organizer-token');

    const reveal = vi.fn();
    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: 'PROJ-123',
        status: 'voting',
        vote_round: 1,
        participants: [{ id: '1', name: 'Alice', is_organizer: true, has_voted: true }],
        votes: null,
        average: null,
      },
      connected: true,
      error: null,
      kicked: false,
      vote: vi.fn(),
      reveal,
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    const revealButton = screen.getByText('Reveal Votes');
    await userEvent.click(revealButton);

    expect(reveal).toHaveBeenCalled();
  });

  it('should show results when status is revealed', () => {
    sessionStorage.setItem('pokerName', 'Alice');

    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: 'PROJ-123',
        status: 'revealed',
        vote_round: 1,
        participants: [
          { id: '1', name: 'Alice', is_organizer: false, has_voted: true },
          { id: '2', name: 'Bob', is_organizer: false, has_voted: true },
        ],
        votes: [
          { id: '1', name: 'Alice', value: '5' },
          { id: '2', name: 'Bob', value: '3' },
        ],
        average: 4.0,
      },
      connected: true,
      error: null,
      kicked: false,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    expect(screen.getByText('Results')).toBeInTheDocument();
    const resultsSection = screen.getByText('Results').closest('.results-section');
    expect(within(resultsSection).getByText('Alice')).toBeInTheDocument();
    expect(within(resultsSection).getByText('Bob')).toBeInTheDocument();
  });

  it('should show average in results', () => {
    sessionStorage.setItem('pokerName', 'Alice');

    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: 'PROJ-123',
        status: 'revealed',
        vote_round: 1,
        participants: [],
        votes: [
          { id: '1', name: 'Alice', value: '5' },
          { id: '2', name: 'Bob', value: '3' },
        ],
        average: 4.0,
      },
      connected: true,
      error: null,
      kicked: false,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    const resultsAverage = document.querySelector('.results-average');
    expect(resultsAverage).toHaveTextContent('5'); // Rounded up average
  });

  it('should show organizer ticket form when organizer and not voting', () => {
    sessionStorage.setItem('pokerName', 'Alice');
    sessionStorage.setItem('pokerToken_ABC123', 'organizer-token');

    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: '',
        status: 'waiting',
        vote_round: 0,
        participants: [{ id: '1', name: 'Alice', is_organizer: true, has_voted: false }],
        votes: null,
        average: null,
      },
      connected: true,
      error: null,
      kicked: false,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    expect(screen.getByDisplayValue('')).toBeInTheDocument();
    expect(screen.getByText('Start Vote')).toBeInTheDocument();
  });

  it('should call setTicket when form submitted', async () => {
    sessionStorage.setItem('pokerName', 'Alice');
    sessionStorage.setItem('pokerToken_ABC123', 'organizer-token');

    const setTicket = vi.fn();
    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: '',
        status: 'waiting',
        vote_round: 0,
        participants: [{ id: '1', name: 'Alice', is_organizer: true, has_voted: false }],
        votes: null,
        average: null,
      },
      connected: true,
      error: null,
      kicked: false,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket,
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    const input = screen.getByPlaceholderText('PROJ-123 or ticket description…');
    await userEvent.type(input, 'PROJ-999');

    const button = screen.getByText('Start Vote');
    await userEvent.click(button);

    expect(setTicket).toHaveBeenCalledWith('PROJ-999');
  });

  it('should show leave room button', () => {
    sessionStorage.setItem('pokerName', 'Alice');

    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: '',
        status: 'waiting',
        vote_round: 0,
        participants: [],
        votes: null,
        average: null,
      },
      connected: true,
      error: null,
      kicked: false,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    expect(screen.getByText('Leave Room')).toBeInTheDocument();
  });

  it('should navigate to home when kicked', async () => {
    sessionStorage.setItem('pokerName', 'Alice');

    const { rerender } = render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: '',
        status: 'waiting',
        vote_round: 0,
        participants: [],
        votes: null,
        average: null,
      },
      connected: true,
      error: null,
      kicked: true,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    rerender(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('should show waiting state for non-organizer', () => {
    sessionStorage.setItem('pokerName', 'Alice');

    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: '',
        status: 'waiting',
        vote_round: 0,
        participants: [{ id: '1', name: 'Alice', is_organizer: false, has_voted: false }],
        votes: null,
        average: null,
      },
      connected: true,
      error: null,
      kicked: false,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    expect(screen.getByText('Waiting for the host to start a vote…')).toBeInTheDocument();
  });

  it('should show error message if error exists', () => {
    sessionStorage.setItem('pokerName', 'Alice');

    mockUseRoom.mockReturnValue({
      roomState: null,
      connected: false,
      error: 'Connection failed',
      kicked: false,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('should show vote count when voting', () => {
    sessionStorage.setItem('pokerName', 'Alice');

    mockUseRoom.mockReturnValue({
      roomState: {
        type: 'room_state',
        room_name: 'Test Room',
        ticket: 'PROJ-123',
        status: 'voting',
        vote_round: 1,
        participants: [
          { id: '1', name: 'Alice', is_organizer: false, has_voted: true },
          { id: '2', name: 'Bob', is_organizer: false, has_voted: false },
          { id: '3', name: 'Charlie', is_organizer: false, has_voted: true },
        ],
        votes: null,
        average: null,
      },
      connected: true,
      error: null,
      kicked: false,
      vote: vi.fn(),
      reveal: vi.fn(),
      setTicket: vi.fn(),
      kick: vi.fn(),
      reconnect: vi.fn(),
      participantId: 'test-id',
    });

    render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );

    expect(screen.getByText(/2\/3 voted/)).toBeInTheDocument();
  });
});

