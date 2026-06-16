import re
from datetime import date
from typing import Optional, Tuple

MONTHS = {
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "setiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}


def parse_spanish_date(date_str: str) -> Optional[date]:
    """
    Attempts to parse a Spanish text date into a datetime.date object.
    Supports formats like:
      - '20 de noviembre de 2025'
      - 'hasta el 30 de julio de 2026'
      - '30/07/2026' or '30-07-2026'
      - '2026-05-20'
    """
    if not date_str:
        return None

    date_str = date_str.lower().strip()

    # Remove common prefixes
    date_str = re.sub(r"^(hasta el|del|al|el|cierre|límite|limite|vence)\s+", "", date_str)

    # 1. Try ISO format (YYYY-MM-DD)
    iso_match = re.search(r"\b(\d{4})[-/](\d{2})[-/](\d{2})\b", date_str)
    if iso_match:
        try:
            return date(int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3)))
        except ValueError:
            pass

    # 2. Try standard DD/MM/YYYY or DD-MM-YYYY formats
    std_match = re.search(r"\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b", date_str)
    if std_match:
        try:
            return date(int(std_match.group(3)), int(std_match.group(2)), int(std_match.group(1)))
        except ValueError:
            pass

    # 3. Try Spanish text format (e.g., "15 de junio de 2026" or "30 de julio del 2025")
    # Regex to capture [day] de [month] de/del [year]
    text_match = re.search(r"(\d{1,2})\s+de\s+([a-z]+)\s+de?l?\s+(\d{4})", date_str)
    if text_match:
        day = int(text_match.group(1))
        month_name = text_match.group(2)
        year = int(text_match.group(3))
        if month_name in MONTHS:
            try:
                return date(year, MONTHS[month_name], day)
            except ValueError:
                pass

    return None


def extract_deadline_from_text(text: str) -> Tuple[str, Optional[date]]:
    """
    Scans a text snippet for deadline dates, returns the original text fragment and the parsed date.
    """
    if not text:
        return "Ver bases", None

    # Search patterns
    patterns = [
        # "hasta el 30 de noviembre de 2026" or similar
        r"(?:cierre|limite|plazo|hasta el|vence)\s*:?\s*(\d{1,2}\s+de\s+[a-zA-Z]+\s+de?l?\s+\d{4})",
        # "cierre: 30/11/2026"
        r"(?:cierre|limite|plazo|hasta el|vence)\s*:?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})",
        # General date "30 de noviembre de 2026"
        r"(\d{1,2}\s+de\s+[a-zA-Z]+\s+del?\s+\d{4})",
        # General date "30/11/2026"
        r"(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            original_text = match.group(0)
            date_text = match.group(1)
            parsed_d = parse_spanish_date(date_text)
            if parsed_d:
                return original_text, parsed_d

    return "Ver bases", None


def calculate_days_remaining(deadline: Optional[date], current_d: Optional[date] = None) -> Optional[int]:
    """Calculates number of days remaining from deadline compared to current date."""
    if not deadline:
        return None
    if not current_d:
        current_d = date.today()
    return (deadline - current_d).days
