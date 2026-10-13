-- Apps requested at public /register (stored until system owner approves).
ALTER TABLE "company_signup_requests"
  ADD COLUMN IF NOT EXISTS "requested_modules" JSONB;
