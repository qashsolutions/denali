-- Denali.health Pre-Diabetes Blog Expansion — 10 new articles
-- Focused on pre-diabetes prevention, healthy eating, lifestyle changes
-- Sources: CDC, NIH/NIDDK, ADA, Harvard Health, AHA, Mayo Clinic
-- Idempotent: ON CONFLICT (slug) DO NOTHING

INSERT INTO blog_posts (slug, title, kicker, key_message, body, category, cta_text, cta_url, sources, tags, meta_title, meta_description, published, published_at) VALUES

-- ============================================================
-- PRE-DIABETES SPECIFIC (10 new posts)
-- ============================================================

(
  'how-to-know-if-you-are-prediabetic',
  'How to Know If You''re Pre-Diabetic: Risk Factors and Testing',
  'More than 2 in 5 American adults have pre-diabetes — and 80% don''t know it.',
  'Pre-diabetes rarely causes symptoms. The only way to know is a blood test: A1C between 5.7-6.4%, fasting glucose 100-125 mg/dL, or OGTT 140-199 mg/dL. Medicare covers screening for free.',
  'Barbara felt fine. No unusual thirst, no fatigue, no blurry vision. At her annual wellness visit, her doctor ordered routine bloodwork. Her A1C came back at 6.0% — pre-diabetic. She was stunned. Pre-diabetes almost never causes noticeable symptoms. That''s what makes it dangerous: more than 2 in 5 American adults have it, but 8 in 10 don''t know, according to the CDC. Three blood tests can detect it. An A1C between 5.7% and 6.4% means pre-diabetes — it measures your average blood sugar over 3 months. A fasting blood glucose between 100 and 125 mg/dL is another indicator. And an oral glucose tolerance test reading between 140 and 199 mg/dL after 2 hours confirms it. Your risk goes up if you are over 45, carry extra weight (especially around the middle), have a parent or sibling with diabetes, are physically active fewer than 3 times a week, or have had gestational diabetes. For people over 65, here is important context: a Harvard Health study found that fewer than 12% of adults over 71 with pre-diabetes progressed to Type 2 diabetes over 6.5 years. The condition progresses more slowly in older adults — but lifestyle changes still matter for heart health and overall well-being. Medicare covers diabetes screening tests at no cost as part of your preventive benefits. You can get tested twice a year if your doctor says you are at risk. Don''t wait for symptoms that may never come. Ask for your A1C at your next visit.',
  'coverage',
  'Check your pre-diabetes risk with Denali',
  '/app/chat?topic=diabetes',
  ARRAY['CDC — Prediabetes: Your Chance to Prevent Type 2 Diabetes', 'ADA — Diabetes Diagnosis', 'NIDDK — The A1C Test', 'Harvard Health — Prediabetes Diagnosis as an Older Adult'],
  ARRAY['diabetes'],
  'How to Know If You Are Pre-Diabetic — Risk Factors, Tests, and Medicare Coverage',
  'Pre-diabetes affects over 98 million Americans with no symptoms. Learn the 3 blood tests that detect it, your risk factors, and how Medicare covers screening.',
  true, NOW()
),

