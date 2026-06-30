#!/usr/bin/env python3
"""
Denali — upload/parse test fixture generator.

Produces native TEXT-LAYER PDFs (the only thing the Phase-1 upload pipeline
accepts — no OCR, scanned/image PDFs are rejected) that exercise the
/api/parse-report extractor and the on-device analysis layer.

Coverage: one report per <sex>_<healthissue> across every category we listed,
for male AND female where clinically applicable, plus negative fixtures.

ALL DATA IS SYNTHETIC. Names / DOB / MRN are deliberately fake and present so
we can verify the parser STRIPS identifiers (it must never echo PII).

Run:  cd mobile/test-fixtures && python3 generate_fixtures.py
Out:  reports/*.pdf  +  manifest.json  (expected parsed observations)
Deps: reportlab (pip install reportlab)  — verify with pdftotext.
"""

import json
import os
import subprocess

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "reports")
os.makedirs(OUT, exist_ok=True)

styles = getSampleStyleSheet()
H1 = ParagraphStyle("h1", parent=styles["Title"], fontSize=15, spaceAfter=2)
SUB = ParagraphStyle("sub", parent=styles["Normal"], fontSize=9,
                     textColor=colors.HexColor("#555555"))
SYN = ParagraphStyle("syn", parent=styles["Normal"], fontSize=8,
                     textColor=colors.HexColor("#9a3412"))
SECT = ParagraphStyle("sect", parent=styles["Heading2"], fontSize=11,
                      spaceBefore=10, spaceAfter=4)
BODY = ParagraphStyle("body", parent=styles["Normal"], fontSize=9.5,
                      leading=13)
FOOT = ParagraphStyle("foot", parent=styles["Normal"], fontSize=7.5,
                      textColor=colors.HexColor("#777777"))


# ── synthetic identities (parser MUST strip these) ────────────────────────
def ident(sex):
    if sex == "Male":
        return dict(name="John Q. Sample", dob="1959-08-22", mrn="SYN-M-4471",
                    age=66)
    return dict(name="Jane R. Example", dob="1962-11-04", mrn="SYN-F-7732",
                age=63)


