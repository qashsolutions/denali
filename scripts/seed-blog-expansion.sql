-- Denali.health Blog Expansion — 30 new articles
-- Adds 8 diabetes, 9 obesity, 13 medicare-general posts
-- Run against RDS: psql $DATABASE_URL -f scripts/seed-blog-expansion.sql
-- Idempotent: ON CONFLICT (slug) DO NOTHING

INSERT INTO blog_posts (slug, title, kicker, key_message, body, category, cta_text, cta_url, sources, tags, meta_title, meta_description, published, published_at) VALUES

-- ============================================================
-- DIABETES (8 new posts)
-- ============================================================

(
  'understanding-a1c-what-numbers-mean',
  'Understanding A1C: What Your Numbers Really Mean',
  'Your A1C is a 3-month snapshot of blood sugar control — here''s how to read it.',
  'A1C measures your average blood sugar over 2-3 months. Below 5.7% is normal, 5.7-6.4% is pre-diabetes, and 6.5% or higher means diabetes. Medicare covers A1C testing, and knowing your number is the first step.',
  'Margaret''s doctor told her A1C was 6.1% and she needed to "watch it." But what does that actually mean? A1C (also called HbA1c or glycated hemoglobin) measures the percentage of your red blood cells that have sugar attached to them. Since red blood cells live about 3 months, A1C gives a picture of your average blood sugar over that time — not just one moment. Here''s what the numbers mean: Below 5.7% is considered normal. Between 5.7% and 6.4% is pre-diabetes — your blood sugar is higher than normal but not yet in the diabetes range. This is the critical window where lifestyle changes can make the biggest difference. 6.5% or higher on two separate tests means diabetes. For people already managing diabetes, the American Diabetes Association recommends keeping A1C below 7% for most adults, though your doctor may set a different target based on your age and health. Every 1% drop in A1C reduces the risk of diabetes-related complications by roughly 25-40%, according to the landmark DCCT and UKPDS studies. Medicare covers A1C tests: twice a year for stable patients, up to 4 times a year if your treatment has changed. Ask your doctor for your actual number — don''t settle for "it''s fine."',
  'coverage',
  'Track your A1C with Denali',
  '/app/chat',
  ARRAY['American Diabetes Association — Standards of Care 2026', 'CDC — All About Your A1C', 'NIDDK — The A1C Test and Diabetes'],
  ARRAY['diabetes'],
  'What Does A1C Mean? Understanding Your Diabetes Numbers',
  'A1C measures average blood sugar over 3 months. Learn what normal, pre-diabetes, and diabetes ranges are, and how Medicare covers testing.',
  true, NOW()
),

(
  'prediabetes-5-lifestyle-changes',
  '5 Lifestyle Changes That Can Reverse Pre-Diabetes',
  'Pre-diabetes affects 98 million Americans — and most don''t know they have it.',
  'The CDC''s Diabetes Prevention Program shows that losing 5-7% of body weight and getting 150 minutes of weekly activity can reduce the risk of developing Type 2 diabetes by 58%. Medicare covers the program for free.',
  'When Tom''s blood work came back with an A1C of 5.9%, his doctor said he was pre-diabetic. Tom felt blindsided — he had no symptoms. That''s exactly the problem: pre-diabetes rarely causes symptoms, which is why 80% of the 98 million Americans with it don''t know. The good news? Pre-diabetes is reversible. The CDC''s landmark Diabetes Prevention Program study proved that simple lifestyle changes are more effective than medication at preventing Type 2 diabetes. Here are the five changes that work: First, lose 5-7% of your body weight. For a 200-pound person, that''s just 10-14 pounds. This alone reduces diabetes risk by 58%. Second, walk 150 minutes per week. That''s about 22 minutes a day. It doesn''t have to be intense — brisk walking counts. Third, choose water over sugary drinks. Swapping one daily soda for water can cut 150 empty calories. Fourth, fill half your plate with vegetables at every meal. This naturally reduces calories and adds fiber, which helps control blood sugar. Fifth, get 7-8 hours of sleep. Poor sleep increases insulin resistance. Medicare covers the Diabetes Prevention Program (MDPP) for free if you have a qualifying blood test and a BMI of 25+. The program includes 26 coaching sessions in the first year. Ask your doctor for a referral.',
  'coverage',
  'Ask about the Medicare DPP program',
  '/app/chat',
  ARRAY['CDC — National Diabetes Prevention Program', 'NIDDK — Diabetes Prevention Program Outcomes Study', 'CMS — Medicare Diabetes Prevention Program'],
  ARRAY['diabetes'],
  '5 Changes That Reverse Pre-Diabetes — CDC-Backed Research',
  'Pre-diabetes affects 98 million Americans. Learn the 5 proven lifestyle changes that reduce diabetes risk by 58%, plus how Medicare covers the prevention program.',
  true, NOW()
),

(
  'diabetes-meal-planning-medicare',
  'Eating Well With Diabetes: What Medicare Covers',
  'Medicare covers nutrition counseling for diabetes — most patients never use it.',
  'Medical Nutrition Therapy (MNT) is a free Medicare benefit for people with diabetes or kidney disease. A registered dietitian creates a personalized meal plan and provides ongoing counseling — covered with no copay.',
  'Rosa was diagnosed with Type 2 diabetes and felt overwhelmed by conflicting diet advice online. Her doctor mentioned something she''d never heard of: Medical Nutrition Therapy, or MNT. It''s a Medicare Part B benefit that covers one-on-one sessions with a registered dietitian. For diabetes patients, Medicare covers 3 hours of MNT in the first year and 2 hours each year after that. The dietitian reviews your eating habits, health goals, and medications, then creates a meal plan tailored to you. No copay, no deductible — it''s covered as a preventive service. What does good diabetes meal planning look like? The American Diabetes Association recommends the "plate method": fill half your plate with non-starchy vegetables (broccoli, salad, green beans), a quarter with lean protein (chicken, fish, beans), and a quarter with carbohydrates (brown rice, whole grain bread, fruit). Watch portions, not just what you eat. Carbs affect blood sugar the most, but you don''t need to eliminate them — just choose wisely and spread them across meals. Fiber is your friend: aim for 25-30 grams daily from vegetables, beans, and whole grains. It slows sugar absorption. Your doctor must refer you to a Medicare-enrolled dietitian. Ask at your next visit.',
  'coverage',
  'Ask about nutrition therapy coverage',
  '/app/chat',
  ARRAY['CMS — Medical Nutrition Therapy (MNT)', 'American Diabetes Association — Nutrition Therapy Recommendations', 'NIDDK — Diabetes Diet, Eating, and Physical Activity'],
  ARRAY['diabetes'],
  'Medicare Covers Diabetes Nutrition Counseling — MNT Benefit Explained',
  'Medicare covers free nutrition counseling (MNT) for diabetes patients — 3 hours in year one, 2 hours annually after. Learn how to access this benefit.',
  true, NOW()
),

(
  'exercise-blood-sugar-diabetes',
  'How Exercise Affects Blood Sugar: A Simple Guide',
  'Even a 10-minute walk after meals can lower blood sugar by 20-30%.',
  'Physical activity makes your cells more sensitive to insulin, helping lower blood sugar. The ADA recommends 150 minutes of moderate activity per week. Start with short walks after meals — even 10 minutes helps.',
  'Frank was told by his doctor to "get more exercise" to help manage his Type 2 diabetes. But nobody explained why exercise helps or how to do it safely. Here''s the science made simple: when you move your muscles, they pull sugar out of your blood for energy — even without insulin. This is why blood sugar drops during and after exercise. Regular activity also makes your cells more responsive to insulin for up to 48 hours afterward. What type of exercise is best? Both aerobic exercise (walking, swimming, cycling) and resistance training (light weights, resistance bands) help lower blood sugar. The American Diabetes Association recommends 150 minutes per week of moderate activity — that''s about 22 minutes a day. But you don''t need to start there. Research from the journal Diabetes Care showed that three 10-minute walks after meals reduced blood sugar more effectively than one 30-minute walk. Safety tips: check blood sugar before exercise if you take insulin. If it''s below 100, have a small snack first. Stay hydrated. Wear proper shoes — foot injuries heal slowly with diabetes. Stop if you feel dizzy or chest pain. Medicare covers a doctor''s fitness assessment as part of your Annual Wellness Visit, and Silver Sneakers gym membership is included with many Medicare Advantage plans.',
  'coverage',
  'Ask about exercise and diabetes coverage',
  '/app/chat',
  ARRAY['American Diabetes Association — Physical Activity Guidelines', 'CDC — Diabetes and Physical Activity', 'Diabetes Care Journal — Post-meal Walking Study'],
  ARRAY['diabetes'],
  'Exercise and Blood Sugar: How Physical Activity Helps Diabetes',
  'Exercise lowers blood sugar by making cells more insulin-sensitive. Learn the ADA guidelines, safety tips, and how even short walks help manage diabetes.',
  true, NOW()
),

