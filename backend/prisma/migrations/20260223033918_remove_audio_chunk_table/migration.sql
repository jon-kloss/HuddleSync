/*
  Warnings:

  - You are about to drop the `AudioChunk` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AudioChunk" DROP CONSTRAINT "AudioChunk_session_id_fkey";

-- DropTable
DROP TABLE "AudioChunk";
