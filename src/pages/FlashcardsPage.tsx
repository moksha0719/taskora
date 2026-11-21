import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, Layers, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { flashcardsApi } from '../lib/api/client';
import type { Flashcard, FlashcardDeck } from '../types';

export const FlashcardsPage: React.FC = () => {
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<FlashcardDeck | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showDeckForm, setShowDeckForm] = useState(false);
  const [editingDeck, setEditingDeck] = useState(false);
  const [deckTitle, setDeckTitle] = useState('');
  const [deckDescription, setDeckDescription] = useState('');
  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [studyMode, setStudyMode] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const dueCards = useMemo(
    () => (selectedDeck?.cards || []).filter((card) => new Date(card.dueAt).getTime() <= Date.now()),
    [selectedDeck]
  );

  const loadDeck = async (id: string) => {
    const result = await flashcardsApi.getDeck(id);
    setSelectedDeck(result);
    setStudyMode(false);
    setShowAnswer(false);
    setEditingDeck(false);
    setEditingCardId(null);
    setCardFront('');
    setCardBack('');
    setError(null);
  };

  useEffect(() => {
    let active = true;
    flashcardsApi.getDecks()
      .then(async (result) => {
        if (!active) return;
        setLoadFailed(false);
        setError(null);
        setDecks(result);
        if (result[0]) {
          const firstDeck = await flashcardsApi.getDeck(result[0].id);
          if (active) setSelectedDeck(firstDeck);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Unable to load flashcard decks.');
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const runAction = async (action: () => Promise<void>, successMessage?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (successMessage) setNotice(successMessage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The flashcard action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateDeck = (event: React.FormEvent) => {
    event.preventDefault();
    void runAction(async () => {
      const deck = await flashcardsApi.createDeck({
        title: deckTitle,
        description: deckDescription || null,
      });
      setDecks((previous) => [deck, ...previous]);
      const loaded = await flashcardsApi.getDeck(deck.id);
      setSelectedDeck(loaded);
      setEditingDeck(false);
      setDeckTitle('');
      setDeckDescription('');
      setShowDeckForm(false);
    }, 'Deck created.');
  };

  const handleSaveDeck = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDeck) return;
    void runAction(async () => {
      const updated = await flashcardsApi.updateDeck(selectedDeck.id, {
        title: deckTitle,
        description: deckDescription || null,
      });
      setSelectedDeck({ ...updated, cards: selectedDeck.cards });
      setDecks((previous) => previous.map((deck) => deck.id === updated.id ? updated : deck));
      setEditingDeck(false);
      setNotice('Deck updated.');
    });
  };

  const beginEditingDeck = () => {
    if (!selectedDeck) return;
    setShowDeckForm(false);
    setDeckTitle(selectedDeck.title);
    setDeckDescription(selectedDeck.description || '');
    setEditingDeck(true);
  };

  const handleDeleteDeck = () => {
    if (!selectedDeck || !window.confirm(`Delete "${selectedDeck.title}" and its cards?`)) return;
    void runAction(async () => {
      await flashcardsApi.deleteDeck(selectedDeck.id);
      setDecks((previous) => previous.filter((deck) => deck.id !== selectedDeck.id));
      setSelectedDeck(null);
      setStudyMode(false);
      setNotice('Deck deleted.');
    });
  };

  const handleSaveCard = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDeck) return;
    void runAction(async () => {
      if (editingCardId) {
        const updated = await flashcardsApi.updateCard(editingCardId, { front: cardFront, back: cardBack });
        setSelectedDeck((previous) => previous && ({
          ...previous,
          cards: previous.cards?.map((card) => card.id === updated.id ? updated : card),
        }));
      } else {
        const created = await flashcardsApi.createCard(selectedDeck.id, { front: cardFront, back: cardBack });
        setSelectedDeck((previous) => previous && ({
          ...previous,
          cardCount: previous.cardCount + 1,
          cards: [...(previous.cards || []), created],
        }));
        setDecks((previous) => previous.map((deck) =>
          deck.id === selectedDeck.id ? { ...deck, cardCount: deck.cardCount + 1 } : deck
        ));
      }
      setCardFront('');
      setCardBack('');
      setEditingCardId(null);
      setNotice(editingCardId ? 'Card updated.' : 'Card added.');
    });
  };

  const beginEditingCard = (card: Flashcard) => {
    setEditingCardId(card.id);
    setCardFront(card.front);
    setCardBack(card.back);
    setStudyMode(false);
  };

  const handleDeleteCard = (card: Flashcard) => {
    if (!window.confirm('Delete this flashcard?')) return;
    void runAction(async () => {
      await flashcardsApi.deleteCard(card.id);
      setSelectedDeck((previous) => previous && ({
        ...previous,
        cardCount: Math.max(0, previous.cardCount - 1),
        cards: previous.cards?.filter((item) => item.id !== card.id),
      }));
      setDecks((previous) => previous.map((deck) =>
        deck.id === selectedDeck?.id ? { ...deck, cardCount: Math.max(0, deck.cardCount - 1) } : deck
      ));
      setNotice('Card deleted.');
    });
  };

  const handleReview = (quality: number) => {
    const card = dueCards[0];
    if (!card || !selectedDeck) return;
    void runAction(async () => {
      const updated = await flashcardsApi.reviewCard(card.id, quality);
      setSelectedDeck((previous) => previous && ({
        ...previous,
        cards: previous.cards?.map((item) => item.id === updated.id ? updated : item),
      }));
      setShowAnswer(false);
      const nextReviewDate = new Date(updated.dueAt).toLocaleDateString();
      const interval = `${updated.intervalDays} day${updated.intervalDays === 1 ? '' : 's'}`;
      setNotice(
        `Next review date: ${nextReviewDate} · Interval: ${interval}.${dueCards.length <= 1 ? ' Review session complete.' : ''}`
      );
    });
  };

  const selectedCard = studyMode ? dueCards[0] : null;

  if (loading) {
    return <Card role="status" className="p-6 text-sm text-muted-purple">Loading flashcards...</Card>;
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">Flashcards</h2>
          <p className="mt-1 text-xs text-muted-purple">Create decks and review cards with spaced repetition.</p>
        </div>
        <Button type="button" onClick={() => {
          setDeckTitle('');
          setDeckDescription('');
          setEditingDeck(false);
          setShowDeckForm((open) => !open);
          setError(null);
        }}>
          <Plus className="h-4 w-4" /> New deck
        </Button>
      </header>

      {error && (
        <Card role="alert" className="flex items-center justify-between gap-3 border-rose-300 p-4 text-sm text-rose-600">
          <span>{error}</span>
          {loadFailed && <button type="button" className="font-bold text-primary" onClick={() => {
            setError(null);
            setLoading(true);
            setLoadFailed(false);
            setReloadKey((key) => key + 1);
          }}>Retry</button>}
        </Card>
      )}
      {notice && <Card role="status" className="border-emerald-300 p-4 text-sm text-emerald-700">{notice}</Card>}

      {showDeckForm && (
        <Card className="p-5">
          <form onSubmit={handleCreateDeck} className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-deep-purple dark:text-white">
              Deck title
              <input required maxLength={120} value={deckTitle} onChange={(event) => setDeckTitle(event.target.value)}
                className="mt-1 w-full rounded-xl border border-subtle bg-white px-3 py-2 text-sm dark:bg-[#181131]" />
            </label>
            <label className="text-xs font-semibold text-deep-purple dark:text-white">
              Description
              <input maxLength={1000} value={deckDescription} onChange={(event) => setDeckDescription(event.target.value)}
                className="mt-1 w-full rounded-xl border border-subtle bg-white px-3 py-2 text-sm dark:bg-[#181131]" />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Create deck'}</Button>
              <Button type="button" variant="ghost" onClick={() => setShowDeckForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {decks.length === 0 ? (
        showDeckForm || loadFailed ? null : (
          <Card className="p-8 text-center">
            <Layers className="mx-auto h-10 w-10 text-primary" />
            <h3 className="mt-3 text-lg font-bold text-deep-purple dark:text-white">No decks yet</h3>
            <p className="mt-1 text-sm text-muted-purple">Create a deck to add and review your own flashcards.</p>
            <Button className="mt-4" onClick={() => setShowDeckForm(true)}>Create a deck</Button>
          </Card>
        )
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Card className="h-fit p-3">
            <h3 className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-purple">Your decks</h3>
            <div className="space-y-1">
              {decks.map((deck) => (
                <button key={deck.id} type="button" onClick={() => void runAction(() => loadDeck(deck.id))}
                  className={`w-full rounded-xl px-3 py-3 text-left transition-colors ${selectedDeck?.id === deck.id ? 'bg-primary-subtle text-primary' : 'hover:bg-primary-subtle/50'}`}>
                  <span className="block truncate text-sm font-semibold">{deck.title}</span>
                  <span className="mt-1 block text-xs text-muted-purple">{deck.cardCount} cards</span>
                </button>
              ))}
            </div>
          </Card>

          {selectedDeck && (
            <section className="min-w-0 space-y-4">
              <Card className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words text-xl font-bold text-deep-purple dark:text-white">{selectedDeck.title}</h3>
                    <p className="mt-1 text-sm text-muted-purple">{selectedDeck.description || 'No description'}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="muted">{selectedDeck.cardCount} cards</Badge>
                      <Badge variant="mint">{dueCards.length} due</Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={beginEditingDeck}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    <Button type="button" size="sm" variant="danger" onClick={handleDeleteDeck} disabled={busy}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                  </div>
                </div>
                {editingDeck && (
                  <form onSubmit={handleSaveDeck} className="mt-4 grid gap-3 border-t border-subtle pt-4 sm:grid-cols-2">
                    <label className="text-xs font-semibold">Deck title
                      <input required maxLength={120} value={deckTitle} onChange={(event) => setDeckTitle(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-subtle bg-white px-3 py-2 text-sm dark:bg-[#181131]" />
                    </label>
                    <label className="text-xs font-semibold">Description
                      <input maxLength={1000} value={deckDescription} onChange={(event) => setDeckDescription(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-subtle bg-white px-3 py-2 text-sm dark:bg-[#181131]" />
                    </label>
                    <div className="flex gap-2 sm:col-span-2">
                      <Button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</Button>
                      <Button type="button" variant="ghost" onClick={() => setEditingDeck(false)}>Cancel</Button>
                    </div>
                  </form>
                )}
              </Card>

              {studyMode && (
                <Card className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-deep-purple dark:text-white">Review session</h3>
                      <p className="text-xs text-muted-purple">{dueCards.length} card{dueCards.length === 1 ? '' : 's'} remaining</p>
                    </div>
                    <Button type="button" variant="ghost" onClick={() => setStudyMode(false)}><X className="h-4 w-4" /> End review</Button>
                  </div>
                  {selectedCard ? (
                    <div className="mt-5">
                      <div className="min-h-40 rounded-2xl border border-subtle bg-primary-subtle/20 p-6 text-center">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-purple">{showAnswer ? 'Answer' : 'Question'}</p>
                        <p className="whitespace-pre-wrap text-lg font-medium text-deep-purple dark:text-white">
                          {showAnswer ? selectedCard.back : selectedCard.front}
                        </p>
                      </div>
                      {!showAnswer ? (
                        <Button className="mt-4 w-full" onClick={() => setShowAnswer(true)}>Show answer</Button>
                      ) : (
                        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {[
                            { quality: 0, label: 'Again' },
                            { quality: 3, label: 'Hard' },
                            { quality: 4, label: 'Good' },
                            { quality: 5, label: 'Easy' },
                          ].map(({ quality, label }) => (
                            <Button key={quality} type="button" variant={quality === 0 ? 'outline' : 'primary'}
                              disabled={busy} onClick={() => handleReview(quality)}>
                              {label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Check className="mx-auto h-9 w-9 text-emerald-600" />
                      <p className="mt-2 font-semibold text-deep-purple dark:text-white">All due cards reviewed</p>
                      <p className="mt-1 text-sm text-muted-purple">Come back when your next cards are due.</p>
                    </div>
                  )}
                </Card>
              )}

              {!studyMode && (
                <>
                  <Card className="p-5">
                    <form onSubmit={handleSaveCard} className="space-y-3">
                      <h4 className="font-bold text-deep-purple dark:text-white">{editingCardId ? 'Edit flashcard' : 'Add a flashcard'}</h4>
                      <label className="block text-xs font-semibold">Front
                        <textarea required maxLength={4000} rows={2} value={cardFront} onChange={(event) => setCardFront(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-subtle bg-white px-3 py-2 text-sm dark:bg-[#181131]" />
                      </label>
                      <label className="block text-xs font-semibold">Back
                        <textarea required maxLength={4000} rows={2} value={cardBack} onChange={(event) => setCardBack(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-subtle bg-white px-3 py-2 text-sm dark:bg-[#181131]" />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" disabled={busy || !cardFront.trim() || !cardBack.trim()}>
                          <Plus className="h-4 w-4" /> {busy ? 'Saving...' : editingCardId ? 'Save card' : 'Add card'}
                        </Button>
                        {editingCardId && <Button type="button" variant="ghost" onClick={() => {
                          setEditingCardId(null);
                          setCardFront('');
                          setCardBack('');
                        }}>Cancel edit</Button>}
                        <Button type="button" variant="outline" disabled={!dueCards.length || busy} onClick={() => {
                          setStudyMode(true);
                          setShowAnswer(false);
                        }}>
                          <BookOpen className="h-4 w-4" /> Study due cards
                        </Button>
                      </div>
                    </form>
                  </Card>

                  {selectedDeck.cards?.length ? (
                    <div className="space-y-3">
                      {selectedDeck.cards.map((card) => (
                        <Card key={card.id} className="p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-purple">Front</span>
                                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-deep-purple dark:text-white">{card.front}</p>
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-purple">Back</span>
                                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-deep-purple dark:text-white">{card.back}</p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button type="button" size="icon" variant="ghost" aria-label="Edit card" onClick={() => beginEditingCard(card)}><Pencil className="h-4 w-4" /></Button>
                              <Button type="button" size="icon" variant="ghost" aria-label="Delete card" onClick={() => handleDeleteCard(card)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                            </div>
                          </div>
                          <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-purple">
                            <RotateCcw className="h-3 w-3" />
                            {new Date(card.dueAt).getTime() <= Date.now()
                              ? 'Next review: Due now'
                              : `Next review: ${new Date(card.dueAt).toLocaleDateString()}`}
                            <span className="ml-2">Interval: {card.intervalDays} day{card.intervalDays === 1 ? '' : 's'}</span>
                          </p>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="p-6 text-center text-sm text-muted-purple">This deck is empty. Add your first card above.</Card>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      )}
      {busy && <span className="sr-only" role="status">Saving flashcard changes</span>}
    </div>
  );
};
