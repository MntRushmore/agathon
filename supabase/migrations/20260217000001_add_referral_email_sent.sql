-- Track whether the referral announcement email has been sent to each waitlist entry
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS referral_email_sent BOOLEAN NOT NULL DEFAULT false;

-- Mark the 6 users who already received the email (from the first batch send)
-- Run this manually if needed, or the admin route will handle deduplication going forward.
