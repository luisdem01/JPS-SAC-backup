import os
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []
        self.user_name = "Sistema SGPI"
        self.generation_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.logo_path = None

    def showPage(self):
        state = dict(self.__dict__)
        # Create copies of mutable structures to prevent data loss on in-place mutations
        state['_code'] = list(self._code)
        state['_codeStack'] = list(self._codeStack)
        state['_formsinuse'] = list(self._formsinuse)
        state['_annotationrefs'] = list(self._annotationrefs)
        state['_colorsUsed'] = dict(self._colorsUsed)
        state['_shadingUsed'] = dict(self._shadingUsed)
        
        self._saved_page_states.append(state)
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()

        # A4 standard size is 595.27 x 841.89
        width, height = A4
        margin = 42  # 1.5 cm in points

        # 1. DRAW HEADER
        # Draw Logo (if available)
        logo_y = height - margin - 45
        logo_x = margin
        logo_width = 38
        logo_height = 45

        has_logo = False
        if self.logo_path and os.path.exists(self.logo_path):
            try:
                self.drawImage(self.logo_path, logo_x, logo_y, width=logo_width, height=logo_height, mask="auto")
                has_logo = True
            except Exception:
                pass  # Fallback to text if image drawing fails

        # Draw Header Text
        text_x = logo_x + logo_width + 12 if has_logo else margin

        # Colors: Navy Blue (#003366) and Dark Gray (#333333)
        navy_blue = colors.HexColor("#003366")
        dark_gray = colors.HexColor("#333333")
        gold_color = colors.HexColor("#E67E22")

        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(navy_blue)
        self.drawString(text_x, height - margin - 12, "UNIVERSIDAD NACIONAL MAYOR DE SAN MARCOS")

        self.setFont("Helvetica", 7)
        self.setFillColor(dark_gray)
        self.drawString(text_x, height - margin - 22, "Universidad del Perú, DECANA DE AMÉRICA")

        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(navy_blue)
        self.drawString(text_x, height - margin - 32, "FACULTAD DE INGENIERÍA DE SISTEMAS E INFORMÁTICA")

        self.setFont("Helvetica", 7)
        self.setFillColor(dark_gray)
        self.drawString(text_x, height - margin - 42, "Unidad de Investigación y Posgrado")

        # Sutil horizontal double line or single colored line in gold below header
        header_line_y = height - margin - 52
        self.setStrokeColor(gold_color)
        self.setLineWidth(1)
        self.line(margin, header_line_y, width - margin, header_line_y)

        # 2. DRAW FOOTER
        footer_line_y = margin + 12
        self.setStrokeColor(colors.HexColor("#D1D5DB"))
        self.setLineWidth(0.5)
        self.line(margin, footer_line_y, width - margin, footer_line_y)

        self.setFont("Helvetica", 6.5)
        self.setFillColor(colors.HexColor("#6B7280"))

        # Left Footer: Document info + requesting user (CU11 requirement)
        footer_left_text = f"Sistema de Gestión de Proyectos de Investigación (SGPI) | Generado por: {self.user_name}"
        self.drawString(margin, margin + 2, footer_left_text)

        # Center Footer: Date and Time
        footer_center_text = f"Fecha de emisión: {self.generation_time}"
        self.drawCentredString(width / 2.0, margin + 2, footer_center_text)

        # Right Footer: Page number (Page X of Y)
        footer_right_text = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(width - margin, margin + 2, footer_right_text)

        self.restoreState()


class NumberedCanvasFactory:
    def __init__(self, user_name="Sistema SGPI", generation_time=None, logo_path=None):
        self.user_name = user_name
        self.generation_time = generation_time or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.logo_path = logo_path

    def __call__(self, *args, **kwargs):
        canvas_instance = NumberedCanvas(*args, **kwargs)
        canvas_instance.user_name = self.user_name
        canvas_instance.generation_time = self.generation_time
        canvas_instance.logo_path = self.logo_path
        return canvas_instance
