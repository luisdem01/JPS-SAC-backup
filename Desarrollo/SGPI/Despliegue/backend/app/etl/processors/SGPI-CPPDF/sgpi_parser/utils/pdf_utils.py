import fitz  # PyMuPDF
import pdfplumber
from typing import List, Generator, Tuple, Optional
from sgpi_parser.config import settings


def get_fitz_doc(pdf_path: str) -> fitz.Document:
    """Abre un documento PDF usando PyMuPDF."""
    return fitz.open(pdf_path)


def get_plumber_doc(pdf_path: str) -> pdfplumber.PDF:
    """Abre un documento PDF usando pdfplumber."""
    return pdfplumber.open(pdf_path)


def is_page_scanned(page: fitz.Page, threshold: Optional[int] = None) -> bool:
    """
    Evalúa si una página de PDF probablemente es escaneada (baja densidad de texto nativo).
    """
    limit = threshold if threshold is not None else settings.OCR_DENSITY_THRESHOLD
    text = page.get_text()
    return len(text.strip()) < limit


def extract_page_text_ocr(page: fitz.Page, dpi: Optional[int] = None, lang: Optional[str] = None) -> str:
    """
    Rasteriza una página de PDF a imagen a la resolución especificada
    y utiliza Tesseract OCR para extraer todo su texto plano.
    """
    import io
    from PIL import Image
    import pytesseract

    ocr_dpi = dpi if dpi is not None else settings.OCR_DPI
    ocr_lang = lang if lang is not None else settings.OCR_LANGUAGE

    # Resolver idioma disponible
    try:
        available_langs = pytesseract.get_languages()
        if ocr_lang not in available_langs:
            if "eng" in available_langs:
                ocr_lang = "eng"
            elif available_langs:
                ocr_lang = available_langs[0]
    except Exception:
        pass

    # 1. Rasterizar página a alta resolución (ej. 300 DPI)
    pix = page.get_pixmap(dpi=ocr_dpi)
    img_data = pix.tobytes("png")

    # 2. Cargar en Pillow
    img = Image.open(io.BytesIO(img_data))

    # 3. Aplicar OCR
    text = pytesseract.image_to_string(img, lang=ocr_lang)
    return text


def extract_page_words_ocr(
    page: fitz.Page, dpi: Optional[int] = None, lang: Optional[str] = None
) -> List[Tuple[float, float, float, float, str, int, int, int]]:
    """
    Rasteriza la página y ejecuta OCR con coordenadas para simular la estructura
    de PyMuPDF: listado de tuplas (x0, y0, x1, y1, "palabra", block_no, line_no, word_no).
    """
    import io
    from PIL import Image
    import pytesseract

    ocr_dpi = dpi if dpi is not None else settings.OCR_DPI
    ocr_lang = lang if lang is not None else settings.OCR_LANGUAGE

    # Resolver idioma disponible
    try:
        available_langs = pytesseract.get_languages()
        if ocr_lang not in available_langs:
            if "eng" in available_langs:
                ocr_lang = "eng"
            elif available_langs:
                ocr_lang = available_langs[0]
    except Exception:
        pass

    # 1. Rasterizar página
    pix = page.get_pixmap(dpi=ocr_dpi)
    img_data = pix.tobytes("png")

    # 2. Cargar en Pillow
    img = Image.open(io.BytesIO(img_data))

    # 3. Ejecutar OCR para obtener diccionario de datos geométricos
    # psm 6 asume un bloque de texto uniforme (muy efectivo para tablas estructuradas)
    config = "--psm 6"
    data = pytesseract.image_to_data(img, lang=ocr_lang, config=config, output_type=pytesseract.Output.DICT)

    # Tesseract da las coordenadas en píxeles. Debemos reescalar a puntos de PDF (72 DPI)
    scale = 72.0 / ocr_dpi

    words_list = []
    n_boxes = len(data["text"])
    for i in range(n_boxes):
        word_text = data["text"][i].strip()
        if not word_text:
            continue

        x = data["left"][i]
        y = data["top"][i]
        w = data["width"][i]
        h = data["height"][i]

        x0 = x * scale
        y0 = y * scale
        x1 = (x + w) * scale
        y1 = (y + h) * scale

        block_no = data["block_num"][i]
        line_no = data["line_num"][i]
        word_no = data["word_num"][i]

        words_list.append((x0, y0, x1, y1, word_text, block_no, line_no, word_no))

    return words_list


def extract_raw_text_fitz(pdf_path: str) -> str:
    """Extrae todo el texto plano de un PDF rápidamente usando PyMuPDF, con fallback condicional a OCR."""
    text = ""
    with get_fitz_doc(pdf_path) as doc:
        for page in doc:
            if is_page_scanned(page):
                try:
                    page_text = extract_page_text_ocr(page)
                except Exception:
                    page_text = page.get_text()
            else:
                page_text = page.get_text()
            text += page_text + "\n"
    return text


def iter_pages_text_fitz(pdf_path: str) -> Generator[Tuple[int, str], None, None]:
    """Itera sobre las páginas del PDF extrayendo el número de página (1-indexed) y su texto con fallback OCR."""
    with get_fitz_doc(pdf_path) as doc:
        for page_num, page in enumerate(doc, 1):
            if is_page_scanned(page):
                try:
                    page_text = extract_page_text_ocr(page)
                except Exception:
                    page_text = page.get_text()
            else:
                page_text = page.get_text()
            yield page_num, page_text


def extract_tables_plumber(pdf_path: str, page_num: int) -> List[List[List[str]]]:
    """
    Extrae tablas de una página específica (1-indexed) usando pdfplumber.
    Retorna una lista de tablas, donde cada tabla es una lista de filas, y cada fila es una lista de strings.
    """
    tables = []
    with get_plumber_doc(pdf_path) as pdf:
        if 1 <= page_num <= len(pdf.pages):
            page = pdf.pages[page_num - 1]
            extracted = page.extract_tables()
            for t in extracted:
                # Filtrar celdas None y limpiar strings
                cleaned_table = []
                for row in t:
                    cleaned_row = [str(cell).strip() if cell is not None else "" for cell in row]
                    # Solo agregar si al menos una celda de la fila tiene contenido
                    if any(cleaned_row):
                        cleaned_table.append(cleaned_row)
                if cleaned_table:
                    tables.append(cleaned_table)
    return tables


def get_pdf_page_count(pdf_path: str) -> int:
    """Retorna la cantidad de páginas del PDF."""
    with get_fitz_doc(pdf_path) as doc:
        return len(doc)
