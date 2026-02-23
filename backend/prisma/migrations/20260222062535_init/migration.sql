-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER', 'GUEST');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Team" (
    "team_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "owner_user_id" UUID NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("team_id")
);

-- CreateTable
CREATE TABLE "User" (
    "user_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "voice_embedding" BYTEA,
    "team_id" UUID,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "HuddleSession" (
    "session_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "started_by" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "HuddleSession_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "AudioChunk" (
    "chunk_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "sequence_num" INTEGER NOT NULL,
    "s3_key" TEXT NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudioChunk_pkey" PRIMARY KEY ("chunk_id")
);

-- CreateTable
CREATE TABLE "Transcript" (
    "transcript_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "full_text" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("transcript_id")
);

-- CreateTable
CREATE TABLE "SpeakerSegment" (
    "segment_id" UUID NOT NULL,
    "transcript_id" UUID NOT NULL,
    "speaker_label" TEXT NOT NULL,
    "user_id" UUID,
    "start_ms" INTEGER NOT NULL,
    "end_ms" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "SpeakerSegment_pkey" PRIMARY KEY ("segment_id")
);

-- CreateTable
CREATE TABLE "Summary" (
    "summary_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" JSONB NOT NULL,
    "is_final" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Summary_pkey" PRIMARY KEY ("summary_id")
);

-- CreateTable
CREATE TABLE "SpeakerSummary" (
    "speaker_summary_id" UUID NOT NULL,
    "summary_id" UUID NOT NULL,
    "user_id" UUID,
    "speaker_label" TEXT NOT NULL,
    "yesterday" TEXT NOT NULL,
    "today" TEXT NOT NULL,
    "blockers" TEXT[],
    "action_items" TEXT[],

    CONSTRAINT "SpeakerSummary_pkey" PRIMARY KEY ("speaker_summary_id")
);

-- CreateIndex
CREATE INDEX "Team_owner_user_id_idx" ON "Team"("owner_user_id");

-- CreateIndex
CREATE INDEX "Team_created_at_idx" ON "Team"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_team_id_idx" ON "User"("team_id");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_created_at_idx" ON "User"("created_at");

-- CreateIndex
CREATE INDEX "HuddleSession_team_id_idx" ON "HuddleSession"("team_id");

-- CreateIndex
CREATE INDEX "HuddleSession_started_by_idx" ON "HuddleSession"("started_by");

-- CreateIndex
CREATE INDEX "HuddleSession_started_at_idx" ON "HuddleSession"("started_at");

-- CreateIndex
CREATE INDEX "HuddleSession_status_idx" ON "HuddleSession"("status");

-- CreateIndex
CREATE INDEX "AudioChunk_session_id_idx" ON "AudioChunk"("session_id");

-- CreateIndex
CREATE INDEX "AudioChunk_session_id_sequence_num_idx" ON "AudioChunk"("session_id", "sequence_num");

-- CreateIndex
CREATE INDEX "AudioChunk_created_at_idx" ON "AudioChunk"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Transcript_session_id_key" ON "Transcript"("session_id");

-- CreateIndex
CREATE INDEX "Transcript_session_id_idx" ON "Transcript"("session_id");

-- CreateIndex
CREATE INDEX "Transcript_created_at_idx" ON "Transcript"("created_at");

-- CreateIndex
CREATE INDEX "SpeakerSegment_transcript_id_idx" ON "SpeakerSegment"("transcript_id");

-- CreateIndex
CREATE INDEX "SpeakerSegment_user_id_idx" ON "SpeakerSegment"("user_id");

-- CreateIndex
CREATE INDEX "SpeakerSegment_speaker_label_idx" ON "SpeakerSegment"("speaker_label");

-- CreateIndex
CREATE INDEX "SpeakerSegment_start_ms_end_ms_idx" ON "SpeakerSegment"("start_ms", "end_ms");

-- CreateIndex
CREATE INDEX "Summary_session_id_idx" ON "Summary"("session_id");

-- CreateIndex
CREATE INDEX "Summary_generated_at_idx" ON "Summary"("generated_at");

-- CreateIndex
CREATE INDEX "SpeakerSummary_summary_id_idx" ON "SpeakerSummary"("summary_id");

-- CreateIndex
CREATE INDEX "SpeakerSummary_user_id_idx" ON "SpeakerSummary"("user_id");

-- CreateIndex
CREATE INDEX "SpeakerSummary_speaker_label_idx" ON "SpeakerSummary"("speaker_label");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("team_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuddleSession" ADD CONSTRAINT "HuddleSession_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("team_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuddleSession" ADD CONSTRAINT "HuddleSession_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioChunk" ADD CONSTRAINT "AudioChunk_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "HuddleSession"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "HuddleSession"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakerSegment" ADD CONSTRAINT "SpeakerSegment_transcript_id_fkey" FOREIGN KEY ("transcript_id") REFERENCES "Transcript"("transcript_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakerSegment" ADD CONSTRAINT "SpeakerSegment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "HuddleSession"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakerSummary" ADD CONSTRAINT "SpeakerSummary_summary_id_fkey" FOREIGN KEY ("summary_id") REFERENCES "Summary"("summary_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakerSummary" ADD CONSTRAINT "SpeakerSummary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
