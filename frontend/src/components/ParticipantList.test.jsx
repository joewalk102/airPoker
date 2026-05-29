import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ParticipantList from '../components/ParticipantList';

describe('ParticipantList Component', () => {
  it('should render empty state when no participants', () => {
    render(<ParticipantList participants={[]} isOrganizer={false} currentId="123" onKick={() => {}} />);
    expect(screen.getByText('No one here yet')).toBeInTheDocument();
  });

  it('should render participants', () => {
    const participants = [
      { id: '1', name: 'Alice', is_organizer: true, has_voted: true },
      { id: '2', name: 'Bob', is_organizer: false, has_voted: false },
    ];
    render(
      <ParticipantList participants={participants} isOrganizer={false} currentId="123" onKick={() => {}} />
    );
    expect(screen.getAllByText('Alice')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Bob')[0]).toBeInTheDocument();
  });

  it('should show count of participants', () => {
    const participants = [
      { id: '1', name: 'Alice', is_organizer: true, has_voted: true },
      { id: '2', name: 'Bob', is_organizer: false, has_voted: false },
      { id: '3', name: 'Charlie', is_organizer: false, has_voted: true },
    ];
    render(
      <ParticipantList participants={participants} isOrganizer={false} currentId="123" onKick={() => {}} />
    );
    expect(screen.getByText('Participants (3)')).toBeInTheDocument();
  });

  it('should show host tag for organizer', () => {
    const participants = [
      { id: '1', name: 'Alice', is_organizer: true, has_voted: true },
    ];
    render(
      <ParticipantList participants={participants} isOrganizer={false} currentId="123" onKick={() => {}} />
    );
    expect(screen.getByText('host')).toBeInTheDocument();
  });

  it('should not show host tag for regular participants', () => {
    const participants = [
      { id: '1', name: 'Bob', is_organizer: false, has_voted: false },
    ];
    render(
      <ParticipantList participants={participants} isOrganizer={false} currentId="123" onKick={() => {}} />
    );
    expect(screen.queryByText('host')).not.toBeInTheDocument();
  });

  it('should show voted indicator when participant has voted', () => {
    const participants = [
      { id: '1', name: 'Alice', is_organizer: false, has_voted: true },
    ];
    render(
      <ParticipantList participants={participants} isOrganizer={false} currentId="123" onKick={() => {}} />
    );
    const dot = document.querySelector('.participant-dot.voted');
    expect(dot).toBeInTheDocument();
  });

  it('should not show voted indicator when participant has not voted', () => {
    const participants = [
      { id: '1', name: 'Bob', is_organizer: false, has_voted: false },
    ];
    render(
      <ParticipantList participants={participants} isOrganizer={false} currentId="123" onKick={() => {}} />
    );
    const dot = document.querySelector('.participant-dot.voted');
    expect(dot).not.toBeInTheDocument();
  });

  it('should show kick button for organizer on non-organizer participants', () => {
    const participants = [
      { id: '1', name: 'Bob', is_organizer: false, has_voted: false },
    ];
    const { container } = render(
      <ParticipantList participants={participants} isOrganizer={true} currentId="999" onKick={() => {}} />
    );
    const kickButton = container.querySelector('.kick-btn');
    expect(kickButton).toBeInTheDocument();
  });

  it('should not show kick button for non-organizer users', () => {
    const participants = [
      { id: '1', name: 'Bob', is_organizer: false, has_voted: false },
    ];
    const { container } = render(
      <ParticipantList participants={participants} isOrganizer={false} currentId="999" onKick={() => {}} />
    );
    const kickButton = container.querySelector('.kick-btn');
    expect(kickButton).not.toBeInTheDocument();
  });

  it('should not show kick button for organizer participants', () => {
    const participants = [
      { id: '1', name: 'Alice', is_organizer: true, has_voted: true },
    ];
    const { container } = render(
      <ParticipantList participants={participants} isOrganizer={true} currentId="999" onKick={() => {}} />
    );
    const kickButton = container.querySelector('.kick-btn');
    expect(kickButton).not.toBeInTheDocument();
  });

  it('should not show kick button for current user', () => {
    const participants = [
      { id: '1', name: 'Alice', is_organizer: true, has_voted: true },
      { id: '2', name: 'Bob', is_organizer: false, has_voted: false },
    ];
    const { container } = render(
      <ParticipantList participants={participants} isOrganizer={true} currentId="2" onKick={() => {}} />
    );
    const kickButtons = container.querySelectorAll('.kick-btn');
    expect(kickButtons).toHaveLength(0);
  });

  it('should call onKick with participant id when kick button clicked', () => {
    const onKick = vi.fn();
    const participants = [
      { id: 'bob-id', name: 'Bob', is_organizer: false, has_voted: false },
    ];
    const { container } = render(
      <ParticipantList participants={participants} isOrganizer={true} currentId="alice-id" onKick={onKick} />
    );
    const kickButton = container.querySelector('.kick-btn');
    fireEvent.click(kickButton);
    expect(onKick).toHaveBeenCalledWith('bob-id');
  });

  it('should render null when participants prop is null', () => {
    const { container } = render(
      <ParticipantList participants={null} isOrganizer={false} currentId="123" onKick={() => {}} />
    );
    expect(container.querySelector('.participant-list')).toBeInTheDocument();
  });

  it('should render null when participants prop is undefined', () => {
    const { container } = render(
      <ParticipantList participants={undefined} isOrganizer={false} currentId="123" onKick={() => {}} />
    );
    expect(container.querySelector('.participant-list')).toBeInTheDocument();
  });

  it('should show multiple kick buttons for multiple non-organizer participants', () => {
    const onKick = vi.fn();
    const participants = [
      { id: '1', name: 'Alice', is_organizer: true, has_voted: true },
      { id: '2', name: 'Bob', is_organizer: false, has_voted: false },
      { id: '3', name: 'Charlie', is_organizer: false, has_voted: true },
    ];
    const { container } = render(
      <ParticipantList participants={participants} isOrganizer={true} currentId="999" onKick={onKick} />
    );
    const kickButtons = container.querySelectorAll('.kick-btn');
    expect(kickButtons).toHaveLength(2);
  });

  it('should have proper title attributes on kick buttons', () => {
    const participants = [
      { id: '1', name: 'Bob', is_organizer: false, has_voted: false },
    ];
    const { container } = render(
      <ParticipantList participants={participants} isOrganizer={true} currentId="999" onKick={() => {}} />
    );
    const kickButton = container.querySelector('.kick-btn');
    expect(kickButton).toHaveAttribute('title', 'Remove Bob');
  });
});
