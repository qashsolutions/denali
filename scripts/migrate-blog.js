#!/usr/bin/env node
// Blog posts migration: ALTER TABLE + seed 10 posts
// Run inside ECS container: node /tmp/migrate-blog.js

const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
  ssl: { rejectUnauthorized: false },
});

const ALTER_SQL = `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'`;

const SEED_SQL = `INSERT INTO blog_posts (slug, title, kicker, key_message, body, category, cta_text, cta_url, sources, meta_title, meta_description, published, published_at) VALUES

('what-does-co50-mean',
 'What Does Medicare Denial Code CO-50 Mean?',
 'The most common Medicare denial — and it''s often overturned.',
 'CO-50 means Medicare says your service wasn''t medically necessary. With the right documentation from your doctor, most CO-50 denials can be appealed successfully within 120 days.',
 'David got a letter saying his back MRI was denied. The code at the top — CO-50 — means Medicare decided the scan wasn''t medically necessary. This is the most common Medicare denial, affecting roughly 1 in 3 claims. But here''s what David didn''t know: CO-50 denials are often overturned. The key is showing Medicare why your doctor ordered the test. That usually means a letter describing your symptoms, how long you''ve had them, and what treatments you''ve already tried. You have 120 days from the denial date to file a Level 1 appeal. Most patients who appeal with strong documentation win.',
 'denial-codes',
 'Appeal your CO-50 denial with Denali',
 '/chat',
 ARRAY['CMS.gov — Medicare Claims Processing Manual Ch. 1', 'OIG Report: Medicare Denial Rates 2023', 'CMS Remittance Advice Remark Codes, effective 2025-12-10'],
 'What Does Medicare Denial Code CO-50 Mean?',
 'CO-50 is the most common Medicare denial — not medically necessary. Learn what it means, how to appeal, and what documentation you need to win.',
 true, NOW()),

('what-does-co16-mean',
 'Got a CO-16 Medicare Denial? It''s Usually a Paperwork Fix.',
 'A billing error doesn''t mean you owe the money — it means someone needs to fix a form.',
 'CO-16 means your claim is missing information or has a billing error. In most cases, your doctor''s billing office can correct and resubmit at no cost to you.',
 'Linda opened her Medicare Summary Notice and found a charge denied with code CO-16. She panicked — until she called her doctor''s billing office. CO-16 means the claim is missing something: a date, a diagnosis code, or a required modifier. It''s rarely the patient''s fault, and it''s almost always fixable. The billing office can correct the error and resubmit — usually at no cost to you. Don''t pay the bill while the corrected claim is pending. If the resubmission is denied again, you have the right to appeal. Keep a record of every call you make.',
 'denial-codes',
 'Ask Denali about your denial',
 '/chat',
 ARRAY['CMS.gov — Remittance Advice Reason Codes', 'CMS Claims Processing Manual Chapter 1, Section 80', 'Medicare Learning Network: Claim Submission Errors'],
 'CO-16 Medicare Denial: What It Means and How to Fix It',
 'CO-16 means a billing or submission error on your Medicare claim. Learn how to get it corrected and resubmitted — usually without paying a cent.',
 true, NOW()),

('what-does-co97-mean',
 'Medicare Denied With CO-97? You Probably Don''t Owe Anything.',
 'CO-97 means the service was already paid for as part of another claim.',
 'CO-97 means Medicare considers this service bundled into a payment it already made. Your provider cannot bill you for a CO-97 denial.',
 'When Robert saw CO-97 on his Medicare Explanation of Benefits, he assumed he owed money. He didn''t. CO-97 means Medicare already paid for that service as part of a bundled payment for something else — like an office visit or a surgical procedure. Think of it as Medicare saying "we already covered that." Your provider is not allowed to bill you separately for a service denied with CO-97. If you receive a bill, show the provider the denial code. Ask them to check the bundling rules. If they insist you owe the money, file a complaint with your Medicare Administrative Contractor.',
 'denial-codes',
 'Check your rights with Denali',
 '/chat',
 ARRAY['CMS.gov — National Correct Coding Initiative (NCCI)', 'CMS Transmittal 2020: Bundled Payment Rules', 'Medicare Benefit Policy Manual Ch. 15'],
 'CO-97 Medicare Denial: What It Means (And Why You May Owe Nothing)',
 'CO-97 means Medicare bundled payment already covers this service. Learn why you likely don''t owe anything and what to do if your provider bills you.',
 true, NOW()),

('does-medicare-cover-cgm',
 'Does Medicare Cover Continuous Glucose Monitors (CGMs)?',
 'Yes — Medicare covers CGMs like Dexcom and FreeStyle Libre under Part B.',
 'Medicare Part B covers continuous glucose monitors as durable medical equipment for eligible diabetes patients. You pay 20% after your Part B deductible. Your doctor must document the medical necessity.',
 'Susan''s doctor recommended a continuous glucose monitor to manage her Type 2 diabetes. She assumed Medicare wouldn''t pay. It does. Since 2023, Medicare Part B covers CGMs — including the Dexcom G7 and FreeStyle Libre 3 — as durable medical equipment. You typically pay 20% of the Medicare-approved amount after your Part B deductible. To qualify, your doctor must document that you have diabetes and require monitoring. Ask your doctor to write a detailed order that includes your diagnosis code, monitoring frequency, and why a CGM is medically necessary. The DME supplier will handle the Medicare paperwork from there.',
 'coverage',
 'Check your CGM coverage on Denali',
 '/chat',
 ARRAY['CMS.gov — LCD L33822: Blood Glucose Monitors', 'CMS Final Rule 2023: CGM Coverage Expansion', 'Medicare Benefit Policy Manual Ch. 11: DME'],
 'Does Medicare Cover Continuous Glucose Monitors (CGMs)?',
 'Medicare Part B covers CGMs like Dexcom G7 and FreeStyle Libre under DME. Learn the eligibility requirements and what your doctor needs to document.',
 true, NOW()),

('does-medicare-cover-physical-therapy',
 'Does Medicare Cover Physical Therapy?',
 'Yes — Medicare Part B covers physical therapy when your doctor certifies it''s medically necessary.',
 'Medicare covers physical therapy with no hard visit cap, but your therapist must document progress. If denied for ''plateau,'' you can appeal — a 2013 court settlement confirmed Medicare cannot deny care solely because you''re not improving.',
 'After her hip replacement, Joan needed physical therapy to walk again. She worried Medicare would only pay for a few sessions. Medicare Part B covers medically necessary physical therapy — and there is no arbitrary visit limit. Your doctor must certify the need, and your therapist must document your progress at every session. If Medicare denies a claim saying you''ve "plateaued," you can appeal. The Jimmo v. Sebelius settlement confirmed that Medicare cannot deny coverage solely because a patient isn''t improving — maintenance therapy to prevent decline is covered too. Keep records of every session and your functional goals.',
 'coverage',
 'Check your therapy coverage on Denali',
 '/chat',
 ARRAY['CMS.gov — Medicare Benefit Policy Manual Ch. 15', 'Jimmo v. Sebelius Settlement Agreement (2013)', 'LCD L33903: Physical Therapy'],
 'Does Medicare Cover Physical Therapy? What Patients Need to Know',
 'Medicare Part B covers physical therapy with no hard visit cap. Learn the documentation requirements and your rights if Medicare denies your claim.',
 true, NOW()),

('does-medicare-cover-mental-health',
 'Does Medicare Cover Mental Health Care?',
 'Yes — Medicare covers therapy and psychiatry visits at the same rate as physical health care.',
 'Medicare Part B covers outpatient mental health services — including therapy, counseling, and psychiatry — at 20% after your deductible, the same cost-sharing as medical visits.',
 'After her husband passed away, Carol''s doctor suggested she see a therapist. She assumed Medicare wouldn''t pay for it. It does. Medicare Part B covers outpatient therapy with psychiatrists, psychologists, and licensed clinical social workers. You pay 20% after your Part B deductible — the same as a regular doctor visit. Medicare Advantage plans must cover mental health at the same cost-sharing as physical health. One important step: before your first appointment, ask "Do you accept Medicare assignment?" Providers who don''t can charge you more than the Medicare rate. Telehealth mental health visits are also covered under Medicare.',
 'coverage',
 'Check your mental health coverage on Denali',
 '/chat',
 ARRAY['CMS.gov — Medicare Mental Health Coverage', 'Mental Health Parity and Addiction Equity Act (MHPAEA)', 'Medicare Benefit Policy Manual Ch. 6'],
 'Does Medicare Cover Mental Health Care and Therapy?',
 'Medicare Part B covers therapy, counseling, and psychiatry at 20% after your deductible. Learn which providers are covered and how to avoid surprise bills.',
 true, NOW()),

('how-to-appeal-medicare-denial',
 'How to Appeal a Medicare Denial: Your 5-Step Guide',
 'You have a legal right to appeal — and most patients who appeal with documentation win.',
 'Medicare denials are not final. You have 120 days to file a Level 1 appeal (Redetermination). The most important step: get a letter of medical necessity from your doctor before you submit.',
 'When Patricia got her denial letter, she almost gave up. She didn''t know she had a right to appeal — or that the odds were in her favor. Here''s how it works: First, read the denial letter — it states the exact reason. Second, call your doctor and ask for a letter of medical necessity explaining why the service was right for you specifically. Third, complete a Redetermination Request (CMS-20027). Fourth, attach the doctor''s letter and any supporting medical records. Fifth, mail or fax everything to your Medicare Administrative Contractor — the address is on the denial letter. You have 120 days from the denial date.',
 'appeals',
 'Generate your appeal letter with Denali',
 '/chat',
 ARRAY['CMS.gov — Medicare Appeals Process', 'CMS Form CMS-20027: Redetermination Request', 'Medicare & You Handbook 2025: Chapter 9'],
 'How to Appeal a Medicare Denial: 5 Steps That Work',
 'Learn how to appeal a Medicare denial in 5 steps. You have 120 days to file and a strong doctor''s letter is your most powerful tool.',
 true, NOW()),

('what-are-my-chances-winning-medicare-appeal',
 'What Are the Odds of Winning a Medicare Appeal?',
 'At the first appeal level, about 40% of denials are overturned — and the odds improve with a strong doctor''s letter.',
 'Medicare appeals succeed most often when your doctor submits a letter specific to your case — explaining your symptoms, history, and why the service was necessary for you. Generic appeals lose. Personalized ones win.',
 'James assumed his Medicare denial was final. He was wrong — and the statistics were on his side. At the first appeal level (Redetermination), roughly 40% of Medicare denials are overturned. At the second level (Reconsideration), the rate climbs higher for patients with strong documentation. The single most important factor is what your doctor writes. A letter that references your specific symptoms, your history of failed treatments, and why this particular service was medically necessary for you carries far more weight than a generic form. Vague appeals lose. Specific, well-documented ones win — often within 60 days.',
 'appeals',
 'Build your appeal with Denali',
 '/chat',
 ARRAY['OIG Report OEI-02-17-00540: Medicare Advantage Appeal Outcomes', 'CMS Medicare Fee-for-Service Appeals Data 2023', 'KFF Analysis: Medicare Denial and Appeal Rates'],
 'What Are Your Chances of Winning a Medicare Appeal?',
 'About 40% of Medicare denials are overturned at the first appeal level. Learn what makes an appeal succeed and how to build a winning case.',
 true, NOW()),

('what-is-prior-authorization-medicare',
 'What Is Prior Authorization in Medicare?',
 'Prior authorization means your plan must approve a service before you receive it. Original Medicare rarely requires it — but Medicare Advantage plans use it frequently.',
 'Prior authorization (PA) means getting your insurer''s approval before a procedure, scan, or specialist visit. Without it, your plan can deny the entire claim and leave you with the full bill.',
 'George''s doctor ordered an MRI. The scheduler said he''d need "prior authorization" first. George had no idea what that meant. Prior authorization means your insurer must approve the service before you receive it. Original Medicare (Parts A and B) rarely requires PA — but Medicare Advantage plans use it for many services including imaging, surgeries, and specialist visits. If PA is required and you skip it, your plan can deny the entire claim. Always ask your doctor''s office before any major procedure: "Does my plan require prior authorization for this?" If they''re unsure, call the Member Services number on your insurance card.',
 'prior-auth',
 'Check prior auth requirements with Denali',
 '/chat',
 ARRAY['CMS.gov — Prior Authorization for Certain Hospital Outpatient Services', 'CMS Medicare Advantage Prior Authorization Model 2024', 'Senate Finance Committee Report: Medicare Advantage Prior Auth 2022'],
 'What Is Prior Authorization in Medicare? A Plain-English Guide',
 'Prior authorization means getting insurer approval before a service. Learn when Medicare requires it, how to get it, and what to do if it''s denied.',
 true, NOW()),

('medicare-advantage-prior-auth-what-to-know',
 'Medicare Advantage Prior Authorization: What Every Patient Should Know',
 'Medicare Advantage plans can require prior auth for services Original Medicare covers freely — and denials are common but often reversible.',
 'If your Medicare Advantage plan denies prior authorization, ask for a peer-to-peer review between your doctor and the plan''s medical director. This single step overturns many denials before a formal appeal.',
 'Helen switched to Medicare Advantage to save on premiums. Then her plan denied her knee replacement — she hadn''t gotten prior authorization. A 2022 Senate investigation found that 13% of Medicare Advantage prior auth denials were for care that met Medicare''s own coverage rules. If your plan denies PA: first, ask for a "peer-to-peer review" — a call between your doctor and the plan''s medical director. Many denials flip at this stage. If it''s still denied, you have 60 days to appeal. Request an expedited appeal if the delay would seriously harm your health — the plan must decide within 72 hours.',
 'prior-auth',
 'Fight your prior auth denial with Denali',
 '/chat',
 ARRAY['Senate Finance Committee: Improving Seniors'' Timely Access to Care Act 2022', 'CMS Medicare Advantage RADV Audit Findings 2023', 'OIG Report OEI-09-18-00260: Medicare Advantage Prior Auth Denials'],
 'Medicare Advantage Prior Authorization: Denials, Appeals, and Your Rights',
 'Medicare Advantage prior auth denials are common but reversible. Learn how to request a peer-to-peer review and what to do if your plan still says no.',
 true, NOW())

ON CONFLICT (slug) DO NOTHING`;

async function run() {
  try {
    await client.connect();
    console.log('Connected to RDS');

    // Task 1: ALTER TABLE
    console.log('\n--- Task 1: ALTER TABLE (add tags column) ---');
    const alterResult = await client.query(ALTER_SQL);
    console.log('Result:', alterResult.command);

    // Task 2: Seed blog posts
    console.log('\n--- Task 2: Seed blog posts ---');
    const seedResult = await client.query(SEED_SQL);
    console.log('Result:', seedResult.command, '— Rows:', seedResult.rowCount);

    // Verify
    console.log('\n--- Verification ---');
    const count = await client.query('SELECT COUNT(*) as total FROM blog_posts');
    console.log('Total blog posts:', count.rows[0].total);

    const cols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'blog_posts' AND column_name = 'tags'
    `);
    console.log('Tags column exists:', cols.rows.length > 0);
    if (cols.rows.length > 0) console.log('Tags column type:', cols.rows[0].data_type);

    const posts = await client.query('SELECT slug, category FROM blog_posts ORDER BY category, slug');
    console.log('\nBlog posts by category:');
    posts.rows.forEach(r => console.log(`  [${r.category}] ${r.slug}`));

    console.log('\n✅ Migration complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
