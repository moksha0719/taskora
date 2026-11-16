-- CreateEnum
CREATE TYPE "StudyPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StudyDayOfWeek" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- CreateEnum
CREATE TYPE "ScheduleItemKind" AS ENUM ('STUDY', 'REVIEW');

-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "activeUserId" UUID,
    "title" TEXT NOT NULL,
    "status" "StudyPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "timeZone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Colombo',
    "weeklyTargetMinutes" INTEGER NOT NULL,
    "studyDaysPerWeek" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySubject" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "targetMinutesPerWeek" INTEGER NOT NULL,

    CONSTRAINT "StudySubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleItem" (
    "id" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "dayOfWeek" "StudyDayOfWeek" NOT NULL,
    "startMinuteOfDay" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "kind" "ScheduleItemKind" NOT NULL DEFAULT 'STUDY',
    "topics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "ScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionCompletion" (
    "id" UUID NOT NULL,
    "scheduleItemId" UUID NOT NULL,
    "occurrenceDate" DATE NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualDurationMinutes" INTEGER,

    CONSTRAINT "SessionCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudyPlan_activeUserId_key" ON "StudyPlan"("activeUserId");

-- CreateIndex
CREATE INDEX "StudyPlan_userId_status_idx" ON "StudyPlan"("userId", "status");

-- CreateIndex
CREATE INDEX "StudySubject_planId_idx" ON "StudySubject"("planId");

-- CreateIndex
CREATE INDEX "ScheduleItem_subjectId_dayOfWeek_idx" ON "ScheduleItem"("subjectId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "SessionCompletion_occurrenceDate_idx" ON "SessionCompletion"("occurrenceDate");

-- CreateIndex
CREATE UNIQUE INDEX "SessionCompletion_scheduleItemId_occurrenceDate_key" ON "SessionCompletion"("scheduleItemId", "occurrenceDate");

-- AddCheckConstraint
ALTER TABLE "StudyPlan"
    ADD CONSTRAINT "StudyPlan_activeUserId_check"
    CHECK (
        ("status" = 'ACTIVE' AND "activeUserId" IS NOT NULL AND "activeUserId" = "userId")
        OR ("status" <> 'ACTIVE' AND "activeUserId" IS NULL)
    ),
    ADD CONSTRAINT "StudyPlan_date_range_check"
    CHECK ("startDate" <= "endDate"),
    ADD CONSTRAINT "StudyPlan_weekly_target_check"
    CHECK ("weeklyTargetMinutes" BETWEEN 600 AND 2400),
    ADD CONSTRAINT "StudyPlan_study_days_check"
    CHECK ("studyDaysPerWeek" IN (4, 5, 6));

-- AddCheckConstraint
ALTER TABLE "StudySubject"
    ADD CONSTRAINT "StudySubject_target_minutes_check"
    CHECK ("targetMinutesPerWeek" > 0);

-- AddCheckConstraint
ALTER TABLE "ScheduleItem"
    ADD CONSTRAINT "ScheduleItem_duration_check"
    CHECK (
        "startMinuteOfDay" BETWEEN 0 AND 1439
        AND "durationMinutes" BETWEEN 1 AND 150
        AND "startMinuteOfDay" + "durationMinutes" <= 1440
    );

-- AddCheckConstraint
ALTER TABLE "SessionCompletion"
    ADD CONSTRAINT "SessionCompletion_actualDurationMinutes_check"
    CHECK ("actualDurationMinutes" IS NULL OR "actualDurationMinutes" > 0);

-- AddForeignKey
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySubject" ADD CONSTRAINT "StudySubject_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "StudySubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCompletion" ADD CONSTRAINT "SessionCompletion_scheduleItemId_fkey" FOREIGN KEY ("scheduleItemId") REFERENCES "ScheduleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
