-- AlterTable
ALTER TABLE "StudyRoom" ADD COLUMN     "inviteCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StudyRoom_inviteCode_key" ON "StudyRoom"("inviteCode");
