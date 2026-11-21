import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Layers } from 'lucide-react';
import { Card } from '../common/Card';
import { flashcardsApi } from '../../lib/api/client';
import type { FlashcardDeck } from '../../types';

export const FlashcardWidget: React.FC = () => {
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    flashcardsApi.getDecks()
      .then((result) => {
        if (active) setDecks(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load flashcards.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const cardCount = decks.reduce((total, deck) => total + deck.cardCount, 0);

  return (
    <Card className="p-6 min-h-64">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-subtle text-primary dark:bg-primary/20">
          <Layers className="h-5 w-5" />
        </div>
        <h3 className="text-base font-bold font-heading text-deep-purple dark:text-white">Flashcards</h3>
      </div>
      <div className="flex min-h-40 flex-col items-center justify-center text-center">
        {loading ? (
          <p role="status" className="text-sm text-muted-purple">Loading flashcards...</p>
        ) : error ? (
          <p role="alert" className="max-w-xs text-sm text-rose-600">{error}</p>
        ) : cardCount === 0 ? (
          <>
            <p className="text-sm font-semibold text-deep-purple dark:text-white">No flashcards available</p>
            <p className="mt-1 max-w-xs text-xs text-muted-purple">Create a deck to add and review your own cards.</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-deep-purple dark:text-white">
              {cardCount} card{cardCount === 1 ? '' : 's'} across {decks.length} deck{decks.length === 1 ? '' : 's'}
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-purple">Review cards that are due for practice.</p>
          </>
        )}
        <Link to="/flashcards" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
          Open Flashcards <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
};
