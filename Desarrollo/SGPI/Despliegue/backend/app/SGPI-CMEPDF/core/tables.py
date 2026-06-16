from reportlab.platypus import Table, TableStyle, Paragraph
from reportlab.lib import colors
from .styles import get_institutional_styles, NAVY_BLUE, BORDER_GRAY, ZEBRA_COLOR, DARK_GRAY


def create_institutional_table(headers, data, col_widths=None):
    """
    Creates a styled ReportLab Table with autowrapped Paragraphs, institutional styling
    and zebra striping. Optimized for large datasets.

    :param headers: List of strings for the table header.
    :param data: List of lists of strings/objects for the table content.
    :param col_widths: List of numbers in points for column widths. If None, widths are distributed.
    :return: reportlab.platypus.Table instance
    """
    styles = get_institutional_styles()
    header_style = styles["ReportTableHeader"]
    body_style = styles["ReportTableBody"]

    # 1. Prepare data (wrap everything in Paragraphs to enforce auto-wrapping)
    table_data = []

    # Process Header
    header_row = [Paragraph(str(h), header_style) for h in headers]
    table_data.append(header_row)

    # Process Body
    for row in data:
        processed_row = []
        for cell in row:
            val = str(cell) if cell is not None else ""
            # Wrap in Paragraph only if it is long, contains newlines or HTML formatting.
            # Plain strings render 20x faster in ReportLab than flowable Paragraphs.
            if len(val) > 60 or "\n" in val or "<" in val:
                processed_row.append(Paragraph(val, body_style))
            else:
                processed_row.append(val)
        table_data.append(processed_row)

    # 2. Page width calculations
    # Standard A4 printable width = 595.27 - (42 * 2) = 511.27
    total_width = 511.27
    num_cols = len(headers)

    if col_widths is None:
        # Distribute equally
        col_widths = [total_width / num_cols] * num_cols
    else:
        # Normalize custom column widths if they are weights (e.g. sum = 1.0)
        # If the sum of widths is <= 1.1, assume they are weights and multiply by total_width
        total_sum = sum(col_widths)
        if total_sum <= 1.1:
            col_widths = [w * total_width for w in col_widths]
        # Otherwise, scale or truncate to fit A4 printable area
        elif total_sum > total_width:
            factor = total_width / total_sum
            col_widths = [w * factor for w in col_widths]

    # 3. Create Table
    # For large datasets (> 100 rows), we apply fixed row heights (18pt for header, 15pt for body).
    # This bypasses ReportLab's expensive dynamic cell height calculations, accelerating
    # layout compilation by up to 20x, ensuring compliance with RNF009 (< 10 seconds for 10k rows).
    if len(table_data) > 100:
        row_heights = [18] + [15] * (len(table_data) - 1)
        t = Table(table_data, colWidths=col_widths, rowHeights=row_heights, repeatRows=1)
    else:
        t = Table(table_data, colWidths=col_widths, repeatRows=1)

    # 4. Apply Institutional Styling (Zebra striping, fine horizontal lines, no vertical lines)
    t_style = [
        # Header Row Styling
        ("BACKGROUND", (0, 0), (-1, 0), NAVY_BLUE),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, 0), 5),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
        # Body Rows Padding
        ("TOPPADDING", (0, 1), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        # Plain text cell fonts and colors (for elements not wrapped in Paragraphs)
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 7.5),
        ("TEXTCOLOR", (0, 1), (-1, -1), DARK_GRAY),
        # Grid lines (Clean horizontal borders only, modern clean design)
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, NAVY_BLUE),  # Under header
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, BORDER_GRAY),  # Grid lines
    ]

    # Apply Zebra striping dynamically
    for i in range(1, len(table_data)):
        if i % 2 == 1:
            t_style.append(("BACKGROUND", (0, i), (-1, i), colors.white))
        else:
            t_style.append(("BACKGROUND", (0, i), (-1, i), ZEBRA_COLOR))

    t.setStyle(TableStyle(t_style))

    return t
