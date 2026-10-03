import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def prepare_rounded_screenshots():
    """Generates high-res rounded-corner screenshots with smooth anti-aliased edges and solid borders."""
    uploaded_dir = Path(r"C:\Users\GUEST1\.gemini\antigravity-ide\brain\9fd923f2-7fc2-4b1f-a221-98bba20b90b0\.user_uploaded")
    out_dir = Path("sih_extracted_images")
    out_dir.mkdir(exist_ok=True)

    def round_corners(input_path, output_path, radius=32, border_color=(10, 37, 64, 255), border_width=3):
        if not input_path.exists():
            return
        img = Image.open(input_path).convert('RGBA')
        w, h = img.size
        scale = 2
        mask = Image.new('L', (w * scale, h * scale), 0)
        draw = ImageDraw.Draw(mask)
        draw.rounded_rectangle([(0, 0), (w * scale, h * scale)], radius=radius * scale, fill=255)
        mask = mask.resize((w, h), Image.Resampling.LANCZOS)
        
        output = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        output.paste(img, (0, 0), mask=mask)
        
        if border_width > 0 and border_color:
            b_mask = Image.new('RGBA', (w * scale, h * scale), (0, 0, 0, 0))
            b_draw = ImageDraw.Draw(b_mask)
            b_draw.rounded_rectangle([(0, 0), (w * scale - 1, h * scale - 1)], radius=radius * scale, outline=border_color, width=border_width * scale)
            b_mask = b_mask.resize((w, h), Image.Resampling.LANCZOS)
            output = Image.alpha_composite(output, b_mask)
            
        output.save(output_path, 'PNG')

    round_corners(uploaded_dir / "media_1789665297563.png", out_dir / "rounded_cloned.png", radius=32, border_color=(185, 28, 28, 255), border_width=3)
    round_corners(uploaded_dir / "media_1789665297372.png", out_dir / "rounded_genuine.png", radius=32, border_color=(15, 118, 54, 255), border_width=3)
    round_corners(uploaded_dir / "media_1789665297475.png", out_dir / "rounded_impersonator.png", radius=32, border_color=(180, 83, 9, 255), border_width=3)

