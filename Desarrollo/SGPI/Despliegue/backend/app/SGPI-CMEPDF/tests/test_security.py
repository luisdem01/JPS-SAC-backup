import os
import sys
# Ensure app root is in path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

# Initialize test client
client = TestClient(app)


def test_health_check_endpoint():
    """
    Validate that health check endpoint responds with 200 OK and status 'healthy'.
    Required to avoid Render cold starts.
    """
    response = client.get("/health")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["status"] == "healthy"
    assert json_data["service"] == "SGPI-CMEPDF Engine"


def test_api_generate_pdf_report_success():
    """
    Validate POST /api/pdf/generate with a valid report payload.
    Checks headers, media type, file naming and PDF magic signature bytes.
    """
    payload = {
        "title": "Reporte de Convocatorias 2026",
        "subtitle": "Filtros aplicados para auditoría de la Unidad de Investigación",
        "filters_applied": {"Año": 2026, "Estado": "Activo"},
        "user_requesting": "Secretaria_Tester",
        "columns": ["ID", "Título de Convocatoria", "Fecha Cierre"],
        "data": [
            ["1", "PMULTI - Proyectos Multidisciplinarios", "2026-07-30"],
            ["2", "PCONFIGI - Proyectos con Financiamiento", "2026-08-15"]
        ],
        "doc_type": "report"
    }
    response = client.post("/api/pdf/generate", json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"

    # Assert headers and attachment naming convention
    assert "Content-Disposition" in response.headers
    expected_filename = 'attachment; filename="Reporte_de_Convocatorias_2026_report.pdf"'
    assert expected_filename in response.headers["Content-Disposition"]

    # Validate PDF signature
    content = response.content
    assert content[:4] == b"%PDF"


def test_api_generate_pdf_certificate_success():
    """
    Validate POST /api/pdf/generate with a valid certificate payload.
    """
    payload = {
        "title": "CERTIFICADO DE EXCELENCIA ACADEMICA",
        "subtitle": "Unidad de Investigacion de la FISI",
        "user_requesting": "Director_UI",
        "data": [
            ["Por cuanto el Dr. Juan Perez Gomez ha cumplido con los objetivos cientificos del POI 2025."],
            ["Se expide la presente constancia para los fines pertinentes de carga no lectiva."]
        ],
        "doc_type": "certificate"
    }
    response = client.post("/api/pdf/generate", json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "Content-Disposition" in response.headers
    expected_filename = 'attachment; filename="CERTIFICADO_DE_EXCELENCIA_ACADEMICA_certificate.pdf"'
    assert expected_filename in response.headers["Content-Disposition"]

    content = response.content
    assert content[:4] == b"%PDF"


def test_api_generate_pdf_validation_error():
    """
    Validate that invalid payloads (e.g. report without columns/data)
    respond with HTTP 400 Bad Request.
    """
    # report type requires columns and data
    payload = {
        "title": "Reporte Erróneo",
        "doc_type": "report"
    }
    response = client.post("/api/pdf/generate", json=payload)
    assert response.status_code == 400
    assert "detail" in response.json()
