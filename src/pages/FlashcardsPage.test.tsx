import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FlashcardsPage } from './FlashcardsPage';
import { flashcardsApi } from '../lib/api/client';
import type { Flashcard, FlashcardDeck } from '../types';

vi.mock('../lib/api/client', () => ({
  flashcardsApi: {
    getDecks: vi.fn(),
    getDeck: vi.fn(),
    createDeck: vi.fn(),
    updateDeck: vi.fn(),
    deleteDeck: vi.fn(),
    createCard: vi.fn(),
    updateCard: vi.fn(),
    deleteCard: vi.fn(),
    reviewCard: vi.fn(),
  },
}));

const card: Flashcard = {
  id: 'card-1',
  deckId: 'deck-1',
  front: 'What is a process?',
  back: 'A running program.',
  position: 0,
  repetitions: 0,
  intervalDays: 0,
  easeFactor: 2.5,
  reviewCount: 0,
  dueAt: new Date(Date.now() - 1000).toISOString(),
  lastReviewedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const deck: FlashcardDeck = {
  id: 'deck-1',
  userId: 'user-1',
  title: 'Operating Systems',
  description: null,
  cardCount: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  cards: [card],
};

describe('FlashcardsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reviews a due card and updates to the empty due state', async () => {
    const nextReviewDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    vi.mocked(flashcardsApi.getDecks).mockResolvedValue([deck]);
    vi.mocked(flashcardsApi.getDeck).mockResolvedValue(deck);
    vi.mocked(flashcardsApi.reviewCard).mockResolvedValue({
      ...card,
      repetitions: 1,
      intervalDays: 1,
      reviewCount: 1,
      dueAt: nextReviewDate,
      lastReviewedAt: new Date().toISOString(),
    });
    render(<FlashcardsPage />);

    expect(await screen.findByText('What is a process?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /study due cards/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));
    expect(screen.getByText('A running program.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Good' }));

    expect(await screen.findByText('All due cards reviewed')).toBeInTheDocument();
    expect(await screen.findByText(
      `Next review date: ${new Date(nextReviewDate).toLocaleDateString()} · Interval: 1 day. Review session complete.`
    )).toBeInTheDocument();
    expect(flashcardsApi.reviewCard).toHaveBeenCalledWith('card-1', 4);
  });

  it('creates a card through the API and adds the returned card to the deck', async () => {
    const createdCard: Flashcard = {
      ...card,
      id: 'card-2',
      front: 'What is a thread?',
      back: 'A unit of execution.',
      position: 1,
      intervalDays: 0,
    };
    vi.mocked(flashcardsApi.getDecks).mockResolvedValue([deck]);
    vi.mocked(flashcardsApi.getDeck).mockResolvedValue(deck);
    vi.mocked(flashcardsApi.createCard).mockResolvedValue(createdCard);

    render(<FlashcardsPage />);
    expect(await screen.findByText('What is a process?')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Front'), { target: { value: createdCard.front } });
    fireEvent.change(screen.getByLabelText('Back'), { target: { value: createdCard.back } });
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }));

    await waitFor(() => expect(flashcardsApi.createCard).toHaveBeenCalledWith('deck-1', {
      front: createdCard.front,
      back: createdCard.back,
    }));
    expect(await screen.findByText('What is a thread?')).toBeInTheDocument();
    expect(screen.getByText('Card added.')).toBeInTheDocument();
  });

  it('shows the empty state and creates a user deck through the API', async () => {
    vi.mocked(flashcardsApi.getDecks).mockResolvedValue([]);
    vi.mocked(flashcardsApi.createDeck).mockResolvedValue({
      ...deck,
      id: 'deck-2',
      title: 'New deck',
      cardCount: 0,
      cards: undefined,
    });
    vi.mocked(flashcardsApi.getDeck).mockResolvedValue({
      ...deck,
      id: 'deck-2',
      title: 'New deck',
      cardCount: 0,
      cards: [],
    });
    render(<FlashcardsPage />);

    expect(await screen.findByText('No decks yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New deck' }));
    fireEvent.change(screen.getByLabelText('Deck title'), { target: { value: 'New deck' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create deck' }));

    await waitFor(() => expect(flashcardsApi.createDeck).toHaveBeenCalledWith({
      title: 'New deck',
      description: null,
    }));
    expect(await screen.findByRole('heading', { name: 'New deck' })).toBeInTheDocument();
  });

  it('surfaces a load error instead of presenting it as an empty deck list', async () => {
    vi.mocked(flashcardsApi.getDecks).mockRejectedValue(new Error('Flashcards are unavailable'));
    render(<FlashcardsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Flashcards are unavailable');
    expect(screen.queryByText('No decks yet')).not.toBeInTheDocument();
  });
});
