-- Odoo-style to-do priority + optional user phone for future WhatsApp notify.
ALTER TABLE "workspace_todos" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
