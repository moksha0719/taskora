CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ADMIN');
CREATE TYPE "RoomMode" AS ENUM ('FOCUS', 'BREAK');

ALTER TABLE "User"
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
  ADD COLUMN "avatar" TEXT,
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "major" TEXT;

CREATE TABLE "Habit" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(1000),
  "category" VARCHAR(64) NOT NULL,
  "color" VARCHAR(7) NOT NULL,
  "iconName" VARCHAR(64) NOT NULL,
  "frequency" VARCHAR(16) NOT NULL,
  "reminderTime" VARCHAR(5),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HabitCheckIn" (
  "id" UUID NOT NULL,
  "habitId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "date" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HabitCheckIn_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HabitCheckIn_habitId_date_key" ON "HabitCheckIn"("habitId", "date");

CREATE TABLE "StudyNote" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "subjectId" TEXT,
  "subjectName" TEXT,
  "title" VARCHAR(160) NOT NULL,
  "content" VARCHAR(20000) NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isPrivate" BOOLEAN NOT NULL DEFAULT true,
  "shareCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyNote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudyNote_shareCode_key" ON "StudyNote"("shareCode");

CREATE TABLE "FocusSession" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "subject" VARCHAR(120) NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "notes" VARCHAR(2000),
  "xpEarned" INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FocusSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudyRoom" (
  "id" UUID NOT NULL,
  "ownerId" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "topic" VARCHAR(160) NOT NULL,
  "isPrivate" BOOLEAN NOT NULL DEFAULT false,
  "passcodeHash" TEXT,
  "maxParticipants" INTEGER NOT NULL DEFAULT 8,
  "focusDurationMinutes" INTEGER NOT NULL DEFAULT 25,
  "breakDurationMinutes" INTEGER NOT NULL DEFAULT 5,
  "currentMode" "RoomMode" NOT NULL DEFAULT 'FOCUS',
  "timerRemainingSeconds" INTEGER NOT NULL DEFAULT 1500,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomParticipant" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomParticipant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RoomParticipant_roomId_userId_key" ON "RoomParticipant"("roomId", "userId");

CREATE TABLE "RoomMessage" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "content" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "XPTransaction" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" VARCHAR(200) NOT NULL,
  "source" VARCHAR(32) NOT NULL,
  "dedupeKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "XPTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "XPTransaction_dedupeKey_key" ON "XPTransaction"("dedupeKey");

CREATE TABLE "Achievement" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "category" VARCHAR(32) NOT NULL,
  "icon" VARCHAR(64) NOT NULL,
  "xpReward" INTEGER NOT NULL,
  "requirement" INTEGER NOT NULL,
  CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");

CREATE TABLE "UserAchievement" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "achievementId" UUID NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "unlockedAt" TIMESTAMP(3),
  CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

CREATE INDEX "Habit_userId_createdAt_idx" ON "Habit"("userId", "createdAt");
CREATE INDEX "HabitCheckIn_userId_date_idx" ON "HabitCheckIn"("userId", "date");
CREATE INDEX "StudyNote_userId_updatedAt_idx" ON "StudyNote"("userId", "updatedAt");
CREATE INDEX "FocusSession_userId_completedAt_idx" ON "FocusSession"("userId", "completedAt");
CREATE INDEX "StudyRoom_ownerId_createdAt_idx" ON "StudyRoom"("ownerId", "createdAt");
CREATE INDEX "RoomMessage_roomId_createdAt_idx" ON "RoomMessage"("roomId", "createdAt");
CREATE INDEX "XPTransaction_userId_createdAt_idx" ON "XPTransaction"("userId", "createdAt");

ALTER TABLE "Habit" ADD CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HabitCheckIn" ADD CONSTRAINT "HabitCheckIn_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HabitCheckIn" ADD CONSTRAINT "HabitCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudyNote" ADD CONSTRAINT "StudyNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FocusSession" ADD CONSTRAINT "FocusSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudyRoom" ADD CONSTRAINT "StudyRoom_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomParticipant" ADD CONSTRAINT "RoomParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "StudyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomParticipant" ADD CONSTRAINT "RoomParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "StudyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "XPTransaction" ADD CONSTRAINT "XPTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PasswordResetToken" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

CREATE TYPE "ModerationTargetType" AS ENUM ('NOTE', 'ROOM_MESSAGE', 'USER');
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

CREATE TABLE "ModerationReport" (
  "id" UUID NOT NULL,
  "reporterId" UUID NOT NULL,
  "targetType" "ModerationTargetType" NOT NULL,
  "targetId" UUID NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "contentSnippet" VARCHAR(2000) NOT NULL,
  "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
  "resolvedById" UUID,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ModerationReport_status_createdAt_idx" ON "ModerationReport"("status", "createdAt");
CREATE INDEX "ModerationReport_reporterId_createdAt_idx" ON "ModerationReport"("reporterId", "createdAt");

CREATE TABLE "AuditLog" (
  "id" UUID NOT NULL,
  "actorId" UUID,
  "action" VARCHAR(120) NOT NULL,
  "target" VARCHAR(200) NOT NULL,
  "ipAddress" VARCHAR(64),
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationReport" ADD CONSTRAINT "ModerationReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationReport" ADD CONSTRAINT "ModerationReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudyRoom"
  ADD CONSTRAINT "StudyRoom_capacity_check" CHECK ("maxParticipants" BETWEEN 2 AND 100),
  ADD CONSTRAINT "StudyRoom_focus_duration_check" CHECK ("focusDurationMinutes" BETWEEN 1 AND 1440),
  ADD CONSTRAINT "StudyRoom_break_duration_check" CHECK ("breakDurationMinutes" BETWEEN 1 AND 1440),
  ADD CONSTRAINT "StudyRoom_private_passcode_check"
    CHECK (("isPrivate" = false) OR ("passcodeHash" IS NOT NULL));

ALTER TABLE "XPTransaction"
  ADD CONSTRAINT "XPTransaction_amount_check" CHECK ("amount" > 0);

ALTER TABLE "UserAchievement"
  ADD CONSTRAINT "UserAchievement_progress_check" CHECK ("progress" >= 0);

INSERT INTO "Achievement" ("id","key","title","description","category","icon","xpReward","requirement")
VALUES
  (gen_random_uuid(),'first_focus','First Focus','Complete your first focus session','focus','Clock',50,1),
  (gen_random_uuid(),'focus_10','Focused Learner','Complete 10 focus sessions','focus','Flame',150,10),
  (gen_random_uuid(),'task_10','Task Finisher','Complete 10 tasks','tasks','CheckCircle',100,10),
  (gen_random_uuid(),'habit_7','Habit Builder','Complete a 7-day habit streak','habits','Trophy',120,7),
  (gen_random_uuid(),'room_participant','Social Scholar','Join a study room','social','Users',50,1)
ON CONFLICT ("key") DO NOTHING;