(
  'diabetes-foot-care-prevent-complications',
  'Diabetes and Foot Care: Preventing Serious Complications',
  'Diabetes-related foot problems lead to 130,000+ amputations yearly — most are preventable.',
  'Diabetes can damage nerves and blood flow in your feet, making small injuries dangerous. Medicare covers therapeutic shoes, foot exams every 6 months, and podiatry visits. Daily foot checks take 2 minutes and can save your feet.',
  'Harold stepped on a small piece of glass and didn''t feel it for days. By the time he noticed the wound on his foot, it was infected. Harold has Type 2 diabetes, and the nerve damage (neuropathy) that often comes with it meant he couldn''t feel the injury. This is more common than most people realize: over 130,000 lower-limb amputations happen each year in the US due to diabetes complications, according to the CDC. Most are preventable with proper foot care. Check your feet daily — look for cuts, blisters, red spots, and swelling. Use a mirror for the bottoms. Wash feet daily with warm (not hot) water and dry thoroughly, especially between toes. Moisturize the tops and bottoms but not between toes. Never go barefoot, even indoors. Trim toenails straight across to prevent ingrown nails. Wear well-fitting shoes — avoid pointed toes or high heels. Medicare covers: diabetic foot exams every 6 months for patients with peripheral neuropathy, therapeutic shoes and inserts once per year (Medicare Therapeutic Shoe Program), and routine podiatric care when medically necessary. If you notice a wound that isn''t healing, redness spreading, or a foot that feels warmer than the other, call your doctor the same day.',
  'coverage',
  'Check your foot care coverage',
  '/app/chat',
  ARRAY['CDC — Diabetes and Foot Complications', 'NIDDK — Diabetic Foot Problems', 'CMS — Medicare Therapeutic Shoe Program'],
  ARRAY['diabetes'],
  'Diabetes Foot Care: Prevent Complications with Medicare Coverage',
  'Diabetes-related foot problems cause 130,000+ amputations yearly. Learn daily foot care, warning signs, and what Medicare covers for diabetic foot health.',
  true, NOW()
),

(
  'metformin-what-medicare-patients-should-know',
  'Metformin: What Every Medicare Patient Should Know',
  'The most prescribed diabetes drug in the world costs less than $10/month on most Part D plans.',
  'Metformin is the first-line treatment for Type 2 diabetes, lowering A1C by 1-1.5%. It works by reducing liver sugar production and improving insulin sensitivity. Medicare Part D covers it as a generic — often at the lowest copay tier.',
  'When Jean was diagnosed with Type 2 diabetes, her doctor prescribed metformin. Jean worried about the cost. She was relieved to learn it''s one of the most affordable medications available — often under $10 per month on Medicare Part D. Metformin (brand name Glucophage) has been around since the 1950s and is the most-studied diabetes drug in history. It works in two ways: it tells your liver to make less sugar, and it helps your body use insulin more effectively. For most patients, it lowers A1C by 1 to 1.5 percentage points. The most common side effects are stomach upset, nausea, and diarrhea — especially when you first start. Taking it with food helps, and many doctors start with a low dose and increase gradually. The extended-release version (metformin ER) causes fewer stomach issues. Important safety notes: tell your doctor if you have kidney problems, as metformin dosing depends on kidney function. Stop taking metformin and call your doctor before any procedure using contrast dye (like a CT scan with contrast). Avoid excessive alcohol. Medicare Part D covers metformin as a Tier 1 generic on nearly all formularies. If you''re paying more than $15/month, ask your pharmacist about switching pharmacies or using the Medicare Part D Extra Help program if you have limited income.',
  'coverage',
  'Ask about your diabetes medication coverage',
  '/app/chat',
  ARRAY['FDA — Metformin Prescribing Information', 'American Diabetes Association — Pharmacologic Treatment Standards', 'NIDDK — Insulin, Medicines, and Other Diabetes Treatments'],
  ARRAY['diabetes'],
  'Metformin and Medicare: Cost, Coverage, and What to Expect',
  'Metformin is the most prescribed diabetes drug and costs under $10/month on most Part D plans. Learn how it works, side effects, and Medicare coverage.',
  true, NOW()
),

(
  'diabetes-eye-exams-why-they-matter',
  'Why Annual Eye Exams Matter When You Have Diabetes',
  'Diabetic retinopathy has no early symptoms — by the time you notice vision changes, damage is done.',
  'Diabetes is the leading cause of new blindness in adults. Medicare covers a dilated eye exam every 12 months for diabetes patients. Early detection through regular exams can prevent 95% of diabetes-related vision loss.',
  'Gloria had diabetes for 8 years and her vision seemed fine. She skipped her eye exams — she could see just fine, so why bother? Then one morning she noticed dark spots floating across her vision. Her ophthalmologist diagnosed diabetic retinopathy, the leading cause of new blindness in working-age adults according to the National Eye Institute. High blood sugar damages the tiny blood vessels in your retina over time. In the early stages, there are no symptoms at all. By the time you notice vision changes — blurred vision, dark spots, trouble seeing at night — the damage may be permanent. This is why annual exams are critical. A dilated eye exam lets your doctor see the blood vessels in the back of your eye before you notice any problems. When caught early, treatments like laser therapy and injections can prevent 95% of severe vision loss. Medicare Part B covers a dilated eye exam every 12 months for patients with diabetes. No deductible applies for the diagnostic portion. You don''t need a referral — you can go directly to a Medicare-enrolled ophthalmologist or optometrist. If you haven''t had an eye exam in the past year, schedule one this month. It takes about 30 minutes and could save your sight.',
  'coverage',
  'Check your eye exam coverage',
  '/app/chat',
  ARRAY['National Eye Institute — Diabetic Retinopathy', 'CDC — Vision Health Initiative: Diabetes and Vision Loss', 'CMS — Preventive Services: Diabetes Screening'],
  ARRAY['diabetes'],
  'Diabetes and Eye Exams: Why Medicare Covers Annual Screenings',
  'Diabetes is the leading cause of new blindness. Medicare covers annual dilated eye exams for diabetics. Learn why early detection prevents 95% of vision loss.',
  true, NOW()
),

(
  'insulin-costs-medicare-35-cap',
  'The $35 Insulin Cap: What Medicare Patients Need to Know',
  'Thanks to the Inflation Reduction Act, insulin is now capped at $35/month for all Medicare patients.',
  'Since January 2023, Medicare Part D plans cannot charge more than $35 per month per insulin prescription. This applies to all insulin types and brands — no exceptions. The cap also applies to insulin covered under Part B (pump supplies).',
  'Robert was spending over $300 a month on insulin — sometimes choosing between his medication and groceries. Then the Inflation Reduction Act changed everything. Starting January 1, 2023, all Medicare Part D plans must cap insulin copays at $35 per month per covered insulin product. This applies to every type of insulin: rapid-acting (Humalog, NovoLog), long-acting (Lantus, Levemir, Tresiba), and premixed formulas. It applies whether you''ve met your deductible or not. If you use an insulin pump, the $35 cap also applies to insulin covered under Medicare Part B. The cap is per prescription, not per insulin type — so if you use two different insulins, your maximum is $70 per month total for insulin. What you need to do: make sure your insulin is on your Part D plan''s formulary. If your plan doesn''t cover your specific insulin brand, ask your doctor about switching to a covered alternative, or switch plans during open enrollment. If you''re still being charged more than $35, contact your Part D plan directly — they are required by law to honor the cap. Keep your pharmacy receipts. If you believe you were overcharged, you can file a complaint with 1-800-MEDICARE.',
  'coverage',
  'Check your insulin coverage with Denali',
  '/app/chat',
  ARRAY['CMS — Inflation Reduction Act and Medicare', 'Medicare.gov — Insulin Savings', 'HHS — Lowering Drug Costs for Americans'],
  ARRAY['diabetes'],
  'Medicare $35 Insulin Cap: Inflation Reduction Act Explained',
  'The Inflation Reduction Act caps insulin at $35/month for all Medicare patients. Learn what''s covered, how it works, and what to do if you''re overcharged.',
  true, NOW()
),

