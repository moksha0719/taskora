import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Layers, ChevronLeft, ChevronRight, Sparkles, RotateCw } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Flashcard {
  id: number;
  question: string;
  answer: string;
  subject: string;
}

const SAMPLE_FLASHCARDS: Flashcard[] = [
  {
    id: 1,
    question: 'What is the time complexity of binary search?',
    answer: 'O(log n)',
    subject: 'Data Structures',
  },
  {
    id: 2,
    question: 'In Raft consensus, what triggers a new leader election?',
    answer: 'Heartbeat timeout on a follower node.',
    subject: 'Distributed Systems',
  },
  {
    id: 3,
    question: 'What is the primary difference between ACID and BASE consistency?',
    answer: 'ACID guarantees immediate strict consistency; BASE favors availability and eventual consistency.',
    subject: 'Databases',
  },
  {
    id: 4,
    question: 'What is the worst-case time complexity of QuickSort?',
    answer: 'O(n²) when pivot chosen is consistently extreme.',
    subject: 'Algorithms',
  },
  {
    id: 5,
    question: 'What invariant must a Red-Black Tree root maintain?',
    answer: 'The root node must always be black.',
    subject: 'Data Structures',
  },
  {
    id: 6,
    question: 'What is Amortized Analysis in dynamic array resizing?',
    answer: 'Average time per operation over a worst-case sequence (O(1) amortized for append).',
    subject: 'Algorithms',
  },
];

export const FlashcardWidget: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deck, setDeck] = useState<Flashcard[]>(SAMPLE_FLASHCARDS);

  const current = deck[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % deck.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + deck.length) % deck.length);
  };

  const handleGenerateMore = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.6 },
        colors: ['#9885E8', '#C7B9F5', '#DDF3E9'],
      });
    }, 800);
  };

  return (
    <Card className="p-6 relative flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-subtle dark:bg-primary/20 flex items-center justify-center text-primary">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-bold font-heading text-deep-purple dark:text-white">
              AI Flashcards
            </h3>
          </div>

          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-mint-accent text-mint-accent-text dark:bg-emerald-950/40 dark:text-emerald-300">
            Generated from your notes ✨
          </span>
        </div>

        {/* Question & Answer Card matching reference */}
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className="p-4 rounded-2xl bg-primary-subtle/30 dark:bg-[#1E163B] border border-primary/20 min-h-[140px] flex flex-col justify-between cursor-pointer hover:border-primary/50 transition-all select-none group"
        >
          <div>
            <div className="flex items-start gap-2.5 mb-2">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-extrabold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
                Q
              </span>
              <p className="text-xs sm:text-sm font-semibold text-deep-purple dark:text-white leading-relaxed">
                {current.question}
              </p>
            </div>

            {isFlipped ? (
              <div className="flex items-start gap-2.5 mt-3 pt-3 border-t border-primary/10 animate-fade-in">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  A
                </span>
                <p className="text-xs sm:text-sm font-bold text-deep-purple dark:text-emerald-300">
                  {current.answer}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-3 pt-2 text-[11px] font-medium text-muted-purple group-hover:text-primary transition-colors">
                <RotateCw className="w-3 h-3" />
                <span>Tap card to reveal answer</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[10px] font-bold text-muted-purple tracking-wide uppercase">
              {current.subject}
            </span>
            <span className="text-[10px] font-bold text-primary">
              {isFlipped ? 'Answer Shown' : 'Question Mode'}
            </span>
          </div>
        </div>

        {/* Pagination Navigation */}
        <div className="flex items-center justify-center gap-4 mt-3">
          <button
            onClick={handlePrev}
            className="p-1 rounded-full text-muted-purple hover:bg-primary-subtle transition-colors"
            aria-label="Previous flashcard"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-deep-purple dark:text-white">
            {currentIndex + 1} / {deck.length}
          </span>
          <button
            onClick={handleNext}
            className="p-1 rounded-full text-muted-purple hover:bg-primary-subtle transition-colors"
            aria-label="Next flashcard"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Button: + Generate More Flashcards */}
      <button
        onClick={handleGenerateMore}
        disabled={isGenerating}
        className="w-full mt-4 py-2 px-3 rounded-2xl bg-primary-subtle/80 hover:bg-primary hover:text-white dark:bg-primary/20 dark:hover:bg-primary text-primary dark:text-lavender-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-primary/20 shadow-xs active:scale-98"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>{isGenerating ? 'Analyzing Notes...' : '+ Generate More Flashcards'}</span>
      </button>
    </Card>
  );
};