(
  'fiber-blood-sugar-connection',
  'The Fiber–Blood Sugar Connection: Why It Matters for Pre-Diabetes',
  'Fiber is the one carbohydrate that does not spike your blood sugar.',
  'Soluble fiber slows digestion and blunts blood sugar spikes after meals. Research shows that 13+ grams of soluble fiber daily can lower A1C by about 0.60% — similar to some medications. Most Americans get far less fiber than recommended.',
  'When Helen was told her A1C was 5.8%, her doctor said something she didn''t expect: eat more carbs — the right kind. Fiber is a carbohydrate, but unlike sugar and starch, your body cannot break it down or absorb it. That means fiber does not spike your blood sugar the way other carbs do. Soluble fiber — found in oats, beans, apples, and flaxseed — dissolves in water and forms a gel-like substance in your stomach. This gel slows digestion and blunts the blood sugar rise after eating. Research published through the American Diabetes Association found that consuming at least 13 grams of soluble fiber per day reduced A1C levels by approximately 0.60%. That is a clinically meaningful drop — similar to what some diabetes medications achieve. The ADA recommends 30 to 50 grams of total dietary fiber daily, with at least 10 to 20 grams from soluble sources. Most Americans fall far short: the average intake is only about 15 grams total. Simple ways to add fiber: start your day with oatmeal (4 grams per cup). Add a half cup of black beans to lunch (7.5 grams). Snack on an apple with the skin on (4.4 grams). Choose brown rice over white (3.5 grams vs 0.6 grams per cup). Swap white bread for 100% whole wheat. Increase fiber gradually over 2-3 weeks to avoid bloating, and drink plenty of water. Medicare covers Medical Nutrition Therapy with a registered dietitian who can help build a high-fiber eating plan tailored to your needs and preferences.',
  'coverage',
  'Ask about fiber and blood sugar',
  '/app/chat?topic=diabetes',
  ARRAY['CDC — Fiber: The Carb That Helps You Manage Diabetes', 'ADA — Standards of Care in Diabetes 2025', 'PMC — Increasing Dietary Fiber Intake for T2DM Management'],
  ARRAY['diabetes'],
  'Fiber and Blood Sugar: How Fiber Helps Prevent Pre-Diabetes',
  'Soluble fiber can lower A1C by 0.60% — similar to medication. Learn which high-fiber foods help control blood sugar and how Medicare covers nutrition counseling.',
  true, NOW()
),

(
  'mediterranean-diet-diabetes-prevention',
  'The Mediterranean Diet: Why Doctors Recommend It for Pre-Diabetes',
  'A landmark study found the Mediterranean diet cut new diabetes cases by up to 52%.',
  'The PREDIMED trial showed that a Mediterranean diet rich in olive oil reduced the risk of developing Type 2 diabetes by 52% — without requiring calorie counting or weight loss. Combined with exercise, the risk dropped by nearly a third.',
  'When Frank''s doctor told him his blood sugar was creeping into pre-diabetes range, she didn''t hand him a list of foods to avoid. Instead, she said: eat like you''re in southern Italy. The Mediterranean diet has more clinical evidence behind it than almost any other eating pattern for diabetes prevention. The landmark PREDIMED trial followed over 3,500 adults and found that those eating a Mediterranean diet supplemented with extra-virgin olive oil had 52% fewer new diabetes cases than the control group. The researchers saw 16 new diabetes cases per 1,000 people in the olive oil group versus nearly 24 in the comparison group — achieved without counting calories or requiring weight loss. What does Mediterranean eating look like? Vegetables, fruits, whole grains, beans, nuts, and seeds form the base. Olive oil replaces butter. Fish and poultry appear several times a week. Red meat is occasional, not daily. Moderate amounts of cheese and yogurt round things out. The approach works because extra-virgin olive oil decreases blood sugar after meals and improves insulin response. Harvard researchers found that combining this eating style with moderate physical activity can cut diabetes risk by 31%. The diet is also heart-protective — important because pre-diabetes raises cardiovascular risk. You don''t have to overhaul your kitchen overnight. Start with one change: cook with olive oil instead of butter. Add a handful of nuts as a snack. Build a salad into lunch. Medicare covers nutrition counseling with a registered dietitian who can help you adapt Mediterranean eating to your tastes and budget.',
  'coverage',
  'Ask about Mediterranean diet and Medicare',
  '/app/chat?topic=diabetes',
  ARRAY['NEJM — PREDIMED Trial', 'Harvard T.H. Chan — Mediterranean Diet and Diabetes Risk Reduction', 'Harvard Health — Combining Mediterranean Diet with Lifestyle Changes', 'PMC — Mediterranean Diet Effects on T2D Prevention'],
  ARRAY['diabetes'],
  'Mediterranean Diet for Pre-Diabetes: What the PREDIMED Study Proved',
  'The PREDIMED trial found a Mediterranean diet cut diabetes risk by 52%. Learn what to eat, how it works for blood sugar, and how Medicare covers nutrition support.',
  true, NOW()
),

