import os
from datetime import datetime
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from .canvas import NumberedCanvasFactory
from .styles import get_institutional_styles
from .tables import create_institutional_table


def build_pdf_report(
    output_target,
    title,
    subtitle=None,
    filters_applied=None,
    user_name="Sistema SGPI",
    headers=None,
    data=None,
    col_widths=None,
    doc_type="report",
):
    """
    Builds a complete institutional PDF document.

    :param output_target: File path (string) or BytesIO buffer where the PDF will be written.
    :param title: Title of the document.
    :param subtitle: Optional subtitle of the document.
    :param filters_applied: Optional dictionary of filters applied to the query.
    :param user_name: The name of the user requesting this PDF generation (for audit trail).
    :param headers: List of strings for the table headers.
    :param data: List of lists of strings/data for the table rows.
    :param col_widths: Optional list of widths/weights for the columns.
    :param doc_type: Type of document: "report" (standard tables) or "certificate" (centered cert text).
    """
    # 1. Setup Document Template
    # We use 1.5 cm (42 points) margins on sides, and larger top (90) and bottom (65) margins
    # to avoid overlapping the header and footer decorations.
    doc = SimpleDocTemplate(output_target, pagesize=A4, leftMargin=42, rightMargin=42, topMargin=90, bottomMargin=65)

    # Set standard PDF metadata (ISO 32000-1 and RNF005 requirement)
    doc.title = title
    doc.author = "Unidad de Investigacion FISI UNMSM"
    doc.subject = subtitle or "Reporte SGPI"
    doc.creator = "SGPI-CMEPDF Engine v1.0"

    # 2. Get styles
    styles = get_institutional_styles()

    story = []

    # 3. Build Flowables depending on doc_type
    if doc_type == "certificate":
        # Centered Certificate Layout
        story.append(Spacer(1, 40))

        # Centered Title
        cert_title_style = styles["ReportTitle"].clone("CertTitle")
        cert_title_style.alignment = 1  # Center
        cert_title_style.fontSize = 18
        cert_title_style.leading = 22
        story.append(Paragraph(title.upper(), cert_title_style))
        story.append(Spacer(1, 15))

        if subtitle:
            cert_sub_style = styles["ReportSubtitle"].clone("CertSub")
            cert_sub_style.alignment = 1  # Center
            story.append(Paragraph(subtitle, cert_sub_style))
            story.append(Spacer(1, 25))

        # Body text (justified or centered)
        cert_body_style = styles["ReportBody"].clone("CertBody")
        cert_body_style.alignment = 4  # Justify
        cert_body_style.fontSize = 10
        cert_body_style.leading = 15
        cert_body_style.spaceAfter = 12

        # If data is provided, assume it's paragraphs of the certificate text
        if data:
            for text_block in data:
                # data is expected to be a list of lists/strings
                block_content = text_block[0] if isinstance(text_block, list) else text_block
                story.append(Paragraph(str(block_content), cert_body_style))
                story.append(Spacer(1, 10))

        story.append(Spacer(1, 60))

        # Signatures line (visual spaces only - as per user feedback: no mock stamps)
        sig_data = [
            ["", ""],
            ["____________________________________", "____________________________________"],
            ["Director de la Unidad de Investigación", "Decano de la Facultad de Ingeniería de Sistemas"],
            ["FISI - UNMSM", "FISI - UNMSM"],
        ]

        # We can build a clean transparent table for signatures
        sig_table = create_institutional_table(headers=["", ""], data=sig_data[1:], col_widths=[0.5, 0.5])

        # Make the signature table borderless and plain
        from reportlab.platypus import TableStyle

        sig_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TEXTCOLOR", (0, 0), (-1, -1), styles["ReportBody"].textColor),
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("LINEBELOW", (0, 0), (-1, -1), 0, colors.white),
                ]
            )
        )

        # Wrap it in KeepTogether to ensure signatures are never orphaned
        story.append(KeepTogether([sig_table]))

    else:
        # Standard Tabular Report Layout
        story.append(Paragraph(title, styles["ReportTitle"]))

        if subtitle:
            story.append(Paragraph(subtitle, styles["ReportSubtitle"]))

        # Draw metadata / query filters
        if filters_applied:
            filter_parts = []
            for k, v in filters_applied.items():
                filter_parts.append(f"<b>{k}:</b> {v}")
            filter_text = f"<i>Filtros de consulta:</i> {' | '.join(filter_parts)}"
            story.append(Paragraph(filter_text, styles["ReportMeta"]))

        story.append(Spacer(1, 8))

        # Draw Data Table
        if headers and data:
            data_table = create_institutional_table(headers, data, col_widths)
            story.append(data_table)

    # 4. Canvas Maker with logo binding
    # Resolving absolute path to the local logo copied in Phase 1
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    logo_path = os.path.join(base_dir, "resources", "UNMSM_coatofarms_seal.png")

    canvas_factory = NumberedCanvasFactory(
        user_name=user_name, generation_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"), logo_path=logo_path
    )

    # 5. Build Document
    doc.build(story, canvasmaker=canvas_factory)
