import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FlashcardWidget } from './FlashcardWidget';
import { flashcardsApi } from '../../lib/api/client';

vi.mock('../../lib/api/client', () => ({
  flashcardsApi: { getDecks: vi.fn() },
}));

describe('FlashcardWidget', () => {
  beforeEach(() => {
    vi.mocked(flashcardsApi.getDecks).mockReset();
  });

  it('shows an honest empty state and links to the flashcard manager', async () => {
    vi.mocked(flashcardsApi.getDecks).mockResolvedValue([]);
    render(<MemoryRouter><FlashcardWidget /></MemoryRouter>);

    expect(await screen.findByText('No flashcard decks yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create a deck/i })).toHaveAttribute('href', '/flashcards');
  });

  it('shows counts based on saved decks', async () => {
    vi.mocked(flashcardsApi.getDecks).mockResolvedValue([
      { id: 'deck-1', userId: 'user-1', title: 'Biology', description: null, cardCount: 3, createdAt: '', updatedAt: '' },
      { id: 'deck-2', userId: 'user-1', title: 'Math', description: null, cardCount: 1, createdAt: '', updatedAt: '' },
    ]);
    render(<MemoryRouter><FlashcardWidget /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('4 cards across 2 decks')).toBeInTheDocument());
  });

  it('shows an error and retries loading decks', async () => {
    vi.mocked(flashcardsApi.getDecks)
      .mockRejectedValueOnce(new Error('Flashcards unavailable'))
      .mockResolvedValueOnce([
        { id: 'deck-1', userId: 'user-1', title: 'Biology', description: null, cardCount: 2, createdAt: '', updatedAt: '' },
      ]);
    render(<MemoryRouter><FlashcardWidget /></MemoryRouter>);

    expect(await screen.findByRole('alert')).toHaveTextContent('Flashcards unavailable');
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(await screen.findByText('2 cards across 1 deck')).toBeInTheDocument();
  });
});