-- ============================================================
-- OBESITY (9 new posts)
-- ============================================================

(
  'bmi-not-whole-story',
  'BMI Isn''t the Whole Story: Understanding Obesity',
  'BMI is a screening tool, not a diagnosis — here''s what your doctor should also consider.',
  'BMI (Body Mass Index) is useful for population screening but doesn''t distinguish between muscle and fat, or where fat is stored. Waist circumference, body composition, and metabolic health markers give a fuller picture.',
  'When Maria''s doctor told her BMI was 32, she was confused — she felt healthy, walked daily, and her blood work was normal. BMI (Body Mass Index) divides your weight in kilograms by your height in meters squared. A BMI of 30 or higher is classified as obese. But the CDC and NIH both acknowledge that BMI has significant limitations. It doesn''t distinguish between muscle and fat — a muscular person and an obese person can have the same BMI. It doesn''t show where fat is stored — belly fat (visceral fat) is far more dangerous than fat on your hips or thighs. And it doesn''t account for age, sex, or ethnicity differences in body composition. What should your doctor also look at? Waist circumference: above 35 inches for women or 40 inches for men increases health risk regardless of BMI. Blood pressure, cholesterol, triglycerides, and fasting glucose — these metabolic markers matter more than the number on the scale. Family history of heart disease, diabetes, or stroke. The key takeaway: BMI is a starting point, not a verdict. If your BMI is 30+ but your metabolic health is good, your doctor may take a watchful approach. If your BMI is 25-29 but you have high blood pressure, high blood sugar, and belly fat, that may be more urgent. Medicare covers obesity screening (BMI calculation) at every Annual Wellness Visit, and Intensive Behavioral Therapy for BMI 30+.',
  'coverage',
  'Discuss your weight and health with Denali',
  '/app/chat',
  ARRAY['CDC — About Adult BMI', 'NIH/NHLBI — Assessing Your Weight and Health Risk', 'Mayo Clinic — BMI: Is It Reliable?'],
  ARRAY['obesity'],
  'Understanding BMI: Why It''s Not the Whole Story for Obesity',
  'BMI is a screening tool with real limitations. Learn what your doctor should also check — waist circumference, metabolic markers, and more.',
  true, NOW()
),

(
  'walking-30-minutes-weight-management',
  '30 Minutes of Walking: What the Research Shows',
  'Walking is the most underrated exercise for weight management — and it''s free.',
  'The HHS Physical Activity Guidelines recommend 150 minutes of moderate activity per week for adults. Studies show brisk walking for 30 minutes daily reduces obesity-related health risks even without significant weight loss.',
  'Joyce''s doctor told her to exercise more. She dreaded the gym. Then her doctor said something that surprised her: "Just walk." It turns out walking is one of the most studied and effective forms of exercise for weight management, especially for older adults. The federal Physical Activity Guidelines for Americans (HHS) recommend at least 150 minutes of moderate-intensity activity per week — that''s 30 minutes, 5 days a week. Brisk walking counts. What does "brisk" mean? Walking fast enough that you can talk but not sing. About 3-4 miles per hour for most people. A landmark study in the Journal of the American Medical Association followed over 16,000 older women and found that those who walked just 4,400 steps per day had significantly lower mortality rates compared to those who walked 2,700 steps. Benefits increased up to about 7,500 steps, then leveled off. Walking after meals is especially effective: a 2022 meta-analysis in Sports Medicine found that walking for even 2-5 minutes after eating significantly reduced blood sugar spikes. For weight management, consistency matters more than intensity. Research shows that people who walk regularly maintain weight loss better long-term than those who do intense workouts sporadically. Start where you are. If 30 minutes feels like too much, start with 10. Medicare Advantage plans often include Silver Sneakers fitness memberships at no extra cost.',
  'coverage',
  'Ask about fitness benefits in your Medicare plan',
  '/app/chat',
  ARRAY['HHS — Physical Activity Guidelines for Americans', 'JAMA Internal Medicine — Steps Per Day and Mortality', 'Sports Medicine — Post-Meal Walking Meta-Analysis 2022'],
  ARRAY['obesity'],
  'Walking 30 Minutes a Day: Research-Backed Weight Management',
  'Walking 30 minutes daily reduces obesity health risks. Learn what HHS guidelines recommend, how many steps matter, and why post-meal walks help.',
  true, NOW()
),

(
  'portion-control-practical-tips',
  'Portion Control Tips That Actually Work',
  'American portion sizes have doubled since the 1970s — your plate might be the problem.',
  'NIH research shows using smaller plates, measuring servings, and eating slowly can reduce calorie intake by 20-30% without feeling deprived. These simple habits help with long-term weight management.',
  'Carol joined a weight loss program but couldn''t figure out why she wasn''t losing weight — she was eating "healthy" foods. Her dietitian asked her to measure her portions for one week. Carol was shocked: her "bowl of cereal" was actually three servings. Her "handful of nuts" was four servings. This is incredibly common. According to the NIH, average restaurant portions are 2-3 times larger than standard serving sizes. Research-backed tips that help: Use smaller plates — a 10-inch plate instead of a 12-inch plate naturally reduces portions by about 22% (Cornell Food Lab study). Read labels — a "serving" of pasta is half a cup, not the pile most of us cook. Eat slowly — it takes about 20 minutes for your brain to register fullness. Putting your fork down between bites helps. Plate your food in the kitchen instead of serving family-style at the table — people eat 20% less when they have to get up for seconds. Use the "MyPlate" method: half your plate is fruits and vegetables, a quarter is protein, a quarter is grains. Drink a glass of water before each meal — a Virginia Tech study showed this reduced calorie intake by 75-90 calories per meal. Don''t eat from the bag or container — portion into a bowl. These aren''t about restriction — they''re about awareness. Medicare''s Intensive Behavioral Therapy for obesity (BMI 30+) includes nutrition counseling that covers portion strategies.',
  'coverage',
  'Ask about Medicare nutrition counseling',
  '/app/chat',
  ARRAY['NIDDK — Just Enough for You: About Food Portions', 'USDA — MyPlate Guidelines', 'NIH — Portion Size and Obesity'],
  ARRAY['obesity'],
  'Portion Control Tips for Weight Management — Research-Based',
  'American portions have doubled since the 1970s. Learn research-backed tips for portion control that reduce calories by 20-30% without feeling deprived.',
  true, NOW()
),

(
  'sleep-weight-connection',
  'How Sleep Affects Your Weight: What Research Shows',
  'Getting less than 7 hours of sleep increases obesity risk by 41%.',
  'Poor sleep disrupts hunger hormones (ghrelin and leptin), increases cravings for high-calorie foods, and reduces your body''s ability to process insulin. The CDC recommends 7-9 hours for adults. Better sleep supports weight management.',
  'Phil couldn''t understand why his weight kept creeping up. He was eating reasonably and walking most days. His doctor asked an unexpected question: "How are you sleeping?" Phil admitted he averaged about 5 hours a night. Research from the University of Chicago and other major institutions has established a clear link between sleep and weight. When you don''t sleep enough, your body produces more ghrelin (the hunger hormone) and less leptin (the fullness hormone). The result: you feel hungrier and eat more, especially high-calorie, high-carb foods. A meta-analysis in the journal Sleep found that adults sleeping less than 7 hours per night had a 41% higher risk of obesity. It''s not just about willpower — your biology is working against you. Poor sleep also increases cortisol (the stress hormone), which promotes belly fat storage, and reduces insulin sensitivity, raising blood sugar. What helps: Keep a consistent sleep schedule — go to bed and wake up at the same time, even on weekends. Make your bedroom dark, cool (65-68 degrees), and quiet. Avoid screens for 30 minutes before bed. Limit caffeine after noon. If you snore loudly or wake up tired despite sleeping 7+ hours, talk to your doctor about sleep apnea — it''s extremely common in people with obesity and is covered by Medicare (home sleep tests and CPAP machines).',
  'coverage',
  'Ask about sleep apnea coverage',
  '/app/chat',
  ARRAY['CDC — Sleep and Sleep Disorders', 'NIH — Sleep Deprivation and Obesity', 'Sleep Journal — Sleep Duration and Obesity Meta-Analysis'],
  ARRAY['obesity'],
  'Sleep and Weight: How Poor Sleep Increases Obesity Risk',
  'Less than 7 hours of sleep raises obesity risk by 41%. Learn how sleep affects hunger hormones, cravings, and insulin — plus tips for better sleep.',
  true, NOW()
),