def build_sih_official_deck():
    prepare_rounded_screenshots()

    prs = Presentation()
    # Official SIH 16:9 widescreen dimensions (13.333 x 7.5 inches)
    prs.slide_width = Inches(13.333333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Directories and image paths
    sih_logo_path = Path("sih_extracted_images/slide_1_sh_6_1.png")
    clean_bulb_path = Path("sih_extracted_images/sih_clean_bulb.png")
    
    img_cloned = Path("sih_extracted_images/rounded_cloned.png")
    img_genuine = Path("sih_extracted_images/rounded_genuine.png")
    img_impersonator = Path("sih_extracted_images/rounded_impersonator.png")

    # =========================================================================
    # SOLID NAVY BLUE & HIGH-CONTRAST PALETTE (Bold, Authoritative, Diagrammatic)
    # =========================================================================
    COLOR_NAVY_SOLID  = RGBColor(10, 37, 64)     # #0A2540 - Deep Solid Navy Blue
    COLOR_NAVY_ACCENT = RGBColor(14, 60, 105)    # #0E3C69 - Mid Navy
    COLOR_NAVY_LIGHT  = RGBColor(235, 242, 250)  # #EBF2FA - Light Navy Tint
    
    COLOR_CARD_WHITE  = RGBColor(255, 255, 255)  # Crisp Solid White Fill
    COLOR_BORDER_NAVY = RGBColor(10, 37, 64)     # #0A2540 - Solid Navy Border
    
    # State Accents (Solid & High Visibility)
    COLOR_GREEN_FILL  = RGBColor(240, 253, 244)  # #F0FDF4
    COLOR_GREEN_SOLID = RGBColor(15, 118, 54)    # #0F7636 - Solid Dark Emerald
    COLOR_RED_FILL    = RGBColor(254, 242, 242)  # #FEF2F2
    COLOR_RED_SOLID   = RGBColor(185, 28, 28)    # #B91C1C - Solid Dark Crimson
    COLOR_AMBER_FILL  = RGBColor(255, 251, 235)  # #FFFBEB
    COLOR_AMBER_SOLID = RGBColor(180, 83, 9)     # #B45309 - Solid Dark Amber
    
    # Typography Colors
    COLOR_TEXT_BLACK  = RGBColor(10, 15, 25)     # #0A0F19 - Pitch Dark
    COLOR_TEXT_NAVY   = RGBColor(10, 37, 64)     # #0A2540 - Solid Navy Text
    COLOR_WHITE       = RGBColor(255, 255, 255)
    COLOR_CYAN_ACCENT = RGBColor(56, 189, 248)   # #38BDF8 - Bright Cyan

    def set_white_bg(slide):
        bg = slide.background
        fill = bg.fill
        fill.solid()
        fill.fore_color.rgb = COLOR_WHITE

    def apply_sih_chrome(slide, slide_num, title_text, category_tag=None):
        set_white_bg(slide)

        # 1. Slide Title (Solid Deep Navy Blue & Big 27pt Bold)
        t_box = slide.shapes.add_textbox(Inches(1.85), Inches(0.08), Inches(8.7), Inches(0.95))
        tf = t_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.text = title_text
        p.font.name = "Segoe UI"
        p.font.size = Pt(27)
        p.font.bold = True
        p.font.color.rgb = COLOR_NAVY_SOLID

        # Category Tag / Sub-badge
        if category_tag:
            p_cat = tf.add_paragraph()
            p_cat.text = category_tag.upper()
            p_cat.font.name = "Segoe UI"
            p_cat.font.size = Pt(10.5)
            p_cat.font.bold = True
            p_cat.font.color.rgb = COLOR_TEXT_BLACK
            p_cat.space_before = Pt(2)

        # 2. Top-Left Team Badge Oval
        oval = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(0.36), Inches(0.18), Inches(1.35), Inches(0.72))
        oval.fill.solid()
        oval.fill.fore_color.rgb = COLOR_NAVY_LIGHT
        oval.line.color.rgb = COLOR_NAVY_SOLID
        oval.line.width = Pt(1.5)
        ot = oval.text_frame
        ot.word_wrap = True
        ot.margin_left = ot.margin_top = ot.margin_right = ot.margin_bottom = 0
        p_ov = ot.paragraphs[0]
        p_ov.alignment = PP_ALIGN.CENTER
        p_ov.text = "Voice Gaurd"
        p_ov.font.name = "Segoe UI"
        p_ov.font.size = Pt(10.5)
        p_ov.font.bold = True
        p_ov.font.color.rgb = COLOR_NAVY_SOLID

        # 3. Top-Right SIH 2026 Logo
        if sih_logo_path.exists():
            slide.shapes.add_picture(str(sih_logo_path), Inches(10.50), Inches(0.08), Inches(2.65), Inches(1.22))

        # 4. Official SIH Footer Bar (Solid Navy Background)
        f_bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(6.92), Inches(13.333333), Inches(0.58))
        f_bar.fill.solid()
        f_bar.fill.fore_color.rgb = COLOR_NAVY_SOLID
        f_bar.line.fill.background()

        # Footer Text (Team Name & Team ID as requested)
        f_box = slide.shapes.add_textbox(Inches(0.60), Inches(6.96), Inches(9.5), Inches(0.45))
        f_tf = f_box.text_frame
        f_tf.margin_top = f_tf.margin_bottom = f_tf.margin_left = f_tf.margin_right = 0
        p_foot = f_tf.paragraphs[0]
        p_foot.text = "Team Name: Voice Gaurd   |   Team ID: 170663"
        p_foot.font.name = "Segoe UI"
        p_foot.font.size = Pt(12)
        p_foot.font.bold = True
        p_foot.font.color.rgb = COLOR_WHITE

        # Footer Slide Number
        n_box = slide.shapes.add_textbox(Inches(12.20), Inches(6.96), Inches(0.8), Inches(0.45))
        n_tf = n_box.text_frame
        n_tf.margin_top = n_tf.margin_bottom = n_tf.margin_left = n_tf.margin_right = 0
        p_num = n_tf.paragraphs[0]
        p_num.alignment = PP_ALIGN.RIGHT
        p_num.text = str(slide_num)
        p_num.font.name = "Segoe UI"
        p_num.font.size = Pt(12)
        p_num.font.bold = True
        p_num.font.color.rgb = COLOR_WHITE

    def create_card(slide, left, top, width, height, bg_color=COLOR_CARD_WHITE, border_color=COLOR_BORDER_NAVY, border_width=1.5, shape_type=MSO_SHAPE.ROUNDED_RECTANGLE):
        card = slide.shapes.add_shape(shape_type, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = bg_color
        if border_color and border_width > 0:
            card.line.color.rgb = border_color
            card.line.width = Pt(border_width)
        else:
            card.line.fill.background()
        return card

    def add_arrow_down(slide, left, top, width=Inches(0.35), height=Inches(0.24), color=COLOR_NAVY_SOLID):
        arrow = slide.shapes.add_shape(MSO_SHAPE.DOWN_ARROW, left, top, width, height)
        arrow.fill.solid()
        arrow.fill.fore_color.rgb = color
        arrow.line.fill.background()
        return arrow

    def add_arrow_right(slide, left, top, width=Inches(0.35), height=Inches(0.24), color=COLOR_NAVY_SOLID):
        arrow = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, left, top, width, height)
        arrow.fill.solid()
        arrow.fill.fore_color.rgb = color
        arrow.line.fill.background()
        return arrow

    # =========================================================================
    # SLIDE 1: SMART INDIA HACKATHON 2026 (VISUAL IDENTITY & KEY PILLARS)
    # =========================================================================
    slide1 = prs.slides.add_slide(blank_layout)
    set_white_bg(slide1)

    if sih_logo_path.exists():
        slide1.shapes.add_picture(str(sih_logo_path), Inches(10.50), Inches(0.08), Inches(2.65), Inches(1.22))

    # Main Title Header (Solid Navy Blue, Big 33pt Bold)
    t_box1 = slide1.shapes.add_textbox(Inches(0.60), Inches(0.30), Inches(9.8), Inches(0.85))
    tf1 = t_box1.text_frame
    p1 = tf1.paragraphs[0]
    p1.text = "SMART INDIA HACKATHON 2026"
    p1.font.name = "Segoe UI"
    p1.font.size = Pt(33)
    p1.font.bold = True
    p1.font.color.rgb = COLOR_NAVY_SOLID

    # Subtitle (Solid Dark, 16pt Bold)
    sub1 = slide1.shapes.add_textbox(Inches(0.60), Inches(1.15), Inches(10.2), Inches(0.55))
    tf_sub = sub1.text_frame
    p_sub = tf_sub.paragraphs[0]
    p_sub.text = "Voice Gaurd — Real-Time In-Call Deepfake Voice Clone Interception & Biometric Shield"
    p_sub.font.name = "Segoe UI"
    p_sub.font.size = Pt(16)
    p_sub.font.bold = True
    p_sub.font.color.rgb = COLOR_TEXT_BLACK

    # Left Container: Structured Official Details
    c_meta = create_card(slide1, Inches(0.60), Inches(1.88), Inches(7.50), Inches(3.65), COLOR_CARD_WHITE, COLOR_BORDER_NAVY, 2.0, MSO_SHAPE.ROUNDED_RECTANGLE)
    tf_m = c_meta.text_frame
    tf_m.word_wrap = True
    tf_m.margin_left = tf_m.margin_right = Inches(0.35)
    tf_m.margin_top = Inches(0.18)

    COLOR_QUESTION_MUTED = RGBColor(79, 93, 117)  # Elegant Slate Steel Navy for Question Labels

    s1_cards = [
        ("Problem Statement ID", "SIH26104", COLOR_NAVY_SOLID, 17.5),
        ("Problem Statement Title", "AI-Powered Real-Time Detection & Prevention of Voice Cloning Impersonation", COLOR_TEXT_BLACK, 14),
        ("Theme & Category", "Blockchain & Cybersecurity   |   Software Edition", COLOR_TEXT_BLACK, 13.5),
        ("Team Credentials", "Team ID: 170663   •   Team Name: Voice Gaurd", COLOR_NAVY_SOLID, 14.5),
        ("Project GitHub Repository", "https://github.com/jayaram21-creator/VoiceGuard", COLOR_NAVY_SOLID, 14)
    ]

    for idx, (lbl, val, col, fsize) in enumerate(s1_cards):
        p_lbl = tf_m.paragraphs[0] if idx == 0 else tf_m.add_paragraph()
        p_lbl.alignment = PP_ALIGN.LEFT
        p_lbl.text = f"▸ {lbl.upper()}"
        p_lbl.font.name = "Segoe UI"
        p_lbl.font.size = Pt(9.5)
        p_lbl.font.bold = True
        p_lbl.font.color.rgb = COLOR_QUESTION_MUTED
        if idx > 0:
            p_lbl.space_before = Pt(7)

        p_val = tf_m.add_paragraph()
        p_val.alignment = PP_ALIGN.LEFT
        p_val.text = val
        p_val.font.name = "Segoe UI"
        p_val.font.size = Pt(fsize)
        p_val.font.bold = True
        p_val.font.color.rgb = col
        p_val.space_before = Pt(2)

    # 3 Visual Highlight Feature Pills at Bottom of Slide 1 (Capsule / Stadium Shapes)
    pillars = [
        ("🧠 DUAL-BRAIN AI", "AASIST GNN + Biometric Voiceprints", Inches(0.60)),
        ("⚡ ZERO CALL DELAY", "<150ms Inspection on Standard CPU", Inches(3.15)),
        ("⚖ 1-CLICK POLICE FIR", "Form 1930-B PDF with SHA-256 Hash", Inches(5.70))
    ]
    for p_title, p_desc, p_left in pillars:
        pil_card = create_card(slide1, p_left, Inches(5.70), Inches(2.40), Inches(0.95), COLOR_NAVY_SOLID, None, 0, MSO_SHAPE.FLOWCHART_TERMINATOR)
        tf_p = pil_card.text_frame
        tf_p.word_wrap = True
        tf_p.margin_left = tf_p.margin_right = Inches(0.12)
        tf_p.margin_top = Inches(0.12)
        p_pt = tf_p.paragraphs[0]
        p_pt.alignment = PP_ALIGN.CENTER
        p_pt.text = p_title
        p_pt.font.name = "Segoe UI"
        p_pt.font.size = Pt(11)
        p_pt.font.bold = True
        p_pt.font.color.rgb = COLOR_CYAN_ACCENT
        p_pd = tf_p.add_paragraph()
        p_pd.alignment = PP_ALIGN.CENTER
        p_pd.text = p_desc
        p_pd.font.name = "Segoe UI"
        p_pd.font.size = Pt(9.5)
        p_pd.font.bold = True
        p_pd.font.color.rgb = COLOR_WHITE
        p_pd.space_before = Pt(2)

    # Right Side: Clean Bulb Logo
    if clean_bulb_path.exists():
        slide1.shapes.add_picture(str(clean_bulb_path), Inches(8.75), Inches(1.65), Inches(4.1), Inches(4.7))

    # =========================================================================
    # SLIDE 2: IDEA TITLE — DYNAMIC FLOWCHART (PARALLELOGRAM -> HEXAGON -> DIAMOND -> BRANCHES -> DOCUMENT)
    # =========================================================================
    slide2 = prs.slides.add_slide(blank_layout)
    apply_sih_chrome(slide2, 2, "IDEA TITLE", "Visual In-Call Protection Flowchart")

    # Left Column: Authentic Flowchart Diagrammatic Shapes
    
    # 1. Flowchart Input Node (Stadium / Terminator Pill Shape)
    flow1 = create_card(slide2, Inches(0.40), Inches(1.22), Inches(6.15), Inches(0.76), COLOR_NAVY_LIGHT, COLOR_BORDER_NAVY, 1.8, MSO_SHAPE.FLOWCHART_TERMINATOR)
    tf1 = flow1.text_frame
    tf1.word_wrap = True
    tf1.margin_left = tf1.margin_right = Inches(0.35)
    tf1.margin_top = Inches(0.10)
    p_f1 = tf1.paragraphs[0]
    p_f1.alignment = PP_ALIGN.CENTER
    p_f1.text = "📞 STEP 1: INCOMING CALL STREAM  (WebRTC TAP)"
    p_f1.font.name = "Segoe UI"
    p_f1.font.size = Pt(11.5)
    p_f1.font.bold = True
    p_f1.font.color.rgb = COLOR_NAVY_SOLID
    p_f1b = tf1.add_paragraph()
    p_f1b.alignment = PP_ALIGN.CENTER
    p_f1b.text = "Direct peer-to-peer 16 kHz audio tap. Zero delay added to human conversation."
    p_f1b.font.name = "Segoe UI"
    p_f1b.font.size = Pt(10)
    p_f1b.font.bold = True
    p_f1b.font.color.rgb = COLOR_TEXT_BLACK

    add_arrow_down(slide2, Inches(3.30), Inches(2.02), Inches(0.35), Inches(0.20))

    # 2. Flowchart AI Processing Node (Hexagon High-Tech Node Shape)
    flow2 = create_card(slide2, Inches(0.40), Inches(2.24), Inches(6.15), Inches(0.86), COLOR_CARD_WHITE, COLOR_BORDER_NAVY, 2.0, MSO_SHAPE.HEXAGON)
    tf2 = flow2.text_frame
    tf2.word_wrap = True
    tf2.margin_left = tf2.margin_right = Inches(0.55)
    tf2.margin_top = Inches(0.10)
    p_f2 = tf2.paragraphs[0]
    p_f2.alignment = PP_ALIGN.CENTER
    p_f2.text = "🧠 STEP 2: DUAL-BRAIN AI CORE INSPECTION  (<150ms)"
    p_f2.font.name = "Segoe UI"
    p_f2.font.size = Pt(11.5)
    p_f2.font.bold = True
    p_f2.font.color.rgb = COLOR_NAVY_SOLID
    p_f2b = tf2.add_paragraph()
    p_f2b.alignment = PP_ALIGN.CENTER
    p_f2b.text = "Brain 1 (AASIST GNN) checks vocoders  •  Brain 2 (ECAPA-TDNN) checks speaker ID"
    p_f2b.font.name = "Segoe UI"
    p_f2b.font.size = Pt(10)
    p_f2b.font.bold = True
    p_f2b.font.color.rgb = COLOR_TEXT_BLACK

    add_arrow_down(slide2, Inches(3.30), Inches(3.12), Inches(0.35), Inches(0.20))

    # 3. Flowchart Decision Node (Real Decision Diamond Shape!)
    flow_dia = create_card(slide2, Inches(2.35), Inches(3.34), Inches(2.25), Inches(1.10), COLOR_NAVY_SOLID, None, 0, MSO_SHAPE.FLOWCHART_DECISION)
    tf_dia = flow_dia.text_frame
    tf_dia.word_wrap = True
    tf_dia.margin_left = tf_dia.margin_right = Inches(0.15)
    tf_dia.margin_top = Inches(0.18)
    p_dia = tf_dia.paragraphs[0]
    p_dia.alignment = PP_ALIGN.CENTER
    p_dia.text = "AI SPOOF"
    p_dia.font.name = "Segoe UI"
    p_dia.font.size = Pt(11)
    p_dia.font.bold = True
    p_dia.font.color.rgb = COLOR_CYAN_ACCENT
    p_dia2 = tf_dia.add_paragraph()
    p_dia2.alignment = PP_ALIGN.CENTER
    p_dia2.text = "≥ 65%?"
    p_dia2.font.name = "Segoe UI"
    p_dia2.font.size = Pt(12)
    p_dia2.font.bold = True
    p_dia2.font.color.rgb = COLOR_WHITE

    # Left Branch Arrow (<35% Genuine Human) + Flowchart Label
    lbl_no = slide2.shapes.add_textbox(Inches(1.75), Inches(3.46), Inches(0.70), Inches(0.26))
    lbl_no.text_frame.margin_left = lbl_no.text_frame.margin_top = lbl_no.text_frame.margin_right = lbl_no.text_frame.margin_bottom = 0
    p_no = lbl_no.text_frame.paragraphs[0]
    p_no.alignment = PP_ALIGN.CENTER
    p_no.text = "[ NO ]"
    p_no.font.name = "Segoe UI"
    p_no.font.size = Pt(9.5)
    p_no.font.bold = True
    p_no.font.color.rgb = COLOR_GREEN_SOLID

    arrow_left = slide2.shapes.add_shape(MSO_SHAPE.LEFT_ARROW, Inches(1.85), Inches(3.72), Inches(0.45), Inches(0.22))
    arrow_left.fill.solid()
    arrow_left.fill.fore_color.rgb = COLOR_GREEN_SOLID
    arrow_left.line.fill.background()

    # Left Branch Node (Green Route)
    pass_card = create_card(slide2, Inches(0.40), Inches(3.38), Inches(1.40), Inches(0.95), COLOR_GREEN_FILL, COLOR_GREEN_SOLID, 1.8, MSO_SHAPE.ROUNDED_RECTANGLE)
    tf_pass = pass_card.text_frame
    tf_pass.word_wrap = True
    tf_pass.margin_left = tf_pass.margin_right = Inches(0.08)
    tf_pass.margin_top = Inches(0.10)
    p_pass = tf_pass.paragraphs[0]
    p_pass.alignment = PP_ALIGN.CENTER
    p_pass.text = "🟢 REAL VOICE"
    p_pass.font.name = "Segoe UI"
    p_pass.font.size = Pt(10)
    p_pass.font.bold = True
    p_pass.font.color.rgb = COLOR_GREEN_SOLID
    p_passb = tf_pass.add_paragraph()
    p_passb.alignment = PP_ALIGN.CENTER
    p_passb.text = "Score <35%\nCall Allowed"
    p_passb.font.name = "Segoe UI"
    p_passb.font.size = Pt(9)
    p_passb.font.bold = True
    p_passb.font.color.rgb = COLOR_TEXT_BLACK

    # Right Branch Arrow (≥65% Cloned Attack) + Flowchart Label
    lbl_yes = slide2.shapes.add_textbox(Inches(4.55), Inches(3.46), Inches(0.70), Inches(0.26))
    lbl_yes.text_frame.margin_left = lbl_yes.text_frame.margin_top = lbl_yes.text_frame.margin_right = lbl_yes.text_frame.margin_bottom = 0
    p_yes = lbl_yes.text_frame.paragraphs[0]
    p_yes.alignment = PP_ALIGN.CENTER
    p_yes.text = "[ YES ]"
    p_yes.font.name = "Segoe UI"
    p_yes.font.size = Pt(9.5)
    p_yes.font.bold = True
    p_yes.font.color.rgb = COLOR_RED_SOLID

    arrow_right = slide2.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(4.65), Inches(3.72), Inches(0.45), Inches(0.22))
    arrow_right.fill.solid()
    arrow_right.fill.fore_color.rgb = COLOR_RED_SOLID
    arrow_right.line.fill.background()

    # Right Branch Node (Red Route - Cloned AI)
    block_card = create_card(slide2, Inches(5.15), Inches(3.38), Inches(1.40), Inches(0.95), COLOR_RED_FILL, COLOR_RED_SOLID, 1.8, MSO_SHAPE.ROUNDED_RECTANGLE)
    tf_blk = block_card.text_frame
    tf_blk.word_wrap = True
    tf_blk.margin_left = tf_blk.margin_right = Inches(0.08)
    tf_blk.margin_top = Inches(0.10)
    p_blk = tf_blk.paragraphs[0]
    p_blk.alignment = PP_ALIGN.CENTER
    p_blk.text = "🔴 CLONED AI"
    p_blk.font.name = "Segoe UI"
    p_blk.font.size = Pt(10)
    p_blk.font.bold = True
    p_blk.font.color.rgb = COLOR_RED_SOLID
    p_blkb = tf_blk.add_paragraph()
    p_blkb.alignment = PP_ALIGN.CENTER
    p_blkb.text = "Score ≥65%\nCALL DROPPED!"
    p_blkb.font.name = "Segoe UI"
    p_blkb.font.size = Pt(9)
    p_blkb.font.bold = True
    p_blkb.font.color.rgb = COLOR_TEXT_BLACK

    # Arrow Down from Decision Diamond to FIR Document
    add_arrow_down(slide2, Inches(3.30), Inches(4.48), Inches(0.35), Inches(0.20), COLOR_RED_SOLID)

    # 4. Flowchart Document Node (Real Document Shape with Wavy Bottom!)
    flow4 = create_card(slide2, Inches(0.40), Inches(4.72), Inches(6.15), Inches(1.05), COLOR_NAVY_SOLID, None, 0, MSO_SHAPE.FLOWCHART_DOCUMENT)
    tf4 = flow4.text_frame
    tf4.word_wrap = True
    tf4.margin_left = tf4.margin_right = Inches(0.30)
    tf4.margin_top = Inches(0.12)
    p_f4 = tf4.paragraphs[0]
    p_f4.alignment = PP_ALIGN.CENTER
    p_f4.text = "⚖ STEP 4: 1-CLICK POLICE CYBER CRIME FIR DOSSIER"
    p_f4.font.name = "Segoe UI"
    p_f4.font.size = Pt(12)
    p_f4.font.bold = True
    p_f4.font.color.rgb = COLOR_CYAN_ACCENT
    p_f4b = tf4.add_paragraph()
    p_f4b.alignment = PP_ALIGN.CENTER
    p_f4b.text = "Auto-generates certified Form 1930-B PDF with SHA-256 audio hash (Sec 65B Evidence Act)."
    p_f4b.font.name = "Segoe UI"
    p_f4b.font.size = Pt(10.5)
    p_f4b.font.bold = True
    p_f4b.font.color.rgb = COLOR_WHITE
    p_f4b.space_before = Pt(2)

    # Bottom Empirical Testing Ribbon (Chevron / Pointed Pipeline Style)
    diff_bar = create_card(slide2, Inches(0.40), Inches(5.95), Inches(6.15), Inches(0.78), COLOR_CARD_WHITE, COLOR_BORDER_NAVY, 1.8, MSO_SHAPE.ROUNDED_RECTANGLE)
    df_tf = diff_bar.text_frame
    df_tf.word_wrap = True
    df_tf.margin_left = df_tf.margin_right = Inches(0.18)
    df_tf.margin_top = Inches(0.08)
    p_df = df_tf.paragraphs[0]
    p_df.text = "★ TESTED ON REAL CLONES: ElevenLabs, ChatGPT, Azure & RVC"
    p_df.font.name = "Segoe UI"
    p_df.font.size = Pt(11)
    p_df.font.bold = True
    p_df.font.color.rgb = COLOR_NAVY_SOLID
    p_df2 = df_tf.add_paragraph()
    p_df2.text = "99.9% Empirical Spoof Accuracy  •  Sub-150ms Threat Decision Locking"
    p_df2.font.name = "Segoe UI"
    p_df2.font.size = Pt(10)
    p_df2.font.bold = True
    p_df2.font.color.rgb = COLOR_TEXT_BLACK
    p_df2.space_before = Pt(2)

    # Right Column: Hero Rounded Screenshot + Telemetry Badges
    c_proto = create_card(slide2, Inches(6.80), Inches(1.22), Inches(6.15), Inches(5.50), COLOR_CARD_WHITE, COLOR_BORDER_NAVY, 2.0, MSO_SHAPE.ROUNDED_RECTANGLE)
    
    if img_cloned.exists():
        slide2.shapes.add_picture(str(img_cloned), Inches(6.95), Inches(1.36), Inches(3.20), Inches(4.35))

    # Telemetry Badge Column (Capsule Shapes)
    tel_x = Inches(10.30)
    badges = [
        ("🚨 VERDICT", "99.9% AI Clone", COLOR_RED_FILL, COLOR_RED_SOLID),
        ("⚡ LATENCY", "1.26s Lock", COLOR_CARD_WHITE, COLOR_NAVY_SOLID),
        ("🛡 POLICY", "Call Blocked", COLOR_RED_FILL, COLOR_RED_SOLID),
        ("⚖ EVIDENCE", "1930 PDF Ready", COLOR_GREEN_FILL, COLOR_GREEN_SOLID)
    ]
    b_y = Inches(1.36)
    for b_title, b_val, b_bg, b_col in badges:
        bc = create_card(slide2, tel_x, b_y, Inches(2.50), Inches(0.95), b_bg, b_col, 1.8, MSO_SHAPE.FLOWCHART_TERMINATOR)
        tf_bc = bc.text_frame
        tf_bc.word_wrap = True
        tf_bc.margin_left = Inches(0.12)
        tf_bc.margin_top = Inches(0.10)
        p0 = tf_bc.paragraphs[0]
        p0.alignment = PP_ALIGN.CENTER
        p0.text = b_title
        p0.font.name = "Segoe UI"
        p0.font.size = Pt(10)
        p0.font.bold = True
        p0.font.color.rgb = b_col
        p1 = tf_bc.add_paragraph()
        p1.alignment = PP_ALIGN.CENTER
        p1.text = b_val
        p1.font.name = "Segoe UI"
        p1.font.size = Pt(14)
        p1.font.bold = True
        p1.font.color.rgb = COLOR_TEXT_BLACK
        p1.space_before = Pt(2)
        b_y += Inches(1.05)

    # Bottom caption
    cap2 = slide2.shapes.add_textbox(Inches(6.95), Inches(5.90), Inches(5.85), Inches(0.70))
    cap2.text_frame.word_wrap = True
    p_c2 = cap2.text_frame.paragraphs[0]
    p_c2.text = "📸 Live Working Prototype: Cloned voice intercepted in-call, call terminated, legal FIR ready."
    p_c2.font.name = "Segoe UI"
    p_c2.font.size = Pt(10)
    p_c2.font.bold = True
    p_c2.font.color.rgb = COLOR_TEXT_BLACK

    # =========================================================================
    # SLIDE 3: TECHNICAL APPROACH — SYSTEM ARCHITECTURE PIPELINE
    # =========================================================================
    slide3 = prs.slides.add_slide(blank_layout)
    apply_sih_chrome(slide3, 3, "TECHNICAL APPROACH", "End-to-End System Architecture Pipeline")

    # Left Column: 4-Tier Connected Architecture Flow with Expressive Shapes
    # Tier 1: Ingestion (Data Parallelogram Shape)
    t1 = create_card(slide3, Inches(0.40), Inches(1.18), Inches(6.15), Inches(0.82), COLOR_NAVY_LIGHT, COLOR_BORDER_NAVY, 1.8, MSO_SHAPE.FLOWCHART_DATA)
    tf_t1 = t1.text_frame
    tf_t1.word_wrap = True
    tf_t1.margin_left = Inches(0.55)
    tf_t1.margin_right = Inches(0.55)
    tf_t1.margin_top = Inches(0.08)
    p_t1 = tf_t1.paragraphs[0]
    p_t1.alignment = PP_ALIGN.CENTER
    p_t1.text = "TIER 1: LIVE AUDIO INGESTION LAYER (WebRTC 16 kHz)"
    p_t1.font.name = "Segoe UI"
    p_t1.font.size = Pt(11.5)
    p_t1.font.bold = True
    p_t1.font.color.rgb = COLOR_NAVY_SOLID
    p_t1b = tf_t1.add_paragraph()
    p_t1b.alignment = PP_ALIGN.CENTER
    p_t1b.text = "16 kHz Stream ➔ 4.04s Circular Buffer (64.6k samples) • Zero Delay"
    p_t1b.font.name = "Segoe UI"
    p_t1b.font.size = Pt(10)
    p_t1b.font.bold = True
    p_t1b.font.color.rgb = COLOR_TEXT_BLACK

    add_arrow_down(slide3, Inches(3.30), Inches(2.02), Inches(0.35), Inches(0.20))

    # Tier 2: Parallel Dual-Brain AI (Container Card with 2 Side-by-Side Hexagon / Pill Nodes)
    t2_cont = create_card(slide3, Inches(0.40), Inches(2.26), Inches(6.15), Inches(1.48), COLOR_CARD_WHITE, COLOR_BORDER_NAVY, 1.8, MSO_SHAPE.ROUNDED_RECTANGLE)
    t2_lbl = slide3.shapes.add_textbox(Inches(0.60), Inches(2.30), Inches(5.75), Inches(0.30))
    t2_lbl.text_frame.margin_left = t2_lbl.text_frame.margin_top = t2_lbl.text_frame.margin_right = t2_lbl.text_frame.margin_bottom = 0
    p_t2l = t2_lbl.text_frame.paragraphs[0]
    p_t2l.text = "TIER 2: PARALLEL DUAL-BRAIN AI ENGINE"
    p_t2l.font.name = "Segoe UI"
    p_t2l.font.size = Pt(11.5)
    p_t2l.font.bold = True
    p_t2l.font.color.rgb = COLOR_NAVY_SOLID

    # Brain 1 Hexagon Node
    b1_hex = create_card(slide3, Inches(0.55), Inches(2.65), Inches(2.85), Inches(0.98), COLOR_NAVY_LIGHT, COLOR_NAVY_SOLID, 1.5, MSO_SHAPE.HEXAGON)
    tf_b1 = b1_hex.text_frame
    tf_b1.word_wrap = True
    tf_b1.margin_left = tf_b1.margin_right = Inches(0.30)
    tf_b1.margin_top = Inches(0.08)
    p_b1 = tf_b1.paragraphs[0]
    p_b1.alignment = PP_ALIGN.CENTER
    p_b1.text = "🧠 BRAIN 1: AASIST GNN"
    p_b1.font.name = "Segoe UI"
    p_b1.font.size = Pt(10.5)
    p_b1.font.bold = True
    p_b1.font.color.rgb = COLOR_NAVY_SOLID
    p_b1b = tf_b1.add_paragraph()
    p_b1b.alignment = PP_ALIGN.CENTER
    p_b1b.text = "Spectro-temporal graph attention spots vocoder glazes."
    p_b1b.font.name = "Segoe UI"
    p_b1b.font.size = Pt(9)
    p_b1b.font.bold = True
    p_b1b.font.color.rgb = COLOR_TEXT_BLACK

    # Brain 2 Hexagon Node
    b2_hex = create_card(slide3, Inches(3.55), Inches(2.65), Inches(2.85), Inches(0.98), COLOR_NAVY_LIGHT, COLOR_NAVY_SOLID, 1.5, MSO_SHAPE.HEXAGON)
    tf_b2 = b2_hex.text_frame
    tf_b2.word_wrap = True
    tf_b2.margin_left = tf_b2.margin_right = Inches(0.30)
    tf_b2.margin_top = Inches(0.08)
    p_b2 = tf_b2.paragraphs[0]
    p_b2.alignment = PP_ALIGN.CENTER
    p_b2.text = "🧬 BRAIN 2: ECAPA-TDNN"
    p_b2.font.name = "Segoe UI"
    p_b2.font.size = Pt(10.5)
    p_b2.font.bold = True
    p_b2.font.color.rgb = COLOR_NAVY_SOLID
    p_b2b = tf_b2.add_paragraph()
    p_b2b.alignment = PP_ALIGN.CENTER
    p_b2b.text = "192-dim speaker embeddings verify biometric identity."
    p_b2b.font.name = "Segoe UI"
    p_b2b.font.size = Pt(9)
    p_b2b.font.bold = True
    p_b2b.font.color.rgb = COLOR_TEXT_BLACK

    add_arrow_down(slide3, Inches(3.30), Inches(3.76), Inches(0.35), Inches(0.18))

    # Tier 3: Fusion & Policy Enforcement (Decision Process Shape)
    t3 = create_card(slide3, Inches(0.40), Inches(3.96), Inches(6.15), Inches(0.82), COLOR_CARD_WHITE, COLOR_BORDER_NAVY, 1.8, MSO_SHAPE.FLOWCHART_PROCESS)
    tf_t3 = t3.text_frame
    tf_t3.word_wrap = True
    tf_t3.margin_left = tf_t3.margin_right = Inches(0.20)
    tf_t3.margin_top = Inches(0.08)
    p_t3 = tf_t3.paragraphs[0]
    p_t3.alignment = PP_ALIGN.CENTER
    p_t3.text = "TIER 3: FUSION DECISION & ENFORCEMENT"
    p_t3.font.name = "Segoe UI"
    p_t3.font.size = Pt(11.5)
    p_t3.font.bold = True
    p_t3.font.color.rgb = COLOR_NAVY_SOLID
    p_t3b = tf_t3.add_paragraph()
    p_t3b.alignment = PP_ALIGN.CENTER
    p_t3b.text = "Deterministic Threat Lock: Green Shield Allow (<35%) or Immediate Call Drop (≥65%)."
    p_t3b.font.name = "Segoe UI"
    p_t3b.font.size = Pt(10)
    p_t3b.font.bold = True
    p_t3b.font.color.rgb = COLOR_TEXT_BLACK

    add_arrow_down(slide3, Inches(3.30), Inches(4.80), Inches(0.35), Inches(0.18))

    # Tier 4: Legal Case Filing (Flowchart Document Shape)
    t4 = create_card(slide3, Inches(0.40), Inches(5.00), Inches(6.15), Inches(0.88), COLOR_NAVY_SOLID, None, 0, MSO_SHAPE.FLOWCHART_DOCUMENT)
    tf_t4 = t4.text_frame
    tf_t4.word_wrap = True
    tf_t4.margin_left = tf_t4.margin_right = Inches(0.25)
    tf_t4.margin_top = Inches(0.10)
    p_t4 = tf_t4.paragraphs[0]
    p_t4.alignment = PP_ALIGN.CENTER
    p_t4.text = "TIER 4: AUTOMATED FORM 1930-B POLICE DOSSIER"
    p_t4.font.name = "Segoe UI"
    p_t4.font.size = Pt(11.5)
    p_t4.font.bold = True
    p_t4.font.color.rgb = COLOR_CYAN_ACCENT
    p_t4b = tf_t4.add_paragraph()
    p_t4b.alignment = PP_ALIGN.CENTER
    p_t4b.text = "Exports SHA-256 evidence chain under Sec 65B Evidence Act & Sec 318(4) BNS."
    p_t4b.font.name = "Segoe UI"
    p_t4b.font.size = Pt(9.5)
    p_t4b.font.bold = True
    p_t4b.font.color.rgb = COLOR_WHITE

    # Bottom Specs Ribbon (Capsule Pill Shape)
    specs_card = create_card(slide3, Inches(0.40), Inches(6.00), Inches(6.15), Inches(0.74), COLOR_NAVY_LIGHT, COLOR_BORDER_NAVY, 1.8, MSO_SHAPE.FLOWCHART_TERMINATOR)
    sp_tf = specs_card.text_frame
    sp_tf.word_wrap = True
    sp_tf.margin_left = sp_tf.margin_right = Inches(0.20)
    sp_tf.margin_top = Inches(0.08)
    p_sp = sp_tf.paragraphs[0]
    p_sp.alignment = PP_ALIGN.CENTER
    p_sp.text = "⚡ PRODUCTION BENCHMARK: < 150ms LATENCY"
    p_sp.font.name = "Segoe UI"
    p_sp.font.size = Pt(11.5)
    p_sp.font.bold = True
    p_sp.font.color.rgb = COLOR_NAVY_SOLID
    p_sp2 = sp_tf.add_paragraph()
    p_sp2.alignment = PP_ALIGN.CENTER
    p_sp2.text = "Standard CPU Execution   •   GitHub: jayaram21-creator/VoiceGuard"
    p_sp2.font.name = "Segoe UI"
    p_sp2.font.size = Pt(10)
    p_sp2.font.bold = True
    p_sp2.font.color.rgb = COLOR_NAVY_SOLID

    # Right Column Top: Tech Stack Chips (Visual Badge Layout)
    tech_card = create_card(slide3, Inches(6.80), Inches(1.22), Inches(6.15), Inches(1.98), COLOR_CARD_WHITE, COLOR_BORDER_NAVY, 1.8, MSO_SHAPE.ROUNDED_RECTANGLE)
    tt_tf = tech_card.text_frame
    tt_tf.word_wrap = True
    tt_tf.margin_left = tt_tf.margin_right = Inches(0.20)
    tt_tf.margin_top = Inches(0.10)
    p_tt = tt_tf.paragraphs[0]
    p_tt.text = "PRODUCTION CORE TECH STACK"
    p_tt.font.name = "Segoe UI"
    p_tt.font.size = Pt(12)
    p_tt.font.bold = True
    p_tt.font.color.rgb = COLOR_NAVY_SOLID

    tech_points = [
        ("AI Core", "PyTorch, SincNet Feature Extractor, SpeechBrain ECAPA-TDNN"),
        ("Backend", "FastAPI Asynchronous Workers, Node.js WebRTC Signaling"),
        ("Frontend", "React 19, Web Audio API, Responsive HUD with Call Control"),
        ("GitHub Repo", "https://github.com/jayaram21-creator/VoiceGuard")
    ]
    for k, v in tech_points:
        p_k = tt_tf.add_paragraph()
        p_k.text = f"•  {k}:  {v}"
        p_k.font.name = "Segoe UI"
        p_k.font.size = Pt(10.5)
        p_k.font.bold = True
        p_k.font.color.rgb = COLOR_TEXT_BLACK
        p_k.space_before = Pt(2)

    # Right Column Bottom: Genuine Prototype Screenshot
    c_proto3 = create_card(slide3, Inches(6.80), Inches(3.28), Inches(6.15), Inches(3.46), COLOR_GREEN_FILL, COLOR_GREEN_SOLID, 1.8, MSO_SHAPE.ROUNDED_RECTANGLE)
    if img_genuine.exists():
        slide3.shapes.add_picture(str(img_genuine), Inches(6.95), Inches(3.42), Inches(2.15), Inches(2.68))

    p3_txt = slide3.shapes.add_textbox(Inches(9.25), Inches(3.42), Inches(3.55), Inches(2.68))
    p3_tf = p3_txt.text_frame
    p3_tf.word_wrap = True
    p3_tf.margin_left = p3_tf.margin_top = p3_tf.margin_right = p3_tf.margin_bottom = 0

    p_p3_h = p3_tf.paragraphs[0]
    p_p3_h.text = "VERIFIED REAL VOICE"
    p_p3_h.font.name = "Segoe UI"
    p_p3_h.font.size = Pt(13)
    p_p3_h.font.bold = True
    p_p3_h.font.color.rgb = COLOR_GREEN_SOLID

    p3_bullets = [
        ("✓ Bonafide Score", "93.2% Genuine"),
        ("✓ Spoof Level", "6.8% (Far below 35% limit)"),
        ("✓ Decision HUD", "ALLOW (Green Shield Active)"),
        ("✓ Audio Lag", "0 ms (Direct P2P audio stream)")
    ]
    for tag, val in p3_bullets:
        p_b = p3_tf.add_paragraph()
        p_b.text = f"{tag}:  {val}"
        p_b.font.name = "Segoe UI"
        p_b.font.size = Pt(11.5)
        p_b.font.bold = True
        p_b.font.color.rgb = COLOR_TEXT_BLACK
        p_b.space_before = Pt(4)

    # Bottom caption
    cap3 = slide3.shapes.add_textbox(Inches(6.95), Inches(6.15), Inches(5.85), Inches(0.50))
    cap3.text_frame.word_wrap = True
    p_c3 = cap3.text_frame.paragraphs[0]
    p_c3.text = "📸 Live Prototype: Legitimate caller verified in real time without false alarms."
    p_c3.font.name = "Segoe UI"
    p_c3.font.size = Pt(10)
    p_c3.font.bold = True
    p_c3.font.color.rgb = COLOR_TEXT_BLACK

    # =========================================================================
    # SLIDE 4: FEASIBILITY AND VIABILITY — CHEVRON ROADMAP & SCOPE
    # =========================================================================
    slide4 = prs.slides.add_slide(blank_layout)
    apply_sih_chrome(slide4, 4, "FEASIBILITY AND VIABILITY", "Progressive Chevron Roadmap & Risk Mitigation")

    # Left Column Top: Why Feasible
    f_card = create_card(slide4, Inches(0.40), Inches(1.22), Inches(6.15), Inches(1.50), COLOR_CARD_WHITE, COLOR_BORDER_NAVY, 1.8, MSO_SHAPE.ROUNDED_RECTANGLE)
    f_tf = f_card.text_frame
    f_tf.word_wrap = True
    f_tf.margin_left = f_tf.margin_right = Inches(0.20)
    f_tf.margin_top = Inches(0.10)
    p_fh = f_tf.paragraphs[0]
    p_fh.text = "WHY VOICEGUARD IS PRODUCTION-FEASIBLE"
    p_fh.font.name = "Segoe UI"
    p_fh.font.size = Pt(12.5)
    p_fh.font.bold = True
    p_fh.font.color.rgb = COLOR_NAVY_SOLID

    f_points = [
        ("Runs on Standard CPUs", "Lightweight models (<1M parameters) eliminate costly GPU infrastructure."),
        ("No Telecom Overhead", "Works over standard WebRTC without requiring carrier hardware changes."),
        ("Multi-Dataset Diversity", "Trained on Google, ElevenLabs, ChatGPT, Azure & RVC with 100% Val Acc.")
    ]
    for tag, val in f_points:
        p_f = f_tf.add_paragraph()
        p_f.text = f"•  {tag}:  {val}"
        p_f.font.name = "Segoe UI"
        p_f.font.size = Pt(11)
        p_f.font.bold = True
        p_f.font.color.rgb = COLOR_TEXT_BLACK
        p_f.space_before = Pt(2)

    # Left Column Middle: Visual Chevron Roadmap Pipeline (Real Chevron Shapes!)
    r_card = create_card(slide4, Inches(0.40), Inches(2.84), Inches(6.15), Inches(2.28), COLOR_CARD_WHITE, COLOR_BORDER_NAVY, 1.8, MSO_SHAPE.ROUNDED_RECTANGLE)
    r_tf = r_card.text_frame
    r_tf.margin_left = r_tf.margin_right = Inches(0.20)
    r_tf.margin_top = Inches(0.10)
    p_rh = r_tf.paragraphs[0]
    p_rh.text = "PROGRESSIVE IMPLEMENTATION ROADMAP"
    p_rh.font.name = "Segoe UI"
    p_rh.font.size = Pt(12.5)
    p_rh.font.bold = True
    p_rh.font.color.rgb = COLOR_NAVY_SOLID

    # 3 Real Chevron Pipeline Blocks
    chevrons_data = [
        ("PHASE 1: DELIVERED", "Live WebRTC + AASIST Deepfake HUD", Inches(3.20), COLOR_GREEN_SOLID),
        ("PHASE 2: CURRENT", "Biometric Voiceprints + Form 1930-B PDF", Inches(3.80), COLOR_NAVY_SOLID),
        ("PHASE 3: SCALE", "SIP/PBX Enterprise + Carrier Gateway", Inches(4.40), COLOR_NAVY_ACCENT)
    ]
    for c_title, c_desc, c_y, c_col in chevrons_data:
        chev = slide4.shapes.add_shape(MSO_SHAPE.CHEVRON, Inches(0.60), c_y, Inches(5.75), Inches(0.52))
        chev.fill.solid()
        chev.fill.fore_color.rgb = c_col
        chev.line.fill.background()
        c_tf = chev.text_frame
        c_tf.word_wrap = True
        c_tf.margin_left = Inches(0.20)
        c_tf.margin_right = Inches(0.40)
        c_tf.margin_top = Inches(0.06)
        p_ct = c_tf.paragraphs[0]
        p_ct.text = f"{c_title}: {c_desc}"
        p_ct.font.name = "Segoe UI"
        p_ct.font.size = Pt(10.5)
        p_ct.font.bold = True
        p_ct.font.color.rgb = COLOR_WHITE

    # Left Column Bottom: Scope Definition (Two Side-by-Side Cards)
    sc_in = create_card(slide4, Inches(0.40), Inches(5.25), Inches(3.00), Inches(1.48), COLOR_GREEN_FILL, COLOR_GREEN_SOLID, 1.8, MSO_SHAPE.ROUNDED_RECTANGLE)
    sc_tf1 = sc_in.text_frame
    sc_tf1.word_wrap = True
    sc_tf1.margin_left = sc_tf1.margin_right = Inches(0.12)
    sc_tf1.margin_top = Inches(0.10)
    p_sc_in = sc_tf1.paragraphs[0]
    p_sc_in.text = "✓ IN SCOPE"
    p_sc_in.font.name = "Segoe UI"
    p_sc_in.font.size = Pt(11.5)
    p_sc_in.font.bold = True
    p_sc_in.font.color.rgb = COLOR_GREEN_SOLID
    p_sc1 = sc_tf1.add_paragraph()
    p_sc1.text = "WebRTC VoIP, Softphones, Enterprise PBX & Form 1930-B Legal Case PDF Dossier."
    p_sc1.font.name = "Segoe UI"
    p_sc1.font.size = Pt(10)
    p_sc1.font.bold = True
    p_sc1.font.color.rgb = COLOR_TEXT_BLACK
    p_sc1.space_before = Pt(3)

    sc_out = create_card(slide4, Inches(3.55), Inches(5.25), Inches(3.00), Inches(1.48), COLOR_CARD_WHITE, COLOR_BORDER_NAVY, 1.8, MSO_SHAPE.ROUNDED_RECTANGLE)
    sc_tf2 = sc_out.text_frame
    sc_tf2.word_wrap = True
    sc_tf2.margin_left = sc_tf2.margin_right = Inches(0.12)
    sc_tf2.margin_top = Inches(0.10)
    p_sc_out = sc_tf2.paragraphs[0]
    p_sc_out.text = "✗ OUT OF SCOPE"
    p_sc_out.font.name = "Segoe UI"
    p_sc_out.font.size = Pt(11.5)
    p_sc_out.font.bold = True
    p_sc_out.font.color.rgb = COLOR_RED_SOLID
    p_sc2 = sc_tf2.add_paragraph()
    p_sc2.text = "Legacy PSTN copper landlines; intrusive decryption of closed consumer apps."
    p_sc2.font.name = "Segoe UI"
    p_sc2.font.size = Pt(10)
    p_sc2.font.bold = True
    p_sc2.font.color.rgb = COLOR_TEXT_BLACK
    p_sc2.space_before = Pt(3)

    # Right Column Top: Risks & Countermeasures
    rk_card = create_card(slide4, Inches(6.80), Inches(1.22), Inches(6.15), Inches(1.92), COLOR_CARD_WHITE, COLOR_BORDER_NAVY, 1.8, MSO_SHAPE.ROUNDED_RECTANGLE)
    rk_tf = rk_card.text_frame
    rk_tf.word_wrap = True
    rk_tf.margin_left = rk_tf.margin_right = Inches(0.20)
    rk_tf.margin_top = Inches(0.12)
    p_rk = rk_tf.paragraphs[0]
    p_rk.text = "RISKS & PRACTICAL MITIGATIONS"
    p_rk.font.name = "Segoe UI"
    p_rk.font.size = Pt(12.5)
    p_rk.font.bold = True
    p_rk.font.color.rgb = COLOR_NAVY_SOLID

    risks = [
        ("Network Jitter & Packet Loss", "4-second rolling buffer guarantees smooth inference."),
        ("High Concurrent Traffic", "Decoupled async workers scale effortlessly on basic server CPUs."),
        ("Human Account Imposters", "Dual-factor biometric voiceprint verification catches fraudsters.")
    ]
    for r_t, r_m in risks:
        p_r = rk_tf.add_paragraph()
        p_r.text = f"•  {r_t}:  {r_m}"
        p_r.font.name = "Segoe UI"
        p_r.font.size = Pt(11)
        p_r.font.bold = True
        p_r.font.color.rgb = COLOR_TEXT_BLACK
        p_r.space_before = Pt(2)

    # Right Column Bottom: Impersonator Prototype Screenshot
    c_proto4 = create_card(slide4, Inches(6.80), Inches(3.28), Inches(6.15), Inches(3.46), COLOR_AMBER_FILL, COLOR_AMBER_SOLID, 1.8, MSO_SHAPE.ROUNDED_RECTANGLE)
    if img_impersonator.exists():
        slide4.shapes.add_picture(str(img_impersonator), Inches(6.95), Inches(3.42), Inches(2.25), Inches(2.68))

    p4_txt = slide4.shapes.add_textbox(Inches(9.35), Inches(3.42), Inches(3.45), Inches(2.68))
    p4_tf = p4_txt.text_frame
    p4_tf.word_wrap = True
    p4_tf.margin_left = p4_tf.margin_top = p4_tf.margin_right = p4_tf.margin_bottom = 0

    p_p4_h = p4_tf.paragraphs[0]
    p_p4_h.text = "IDENTITY MISMATCH DETECTED"
    p_p4_h.font.name = "Segoe UI"
    p_p4_h.font.size = Pt(13)
    p_p4_h.font.bold = True
    p_p4_h.font.color.rgb = COLOR_AMBER_SOLID

    p4_bullets = [
        ("⚠ Match Similarity", "0.2% (Voiceprint Mismatch)"),
        ("⚠ Attack Vector", "Human Imposter Account Takeover"),
        ("🛡 Policy Action", "Verbal Security Challenge Triggered"),
        ("✓ Fraud Proof", "Catches human fraudsters even if acoustic clone check passes")
    ]
    for tag, val in p4_bullets:
        p_b = p4_tf.add_paragraph()
        p_b.text = f"{tag}:  {val}"
        p_b.font.name = "Segoe UI"
        p_b.font.size = Pt(11.5)
        p_b.font.bold = True
        p_b.font.color.rgb = COLOR_TEXT_BLACK
        p_b.space_before = Pt(4)

    # Bottom caption
    cap4 = slide4.shapes.add_textbox(Inches(6.95), Inches(6.15), Inches(5.85), Inches(0.50))
    cap4.text_frame.word_wrap = True
    p_c4 = cap4.text_frame.paragraphs[0]
    p_c4.text = "📸 Live Prototype: Human fraudster blocked via 192-dim ECAPA-TDNN biometric mismatch."
    p_c4.font.name = "Segoe UI"
    p_c4.font.size = Pt(10)
    p_c4.font.bold = True
    p_c4.font.color.rgb = COLOR_TEXT_BLACK

    # =========================================================================
    # SLIDE 5: IMPACT AND BENEFITS — VALUE CREATION INFOGRAPHIC
    # =========================================================================
    slide5 = prs.slides.add_slide(blank_layout)
    apply_sih_chrome(slide5, 5, "IMPACT  AND  BENEFITS", "National Scale & Real-World Impact")

    # Top Half: 4 Solid Stakeholder Cards
    users = [
        ("🏦 Banking & Fintech", "Stops voice-clone wire approvals, fraudulent account takeovers & call-center fraud.", Inches(0.40)),
        ("🏢 Enterprise & CXOs", "Shields executives against deepfake CEO voice impersonation & corporate extortion.", Inches(3.55)),
        ("👮 Police & 1930 Portal", "Instant certified Form 1930-B PDFs with SHA-256 evidence chain for immediate FIRs.", Inches(6.70)),
        ("👨‍👩‍👧 Citizens & Families", "In-call alerts protect seniors and families against fake emergency kidnapping scams.", Inches(9.85))
    ]

    for u_title, u_desc, u_left in users:
        u_card = create_card(slide5, u_left, Inches(1.25), Inches(3.00), Inches(1.95), COLOR_CARD_WHITE, COLOR_BORDER_NAVY, 1.8, MSO_SHAPE.ROUNDED_RECTANGLE)
        u_tf = u_card.text_frame
        u_tf.word_wrap = True
        u_tf.margin_left = u_tf.margin_right = Inches(0.18)
        u_tf.margin_top = Inches(0.18)

        p_ut = u_tf.paragraphs[0]
        p_ut.text = u_title
        p_ut.font.name = "Segoe UI"
        p_ut.font.size = Pt(13)
        p_ut.font.bold = True
        p_ut.font.color.rgb = COLOR_NAVY_SOLID

        p_ud = u_tf.add_paragraph()
        p_ud.text = u_desc
        p_ud.font.name = "Segoe UI"
        p_ud.font.size = Pt(11.5)
        p_ud.font.bold = True
        p_ud.font.color.rgb = COLOR_TEXT_BLACK
        p_ud.space_before = Pt(6)

    # Bottom Half: 4 Big Superpower Cards (Capsule Stadium Shapes)
    benefits = [
        ("< 150 ms", "Sub-150ms Latency", "Zero audio lag; runs in the background of active calls.", Inches(0.40)),
        ("99.9%", "Spoof Accuracy", "Tested against ElevenLabs, ChatGPT, Azure & RVC.", Inches(3.55)),
        ("1-Click", "Form 1930-B PDF", "Tamper-proof SHA-256 legal evidence dossier ready for police.", Inches(6.70)),
        ("100% Web", "Zero Hardware Cost", "Runs directly in web browsers & softphones on standard CPUs.", Inches(9.85))
    ]

    for stat, b_title, b_desc, b_left in benefits:
        b_card = create_card(slide5, b_left, Inches(3.36), Inches(3.00), Inches(2.30), COLOR_CARD_WHITE, COLOR_BORDER_NAVY, 1.8, MSO_SHAPE.FLOWCHART_TERMINATOR)
        b_tf = b_card.text_frame
        b_tf.word_wrap = True
        b_tf.margin_left = b_tf.margin_right = Inches(0.18)
        b_tf.margin_top = Inches(0.15)

        p_stat = b_tf.paragraphs[0]
        p_stat.alignment = PP_ALIGN.CENTER
        p_stat.text = stat
        p_stat.font.name = "Segoe UI"
        p_stat.font.size = Pt(28)
        p_stat.font.bold = True
        p_stat.font.color.rgb = COLOR_NAVY_SOLID

        p_bt = b_tf.add_paragraph()
        p_bt.alignment = PP_ALIGN.CENTER
        p_bt.text = b_title
        p_bt.font.name = "Segoe UI"
        p_bt.font.size = Pt(13)
        p_bt.font.bold = True
        p_bt.font.color.rgb = COLOR_TEXT_BLACK
        p_bt.space_before = Pt(4)

        p_bd = b_tf.add_paragraph()
        p_bd.alignment = PP_ALIGN.CENTER
        p_bd.text = b_desc
        p_bd.font.name = "Segoe UI"
        p_bd.font.size = Pt(11)
        p_bd.font.bold = True
        p_bd.font.color.rgb = COLOR_TEXT_BLACK
        p_bd.space_before = Pt(4)

    # Bottom Takeaway Ribbon
    banner5 = create_card(slide5, Inches(0.40), Inches(5.82), Inches(12.45), Inches(0.88), COLOR_NAVY_SOLID, None, 0, MSO_SHAPE.ROUNDED_RECTANGLE)
    b5_tf = banner5.text_frame
    b5_tf.word_wrap = True
    b5_tf.margin_left = b5_tf.margin_right = Inches(0.20)
    b5_tf.margin_top = Inches(0.10)
    p_b5 = b5_tf.paragraphs[0]
    p_b5.alignment = PP_ALIGN.CENTER
    p_b5.text = "From “Blind Trust in Inbound Caller Voice” to “Cryptographically Verified Biometric Authenticity”"
    p_b5.font.name = "Segoe UI"
    p_b5.font.size = Pt(14)
    p_b5.font.bold = True
    p_b5.font.color.rgb = COLOR_CYAN_ACCENT

    p_b5_sub = b5_tf.add_paragraph()
    p_b5_sub.alignment = PP_ALIGN.CENTER
    p_b5_sub.text = "Empowering 1.4 Billion citizens with autonomous AI defense against synthetic voice cloning attacks."
    p_b5_sub.font.name = "Segoe UI"
    p_b5_sub.font.size = Pt(11)
    p_b5_sub.font.bold = True
    p_b5_sub.font.color.rgb = COLOR_WHITE
    p_b5_sub.space_before = Pt(2)

    # =========================================================================
    # SLIDE 6: RESEARCH AND REFERENCES — STANDARDS & EVIDENCE MATRIX
    # =========================================================================
    slide6 = prs.slides.add_slide(blank_layout)
    apply_sih_chrome(slide6, 6, "RESEARCH  AND REFERENCES", "Academic Grounding & Standards Compliance")

    # Card 1: Problem Statement & GitHub
    c1 = create_card(slide6, Inches(0.40), Inches(1.25), Inches(6.15), Inches(2.28), COLOR_CARD_WHITE, COLOR_BORDER_NAVY, 1.8, MSO_SHAPE.ROUNDED_RECTANGLE)
    c1_tf = c1.text_frame
    c1_tf.word_wrap = True
    c1_tf.margin_left = c1_tf.margin_right = Inches(0.20)
    c1_tf.margin_top = Inches(0.15)
    p1 = c1_tf.paragraphs[0]
    p1.text = "PRIMARY / PROBLEM REFERENCE"
    p1.font.name = "Segoe UI"
    p1.font.size = Pt(12.5)
    p1.font.bold = True
    p1.font.color.rgb = COLOR_NAVY_SOLID

    p1_sub = c1_tf.add_paragraph()
    p1_sub.text = "SIH 2026 — PS26104 (VoiceGuard AI)"
    p1_sub.font.name = "Segoe UI"
    p1_sub.font.size = Pt(13)
    p1_sub.font.bold = True
    p1_sub.font.color.rgb = COLOR_TEXT_BLACK
    p1_sub.space_before = Pt(4)

    p1_d = c1_tf.add_paragraph()
    p1_d.text = "Fully addresses official requirements: In-band audio stream interception, real-time AI deepfake detection, biometric verification, and low-latency CPU execution."
    p1_d.font.name = "Segoe UI"
    p1_d.font.size = Pt(11.5)
    p1_d.font.bold = True
    p1_d.font.color.rgb = COLOR_TEXT_BLACK
    p1_d.space_before = Pt(3)

    p1_gh = c1_tf.add_paragraph()
    p1_gh.text = "🔗 GitHub: https://github.com/jayaram21-creator/VoiceGuard"
    p1_gh.font.name = "Segoe UI"
    p1_gh.font.size = Pt(12.5)
    p1_gh.font.bold = True
    p1_gh.font.color.rgb = COLOR_NAVY_SOLID
    p1_gh.space_before = Pt(6)

    # Card 2: Datasets & Multi-Platform Retraining
    c2 = create_card(slide6, Inches(6.75), Inches(1.25), Inches(6.15), Inches(2.28), COLOR_CARD_WHITE, COLOR_BORDER_NAVY, 1.8, MSO_SHAPE.ROUNDED_RECTANGLE)
    c2_tf = c2.text_frame
    c2_tf.word_wrap = True
    c2_tf.margin_left = c2_tf.margin_right = Inches(0.20)
    c2_tf.margin_top = Inches(0.15)
    p2 = c2_tf.paragraphs[0]
    p2.text = "DATASETS & EMPIRICAL BENCHMARKS"
    p2.font.name = "Segoe UI"
    p2.font.size = Pt(12.5)
    p2.font.bold = True
    p2.font.color.rgb = COLOR_NAVY_SOLID

    d_points = [
        ("ASVspoof 2019 / 2021", "Standard international benchmark for deepfake speech evaluation."),
        ("Multi-Platform Dataset", "Retrained on ElevenLabs, ChatGPT, Azure & RVC (100% Val Accuracy)."),
        ("VoxCeleb 1 & 2", "Standard speaker verification corpus for diverse acoustic voiceprints.")
    ]
    for tag, val in d_points:
        p_d = c2_tf.add_paragraph()
        p_d.text = f"•  {tag}:  {val}"
        p_d.font.name = "Segoe UI"
        p_d.font.size = Pt(11.5)
        p_d.font.bold = True
        p_d.font.color.rgb = COLOR_TEXT_BLACK
        p_d.space_before = Pt(3)

    # Card 3: Foundational Literature
    c3 = create_card(slide6, Inches(0.40), Inches(3.70), Inches(6.15), Inches(2.18), COLOR_CARD_WHITE, COLOR_BORDER_NAVY, 1.8, MSO_SHAPE.ROUNDED_RECTANGLE)
    c3_tf = c3.text_frame
    c3_tf.word_wrap = True
    c3_tf.margin_left = c3_tf.margin_right = Inches(0.20)
    c3_tf.margin_top = Inches(0.15)
    p3 = c3_tf.paragraphs[0]
    p3.text = "FOUNDATIONAL LITERATURE & PAPERS"
    p3.font.name = "Segoe UI"
    p3.font.size = Pt(12.5)
    p3.font.bold = True
    p3.font.color.rgb = COLOR_NAVY_SOLID

    lit = [
        ("AASIST (Jung et al., Interspeech 2022)", "Audio Anti-Spoofing using Spectro-Temporal Graph Attention."),
        ("ECAPA-TDNN (Desplanques et al., 2020)", "Channel Attention & Aggregation for Speaker Verification."),
        ("SpeechBrain Toolkit (Ravanelli et al., 2021)", "Open-source conversational speech processing toolkit.")
    ]
    for tag, val in lit:
        p_l = c3_tf.add_paragraph()
        p_l.text = f"•  {tag}:  {val}"
        p_l.font.name = "Segoe UI"
        p_l.font.size = Pt(11.5)
        p_l.font.bold = True
        p_l.font.color.rgb = COLOR_TEXT_BLACK
        p_l.space_before = Pt(3)

    # Card 4: National Alignment & Form 1930-B PDF
    c4 = create_card(slide6, Inches(6.75), Inches(3.70), Inches(6.15), Inches(2.18), COLOR_CARD_WHITE, COLOR_BORDER_NAVY, 1.8, MSO_SHAPE.ROUNDED_RECTANGLE)
    c4_tf = c4.text_frame
    c4_tf.word_wrap = True
    c4_tf.margin_left = c4_tf.margin_right = Inches(0.20)
    c4_tf.margin_top = Inches(0.15)
    p4 = c4_tf.paragraphs[0]
    p4.text = "NATIONAL ECOSYSTEM ALIGNMENT"
    p4.font.name = "Segoe UI"
    p4.font.size = Pt(12.5)
    p4.font.bold = True
    p4.font.color.rgb = COLOR_NAVY_SOLID

    nat = [
        ("I4C / 1930 Portal (Form 1930-B PDF)", "Automated cyber-crime dossier with SHA-256 evidence chain."),
        ("Legal Statutory Compliance", "Admissible under Sec 65B Evidence Act & Sec 318(4) BNS 2023."),
        ("W3C & IETF Standards", "Zero proprietary codec overhead; RFC 3711 SRTP encrypted WebRTC.")
    ]
    for tag, val in nat:
        p_n = c4_tf.add_paragraph()
        p_n.text = f"•  {tag}:  {val}"
        p_n.font.name = "Segoe UI"
        p_n.font.size = Pt(11.5)
        p_n.font.bold = True
        p_n.font.color.rgb = COLOR_TEXT_BLACK
        p_n.space_before = Pt(3)

    # Bottom Takeaway Ribbon
    banner6 = create_card(slide6, Inches(0.40), Inches(6.00), Inches(12.50), Inches(0.74), COLOR_NAVY_SOLID, None, 0, MSO_SHAPE.ROUNDED_RECTANGLE)
    b6_tf = banner6.text_frame
    b6_tf.word_wrap = True
    b6_tf.margin_left = b6_tf.margin_right = Inches(0.20)
    b6_tf.margin_top = Inches(0.08)
    p_b6 = b6_tf.paragraphs[0]
    p_b6.alignment = PP_ALIGN.CENTER
    p_b6.text = "Grounded across Interspeech Standards  •  Multi-Platform Retrained  •  Form 1930-B Police Dossier"
    p_b6.font.name = "Segoe UI"
    p_b6.font.size = Pt(12)
    p_b6.font.bold = True
    p_b6.font.color.rgb = COLOR_CYAN_ACCENT

    p_b6_sub = b6_tf.add_paragraph()
    p_b6_sub.alignment = PP_ALIGN.CENTER
    p_b6_sub.text = "Addresses all SIH26104 evaluation criteria. Project GitHub: https://github.com/jayaram21-creator/VoiceGuard"
    p_b6_sub.font.name = "Segoe UI"
    p_b6_sub.font.size = Pt(10.5)
    p_b6_sub.font.bold = True
    p_b6_sub.font.color.rgb = COLOR_WHITE
    p_b6_sub.space_before = Pt(2)

    # Save final PPTX
    out_name = "VoiceGuard_SIH_Presentation_Final.pptx"
    prs.save(out_name)
    print(f"Saved PPTX successfully to: {os.path.abspath(out_name)}")
    return out_name

if __name__ == "__main__":
    out_file = build_sih_official_deck()
    print("Generation complete with flowchart architecture & visual diagrams:", out_file)
