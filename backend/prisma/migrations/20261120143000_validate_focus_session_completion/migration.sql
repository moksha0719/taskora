ALTER TABLE "FocusSession"
  ADD COLUMN "completionKey" TEXT;

CREATE UNIQUE INDEX "FocusSession_completionKey_key"
  ON "FocusSession"("completionKey");