(
  'wegovy-zepbound-what-medicare-covers',
  'Wegovy vs Zepbound: What Medicare Covers in 2026',
  'Two powerful weight loss medications — but Medicare coverage depends on your diagnosis.',
  'Wegovy (semaglutide) and Zepbound (tirzepatide) are FDA-approved for weight management. Medicare Part D coverage for obesity-only prescriptions is evolving. If you also have Type 2 diabetes, coverage is much more likely under the diabetes indication.',
  'When the FDA approved Zepbound (tirzepatide) for weight management in late 2023, it joined Wegovy (semaglutide) as a breakthrough GLP-1 medication for obesity. Clinical trials showed patients losing 15-22% of body weight — results previously only seen with surgery. But the question Medicare patients ask most is: will my plan cover it? The answer depends on why it''s prescribed. For Type 2 diabetes: the same drugs are available under different brand names — Ozempic (semaglutide) and Mounjaro (tirzepatide). Medicare Part D covers these for diabetes management, often with prior authorization. For weight loss without diabetes: Medicare has historically excluded weight loss drugs from Part D coverage under the Social Security Act. However, the landscape is changing. The Treat and Reduce Obesity Act has been introduced in Congress multiple times and would lift this exclusion. Some Medicare Advantage plans are beginning to offer supplemental coverage for anti-obesity medications. If you have both conditions, your doctor should prescribe under the diabetes indication — this dramatically improves coverage. Cost without insurance: $1,000-1,300 per month for either drug. Manufacturer savings programs exist but generally don''t apply to Medicare patients. Ask your Part D plan about any step therapy requirements or coverage exceptions. Your doctor can submit a prior authorization with clinical documentation.',
  'coverage',
  'Check your GLP-1 medication coverage',
  '/app/chat',
  ARRAY['FDA — Wegovy (semaglutide) Approval', 'FDA — Zepbound (tirzepatide) Approval', 'CMS — Part D Drug Coverage'],
  ARRAY['obesity', 'coverage'],
  'Wegovy vs Zepbound Medicare Coverage 2026: What''s Covered',
  'Wegovy and Zepbound are FDA-approved for weight loss but Medicare coverage depends on diagnosis. Learn the rules, costs, and how to maximize coverage.',
  true, NOW()
),

(
  'emotional-eating-strategies',
  'Managing Emotional Eating: Strategies That Help',
  'Stress, boredom, and sadness drive more eating than hunger — here''s how to break the cycle.',
  'Emotional eating is eating in response to feelings rather than hunger. Research from the Mayo Clinic shows awareness techniques, alternative coping strategies, and professional support can help break the pattern.',
  'Diane noticed she always reached for chips when she was stressed about bills, and ice cream when she felt lonely. She wasn''t hungry — she was eating her feelings. Emotional eating affects millions of Americans and is one of the biggest barriers to weight management. It''s not a character flaw — it''s a learned coping mechanism, and research shows it can be unlearned. How to tell if you''re emotionally eating: emotional hunger comes on suddenly, physical hunger builds gradually. Emotional eating craves specific comfort foods; physical hunger is satisfied by a range of foods. After emotional eating, you feel guilt; after physical hunger, you feel satisfied. Strategies backed by research: Keep a food-mood journal for one week. Write what you ate, when, and how you felt. Patterns will emerge quickly. When you feel the urge to eat, pause for 5 minutes. Do something with your hands — take a walk, call a friend, do a crossword. Often the urge passes. Don''t keep trigger foods in the house. If chips are your stress food, simply not having them available breaks the automatic response. Practice the "HALT" check: am I Hungry, Angry, Lonely, or Tired? If it''s not hunger, address the real need. Get professional support: Medicare covers mental health counseling, and the free obesity counseling benefit (IBT) includes behavioral strategies for emotional eating. You don''t have to figure this out alone.',
  'coverage',
  'Ask about behavioral health coverage',
  '/app/chat',
  ARRAY['Mayo Clinic — Weight Loss: Emotional Eating', 'NIDDK — Emotional Eating and Weight', 'APA — Understanding and Overcoming Emotional Eating'],
  ARRAY['obesity'],
  'Emotional Eating: Research-Based Strategies to Break the Cycle',
  'Emotional eating drives weight gain for millions. Learn research-backed strategies to identify triggers and break the pattern, plus Medicare counseling options.',
  true, NOW()
),

(
  'obesity-heart-disease-connection',
  'Obesity and Heart Disease: What Every Patient Should Know',
  'Obesity doubles the risk of heart failure — but even modest weight loss improves heart health.',
  'Obesity increases risk for high blood pressure, high cholesterol, Type 2 diabetes, and heart disease. The AHA reports that losing just 5-10% of body weight significantly improves cardiovascular risk factors.',
  'When George had a mild heart attack at 62, his cardiologist said his weight was a major contributing factor. George had a BMI of 36 and had been ignoring his blood pressure for years. Obesity doesn''t directly cause heart attacks, but it creates a cascade of risk factors. Excess weight forces your heart to work harder to pump blood. Fat tissue produces inflammatory chemicals that damage blood vessels. Obesity raises blood pressure, LDL cholesterol, and triglycerides while lowering HDL (good) cholesterol. And it dramatically increases the risk of Type 2 diabetes, which itself doubles heart disease risk. According to the American Heart Association, obesity doubles the risk of heart failure. The connection between belly fat (visceral fat) and heart disease is especially strong — visceral fat produces hormones and chemicals that promote inflammation, insulin resistance, and arterial plaque. The encouraging news: weight loss has an outsized impact on heart health. Losing just 5-10% of body weight can lower blood pressure by 5 mmHg, reduce LDL cholesterol by 5-8%, improve insulin sensitivity, and reduce inflammatory markers. Medicare covers cardiac rehabilitation (12 weeks of supervised exercise and education) after a heart event, obesity counseling (IBT) for BMI 30+, and all standard cardiovascular screenings. If you have both obesity and heart disease risk factors, talk to your doctor about a comprehensive plan.',
  'coverage',
  'Check your heart health coverage',
  '/app/chat',
  ARRAY['American Heart Association — Obesity and Heart Disease', 'CDC — Heart Disease and Obesity', 'NIH/NHLBI — Managing Overweight and Obesity in Adults'],
  ARRAY['obesity'],
  'Obesity and Heart Disease: Risks, Prevention, and Medicare Coverage',
  'Obesity doubles heart failure risk. Learn how excess weight affects your heart, why 5-10% weight loss matters, and what Medicare covers for prevention.',
  true, NOW()
),