def render(fx):
    """fx -> writes reports/<file>.pdf"""
    path = os.path.join(OUT, fx["file"] + ".pdf")
    doc = SimpleDocTemplate(path, pagesize=LETTER,
                            topMargin=0.7 * inch, bottomMargin=0.7 * inch,
                            leftMargin=0.8 * inch, rightMargin=0.8 * inch,
                            title=fx["title"], author=fx["facility"])
    story = []
    story.append(Paragraph(fx["facility"], H1))
    story.append(Paragraph(fx["title"], SUB))
    story.append(Paragraph(
        "SYNTHETIC TEST DOCUMENT — not a real patient; values for QA only.",
        SYN))
    story.append(Spacer(1, 8))

    idn = ident(fx["sex"])
    pt = [
        ["Patient:", idn["name"], "MRN:", idn["mrn"]],
        ["DOB:", idn["dob"], "Sex:", fx["sex"]],
        ["Age:", str(idn["age"]), "Collected:", fx["collected"]],
        ["Ordering provider:", fx.get("provider", "A. Clinician, MD"),
         "Reported:", fx["reported"]],
    ]
    pth = Table(pt, colWidths=[1.2 * inch, 2.4 * inch, 1.0 * inch, 1.7 * inch])
    pth.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#555555")),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#555555")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(pth)
    story.append(Spacer(1, 6))

    if fx.get("intro"):
        story.append(Paragraph(fx["intro"], BODY))
        story.append(Spacer(1, 4))

    for sec in fx.get("sections", []):
        story.append(Paragraph(sec["name"], SECT))
        data = [["Test", "Result", "Units", "Reference range", "Flag"]]
        data += [list(r) for r in sec["rows"]]
        t = Table(data, colWidths=[2.3 * inch, 0.9 * inch, 0.9 * inch,
                                   1.9 * inch, 0.5 * inch], repeatRows=1)
        t.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2f5")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#cccccc")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1),
             [colors.white, colors.HexColor("#f7f9fa")]),
            ("TEXTCOLOR", (4, 1), (4, -1), colors.HexColor("#b91c1c")),
            ("FONTNAME", (4, 1), (4, -1), "Helvetica-Bold"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(t)

    if fx.get("narrative"):
        story.append(Spacer(1, 8))
        for para in fx["narrative"]:
            story.append(Paragraph(para, BODY))
            story.append(Spacer(1, 4))

    story.append(Spacer(1, 14))
    story.append(Paragraph(
        "Electronically signed by " + fx.get("provider", "A. Clinician, MD") +
        ". This is a synthetic QA document and does not reflect a real "
        "individual. Results are for testing the Denali upload pipeline only.",
        FOOT))
    doc.build(story)
    return path


# ── builders: each returns (sections, narrative, expected, rtype, title) ──
def f(file, sex, rtype, title, facility, sections, expected,
      intro=None, narrative=None, provider="A. Clinician, MD"):
    return dict(file=file, sex=sex, rtype=rtype, title=title, facility=facility,
                sections=sections, expected=expected, intro=intro,
                narrative=narrative, provider=provider,
                collected="2026-05-12", reported="2026-05-13")


FIX = []

# 1. DIABETES (M/F)
for sex, tag in (("Male", "male"), ("Female", "female")):
    FIX.append(f(
        f"{tag}_diabetes", sex, "lab", "Outpatient Diabetes Laboratory Report",
        "Cascade Regional Laboratory",
        [{"name": "Glycemic Panel", "rows": [
            ("Hemoglobin A1c", "7.8", "%",
             "<5.7 normal; 5.7-6.4 prediabetes; >=6.5 diabetes", "HIGH"),
            ("Estimated Avg Glucose (eAG)", "177", "mg/dL", "-", ""),
            ("Glucose, Fasting", "162", "mg/dL", "70-99", "HIGH"),
        ]}],
        [("Hemoglobin A1c", "LOINC", "4548-4", 7.8, "%"),
         ("Fasting glucose", "LOINC", "1558-6", 162, "mg/dL")],
        intro="Reason for testing: type 2 diabetes monitoring."))

# 2. CARDIAC (M/F) — lipids + hsCRP + vitals
for sex, tag, hdl in (("Male", "male", "37"), ("Female", "female", "49")):
    FIX.append(f(
        f"{tag}_cardiac", sex, "lab", "Cardiovascular Risk Panel",
        "Mercy Heart & Vascular Clinic",
        [{"name": "Lipid Panel", "rows": [
            ("Cholesterol, Total", "248", "mg/dL", "<200", "HIGH"),
            ("LDL Cholesterol", "166", "mg/dL", "<100", "HIGH"),
            ("HDL Cholesterol", hdl, "mg/dL",
             ">40 (M) / >50 (F)", "LOW"),
            ("Triglycerides", "214", "mg/dL", "<150", "HIGH"),
         ]},
         {"name": "Inflammation & Vitals", "rows": [
            ("hs-C-reactive protein", "3.6", "mg/L",
             "<1.0 low; 1.0-3.0 avg; >3.0 high", "HIGH"),
            ("Blood pressure, systolic", "148", "mmHg", "<120", "HIGH"),
            ("Blood pressure, diastolic", "92", "mmHg", "<80", "HIGH"),
            ("Heart rate, resting", "78", "bpm", "60-100", ""),
         ]}],
        [("Total cholesterol", "LOINC", "2093-3", 248, "mg/dL"),
         ("LDL cholesterol", "LOINC", "18262-6", 166, "mg/dL"),
         ("HDL cholesterol", "LOINC", "2085-9", int(hdl), "mg/dL"),
         ("Triglycerides", "LOINC", "2571-8", 214, "mg/dL"),
         ("hs-CRP", "LOINC", "30522-7", 3.6, "mg/L"),
         ("BP systolic", "LOINC", "8480-6", 148, "mmHg"),
         ("BP diastolic", "LOINC", "8462-4", 92, "mmHg"),
         ("Heart rate", "LOINC", "8867-4", 78, "bpm")]))

# 3. OBESITY / METABOLIC (M/F) — height+weight+waist+BMI (BMI bands)
for sex, tag, ht_cm, wt_kg, waist, bmi in (
        ("Male", "male", 178, 109, 114, 34.4),
        ("Female", "female", 163, 104, 108, 39.1)):
    FIX.append(f(
        f"{tag}_obesity", sex, "visit", "Weight Management Visit Summary",
        "Northgate Family Medicine",
        [{"name": "Anthropometrics / Vitals", "rows": [
            ("Body height", str(ht_cm), "cm", "-", ""),
            ("Body weight", str(wt_kg), "kg", "-", ""),
            ("Waist circumference", str(waist), "cm",
             "<102 (M) / <88 (F)", "HIGH"),
            ("Body mass index (BMI)", str(bmi), "kg/m2",
             "18.5-24.9 healthy", "HIGH"),
         ]}],
        [("Body height", "LOINC", "8302-2", ht_cm, "cm"),
         ("Body weight", "LOINC", "29463-7", wt_kg, "kg"),
         # 8280-0 = measured value; NOT 56086-2 ("Adult Waist Circumf.
         # Protocol", a panel/selector concept that carries no Quantity).
         ("Waist circumference", "LOINC", "8280-0", waist, "cm"),
         ("Body mass index", "LOINC", "39156-5", bmi, "kg/m2")],
        intro="Visit for obesity management and counseling.",
        narrative=[
            "Assessment: BMI %s kg/m2, consistent with obesity. Lifestyle "
            "counseling provided." % bmi]))

# 4. BONE DENSITY (M/F) — DXA T-score (bands)
for sex, tag, hip, spine in (("Male", "male", -1.6, -1.9),
                             ("Female", "female", -2.7, -2.9)):
    FIX.append(f(
        f"{tag}_bonedensity", sex, "lab",
        "DXA Bone Densitometry Report",
        "Summit Imaging Center",
        [{"name": "Bone Mineral Density (DXA)", "rows": [
            ("Femoral neck (hip) T-score", str(hip), "T-score",
             ">=-1.0 normal; -1.0 to -2.5 low; <=-2.5 osteoporosis",
             "LOW" if hip <= -1.0 else ""),
            ("Lumbar spine T-score", str(spine), "T-score",
             ">=-1.0 normal; <=-2.5 osteoporosis",
             "LOW" if spine <= -1.0 else ""),
            # age-matched Z-score runs ~1.4 SD above the T-score by the 60s.
            ("Femoral neck Z-score", str(round(hip + 1.4, 1)), "Z-score",
             "-", ""),
         ]}],
        [("Bone density hip T-score", "LOINC", "38264-8", hip, "T-score")],
        intro="Indication: osteoporosis screening.",
        narrative=[
            "Impression: %s." % (
                "Osteoporosis at the hip (T-score %s)." % hip if hip <= -2.5
                else "Low bone mass (osteopenia), T-score %s." % hip)]))

# 5. THYROID (M/F)
for sex, tag in (("Male", "male"), ("Female", "female")):
    FIX.append(f(
        f"{tag}_thyroid", sex, "lab", "Thyroid Function Laboratory Report",
        "Cascade Regional Laboratory",
        [{"name": "Thyroid Panel", "rows": [
            ("Thyroid stimulating hormone (TSH)", "6.9", "mIU/L",
             "0.4-4.0", "HIGH"),
            ("Free thyroxine (Free T4)", "0.8", "ng/dL", "0.8-1.8", ""),
         ]}],
        [("TSH", "LOINC", "3016-3", 6.9, "mIU/L")],
        intro="Reason: fatigue; rule out hypothyroidism."))

# 6. LIVER (M/F)
for sex, tag in (("Male", "male"), ("Female", "female")):
    FIX.append(f(
        f"{tag}_liver", sex, "lab", "Hepatic Function Panel",
        "Cascade Regional Laboratory",
        [{"name": "Liver Enzymes", "rows": [
            ("Alanine aminotransferase (ALT)", "74", "U/L", "7-56", "HIGH"),
            ("Aspartate aminotransferase (AST)", "68", "U/L", "10-40", "HIGH"),
            ("Alkaline phosphatase", "118", "U/L", "44-147", ""),
            ("Bilirubin, total", "1.1", "mg/dL", "0.1-1.2", ""),
         ]}],
        [("ALT", "LOINC", "1742-6", 74, "U/L"),
         ("AST", "LOINC", "1920-8", 68, "U/L")],
        intro="Reason: elevated liver enzymes on prior screen."))

# 7. KIDNEY (M/F)
# eGFR is computed per-sex from CKD-EPI 2021 on each fixture's own
# creatinine/age/sex (M 66y/1.5 ~51; F 63y/1.3 ~46) — never a shared constant.
for sex, tag, creat, egfr in (("Male", "male", "1.5", "51"),
                              ("Female", "female", "1.3", "46")):
    FIX.append(f(
        f"{tag}_kidney", sex, "lab", "Renal Function Laboratory Report",
        "Cascade Regional Laboratory",
        [{"name": "Renal Panel", "rows": [
            ("Creatinine, serum", creat, "mg/dL",
             "0.7-1.3 (M) / 0.6-1.1 (F)", "HIGH"),
            ("eGFR (CKD-EPI 2021)", egfr, "mL/min/1.73m2", ">=60", "LOW"),
            ("Blood urea nitrogen (BUN)", "26", "mg/dL", "7-20", "HIGH"),
         ]}],
        [("Creatinine", "LOINC", "2160-0", float(creat), "mg/dL"),
         ("eGFR", "LOINC", "98979-8", int(egfr), "mL/min/1.73m2")],
        intro="Reason: chronic kidney disease stage 3a monitoring."))

# 8. ANEMIA / IRON (M/F)
for sex, tag, hgb, fer in (("Male", "male", "12.1", "14"),
                           ("Female", "female", "10.8", "8")):
    FIX.append(f(
        f"{tag}_anemia", sex, "lab", "Anemia / Iron Studies Report",
        "Cascade Regional Laboratory",
        [{"name": "CBC & Iron Studies", "rows": [
            ("Hemoglobin", hgb, "g/dL", "13.5-17.5 (M) / 12.0-15.5 (F)",
             "LOW"),
            ("Ferritin", fer, "ng/mL", "30-400 (M) / 15-150 (F)", "LOW"),
            ("Iron, serum", "42", "ug/dL", "60-170", "LOW"),
            ("Mean corpuscular volume (MCV)", "76", "fL", "80-100", "LOW"),
         ]}],
        [("Ferritin", "LOINC", "2276-4", int(fer), "ng/mL"),
         ("Hemoglobin", "LOINC", "718-7", float(hgb), "g/dL")],
        intro="Reason: fatigue; suspected iron-deficiency anemia."))

# 9. VITAMIN D (M/F)
for sex, tag in (("Male", "male"), ("Female", "female")):
    FIX.append(f(
        f"{tag}_vitamind", sex, "lab", "Vitamin D Laboratory Report",
        "Cascade Regional Laboratory",
        [{"name": "Vitamin D", "rows": [
            ("25-hydroxyvitamin D", "17", "ng/mL",
             "<20 deficient; 20-29 insufficient; 30-100 sufficient", "LOW"),
         ]}],
        [("Vitamin D 25-OH", "LOINC", "62292-8", 17, "ng/mL")],
        intro="Reason: bone health; vitamin D deficiency screen."))

# 10. ALCOHOL (M/F) — liver/CDT markers + AUDIT-C documented
for sex, tag, auditc in (("Male", "male", 7), ("Female", "female", 6)):
    FIX.append(f(
        f"{tag}_alcohol", sex, "visit", "Behavioral Health Visit — Alcohol Use",
        "Riverside Behavioral Health",
        [{"name": "Alcohol-related labs", "rows": [
            ("Gamma-glutamyl transferase (GGT)", "96", "U/L", "8-61", "HIGH"),
            ("Aspartate aminotransferase (AST)", "71", "U/L", "10-40", "HIGH"),
            ("Alanine aminotransferase (ALT)", "44", "U/L", "7-56", ""),
            ("Mean corpuscular volume (MCV)", "99", "fL", "80-100", ""),
         ]}],
        [("GGT", "LOINC", "2324-2", 96, "U/L"),
         ("AST", "LOINC", "1920-8", 71, "U/L"),
         ("AUDIT-C score", "internal", "audit_c_score", auditc, "points")],
        intro="Reason: alcohol use screening and counseling.",
        narrative=[
            "AUDIT-C administered in clinic today: total score %d (positive "
            "screen; suggests risky alcohol use). AST/ALT ratio >1.5 with "
            "elevated GGT is consistent with alcohol-related liver effect."
            % auditc,
            "Plan: brief intervention; recheck hepatic panel in 8 weeks."]))

# 11. MENTAL HEALTH (M/F) — PHQ-9 + GAD-7 documented
for sex, tag in (("Male", "male"), ("Female", "female")):
    FIX.append(f(
        f"{tag}_mentalhealth", sex, "visit",
        "Primary Care Visit — Depression & Anxiety Screening",
        "Northgate Family Medicine",
        [{"name": "Validated screeners (administered today)", "rows": [
            ("PHQ-9 depression score", "16", "points",
             "0-4 none; 15-19 moderately severe", "HIGH"),
            ("GAD-7 anxiety score", "13", "points",
             "0-4 minimal; 10-14 moderate", "HIGH"),
         ]}],
        [("PHQ-9 total score", "LOINC", "44261-6", 16, "points"),
         ("GAD-7 total score", "LOINC", "70274-6", 13, "points")],
        intro="Reason: low mood and worry over the past month.",
        narrative=[
            "PHQ-9 total 16 (moderately severe). Item 9 (self-harm) endorsed "
            "as 'not at all'. GAD-7 total 13 (moderate anxiety).",
            "Plan: shared decision-making on therapy; follow-up in 4 weeks."]))

# 12. SLEEP (M/F) — Epworth documented
for sex, tag in (("Male", "male"), ("Female", "female")):
    FIX.append(f(
        f"{tag}_sleep", sex, "visit", "Sleep Clinic Consultation Summary",
        "Lakeview Sleep Center",
        [{"name": "Daytime sleepiness", "rows": [
            ("Epworth Sleepiness Scale", "14", "points",
             "0-5 lower-normal; 11-12 mild; 13-15 moderate", "HIGH"),
         ]}],
        # NOT LOINC 89204-2 — that code is "PHQ-9 modified for Teens total
        # score" (a depression screener), confirmed via loinc.org. No verified
        # Epworth total-score LOINC on hand, so code as internal (like AUDIT-C
        # / IPSS / MRS / ADAM) rather than assert a wrong one.
        [("Epworth Sleepiness Scale", "internal", "epworth_score", 14,
          "points")],
        intro="Reason: snoring and daytime sleepiness; evaluate for OSA.",
        narrative=[
            "Epworth Sleepiness Scale score 14 of 24 (moderate excessive "
            "daytime sleepiness). Home sleep apnea test ordered."]))

# 13. COMPREHENSIVE annual physical (M/F) — broad multi-panel + BMI
for sex, tag, hdl, ht_cm, wt_kg, bmi, egfr, hgb_ref in (
        ("Male", "male", "41", 177, 92, 29.4, "82", "13.5-17.5"),
        ("Female", "female", "55", 162, 79, 30.1, "63", "12.0-15.5")):
    FIX.append(f(
        f"{tag}_comprehensive", sex, "lab",
        "Annual Wellness — Comprehensive Laboratory & Vitals",
        "Cascade Regional Laboratory",
        [{"name": "Metabolic & Glycemic", "rows": [
            ("Hemoglobin A1c", "6.1", "%", "<5.7 normal", "HIGH"),
            ("Glucose, fasting", "108", "mg/dL", "70-99", "HIGH"),
            ("Creatinine", "1.0", "mg/dL", "0.6-1.3", ""),
            ("eGFR (CKD-EPI 2021)", egfr, "mL/min/1.73m2", ">=60", ""),
         ]},
         {"name": "Lipids", "rows": [
            ("Cholesterol, total", "212", "mg/dL", "<200", "HIGH"),
            ("LDL cholesterol", "138", "mg/dL", "<100", "HIGH"),
            ("HDL cholesterol", hdl, "mg/dL", ">40 (M) / >50 (F)", ""),
            ("Triglycerides", "168", "mg/dL", "<150", "HIGH"),
         ]},
         {"name": "Thyroid / Vitamin / CBC", "rows": [
            ("TSH", "2.3", "mIU/L", "0.4-4.0", ""),
            ("25-hydroxyvitamin D", "28", "ng/mL", "30-100", "LOW"),
            ("Hemoglobin", "14.8", "g/dL", hgb_ref, ""),
         ]},
         {"name": "Vitals & Anthropometrics", "rows": [
            ("Blood pressure, systolic", "132", "mmHg", "<120", "HIGH"),
            ("Blood pressure, diastolic", "84", "mmHg", "<80", "HIGH"),
            ("Heart rate, resting", "72", "bpm", "60-100", ""),
            ("Body height", str(ht_cm), "cm", "-", ""),
            ("Body weight", str(wt_kg), "kg", "-", ""),
            ("Body mass index", str(bmi), "kg/m2", "18.5-24.9", "HIGH"),
         ]}],
        [("Hemoglobin A1c", "LOINC", "4548-4", 6.1, "%"),
         ("Fasting glucose", "LOINC", "1558-6", 108, "mg/dL"),
         ("Creatinine", "LOINC", "2160-0", 1.0, "mg/dL"),
         ("eGFR", "LOINC", "98979-8", int(egfr), "mL/min/1.73m2"),
         ("Total cholesterol", "LOINC", "2093-3", 212, "mg/dL"),
         ("LDL cholesterol", "LOINC", "18262-6", 138, "mg/dL"),
         ("HDL cholesterol", "LOINC", "2085-9", int(hdl), "mg/dL"),
         ("Triglycerides", "LOINC", "2571-8", 168, "mg/dL"),
         ("TSH", "LOINC", "3016-3", 2.3, "mIU/L"),
         ("Vitamin D 25-OH", "LOINC", "62292-8", 28, "ng/mL"),
         ("BP systolic", "LOINC", "8480-6", 132, "mmHg"),
         ("BP diastolic", "LOINC", "8462-4", 84, "mmHg"),
         ("Heart rate", "LOINC", "8867-4", 72, "bpm"),
         ("Body height", "LOINC", "8302-2", ht_cm, "cm"),
         ("Body weight", "LOINC", "29463-7", wt_kg, "kg"),
         ("Body mass index", "LOINC", "39156-5", bmi, "kg/m2")],
        intro="Annual wellness visit; comprehensive panel."))

# 14. PROSTATE (Male only) — PSA + IPSS
FIX.append(f(
    "male_prostate", "Male", "visit", "Urology Consultation — Prostate Health",
    "Summit Urology Associates",
    [{"name": "Prostate labs", "rows": [
        ("Prostate-specific antigen (PSA), total", "5.8", "ng/mL",
         "<4.0", "HIGH"),
     ]}],
    [("PSA total", "LOINC", "2857-1", 5.8, "ng/mL"),
     ("IPSS score", "internal", "ipss_score", 18, "points")],
    intro="Reason: urinary frequency, nocturia; elevated PSA.",
    narrative=[
        "International Prostate Symptom Score (IPSS) completed today: total "
        "18 of 35 (moderate symptoms; upper end of the moderate 8-19 band).",
        "Plan: repeat PSA in 6 weeks; discuss further evaluation."]))

# 15. HORMONAL — low testosterone (Male only) — testosterone + ADAM
FIX.append(f(
    "male_hormonal", "Male", "visit", "Men's Health Visit — Hypogonadism Workup",
    "Northgate Family Medicine",
    [{"name": "Hormonal labs (AM draw)", "rows": [
        ("Testosterone, total", "232", "ng/dL", "300-1000", "LOW"),
        ("Testosterone, free (calc)", "5.1", "ng/dL", "5.0-21.0", ""),
        ("Luteinizing hormone (LH)", "3.2", "mIU/mL", "1.7-8.6", ""),
     ]}],
    [("Testosterone total", "LOINC", "2986-8", 232, "ng/dL"),
     ("ADAM screen", "internal", "adam_positive", 1, "boolean")],
    intro="Reason: fatigue, low libido; evaluate for low testosterone.",
    narrative=[
        "ADAM (Androgen Deficiency in the Aging Male) questionnaire: POSITIVE "
        "(endorsed low libido and decreased energy). Morning total "
        "testosterone 232 ng/dL on two occasions confirms hypogonadism."]))

# 16. MENOPAUSE (Female only) — FSH/estradiol + MRS
FIX.append(f(
    "female_menopause", "Female", "visit",
    "Women's Health Visit — Menopause Evaluation",
    "Northgate Family Medicine",
    [{"name": "Hormonal labs", "rows": [
        ("Follicle stimulating hormone (FSH)", "68", "mIU/mL",
         ">25.8 post-menopausal", "HIGH"),
        ("Estradiol", "14", "pg/mL", "<10-20 post-menopausal", ""),
     ]}],
    [("FSH", "LOINC", "15067-2", 68, "mIU/mL"),
     ("Estradiol", "LOINC", "2243-4", 14, "pg/mL"),
     ("Menopause Rating Scale", "internal", "mrs_score", 22, "points")],
    intro="Reason: hot flashes, sleep disruption; menopause evaluation.",
    narrative=[
        "Menopause Rating Scale (MRS) completed: total score 22 (severe "
        "symptom burden). FSH 68 mIU/mL with low estradiol confirms "
        "post-menopausal status.",
        "Plan: discuss symptom management options at follow-up."]))


# Guard: any 'points'-unit survey observation must use a VERIFIED survey LOINC
# or an internal slug — never an unchecked LOINC. Catches the class of bug
# where Epworth had been mis-coded to a PHQ-9-Teen LOINC (89204-2).
VERIFIED_SURVEY_LOINC = {"44261-6", "70274-6"}  # PHQ-9 total, GAD-7 total
for fx in FIX:
    for disp, csys, code, val, unit in fx["expected"]:
        if unit == "points" and csys == "LOINC" \
                and code not in VERIFIED_SURVEY_LOINC:
            raise SystemExit(
                "Unverified survey LOINC %s for %r in %s — use an internal "
                "code, or add it to VERIFIED_SURVEY_LOINC only after "
                "confirming its LONG_COMMON_NAME." % (code, disp, fx["file"]))

# ── render all clinical fixtures ──────────────────────────────────────────
manifest = []
for fx in FIX:
    p = render(fx)
    manifest.append({
        "file": fx["file"] + ".pdf",
        "report_type": fx["rtype"],
        "sex": fx["sex"],
        "expected_observations": [
            {"display": e[0], "code_system": e[1], "code": e[2],
             "value": e[3], "unit": e[4]} for e in fx["expected"]
        ],
        "expected_no_pii": True,
    })
    print("wrote", os.path.basename(p))

# ── negative fixture: non-medical document (expect empty parse) ───────────
neg = SimpleDocTemplate(os.path.join(OUT, "negative_nonmedical.pdf"),
                        pagesize=LETTER)
neg.build([
    Paragraph("Pinecrest Coffee Roasters", H1),
    Paragraph("Receipt #20260512-0098", SUB), Spacer(1, 10),
    Paragraph("2x Large Latte .......... $11.00<br/>"
              "1x Blueberry Muffin ...... $3.75<br/>"
              "Subtotal ................. $14.75<br/>"
              "Tax ...................... $1.31<br/>"
              "<b>Total ................. $16.06</b><br/><br/>"
              "Thank you for visiting! No health information here.", BODY),
])
manifest.append({"file": "negative_nonmedical.pdf", "report_type": "other",
                 "sex": "n/a", "expected_observations": [],
                 "expected_no_pii": True,
                 "note": "Non-medical PDF -> parser should return 0 "
                         "observations (empty-parse review state)."})
print("wrote negative_nonmedical.pdf")

# ── negative fixture: no text layer (rasterized 'scan') via sips ──────────
src = os.path.join(OUT, "male_comprehensive.pdf")
png = os.path.join(OUT, "_scan_tmp.png")
scan = os.path.join(OUT, "negative_scanned_notextlayer.pdf")
made_scan = False
try:
    subprocess.run(["sips", "-s", "format", "png", "-Z", "1400", src,
                    "--out", png], check=True, capture_output=True)
    from reportlab.pdfgen import canvas as _canvas
    from reportlab.lib.utils import ImageReader
    img = ImageReader(png)
    iw, ih = img.getSize()
    pw, phh = LETTER
    scale = min(pw / iw, phh / ih)
    c = _canvas.Canvas(scan, pagesize=LETTER)
    c.drawImage(img, (pw - iw * scale) / 2, (phh - ih * scale) / 2,
                iw * scale, ih * scale)
    c.save()
    os.remove(png)
    made_scan = True
    manifest.append({"file": "negative_scanned_notextlayer.pdf",
                     "report_type": "lab", "sex": "n/a",
                     "expected_observations": [],
                     "expected_no_pii": True,
                     "note": "Image-only PDF (no text layer) -> extract.ts "
                             "rejects with reason 'pdf_has_no_text_layer'. "
                             "(Rasterized image still shows the synthetic "
                             "identity; never reaches the parser.)"})
    print("wrote negative_scanned_notextlayer.pdf")
except Exception as e:  # noqa
    print("SKIP scanned fixture (need sips+Pillow):", e)

with open(os.path.join(HERE, "manifest.json"), "w") as fh:
    json.dump({"generated_by": "generate_fixtures.py",
               "fixtures": manifest}, fh, indent=2)
print("wrote manifest.json (%d fixtures)" % len(manifest))
