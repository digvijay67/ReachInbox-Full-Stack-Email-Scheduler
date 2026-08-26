/*
  Warnings:

  - The `status` column on the `Email` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[jobId]` on the table `Email` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `senderId` to the `Email` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'SENT', 'FAILED');

-- DropForeignKey
ALTER TABLE "Email" DROP CONSTRAINT "Email_userId_fkey";

-- DropIndex
DROP INDEX "Email_userId_idx";

-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "senderId" INTEGER NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "EmailStatus" NOT NULL DEFAULT 'SCHEDULED';

-- CreateTable
CREATE TABLE "Sender" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "etherealUser" TEXT NOT NULL,
    "etherealPassword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sender_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sender_userId_idx" ON "Sender"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Email_jobId_key" ON "Email"("jobId");

-- CreateIndex
CREATE INDEX "Email_userId_status_idx" ON "Email"("userId", "status");

-- AddForeignKey
ALTER TABLE "Sender" ADD CONSTRAINT "Sender_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Sender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