(
  'bariatric-surgery-preparation-guide',
  'Preparing for Bariatric Surgery: A Medicare Patient''s Guide',
  'Medicare covers bariatric surgery — but preparation starts months before the operating room.',
  'Medicare Part A covers gastric bypass and sleeve gastrectomy for BMI 35+ with comorbidities. Most programs require 3-6 months of supervised weight management, psychological evaluation, and nutritional counseling before surgery is approved.',
  'After years of struggling with her weight, Angela''s doctor recommended bariatric surgery. Her BMI was 42, she had Type 2 diabetes, and her knees were failing. Angela was nervous but hopeful — and she wanted to know exactly what to expect. Medicare Part A covers bariatric surgery under NCD 100.1, but the process takes several months of preparation. Here''s the typical timeline: Months 1-2: Your surgeon evaluates you and confirms you meet Medicare criteria — BMI of 35+ with at least one obesity-related condition (diabetes, sleep apnea, heart disease, or severe joint disease). Most programs require documented evidence that non-surgical weight loss has failed. Months 2-4: Pre-surgical requirements usually include a psychological evaluation (to ensure you''re emotionally prepared for the lifestyle changes), nutritional counseling with a registered dietitian, cardiac clearance, blood work and imaging, and sometimes a sleep study. Months 3-6: Many programs require a supervised weight management program — regular visits showing you can follow dietary guidelines. This isn''t punishment; research shows patients who engage in pre-surgical counseling have better long-term outcomes. Surgery day: Most procedures are now laparoscopic (small incisions, shorter recovery). Hospital stay is typically 1-3 days. Recovery: You''ll follow a liquid diet for 2-4 weeks, then slowly progress to soft foods. Lifelong vitamin supplements are required. Follow-up visits are frequent in the first year. Start a folder now: document every diet attempt, gym membership, Weight Watchers enrollment, and doctor visit related to weight. This documentation strengthens your case for approval.',
  'coverage',
  'Check your bariatric surgery eligibility',
  '/app/chat',
  ARRAY['CMS NCD 100.1 — Bariatric Surgery for Morbid Obesity', 'ASMBS — Bariatric Surgery Guidelines', 'NIH — Bariatric Surgery for Severe Obesity'],
  ARRAY['obesity', 'coverage'],
  'Bariatric Surgery and Medicare: Preparation Guide for Patients',
  'Medicare covers bariatric surgery for BMI 35+ with comorbidities. Learn the 3-6 month preparation timeline, requirements, and what to document.',
  true, NOW()
),

(
  'strength-training-over-65',
  'Strength Training After 65: Safe, Effective, and Important',
  'You lose 3-5% of muscle mass per decade after 30 — strength training slows it down.',
  'Resistance training preserves muscle mass, bone density, and metabolic rate as you age. The CDC recommends strength exercises at least 2 days per week for adults 65+. You don''t need a gym — bodyweight exercises and resistance bands work.',
  'At 68, Dorothy assumed strength training was for young people. Then she broke her wrist from a simple fall — her doctor said her bone density was low and her muscle mass had declined significantly. This age-related muscle loss (called sarcopenia) accelerates after 65 and contributes to falls, fractures, slower metabolism, and weight gain. The good news: strength training at any age slows and even reverses muscle loss. The CDC and the American College of Sports Medicine both recommend strength exercises at least 2 days per week for adults 65 and older. You don''t need heavy weights or a gym membership. Effective options include: resistance bands (inexpensive, portable, joint-friendly), bodyweight exercises (wall push-ups, chair squats, heel raises), light dumbbells (3-8 pounds to start), and water aerobics (the water provides natural resistance). Start with one set of 10-12 repetitions per exercise and work up to 2-3 sets. Focus on major muscle groups: legs, back, chest, arms. Always warm up for 5 minutes first. A key benefit for weight management: muscle tissue burns more calories at rest than fat tissue. Maintaining muscle mass helps keep your metabolism from slowing as you age. Safety tips: breathe normally — never hold your breath while lifting. Stop if you feel sharp pain (muscle soreness the next day is normal, sharp pain during exercise is not). Talk to your doctor before starting if you have heart disease, high blood pressure, or joint replacements. Many Medicare Advantage plans include Silver Sneakers, which provides free gym access and group fitness classes designed for older adults.',
  'coverage',
  'Ask about fitness programs in your plan',
  '/app/chat',
  ARRAY['CDC — Physical Activity for Older Adults', 'NIH/NIA — Exercise and Physical Activity Guide', 'ACSM — Exercise Guidelines for Older Adults'],
  ARRAY['obesity'],
  'Strength Training for Seniors: Safe Exercise After 65',
  'Adults lose 3-5% of muscle per decade after 30. Learn safe strength training exercises for 65+, why it helps weight management, and Medicare fitness benefits.',
  true, NOW()
),

-- ============================================================
-- MEDICARE-GENERAL (13 new posts)
-- ============================================================

(
  'medicare-annual-wellness-visit',
  'Your Free Annual Wellness Visit: What''s Included',
  'It''s not a physical exam — and it''s one of Medicare''s most valuable free benefits.',
  'Medicare''s Annual Wellness Visit (AWV) is a free yearly check-in that creates a personalized prevention plan. It includes health risk assessment, screenings schedule, depression screening, and advance care planning. No copay, no deductible.',
  'Betty skipped her Annual Wellness Visit because she thought it was just a regular checkup. It''s not — and it''s actually more valuable. The Annual Wellness Visit (AWV) is a free Medicare Part B benefit designed to create a personalized prevention plan based on your health history, risk factors, and current conditions. Here''s what happens during an AWV: Your provider reviews your medical and family history, current medications (bring your pill bottles), and functional ability (can you dress, bathe, walk safely?). You''ll complete a Health Risk Assessment questionnaire covering diet, exercise, home safety, and mental health. Your provider screens for depression, cognitive impairment, and fall risk. Together, you''ll create or update a written prevention plan with a schedule of recommended screenings and vaccines. Your provider may measure height, weight, blood pressure, and BMI. Important: the AWV is NOT a head-to-toe physical exam. If your doctor examines you physically or orders tests beyond what''s in the prevention plan, those additional services may be billed separately with a copay. The AWV is covered once every 12 months after your first year on Medicare (the first year, you get a separate "Welcome to Medicare" visit). There is no copay, no deductible, and no coinsurance. To make the most of it: bring a list of all medications and supplements, write down any concerns or health changes, ask about screenings you may be due for, and bring a family member if memory is a concern.',
  'coverage',
  'Ask about your Medicare preventive benefits',
  '/app/chat',
  ARRAY['Medicare.gov — Annual Wellness Visit', 'CMS — Preventive Services Covered by Medicare', 'CMS MLN — Annual Wellness Visit Fact Sheet'],
  ARRAY['medicare-general'],
  'Medicare Annual Wellness Visit: What''s Free and What to Expect',
  'Medicare covers a free Annual Wellness Visit every year — no copay, no deductible. Learn what''s included, how it differs from a physical, and how to prepare.',
  true, NOW()
),

(
  'medicare-part-d-donut-hole-explained',
  'The Medicare Part D Coverage Gap Explained Simply',
  'The "donut hole" is smaller than ever — but it still catches patients off guard.',
  'The Part D coverage gap (donut hole) kicks in after you and your plan spend a combined amount on drugs. In 2026, you pay no more than $2,000 out-of-pocket for the year thanks to the Inflation Reduction Act — a major improvement.',
  'When Frank''s pharmacy bill suddenly jumped from $15 to $90 for the same medication, he thought it was an error. His pharmacist explained he''d entered the Part D "donut hole" — the coverage gap. Here''s how Part D works in four stages: Stage 1 (Deductible): You pay full price until you meet your plan''s deductible (up to $590 in 2026, though some plans have no deductible). Stage 2 (Initial Coverage): You pay copays or coinsurance for your drugs. Your plan pays the rest. This continues until total drug costs (what you and your plan paid combined) reach $5,030 in 2026. Stage 3 (Coverage Gap / Donut Hole): This is where costs used to skyrocket. But thanks to the Inflation Reduction Act, the donut hole has been significantly closed. You''ll pay a reduced coinsurance rate for brand-name and generic drugs. Stage 4 (Catastrophic Coverage): Once your out-of-pocket spending reaches $2,000 for the year, you enter catastrophic coverage and pay $0 for covered Part D drugs for the rest of the year. This $2,000 annual cap is new as of 2025 — previously there was no cap, and some patients spent $10,000+ on medications. How to manage: Ask your doctor about generic alternatives (they cost less and count toward your cap). Use your plan''s preferred pharmacy for lower copays. Review your Part D plan during open enrollment every year — formularies change. If you have limited income, apply for Extra Help (Low Income Subsidy) through Social Security.',
  'coverage',
  'Check your Part D coverage with Denali',
  '/app/chat',
  ARRAY['Medicare.gov — Costs in the Coverage Gap', 'CMS — Part D Defined Standard Benefit 2026', 'HHS — Inflation Reduction Act and Medicare'],
  ARRAY['medicare-general'],
  'Medicare Part D Donut Hole Explained: 2026 Coverage Gap Guide',
  'The Part D donut hole catches patients off guard. Learn the 4 stages of drug coverage, the new $2,000 annual cap, and how to manage costs.',
  true, NOW()
),

