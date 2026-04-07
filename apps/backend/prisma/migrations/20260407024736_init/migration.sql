-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "eoaAddress" TEXT,
    "encryptedPrivateKey" TEXT,
    "accountAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_eoaAddress_key" ON "User"("eoaAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_encryptedPrivateKey_key" ON "User"("encryptedPrivateKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_accountAddress_key" ON "User"("accountAddress");
