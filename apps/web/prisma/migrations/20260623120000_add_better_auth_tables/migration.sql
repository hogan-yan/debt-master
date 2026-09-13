-- CreateTable
CREATE TABLE "better_auth_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "better_auth_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "better_auth_sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "better_auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "better_auth_accounts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "better_auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "better_auth_verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "better_auth_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "better_auth_users_email_key" ON "better_auth_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "better_auth_sessions_token_key" ON "better_auth_sessions"("token");

-- CreateIndex
CREATE INDEX "better_auth_sessions_user_id_idx" ON "better_auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "better_auth_accounts_user_id_idx" ON "better_auth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "better_auth_accounts_provider_id_account_id_key" ON "better_auth_accounts"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "better_auth_verifications_identifier_idx" ON "better_auth_verifications"("identifier");

-- AddForeignKey
ALTER TABLE "better_auth_sessions" ADD CONSTRAINT "better_auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "better_auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "better_auth_accounts" ADD CONSTRAINT "better_auth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "better_auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