(
  'original-medicare-vs-advantage-differences',
  'Original Medicare vs Medicare Advantage: Key Differences',
  'It''s the biggest choice in Medicare — and most people don''t fully understand both options.',
  'Original Medicare (Parts A+B) offers broad provider choice but no out-of-pocket cap. Medicare Advantage (Part C) bundles everything with lower premiums but restricted networks. Neither is universally better — it depends on your health needs.',
  'When Helen turned 65, she was overwhelmed by Medicare options. Her neighbor loved Medicare Advantage. Her doctor recommended Original Medicare. Here''s what you need to know to decide. Original Medicare (Parts A and B) is run by the federal government. You can see any doctor or hospital in the US that accepts Medicare — no network restrictions. You pay 20% of most services after your deductible, with no annual out-of-pocket maximum (which is why most people add a Medigap supplement). You need a separate Part D plan for prescriptions. Medicare Advantage (Part C) is run by private insurance companies approved by Medicare. Plans often include Part D drug coverage, dental, vision, hearing, and fitness benefits. Monthly premiums are often lower (some are $0). The tradeoff: you must use in-network providers (or pay much more), plans require referrals and prior authorization for many services, and coverage varies significantly by plan. Key differences that matter most: Provider choice — Original Medicare wins. If you travel, see specialists, or want to choose any Medicare-accepting doctor, Original Medicare gives you that freedom. Cost predictability — Advantage often wins for people who want one plan with a known maximum out-of-pocket limit. Prior authorization — Advantage plans deny services at higher rates due to prior auth requirements (OIG found 13% of MA prior auth denials were inappropriate). Switching — you can switch from Advantage back to Original Medicare during open enrollment, but buying Medigap after your initial enrollment period may require medical underwriting. There''s no single right answer. Consider your health, budget, and how much provider flexibility you need.',
  'coverage',
  'Compare your Medicare options with Denali',
  '/app/chat',
  ARRAY['Medicare.gov — Original Medicare vs Medicare Advantage', 'CMS — Medicare and You Handbook 2026', 'OIG — Medicare Advantage Prior Authorization Denials Report'],
  ARRAY['medicare-general'],
  'Original Medicare vs Medicare Advantage: Which Is Better?',
  'Original Medicare offers broad choice but no cap. Medicare Advantage bundles benefits but restricts networks. Learn the key differences to decide.',
  true, NOW()
),

(
  'what-is-medicare-supplement-medigap',
  'What Is Medigap and Do You Need It?',
  'Medigap fills the "gaps" in Original Medicare — but timing your enrollment is critical.',
  'Medigap (Medicare Supplement) plans cover costs Original Medicare doesn''t — like the 20% coinsurance, deductibles, and excess charges. You must enroll during your 6-month open enrollment window to guarantee acceptance without medical underwriting.',
  'After Joe got a $4,000 bill for 20% of his surgery costs, he wished he''d signed up for Medigap. Original Medicare covers 80% of approved costs — you pay the other 20% with no annual cap. For expensive treatments, that 20% adds up fast. Medigap (also called Medicare Supplement Insurance) is a private insurance policy that helps pay your share. There are 8 standardized plan types (A, B, D, G, K, L, M, N) — the letters are the same regardless of which company sells them. Plan G is the most popular: it covers the Part A deductible, Part B coinsurance (the 20%), skilled nursing facility coinsurance, and foreign travel emergency care. You still pay the Part B deductible ($257 in 2026). Plan N is similar but costs less — you pay small copays for some office visits and ER visits. Critical timing rule: You have a 6-month Medigap open enrollment period that starts when you''re 65+ AND enrolled in Part B. During this window, insurance companies MUST sell you any Medigap policy they offer, regardless of health conditions. Miss this window, and companies can deny you or charge more based on your health. Medigap plans do NOT include drug coverage — you need a separate Part D plan. Medigap does NOT work with Medicare Advantage — it only supplements Original Medicare. Monthly premiums range from $50-300+ depending on your age, location, and plan type. Compare plans at Medicare.gov or call your State Health Insurance Assistance Program (SHIP) for free counseling.',
  'coverage',
  'Ask about Medigap options',
  '/app/chat',
  ARRAY['Medicare.gov — What''s Medicare Supplement Insurance (Medigap)?', 'CMS — Choosing a Medigap Policy Guide', 'SHIP — State Health Insurance Assistance Program'],
  ARRAY['medicare-general'],
  'Medigap Explained: Do You Need Medicare Supplement Insurance?',
  'Medigap covers the 20% Original Medicare doesn''t pay. Learn about plan types, costs, and the critical 6-month enrollment window you can''t miss.',
  true, NOW()
),

(
  'medicare-preventive-services-free',
  'Every Free Preventive Service Medicare Covers',
  'Medicare covers dozens of preventive services at no cost — most patients use only a fraction.',
  'Medicare Part B covers screenings, vaccines, and counseling at $0 copay. This includes annual wellness visits, cancer screenings, cardiovascular tests, diabetes screening, obesity counseling, depression screening, and more.',
  'Martha was paying copays for services that should have been free. She didn''t know that Medicare covers a long list of preventive services with no copay, no deductible, and no coinsurance — as long as the service is coded correctly. Here are the most important free preventive services: Cancer screenings — mammograms (every 12 months age 40+), colonoscopy (every 10 years for average risk, every 2 years for high risk), Pap smear and pelvic exam (every 24 months, or every 12 months for high risk), prostate PSA test (every 12 months age 50+), lung cancer screening (annual low-dose CT for qualifying smokers). Cardiovascular — cholesterol and lipid panel (every 5 years), cardiovascular disease risk reduction (once per year), abdominal aortic aneurysm screening (once for qualifying men). Diabetes — glucose screening (up to 2 per year for at-risk), diabetes self-management training (DSMT), medical nutrition therapy (MNT). Vaccines — flu shot (annually), pneumonia (per schedule), COVID-19, hepatitis B (for at-risk), shingles (through Part D). Mental health — depression screening (annually), alcohol misuse screening and counseling (annually). Obesity — BMI screening (at wellness visit), intensive behavioral therapy for BMI 30+ (up to 22 visits). Other — Annual Wellness Visit, bone density test (every 24 months for qualifying women), glaucoma test (every 12 months for high risk), HIV screening (annually for at-risk). The key rule: services must be ordered by a Medicare-enrolled provider and coded as preventive. If your doctor adds diagnostic tests during a preventive visit, those may be billed separately.',
  'coverage',
  'Check which screenings you''re due for',
  '/app/chat',
  ARRAY['Medicare.gov — Preventive Services', 'CMS — Your Medicare Preventive Services Coverage Guide', 'CMS MLN — Preventive Services Quick Reference'],
  ARRAY['medicare-general'],
  'Free Medicare Preventive Services: Complete List 2026',
  'Medicare covers dozens of free screenings, vaccines, and counseling. See the complete list of $0 copay preventive services and which ones you may be missing.',
  true, NOW()
),