(
  'carb-counting-basics-blood-sugar',
  'Carb Counting Basics: A Simple Guide for Blood Sugar Control',
  'Carbs affect blood sugar the most — but you don''t need to eliminate them.',
  'The CDC defines one carb serving as 15 grams. Eating a consistent number of carb servings at each meal — rather than varying wildly — helps keep blood sugar steady. Focus on quality over restriction: whole grains, beans, and vegetables over processed foods.',
  'After Robert''s A1C came back at 6.2%, his first instinct was to cut out all carbs. His dietitian stopped him: the goal is not to eliminate carbohydrates but to choose the right ones and eat consistent amounts. Carbs have the biggest effect on blood sugar, but your body needs them for energy. The key is quality and consistency. The CDC defines one carb serving as about 15 grams. A slice of whole wheat bread, a small apple, a third cup of cooked rice, or a half cup of beans each equals roughly one serving. Most people with pre-diabetes do well with 3 to 4 carb servings per meal, but there is no universal number. Your ideal amount depends on your age, weight, activity level, and how your body responds. The ADA''s 2025 Standards of Care emphasize choosing ''minimally processed, nutrient-dense, high-fiber sources of carbohydrate.'' That means brown rice over white rice. Steel-cut oats over sugary cereal. Whole fruit over fruit juice. Sweet potatoes over French fries. Beans and lentils over packaged snack bars. Consistency matters as much as quality. Eating roughly the same amount of carbs at the same times each day helps your body manage blood sugar more predictably than eating 20 grams at breakfast and 80 grams at dinner. Simple tracking approach: use the ADA plate method. Fill half your 9-inch plate with non-starchy vegetables, a quarter with lean protein, and a quarter with a quality carb. No counting required. Medicare covers Medical Nutrition Therapy with a registered dietitian who can help you find the carb balance that works for your body.',
  'coverage',
  'Get personalized carb guidance',
  '/app/chat?topic=diabetes',
  ARRAY['CDC — Carb Counting to Manage Blood Sugar', 'ADA — Standards of Care in Diabetes 2025', 'ADA — Diabetes Plate Method'],
  ARRAY['diabetes'],
  'Carb Counting for Pre-Diabetes: A Beginner''s Guide to Blood Sugar Control',
  'Learn how carb counting works for pre-diabetes. The CDC defines 1 serving as 15g carbs. Focus on quality, consistency, and the ADA plate method — no elimination needed.',
  true, NOW()
),

(
  'grocery-shopping-guide-prediabetes',
  'A Grocery Shopping Guide for Pre-Diabetes',
  'What you put in your cart determines what ends up on your plate.',
  'The ADA recommends the 10% rule for food labels: choose products with at least 10% daily value for fiber and protein, and less than 10% for sodium and added sugars. Stock up on vegetables, beans, whole grains, and lean proteins.',
  'Maria used to dread the grocery store after her pre-diabetes diagnosis. Every aisle felt like a minefield. Her dietitian gave her a simple framework that changed everything. Start around the edges. Fresh produce, lean meats, dairy, and whole grains line the perimeter of most stores. The middle aisles tend to hold more processed foods. For your cart, the ADA recommends the Diabetes Plate approach: half your meals should be non-starchy vegetables, so load up on leafy greens, broccoli, bell peppers, tomatoes, cucumbers, and green beans. These are low in carbs and high in fiber. A quarter of your plate is lean protein: chicken breast, fish (especially salmon and tuna), eggs, and beans. Beans do double duty — they are protein and fiber powerhouses. The last quarter is quality carbs: brown rice, quinoa, sweet potatoes, whole wheat bread, and oats. When reading labels, the ADA suggests the 10% rule. Look for at least 10% daily value of fiber and protein — those are the nutrients that help with blood sugar. Look for less than 10% daily value of sodium and added sugars — those are the ones to limit. What to skip: sugar-sweetened beverages are the single biggest source of added sugar in the American diet. The CDC recommends replacing soda, sweet tea, and fruit drinks with water as a first step. Also minimize packaged snack foods, processed deli meats, and anything with trans fats. Budget-friendly tips: frozen vegetables are just as nutritious as fresh and much cheaper. Dried beans cost a fraction of canned. Store-brand whole grains are identical to name brands. Buy seasonal produce and plan meals around what is on sale.',
  'coverage',
  'Ask about nutrition and pre-diabetes',
  '/app/chat?topic=diabetes',
  ARRAY['ADA — Your Grocery Shopping Game Plan', 'CDC — On Your Way to Preventing Type 2 Diabetes', 'ADA — Diabetes Plate Method'],
  ARRAY['diabetes'],
  'Grocery Shopping Guide for Pre-Diabetes: What to Buy and What to Skip',
  'Use the ADA 10% label rule and Diabetes Plate method to fill your cart with blood sugar-friendly foods. Budget tips, best choices, and what to avoid.',
  true, NOW()
),

