from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# Palette colors definition
NAVY_BLUE = colors.HexColor("#003366")
GOLD = colors.HexColor("#E67E22")
DARK_GRAY = colors.HexColor("#333333")
LIGHT_GRAY = colors.HexColor("#F9FAFB")
BORDER_GRAY = colors.HexColor("#E5E7EB")
ZEBRA_COLOR = colors.HexColor("#F3F4F6")


def get_institutional_styles():
    """
    Returns a custom sample stylesheet with preconfigured institutional styles.
    """
    styles = getSampleStyleSheet()

    # 1. Title Style
    title_style = ParagraphStyle(
        name="ReportTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=NAVY_BLUE,
        alignment=TA_LEFT,
        spaceAfter=10,
    )
    styles.add(title_style)

    # 2. Subtitle Style
    subtitle_style = ParagraphStyle(
        name="ReportSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=GOLD,
        alignment=TA_LEFT,
        spaceAfter=15,
    )
    styles.add(subtitle_style)

    # 3. Section Header Style
    section_style = ParagraphStyle(
        name="ReportSection",
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=NAVY_BLUE,
        alignment=TA_LEFT,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True,
    )
    styles.add(section_style)

    # 4. Subsection Header Style
    subsection_style = ParagraphStyle(
        name="ReportSubsection",
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=GOLD,
        alignment=TA_LEFT,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True,
    )
    styles.add(subsection_style)

    # 5. Normal Body Style
    body_style = ParagraphStyle(
        name="ReportBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11.5,
        textColor=DARK_GRAY,
        alignment=TA_LEFT,
        spaceAfter=6,
    )
    styles.add(body_style)

    # 6. Metadata/Filter Text Style
    meta_style = ParagraphStyle(
        name="ReportMeta",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#4B5563"),
        spaceAfter=12,
    )
    styles.add(meta_style)

    # 7. Table Header Style
    table_hdr_style = ParagraphStyle(
        name="ReportTableHeader",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=TA_CENTER,
    )
    styles.add(table_hdr_style)

    # 8. Table Body Style
    table_body_style = ParagraphStyle(
        name="ReportTableBody", fontName="Helvetica", fontSize=7.5, leading=9.5, textColor=DARK_GRAY, alignment=TA_LEFT
    )
    styles.add(table_body_style)

    # 9. Table Body Bold Style
    table_body_bold_style = ParagraphStyle(
        name="ReportTableBodyBold", parent=table_body_style, fontName="Helvetica-Bold"
    )
    styles.add(table_body_bold_style)

    return styles