(
  'understanding-your-medicare-summary-notice',
  'How to Read Your Medicare Summary Notice',
  'That confusing document in the mail actually tells you everything about what Medicare paid — and what you might owe.',
  'Your Medicare Summary Notice (MSN) is mailed every 3 months and shows every service billed, what Medicare approved, what they paid, and what you owe. Reviewing it catches billing errors and potential fraud.',
  'When a thick envelope arrives from Medicare, most people put it in a drawer. That''s a missed opportunity. Your Medicare Summary Notice (MSN) is your receipt — it shows every claim submitted in your name and is your first defense against billing errors and fraud. The MSN arrives every 3 months and covers all Part A and Part B services. Here''s how to read each section: Section 1 — "Did Medicare Approve All Claims?" A quick yes/no summary. If anything was denied, it''ll say "See Claims" with details below. Section 2 — "Claim Details." For each service: the date, provider name, description of service, amount billed by the provider, Medicare-approved amount (often less than billed), amount Medicare paid, and the amount you may owe. Section 3 — "Deductible and coinsurance." Shows where you stand on your Part B deductible and any coinsurance owed. What to look for: Services you don''t recognize — this could be fraud. Ask yourself: did you see this doctor on this date? Duplicate charges — the same service billed twice. Denied claims — the MSN will include a reason code. Common ones: not medically necessary (CO-50), billing error (CO-16), or bundled service (CO-97). Higher "you may owe" amounts than expected — compare with your provider''s bill. If something looks wrong: call the provider first (billing errors are common). If unresolved, call 1-800-MEDICARE. If you suspect fraud, call the OIG hotline at 1-800-HHS-TIPS. Keep MSNs for at least one year. If you''re appealing a denial, you''ll reference the MSN as part of your evidence.',
  'coverage',
  'Ask Denali about a charge on your MSN',
  '/app/chat',
  ARRAY['Medicare.gov — Your Medicare Summary Notice', 'CMS — Reading Your MSN', 'OIG — Report Medicare Fraud'],
  ARRAY['medicare-general'],
  'How to Read Your Medicare Summary Notice (MSN)',
  'Your Medicare Summary Notice shows every claim, payment, and denial. Learn how to read it, spot errors, and protect yourself from fraud.',
  true, NOW()
),

(
  'medicare-open-enrollment-checklist',
  'Medicare Open Enrollment Checklist: What to Review',
  'Open enrollment runs October 15 - December 7 — and your current plan may have changed more than you think.',
  'During open enrollment, you can switch between Original Medicare and Medicare Advantage, change Part D plans, or join/drop Advantage plans. Review your Annual Notice of Change — your plan''s costs and formulary may have shifted.',
  'Every September, Gloria got a thick envelope from her Medicare Advantage plan — the Annual Notice of Change (ANOC). She never read it. One year, her insulin went from Tier 2 to Tier 4, tripling her copay. She didn''t find out until January. Don''t be Gloria. Open enrollment (October 15 through December 7) is your annual opportunity to make sure your coverage matches your needs. Here''s your checklist: Step 1 — Read your Annual Notice of Change. This document lists every change to your plan for next year: premium increases, new copays, formulary changes (drugs added or removed from coverage), provider network changes, and benefit modifications. Step 2 — Review your medications. Use Medicare.gov''s Plan Finder tool to compare Part D plans based on your specific drug list. A plan that was cheapest last year may not be cheapest next year. Step 3 — Check your providers. If you have Medicare Advantage, confirm your doctors are still in-network. Networks change annually. Step 4 — Consider your health needs. Had a new diagnosis this year? Need more specialist visits? A plan that worked when you were healthy may not work now. Step 5 — Compare costs beyond the premium. Look at deductibles, copays for your most-used services, out-of-pocket maximums, and drug costs. Step 6 — Make your decision by December 7. Changes take effect January 1. If you do nothing, your current plan continues with whatever changes the ANOC described. Free help is available: call your State Health Insurance Assistance Program (SHIP) at 1-877-839-2675 for free, unbiased counseling.',
  'coverage',
  'Review your plan with Denali',
  '/app/chat',
  ARRAY['Medicare.gov — Open Enrollment', 'CMS — Annual Notice of Change Requirements', 'SHIP — Free Medicare Counseling'],
  ARRAY['medicare-general'],
  'Medicare Open Enrollment Checklist 2026: What to Review',
  'Medicare open enrollment runs Oct 15-Dec 7. Use this checklist to review plan changes, drug costs, provider networks, and avoid costly surprises.',
  true, NOW()
),

(
  'when-to-call-1800-medicare',
  'When to Call 1-800-MEDICARE and What They Can Help With',
  'Medicare''s helpline is free, available 24/7, and can resolve more issues than most people realize.',
  '1-800-MEDICARE (1-800-633-4227) handles billing disputes, claim status, plan comparisons, enrollment questions, fraud reports, and much more. TTY users can call 1-877-486-2048. Representatives are available 24 hours a day.',
  'When something goes wrong with Medicare, most people don''t know where to turn. The answer is often simpler than you think: 1-800-MEDICARE (1-800-633-4227). It''s free, available 24 hours a day, 7 days a week, and staffed by trained counselors who can help with far more than most patients realize. Here''s when to call: Billing questions — you received a bill you don''t understand, or you think you were charged incorrectly. Claim status — you want to know if Medicare processed a claim and what they paid. Coverage questions — you want to confirm whether a specific service is covered before you have it done. Plan comparisons — during open enrollment, counselors can walk you through Part D and Medicare Advantage options. Enrollment help — you need to sign up for Part A, Part B, or a new plan. Appeals — you received a denial and need guidance on how to file a Level 1 appeal (redetermination). Fraud — you suspect a provider billed for services you didn''t receive, or you don''t recognize a charge on your MSN. Lost cards — your Medicare card was lost or stolen. Extra Help — you have limited income and want to apply for the Part D Low Income Subsidy. Tips for calling: have your Medicare number ready (your card or the Medicare.gov app). Write down your question before calling. Ask for a reference number for your call. If you disagree with an answer, ask to speak with a supervisor. Note: for Medicare Advantage or Part D plan-specific issues, you may need to call the plan directly — the number is on your plan card. But 1-800-MEDICARE can redirect you.',
  'coverage',
  'Get help understanding your Medicare',
  '/app/chat',
  ARRAY['Medicare.gov — Contact Medicare', 'CMS — 1-800-MEDICARE Reference Guide', 'Medicare.gov — Report Fraud'],
  ARRAY['medicare-general'],
  'When to Call 1-800-MEDICARE: Full Guide to Medicare Help',
  '1-800-MEDICARE is free and available 24/7. Learn what they help with — billing, claims, coverage, enrollment, appeals, fraud, and more.',
  true, NOW()
),

(
  'what-does-co4-mean',
  'CO-4 Denial: The Modifier Wasn''t Right',
  'CO-4 usually means a billing code was wrong — not that your service isn''t covered.',
  'CO-4 means the procedure code or modifier on your claim doesn''t match what Medicare expected. This is almost always a provider billing error, not a patient problem. Your doctor''s office can fix and resubmit it.',
  'When Sarah saw "CO-4" on her Medicare notice, she assumed her knee injection wasn''t covered. Actually, CO-4 means the procedure code or modifier submitted with the claim was incorrect — it''s a billing technicality, not a coverage decision. Modifiers are two-digit codes that give Medicare extra information about a service: which side of the body (left vs right), whether it was done in an office vs hospital, or whether it was a distinct procedure. When the modifier is wrong or missing, Medicare returns a CO-4 denial. What you should do: Call your doctor''s billing office and tell them about the CO-4. They can usually identify the problem quickly — a missing modifier, a wrong modifier, or a code that doesn''t match the place of service. The billing office corrects the claim and resubmits it. You should not pay the bill while the corrected claim is pending. This process is free to you. If the billing office says you owe the money, push back — CO-4 is a provider coding error, not a patient responsibility. Common CO-4 scenarios: a procedure was billed without specifying left vs right side, an office-based service was billed with a hospital modifier, or two services were done the same day without the proper modifier to distinguish them. You don''t need to file a formal appeal for a CO-4 — the provider just needs to resubmit correctly.',
  'denial-codes',
  'Ask Denali about your denial code',
  '/app/chat',
  ARRAY['CMS — Medicare Claims Processing Manual Ch. 1', 'CMS — CARC/RARC Codes', 'CMS MLN — Proper Use of Modifiers'],
  ARRAY['medicare-general'],
  'CO-4 Medicare Denial Code: What It Means and How to Fix It',
  'CO-4 means a billing modifier was wrong on your claim. Learn what caused it, how your doctor''s office can fix it, and why you shouldn''t pay the bill.',
  true, NOW()
),