(
  'stress-blood-sugar-prediabetes',
  'How Stress Affects Your Blood Sugar — and What to Do About It',
  'Stress hormones can raise blood sugar even when you haven''t eaten.',
  'When you are stressed, cortisol triggers your liver to release extra glucose and blocks your muscles from absorbing it. Chronic stress creates sustained high blood sugar that can push pre-diabetes toward diabetes. Proven stress-reduction techniques directly lower blood sugar.',
  'James had been watching his diet carefully since his pre-diabetes diagnosis. He was eating well and walking daily. But during a stressful month at home — dealing with a family health crisis — his blood sugar numbers climbed. His doctor wasn''t surprised. When you are under stress, your body releases cortisol, the ''fight or flight'' hormone. Cortisol does two things that raise blood sugar: it signals your liver to release stored glucose into your bloodstream, and it blocks the receptors on your muscle cells that normally absorb that glucose. The result is higher blood sugar even if you have not eaten anything. This was useful when our ancestors needed quick energy to outrun danger. But modern chronic stress — money worries, caregiving, health concerns — keeps cortisol elevated for days or weeks. Over time, this sustained cortisol creates insulin resistance and can push pre-diabetes into Type 2 diabetes. Research shows that mindfulness interventions lowered average A1C from 5.9% to 5.6% in people with pre-diabetes — a meaningful drop in a range where every tenth of a percent matters. Sleep matters too. Poor sleep directly raises cortisol and adrenaline levels, creating a stress-like hormonal state. Aim for 7 to 8 hours per night. Evidence-based strategies that directly lower cortisol and blood sugar: a 10-minute walk after meals (exercise is the single most effective cortisol reducer), deep breathing exercises (4 counts in, hold 4, out for 6), limiting news and social media before bed, keeping a consistent sleep schedule, and talking to someone — isolation amplifies stress. If stress feels overwhelming, talk to your doctor. Medicare covers mental health services including counseling visits.',
  'coverage',
  'Ask about stress and blood sugar',
  '/app/chat?topic=diabetes',
  ARRAY['PMC — Cortisol Dysregulation: The Bidirectional Link Between Stress and Diabetes', 'PMC — Stress-Induced Diabetes: A Review', 'PMC — Mindfulness-Based Stress Reduction and Diabetes'],
  ARRAY['diabetes'],
  'Stress and Blood Sugar: How Cortisol Affects Pre-Diabetes',
  'Stress hormones raise blood sugar even without eating. Learn how cortisol causes insulin resistance and proven strategies — walking, sleep, mindfulness — that lower it.',
  true, NOW()
),

(
  'prediabetes-heart-disease-connection',
  'Pre-Diabetes and Heart Disease: The Connection Your Doctor Wants You to Know',
  'Pre-diabetes raises your risk of heart disease before diabetes ever develops.',
  'People with pre-diabetes have a 15% greater risk of cardiovascular disease. But reversing pre-diabetes to normal blood sugar cuts heart disease death risk by about 50%. Every step you take to lower blood sugar also protects your heart.',
  'When Patricia''s doctor flagged her A1C of 5.9%, Patricia thought the main risk was eventually getting diabetes. Her doctor explained something more urgent: pre-diabetes is already affecting her heart. The American College of Cardiology found that serious cardiovascular events occurred in 18% of people with pre-diabetes compared with 11% of people with normal blood sugar over five years — nearly doubling the chance of a major heart event. Adults with diabetes are nearly twice as likely to have heart disease or stroke, according to the American Heart Association. Every 80 seconds, an adult with diabetes in the U.S. is hospitalized for heart disease. The NIDDK reports that adults with diabetes face a twofold to fourfold greater risk of dying from cardiovascular disease. But here is the hopeful part. Harvard Health research found that people who reversed their pre-diabetes to normal blood sugar reduced their risk of dying from heart disease by approximately 50%. Heart attacks, strokes, and related complications were 32% lower among those who achieved reversal. The lifestyle changes that lower blood sugar and prevent diabetes are the same ones that protect your heart: regular physical activity (150 minutes of walking per week), a diet rich in vegetables, fiber, and healthy fats, maintaining a healthy weight, managing stress, and not smoking. This is why doctors take pre-diabetes seriously even in patients who feel perfectly fine. Your blood sugar and your heart health are the same fight. Medicare covers cardiovascular screening blood tests, diabetes screening, and nutrition counseling — the tools you need to address both risks together.',
  'coverage',
  'Check your heart and diabetes risk',
  '/app/chat?topic=diabetes',
  ARRAY['ACC — Prediabetes May Not Be as Benign as Once Thought', 'AHA — Cardiovascular Disease and Diabetes', 'NIDDK — Diabetes, Heart Disease & Stroke', 'Harvard Health — Reversing Prediabetes May Slash Heart Disease Risk by Half'],
  ARRAY['diabetes'],
  'Pre-Diabetes and Heart Disease Risk: What the Research Shows',
  'Pre-diabetes raises cardiovascular risk by 15%. But reversing it cuts heart disease death risk by 50%. Learn the connection and what Medicare covers.',
  true, NOW()
),

