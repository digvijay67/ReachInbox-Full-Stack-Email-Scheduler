/*
  Warnings:

  - You are about to drop the column `etherealPassword` on the `Sender` table. All the data in the column will be lost.
  - You are about to drop the column `etherealUser` on the `Sender` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Sender" DROP COLUMN "etherealPassword",
DROP COLUMN "etherealUser",
ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "refreshToken" TEXT;