(
  'what-does-pr1-mean',
  'PR-1 Denial: Your Deductible Hasn''t Been Met Yet',
  'PR-1 doesn''t mean your claim was denied — it means you owe your annual deductible first.',
  'PR-1 means the amount shown is being applied to your Part B deductible ($257 in 2026). Once you meet the deductible, Medicare starts paying its share. This is normal early in the year — not an error.',
  'In January, Mike got his first Medicare bill of the year and saw "PR-1" next to a charge of $185. He called his doctor worried his claim was denied. It wasn''t — PR-1 simply means that amount is being applied toward your annual Part B deductible. In 2026, the Part B deductible is $257. Until you''ve paid that amount out of pocket for Medicare-covered services, you pay 100% of the approved cost. After you meet the deductible, Medicare pays 80% and you pay 20% for the rest of the year. PR-1 usually shows up early in the year when you haven''t used many services yet. Here''s what to know: The deductible resets January 1 each year. Only Medicare-approved amounts count toward your deductible (not the billed amount if it''s higher). Some services are exempt from the deductible — preventive services like your Annual Wellness Visit and most screenings are covered at 100% even before you meet the deductible. If you have a Medigap plan (like Plan G), your supplement insurance may cover the Part B deductible for you. Check your policy. PR-1 is a patient responsibility code (that''s what the "PR" means). It''s not an error, it''s not a denial, and there''s nothing to appeal. You do owe this amount. If you think you''ve already met your deductible for the year, check your Medicare Summary Notice or log into Medicare.gov to see your deductible status.',
  'denial-codes',
  'Check your deductible status with Denali',
  '/app/chat',
  ARRAY['Medicare.gov — Part B Costs', 'CMS — Medicare Deductibles 2026', 'CMS — Patient Responsibility Codes'],
  ARRAY['medicare-general'],
  'PR-1 Medicare Code: Your Deductible Explained',
  'PR-1 means the charge is applied to your Part B deductible ($257 in 2026). Learn when this is normal, how the deductible works, and when it resets.',
  true, NOW()
),

(
  'what-does-co27-mean',
  'CO-27 Denial: Expenses After Coverage Ended',
  'CO-27 means Medicare says the service happened after your coverage or benefit period ended.',
  'CO-27 means the service was provided after your Medicare coverage period, benefit period, or lifetime reserve days expired. This often relates to inpatient stays. Verify your coverage dates and benefit period status.',
  'When Betty received a CO-27 denial for her last two days in the hospital, she was confused — she''d been admitted through the emergency room, and Medicare had covered the first 8 days. CO-27 means Medicare determined the service was provided after your benefit period ended or your coverage terminated. This happens most often with inpatient hospital stays. Medicare Part A covers up to 60 days per benefit period with just a deductible (no daily cost). Days 61-90 cost a daily coinsurance ($431 per day in 2026). After 90 days, you use "lifetime reserve days" (60 total, $862/day in 2026). A new benefit period starts after you''ve been out of the hospital (or skilled nursing facility) for 60 consecutive days. If CO-27 appears on your claim, check these things: Was there a gap in your Medicare enrollment? Some people lose Part A if they stop paying premiums. Did your inpatient benefit period expire? Count the days — if you exceeded your covered days without realizing it, the remaining days would be denied. Was the service date after your discharge date? This could be a billing error — the hospital may have submitted the wrong dates. If you believe the denial is wrong: verify your coverage dates at Medicare.gov or by calling 1-800-MEDICARE. If it''s a billing error, contact the hospital. If your benefit period genuinely expired, ask about whether the hospital can write off the balance or set up a payment plan.',
  'denial-codes',
  'Ask Denali about your denial',
  '/app/chat',
  ARRAY['CMS — Medicare Benefit Policy Manual Ch. 5', 'Medicare.gov — Hospital Stays and Benefit Periods', 'CMS — CARC Code CO-27'],
  ARRAY['medicare-general'],
  'CO-27 Medicare Denial: Coverage Ended — What to Do',
  'CO-27 means Medicare says the service was after your coverage ended. Learn about benefit periods, lifetime reserve days, and how to verify your dates.',
  true, NOW()
),

(
  'how-long-does-medicare-appeal-take',
  'How Long Does a Medicare Appeal Take?',
  'Level 1 takes about 60 days — and 40% of patients who appeal win at this stage.',
  'Medicare has 5 appeal levels with specific timeframes. Level 1 (Redetermination) takes up to 60 days and is where most patients win. Each level has a filing deadline — miss it and you lose your right to that appeal.',
  'After getting denied for a back procedure, Carol wanted to know: how long will this take? The Medicare appeals process has 5 levels, each with defined timeframes and deadlines. Level 1 — Redetermination: Filed with the Medicare Administrative Contractor (MAC) that processed your claim. You have 120 days from the date on your MSN to file. Decision due in 60 days. About 40% of claims are overturned here. This is where most patients should start, and it''s often the only level needed. Level 2 — Reconsideration by a Qualified Independent Contractor (QIC): If Level 1 fails, you have 180 days to request reconsideration. Decision due in 60 days. The QIC is independent from the MAC that first denied you. Level 3 — Administrative Law Judge (ALJ) hearing: The claim must be worth at least $200 (2026 threshold). You have 60 days to request a hearing. Decision due in 90 days. You can present your case in person, by phone, or by video. Having a doctor''s letter is especially powerful at this level. Level 4 — Medicare Appeals Council review: 60 days to file. Decision due in 90 days. This is a paper review. Level 5 — Federal District Court: The claim must be worth at least $1,960 (2026). Most patients never reach this level. Total timeline if you go through all 5 levels: roughly 18-24 months. But most cases are decided at Level 1 or 2. Tips: File as soon as possible — don''t wait until the deadline. Include all supporting documentation with your first filing. Get your doctor to write a letter explaining medical necessity. Keep copies of everything you submit.',
  'appeals',
  'Start your appeal with Denali',
  '/app/chat',
  ARRAY['CMS — Medicare Appeals Process', 'Medicare.gov — How to File an Appeal', 'OMHA — Office of Medicare Hearings and Appeals'],
  ARRAY['medicare-general'],
  'Medicare Appeal Timeline: How Long Each Level Takes',
  'Medicare appeals have 5 levels. Level 1 takes 60 days and 40% of patients win. Learn the timeline, deadlines, and tips for each appeal level.',
  true, NOW()
),

(
  'telehealth-medicare-coverage-2026',
  'Telehealth and Medicare: What''s Covered in 2026',
  'Medicare expanded telehealth during COVID — most of those expansions are now permanent.',
  'Medicare covers telehealth visits for most services that were previously in-person only, including mental health, chronic disease management, and specialist consultations. Geographic restrictions have been removed for most services.',
  'When Margaret''s rheumatologist offered a video visit, she wasn''t sure Medicare would cover it. It does. Medicare has dramatically expanded telehealth coverage, and most pandemic-era expansions have been made permanent or extended through 2026. What''s covered: office visits with your primary care doctor or specialist, mental health and behavioral health counseling (no geographic restrictions), chronic care management check-ins, physical and occupational therapy evaluations (some services), diabetes self-management training (DSMT), medical nutrition therapy (MNT), and many more. You can use video calls (smartphone, tablet, or computer) or audio-only phone calls for many services. The important details: copays for telehealth are the same as in-person visits (typically 20% after deductible). Your provider must be enrolled in Medicare. Telehealth can be provided from your home — the previous requirement to be at a designated health facility has been eliminated for most services. Mental health note: after an initial in-person visit, mental health services can be delivered entirely via telehealth with no geographic restrictions. This is especially valuable for rural Medicare patients. What''s NOT covered via telehealth: procedures requiring physical examination, lab draws, imaging, emergency services, and some initial specialist evaluations. Tips: confirm with your provider that they''ll bill the visit as telehealth (proper coding). Make sure your internet connection is stable. Have your medication list and vital signs (if you have a home blood pressure monitor) ready. Test your video connection before the appointment.',
  'coverage',
  'Ask about telehealth coverage',
  '/app/chat',
  ARRAY['CMS — Medicare Telehealth Services', 'Medicare.gov — Telehealth', 'CMS MLN — Telehealth Services Fact Sheet'],
  ARRAY['medicare-general'],
  'Medicare Telehealth Coverage 2026: What''s Covered by Video Visit',
  'Medicare covers most doctor visits via telehealth in 2026 — including mental health, chronic disease, and specialist consultations. Learn what qualifies.',
  true, NOW()
)

ON CONFLICT (slug) DO NOTHING;
