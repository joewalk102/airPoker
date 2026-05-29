import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Home from '../pages/Home';

// Mock the API calls
global.fetch = vi.fn();

describe('Home Page', () => {
  beforeEach(() => {
    fetch.mockClear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render create and join forms', () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    expect(screen.getByText('Create a Room')).toBeInTheDocument();
    expect(screen.getByText('Join a Room')).toBeInTheDocument();
  });

  it('should show error when creating room without name', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    const createButtons = screen.getAllByRole('button');
    const createButton = createButtons.find(btn => btn.textContent.includes('Create Room'));

    await userEvent.click(createButton);

    expect(screen.getByText('Enter your name')).toBeInTheDocument();
  });

  it('should show error when joining room without name', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    const joinButtons = screen.getAllByRole('button');
    const joinButton = joinButtons.find(btn => btn.textContent.includes('Join Room'));

    await userEvent.click(joinButton);

    expect(screen.getByText('Enter your name')).toBeInTheDocument();
  });

  it('should show error when joining room without code', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    const nameInputs = screen.getAllByPlaceholderText(/^(Alice|Bob)$/);
    const joinNameInput = nameInputs[1]; // Join form

    await userEvent.type(joinNameInput, 'Bob');

    const joinButtons = screen.getAllByRole('button');
    const joinButton = joinButtons.find(btn => btn.textContent.includes('Join Room'));

    await userEvent.click(joinButton);

    expect(screen.getByText('Enter a room code')).toBeInTheDocument();
  });

  it('should create room successfully', async () => {
    const mockRoomData = {
      code: 'ABC123',
      name: 'Test Room',
      organizer_token: 'mock-token-123',
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRoomData,
    });

    const { container } = render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    const nameInputs = screen.getAllByPlaceholderText('Alice');
    await userEvent.type(nameInputs[0], 'Alice');

    const roomNameInput = screen.getByPlaceholderText('Sprint 42 Planning');
    await userEvent.type(roomNameInput, 'My Room');

    const createButtons = screen.getAllByRole('button');
    const createButton = createButtons.find(btn => btn.textContent.includes('Create Room'));

    await userEvent.click(createButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/rooms/'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    expect(sessionStorage.getItem('pokerName')).toBe('Alice');
    expect(sessionStorage.getItem('pokerToken_ABC123')).toBe('mock-token-123');
  });

  it('should handle room creation error', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
    });

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    const nameInputs = screen.getAllByPlaceholderText('Alice');
    await userEvent.type(nameInputs[0], 'Alice');

    const createButtons = screen.getAllByRole('button');
    const createButton = createButtons.find(btn => btn.textContent.includes('Create Room'));

    await userEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Could not create room. Is the server running?')).toBeInTheDocument();
    });
  });

  it('should join room successfully', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ code: 'ABC123', name: 'Existing Room' }),
    });

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    const nameInputs = screen.getAllByPlaceholderText(/^(Alice|Bob)$/);
    const joinNameInput = nameInputs[1];
    await userEvent.type(joinNameInput, 'Bob');

    const joinCodeInput = screen.getByPlaceholderText('ABC123');
    await userEvent.type(joinCodeInput, 'abc123');

    const joinButtons = screen.getAllByRole('button');
    const joinButton = joinButtons.find(btn => btn.textContent.includes('Join Room'));

    await userEvent.click(joinButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/rooms/ABC123/')
      );
    });

    expect(sessionStorage.getItem('pokerName')).toBe('Bob');
  });

  it('should handle room not found error', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    const nameInputs = screen.getAllByPlaceholderText(/^(Alice|Bob)$/);
    const joinNameInput = nameInputs[1];
    await userEvent.type(joinNameInput, 'Bob');

    const joinCodeInput = screen.getByPlaceholderText('ABC123');
    await userEvent.type(joinCodeInput, 'ABC999');

    const joinButtons = screen.getAllByRole('button');
    const joinButton = joinButtons.find(btn => btn.textContent.includes('Join Room'));

    await userEvent.click(joinButton);

    await waitFor(() => {
      expect(screen.getByText('Room not found')).toBeInTheDocument();
    });
  });

  it('should trim and store participant name', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 'ABC123',
        name: 'Test',
        organizer_token: 'token',
      }),
    });

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    const nameInputs = screen.getAllByPlaceholderText('Alice');
    await userEvent.type(nameInputs[0], '  Alice  ');

    const createButtons = screen.getAllByRole('button');
    const createButton = createButtons.find(btn => btn.textContent.includes('Create Room'));

    await userEvent.click(createButton);

    await waitFor(() => {
      expect(sessionStorage.getItem('pokerName')).toBe('Alice');
    });
  });
});