(
  'water-hydration-blood-sugar',
  'Why Staying Hydrated Helps Control Blood Sugar',
  'Dehydration can raise your blood sugar even if you are eating well.',
  'A 9-year study found that drinking more than 1 liter of water daily was linked to significantly lower risk of high blood sugar. When you are dehydrated, your body releases hormones that tell your liver to produce more glucose. Water is the simplest blood sugar tool.',
  'George had been following his meal plan faithfully after his pre-diabetes diagnosis. But on hot days when he forgot to drink enough water, his blood sugar readings were noticeably higher. It was not a coincidence. When your body is low on water, it releases a hormone called vasopressin to help conserve fluid. Vasopressin has a side effect: it signals your liver to produce and release extra glucose into your bloodstream. Research shows that this hormonal response can raise blood sugar levels by 10 to 15 percent — a meaningful amount when you are trying to keep numbers in the pre-diabetes range. A 9-year French study published in the journal Diabetes Care followed over 3,600 adults and found that people who drank more than 1 liter of water per day had significantly lower odds of developing high blood sugar compared to those who drank less than half a liter. Dehydration also concentrates the glucose already in your blood. Think of it like sugar in a glass: the same amount of sugar in less water makes a sweeter solution. Even mild dehydration in people with diabetes can increase blood sugar by 50 to 110 mg/dL. Practical tips: keep a water bottle visible throughout the day. Drink a glass of water before each meal — this also helps with portion control. If plain water bores you, add slices of lemon, cucumber, or mint. Herbal tea counts. Coffee in moderation counts. What does not count: soda, sweet tea, fruit juice, and sports drinks all add sugar that directly spikes blood glucose. The NIDDK recommends replacing sweetened beverages with water as one of the first and most accessible steps for diabetes prevention. It costs nothing and you can start today.',
  'coverage',
  'Ask about hydration and blood sugar',
  '/app/chat?topic=diabetes',
  ARRAY['ADA/Diabetes Care — Low Water Intake and Risk for New-Onset Hyperglycemia', 'PMC — Hydration, Arginine Vasopressin, and Glucoregulatory Health', 'NIDDK — Preventing Type 2 Diabetes'],
  ARRAY['diabetes'],
  'Water and Blood Sugar: How Hydration Helps Control Pre-Diabetes',
  'Dehydration raises blood sugar through hormonal changes. A 9-year study shows drinking 1+ liter of water daily lowers hyperglycemia risk. Learn simple hydration strategies.',
  true, NOW()
),

