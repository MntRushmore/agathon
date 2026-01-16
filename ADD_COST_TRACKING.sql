-- ============================================
-- ADD REAL COST TRACKING TO AI USAGE
-- ============================================
-- This adds proper cost tracking so admin dashboard shows real $ spent

-- ============================================
-- STEP 1: Add cost columns to ai_usage table
-- ============================================

-- Add actual cost tracking columns
ALTER TABLE ai_usage
ADD COLUMN IF NOT EXISTS input_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10, 6) DEFAULT 0.00;

-- Add model information
ALTER TABLE ai_usage
ADD COLUMN IF NOT EXISTS model_used TEXT;

-- ============================================
-- STEP 2: Create a view for total costs
-- ============================================

CREATE OR REPLACE VIEW ai_cost_summary AS
SELECT
  COUNT(*) as total_interactions,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_cost) as total_cost_usd,
  COUNT(DISTINCT student_id) as unique_users,
  DATE_TRUNC('day', created_at) as date
FROM ai_usage
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- ============================================
-- STEP 3: Show current summary
-- ============================================

SELECT
  COUNT(*) as total_ai_interactions,
  SUM(total_cost) as total_spent_usd,
  AVG(total_cost) as avg_cost_per_interaction,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens
FROM ai_usage;

-- ============================================
-- STEP 4: Backfill existing data with estimates
-- ============================================

-- For existing records without costs, use rough estimates
-- OpenRouter typical costs: ~$0.002-0.005 per interaction
UPDATE ai_usage
SET
  total_cost = 0.003,
  input_tokens = 500,
  output_tokens = 300,
  model_used = 'unknown'
WHERE total_cost = 0 OR total_cost IS NULL;

-- ============================================
-- STEP 5: Show updated summary
-- ============================================

SELECT '=== UPDATED COST SUMMARY ===' as section;

SELECT
  COUNT(*) as total_interactions,
  ROUND(SUM(total_cost)::numeric, 2) as total_cost_usd,
  ROUND(AVG(total_cost)::numeric, 4) as avg_cost_per_call,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens
FROM ai_usage;

-- Show by mode
SELECT
  mode,
  COUNT(*) as interactions,
  ROUND(SUM(total_cost)::numeric, 2) as cost_usd
FROM ai_usage
GROUP BY mode
ORDER BY cost_usd DESC;

-- ============================================
-- COMPLETION
-- ============================================

SELECT '✅ Cost tracking added to ai_usage table!' as status;
SELECT 'Update your API routes to pass actual costs from OpenRouter' as next_step;
