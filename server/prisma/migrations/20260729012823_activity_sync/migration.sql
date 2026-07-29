-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "bankedAp" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ActivitySync" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "stepCount" INTEGER NOT NULL,
    "clientStartedAt" TIMESTAMP(3) NOT NULL,
    "clientEndedAt" TIMESTAMP(3) NOT NULL,
    "serverReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,

    CONSTRAINT "ActivitySync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivitySync_characterId_idx" ON "ActivitySync"("characterId");

-- AddForeignKey
ALTER TABLE "ActivitySync" ADD CONSTRAINT "ActivitySync_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
