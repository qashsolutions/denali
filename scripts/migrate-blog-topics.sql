-- ============================================================================
-- Migration: user_topic_preferences table + tag existing posts + seed 6 new posts
-- Converted from: scripts/migrate-blog-topics.js on 2026-04-21
-- Reason: Staging bootstrap uses uniform postgres:16-alpine +
--         S3-relay pattern; .js files aren't included in the
--         Docker image runner stage (verified 2026-04-21).
--
-- Idempotency: CREATE TABLE IF NOT EXISTS, CREATE UNIQUE INDEX IF NOT EXISTS,
--              UPDATE filtered to NULL/empty rows only, ON CONFLICT (slug) DO NOTHING
-- ============================================================================

BEGIN;

-- Statement 1a (from CREATE_TABLE_SQL): create user_topic_preferences table
CREATE TABLE IF NOT EXISTS user_topic_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL CHECK (topic IN ('diabetes', 'obesity', 'medicare-general')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Statement 1b (from CREATE_TABLE_SQL): unique index on (user_id, topic)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_topic_unique ON user_topic_preferences(user_id, topic);

-- Statement 2 (from TAG_EXISTING_SQL): tag existing posts as medicare-general
UPDATE blog_posts SET tags = ARRAY['medicare-general']
WHERE tags = '{}' OR tags IS NULL;

-- Statement 3 (from SEED_SQL): seed 6 new diabetes + obesity blog posts
INSERT INTO blog_posts (slug, title, kicker, key_message, body, category, cta_text, cta_url, sources, tags, meta_title, meta_description, published, published_at) VALUES

('does-medicare-cover-cgm',
 'Does Medicare Cover Continuous Glucose Monitors?',
 'If you have diabetes and use insulin, Medicare likely covers your CGM — but the paperwork matters.',
 'Medicare Part B covers CGMs like Dexcom and FreeStyle Libre for patients with diabetes who use insulin. Your doctor must order it, and a supplier must be Medicare-enrolled. Without the right documentation, claims get denied.',
 'Maria was tired of pricking her finger four times a day. Her doctor recommended a continuous glucose monitor — a small sensor that tracks blood sugar every five minutes. But would Medicare pay for it? The answer is yes, with conditions. Medicare Part B covers CGMs as durable medical equipment under the "therapeutic CGM" benefit. To qualify, you must have diabetes (Type 1 or Type 2), use insulin, need frequent glucose adjustments, and have your doctor write an order documenting why the CGM is medically necessary. The most common denial? Missing the insulin requirement or the doctor''s order lacking detail. The device must come from a Medicare-enrolled DME supplier — buying one from a pharmacy or online retailer without proper enrollment leads to automatic denial. National Coverage Determination 40.1 covers diabetes self-management broadly, and the CGM benefit falls under the DME benefit category. If denied, you have 120 days to appeal with your doctor''s detailed order.',
 'coverage',
 'Check your CGM coverage with Denali',
 '/app/chat',
 ARRAY['CMS NCD 40.1 — Diabetes Self-Management Training', 'CMS LCD L33822 — Glucose Monitors', 'Medicare.gov — Diabetes supplies and services'],
 ARRAY['diabetes', 'coverage'],
 'Does Medicare Cover Continuous Glucose Monitors (CGM)?',
 'Medicare Part B covers CGMs like Dexcom and FreeStyle Libre for insulin-using diabetics. Learn the requirements and how to avoid denials.',
 true, NOW()),

('medicare-diabetes-prevention-program',
 'The Medicare Diabetes Prevention Program: Free Coverage You Might Not Know About',
 'If you''re pre-diabetic, Medicare covers a year-long coaching program at no cost to you.',
 'The Medicare Diabetes Prevention Program (MDPP) is a free benefit for Medicare patients with pre-diabetes. It includes a year of group coaching on nutrition, exercise, and weight loss — fully covered, no copay.',
 'Robert''s doctor told him his blood sugar was "borderline." Not quite diabetes, but heading that way. What Robert didn''t know: Medicare covers a structured program specifically designed to prevent pre-diabetes from becoming Type 2 diabetes. The Medicare Diabetes Prevention Program (MDPP) offers up to 26 group coaching sessions in the first year, covering nutrition, physical activity, and behavior change. It''s led by a trained lifestyle coach and there''s no cost to you — no copay, no deductible. To qualify, you need a recent blood test showing pre-diabetes (an A1C between 5.7% and 6.4%, or a fasting glucose between 110-125 mg/dL), a BMI of 25 or higher (23 if Asian American), and no previous Type 1 or Type 2 diabetes diagnosis. The program is covered under Medicare Part B. The biggest barrier? Most eligible patients don''t know the program exists. Ask your doctor if you qualify, or search for MDPP suppliers at Medicare.gov.',
 'coverage',
 'Ask Denali about diabetes prevention coverage',
 '/app/chat',
 ARRAY['CMS.gov — Medicare Diabetes Prevention Program', 'CDC — National Diabetes Prevention Program', 'CMS NCD 40.1 — Diabetes Outpatient Self-Management Training'],
 ARRAY['diabetes', 'coverage'],
 'Medicare Diabetes Prevention Program (MDPP) — Free Coaching Benefit',
 'Medicare covers a free year-long diabetes prevention coaching program for pre-diabetic patients. Learn who qualifies and how to enroll.',
 true, NOW()),

('diabetes-screening-schedule-medicare',
 'Your Medicare Diabetes Screening Schedule: What''s Covered and When',
 'Medicare covers regular diabetes screenings — but timing and frequency rules can trip you up.',
 'Medicare covers A1C tests, glucose screenings, eye exams, and kidney tests for diabetes patients on a schedule. Missing a screening or getting one too early can result in a denial. Here''s your timeline.',
 'Diabetes care isn''t just about medication — it''s about staying ahead of complications. Medicare knows this, which is why it covers several preventive screenings for people with diabetes or at risk for it. But each screening has its own frequency rules, and getting one too early means you pay out of pocket. Here''s what''s covered: A1C tests are covered every 3 months if your doctor says your diabetes treatment changed, or twice a year for stable patients. Fasting glucose screening is covered once a year if you have risk factors (obesity, family history, hypertension). Diabetic eye exams are covered once every 12 months for patients with diabetes — and this is critical, because diabetic retinopathy often has no symptoms until it''s advanced. Kidney function tests (eGFR, urine albumin) are covered annually. Diabetes self-management training (DSMT) is covered when first diagnosed or when treatment changes significantly. Foot exams are covered every 6 months for patients with diabetic nerve damage. The most common denial? Getting a screening before the coverage interval resets. Keep track of your dates, and ask your doctor to note the medical necessity in your chart.',
 'coverage',
 'Check your screening schedule with Denali',
 '/app/chat',
 ARRAY['CMS NCD 40.1 — Diabetes Self-Management Training', 'Medicare.gov — Preventive services', 'CMS LCD L33369 — Therapeutic Shoes for Diabetes'],
 ARRAY['diabetes'],
 'Medicare Diabetes Screening Schedule — What''s Covered and When',
 'Medicare covers A1C, eye exams, kidney tests, and more for diabetics. Learn the frequency rules to avoid denials.',
 true, NOW()),

('does-medicare-cover-weight-loss-surgery',
 'Does Medicare Cover Weight Loss Surgery?',
 'Medicare covers bariatric surgery — but only if you meet strict BMI and health criteria.',
 'Medicare Part A covers gastric bypass, sleeve gastrectomy, and other bariatric surgeries for patients with a BMI of 35+ and at least one related health condition. The approval process requires documentation of failed non-surgical treatment.',
 'James weighed 310 pounds and his knees were giving out. His doctor recommended weight loss surgery, but James assumed Medicare wouldn''t cover it. He was wrong. Medicare Part A covers several bariatric procedures: Roux-en-Y gastric bypass, laparoscopic sleeve gastrectomy, and biliopancreatic diversion with duodenal switch. To qualify, you need a BMI of 35 or higher, at least one obesity-related condition (Type 2 diabetes, heart disease, sleep apnea, or joint disease), and documented evidence that non-surgical weight loss methods have failed. Your surgeon must be a Medicare-enrolled provider, and the hospital must have the capacity to handle bariatric patients. National Coverage Determination 100.1 lays out the full criteria. The most common denial reasons: BMI documentation is missing or outdated, the related condition isn''t clearly linked in the medical record, or there''s no evidence of prior weight loss attempts. If you''re considering surgery, start documenting your weight loss journey now — diet programs, nutritionist visits, and exercise records all strengthen your case.',
 'coverage',
 'Check your surgery eligibility with Denali',
 '/app/chat',
 ARRAY['CMS NCD 100.1 — Bariatric Surgery for Morbid Obesity', 'CMS LCD L34576 — Laparoscopic Sleeve Gastrectomy', 'Medicare.gov — Obesity screenings and counseling'],
 ARRAY['obesity', 'coverage'],
 'Does Medicare Cover Bariatric Weight Loss Surgery?',
 'Medicare covers gastric bypass and sleeve gastrectomy for BMI 35+ patients. Learn the criteria, documentation needed, and how to avoid denials.',
 true, NOW()),

('medicare-free-obesity-counseling',
 'Medicare''s Free Obesity Counseling: A Benefit Most Patients Miss',
 'If your BMI is 30 or higher, Medicare covers free behavioral counseling — no copay, no referral needed.',
 'Medicare Part B covers intensive behavioral therapy for obesity — up to 22 face-to-face counseling visits in the first year — at zero cost. Your primary care provider delivers it, and no referral is required.',
 'Pat stepped on the scale at her doctor''s office and the number read 215. At 5''4", her BMI was over 30. Her doctor mentioned something Pat had never heard of: free obesity counseling through Medicare. It''s called Intensive Behavioral Therapy (IBT) for Obesity, and it''s covered under National Coverage Determination 210.12. Here''s what it includes: weekly face-to-face visits for the first month, biweekly visits for months 2-6, and monthly visits for months 7-12 — up to 22 visits in the first year. If you lose at least 3 kg (about 6.6 pounds) in the first 6 months, you qualify for continued monthly visits. The counseling covers dietary assessment, setting weight loss goals, and lifestyle coaching. The best part: no copay, no deductible, and no referral needed. It must be delivered by your primary care provider (or their office) in a primary care setting. The biggest barrier? Most doctors don''t mention it, and most patients don''t know to ask. If your BMI is 30 or higher, bring it up at your next visit.',
 'coverage',
 'Learn about your obesity counseling benefit',
 '/app/chat',
 ARRAY['CMS NCD 210.12 — Intensive Behavioral Therapy for Obesity', 'CMS.gov — Preventive services', 'OIG Report — Utilization of IBT for Obesity 2024'],
 ARRAY['obesity', 'coverage'],
 'Medicare Free Obesity Counseling — IBT Benefit Explained',
 'Medicare covers up to 22 free obesity counseling visits per year for BMI 30+. No copay, no referral. Learn how to access this overlooked benefit.',
 true, NOW()),

('glp1-medications-medicare-coverage',
 'GLP-1 Medications and Medicare: What You Need to Know',
 'Ozempic, Wegovy, Mounjaro — the rules are different depending on your diagnosis.',
 'Medicare covers GLP-1 medications like Ozempic and Mounjaro for Type 2 diabetes under Part D. But coverage for weight loss alone (like Wegovy) is still evolving. Your diagnosis determines everything.',
 'Sandra saw the ads for Wegovy and asked her doctor about it. She has a BMI of 34 but no diabetes diagnosis. Her doctor warned her: Medicare coverage for GLP-1 medications depends entirely on the reason it''s prescribed. For Type 2 diabetes: Medicare Part D covers semaglutide (Ozempic), tirzepatide (Mounjaro), dulaglutide (Trulicity), and liraglutide (Victoza) when prescribed for blood sugar management. These are well-established on most Part D formularies. For weight loss without diabetes: this is where it gets complicated. Medicare historically excluded weight loss drugs from Part D coverage. However, recent legislation (the Treat and Reduce Obesity Act has been proposed multiple times) and CMS guidance are evolving. As of early 2026, some Part D plans may cover anti-obesity medications under specific conditions, but it varies by plan. The FDA-approved weight loss indication (Wegovy for semaglutide, Zepbound for tirzepatide) is separate from the diabetes indication. If you have both obesity and diabetes, your doctor should code the prescription for the diabetes indication — this significantly increases the chance of Part D coverage. Always check your specific Part D plan''s formulary, and ask your doctor to include the clinical rationale in the prescription. Prior authorization is almost always required for GLP-1 medications.',
 'coverage',
 'Check your GLP-1 coverage with Denali',
 '/app/chat',
 ARRAY['CMS Part D Formulary Guidance 2026', 'FDA — Approved GLP-1 Receptor Agonists', 'American Journal of Managed Care — GLP-1 Prescribing Trends 2025'],
 ARRAY['obesity', 'diabetes', 'coverage'],
 'GLP-1 Medications (Ozempic, Wegovy, Mounjaro) and Medicare Coverage',
 'Medicare Part D covers GLP-1s for diabetes but weight loss coverage varies. Learn the rules for Ozempic, Wegovy, Mounjaro and how your diagnosis affects coverage.',
 true, NOW())

ON CONFLICT (slug) DO NOTHING;

COMMIT;

-- ============================================================================
-- Verification queries (read-only, run after COMMIT)
-- Mirror the post-migration probes in the original JS file.
-- ============================================================================

-- Statement 4: total blog post count
SELECT COUNT(*) as total FROM blog_posts;

-- Statement 5: confirm user_topic_preferences table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'user_topic_preferences'
) as exists;

-- Statement 6: posts grouped by tag
SELECT unnest(tags) as tag, COUNT(*) as count
FROM blog_posts
GROUP BY tag
ORDER BY count DESC;

-- Statement 7: list diabetes/obesity posts
SELECT slug, title, tags FROM blog_posts
WHERE 'diabetes' = ANY(tags) OR 'obesity' = ANY(tags)
ORDER BY slug;
