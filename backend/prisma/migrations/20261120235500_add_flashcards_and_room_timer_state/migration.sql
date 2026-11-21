ALTER TABLE "StudyRoom"
  ADD COLUMN "timerStartedAt" TIMESTAMP(3);

CREATE TABLE "FlashcardDeck" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FlashcardDeck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Flashcard" (
  "id" UUID NOT NULL,
  "deckId" UUID NOT NULL,
  "front" VARCHAR(4000) NOT NULL,
  "back" VARCHAR(4000) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "repetitions" INTEGER NOT NULL DEFAULT 0,
  "intervalDays" INTEGER NOT NULL DEFAULT 0,
  "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  "reviewCount" INTEGER NOT NULL DEFAULT 0,
  "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Flashcard_position_check" CHECK ("position" >= 0),
  CONSTRAINT "Flashcard_repetitions_check" CHECK ("repetitions" >= 0),
  CONSTRAINT "Flashcard_intervalDays_check" CHECK ("intervalDays" >= 0),
  CONSTRAINT "Flashcard_easeFactor_check" CHECK ("easeFactor" >= 1.3),
  CONSTRAINT "Flashcard_reviewCount_check" CHECK ("reviewCount" >= 0)
);

CREATE INDEX "FlashcardDeck_userId_updatedAt_idx" ON "FlashcardDeck"("userId", "updatedAt");
CREATE INDEX "Flashcard_deckId_position_idx" ON "Flashcard"("deckId", "position");
CREATE INDEX "Flashcard_deckId_dueAt_idx" ON "Flashcard"("deckId", "dueAt");

ALTER TABLE "FlashcardDeck"
  ADD CONSTRAINT "FlashcardDeck_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Flashcard"
  ADD CONSTRAINT "Flashcard_deckId_fkey"
  FOREIGN KEY ("deckId") REFERENCES "FlashcardDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