(
  'intermittent-fasting-prediabetes-research',
  'Intermittent Fasting and Pre-Diabetes: What the Research Actually Says',
  'The ADA now recognizes time-restricted eating as a ''helpful and safe tool'' for blood sugar.',
  'An NIH-funded study found that eating only between noon and 8 PM led to similar blood sugar improvements as traditional calorie-counting diets. But fasting is not right for everyone — talk to your doctor first, especially if you take medications.',
  'When Dorothy read about intermittent fasting online, she was curious but skeptical. At 68, was it safe? And would it actually help her pre-diabetes? The research is newer than for diet and exercise, but growing. An NIH-funded study compared two groups of adults with elevated blood sugar: one ate only between noon and 8 PM (time-restricted eating), while the other reduced calories by 25%. After six months, both groups achieved similarly healthy decreases in blood glucose levels. The fasting group lost an average of 3.6% of body weight. Researchers concluded that time-restricted eating might be an effective alternative for people who struggle with conventional dieting. The ADA''s 2024 Standards of Care formally recognized intermittent fasting as a ''helpful and safe tool'' for blood sugar management — a significant endorsement from the field''s most influential organization. Clinical trials have shown that eating earlier in the day and stopping by early afternoon reduced blood sugar fluctuations within as little as one week. Important caution: this approach is not for everyone. The NIH explicitly warns that people taking diabetes medications or drugs that affect blood sugar must consult their doctor before trying intermittent fasting. Medication timing and hypoglycemia risk need to be carefully managed. If you skip breakfast and take a morning diabetes medication, your blood sugar could drop dangerously low. Start with a conversation with your doctor. If they give the green light, begin gradually — try a 12-hour eating window first (say, 7 AM to 7 PM) before narrowing to 8 hours. Stay hydrated during fasting hours. And monitor your blood sugar more frequently during the first few weeks to see how your body responds.',
  'coverage',
  'Ask about fasting and blood sugar',
  '/app/chat?topic=diabetes',
  ARRAY['NIH News in Health — Intermittent Fasting and Type 2 Diabetes', 'ADA — Standards of Care in Diabetes 2024', 'Endocrine Society — Early Time-Restricted Feeding Improves Blood Sugar'],
  ARRAY['diabetes'],
  'Intermittent Fasting for Pre-Diabetes: NIH and ADA Research Findings',
  'The ADA recognizes intermittent fasting as safe for blood sugar control. NIH research shows time-restricted eating works as well as calorie counting. Safety caveats for Medicare patients.',
  true, NOW()
),

(
  'family-history-diabetes-what-you-control',
  'Family History and Diabetes: What You Can''t Change vs. What You Can',
  'Having a parent with diabetes doubles your risk — but lifestyle changes cut it by 58%.',
  'Genetics accounts for only about 10% of Type 2 diabetes risk. The landmark Diabetes Prevention Program proved that losing 5-7% of body weight and walking 150 minutes weekly reduced diabetes risk by 58% overall — and 71% in adults over 60 — regardless of family history.',
  'When Carol''s mother was diagnosed with Type 2 diabetes, Carol worried she was next. Her mother, grandmother, and an uncle all had it. Was she destined to follow? The numbers are real: having one parent with diabetes doubles your risk. Having both parents with it raises your risk more than threefold. A sibling with diabetes means your risk is about 4.5 times higher than someone with no family history. But here is what matters more: genetics explains only about 10% of Type 2 diabetes risk. The majority of what looks like ''inherited'' diabetes actually comes from shared family habits — how you eat, how active you are, and environmental factors that can be changed. The most powerful evidence comes from the Diabetes Prevention Program, the largest study of its kind, funded by the NIDDK. It proved that losing just 5 to 7 percent of body weight and walking 150 minutes per week reduced diabetes risk by 58% overall. For adults over 60, the reduction was even more dramatic: 71%. These results held regardless of family history or genetic risk. The benefits lasted. A 22-year follow-up study found that the lifestyle group still had 25% lower diabetes risk two decades later. That is not a temporary fix — it is a lasting change in trajectory. What does 5 to 7 percent weight loss look like? For a 180-pound person, it is just 9 to 13 pounds. What does 150 minutes of weekly activity look like? About 22 minutes of brisk walking a day. You cannot change your parents or your genes. But you can change your plate, your walking shoes, and your daily habits. Medicare covers the Diabetes Prevention Program for free if you have pre-diabetes — a year-long coaching program with 26 sessions. Ask your doctor for a referral.',
  'coverage',
  'Ask about the Medicare prevention program',
  '/app/chat?topic=diabetes',
  ARRAY['NIDDK — Diabetes Prevention Program', 'ADA — DPPOS 22-Year Follow-Up Data', 'PMC — Family History and Prediabetes Burden (NHANES 2009-2014)', 'CDC — Family History of Diabetes'],
  ARRAY['diabetes'],
  'Family History and Diabetes Risk: What Genetics vs. Lifestyle Research Shows',
  'A parent with diabetes doubles your risk, but lifestyle changes reduce it by 58-71%. The 22-year DPP study proves genetics is not destiny. Learn what you can control.',
  true, NOW()
)

ON CONFLICT (slug) DO NOTHING;
