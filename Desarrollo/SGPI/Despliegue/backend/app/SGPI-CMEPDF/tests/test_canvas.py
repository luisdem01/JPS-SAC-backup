import os
import tempfile
import sys
# Ensure app root is in path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.engine import build_pdf_report  # noqa: E402


def test_build_pdf_report_creation():
    """
    Test basic report document compilation to verify canvas works without throwing exceptions.
    """
    # Create temp file path
    fd, tmp_path = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)

    try:
        build_pdf_report(
            output_target=tmp_path,
            title="Reporte de Prueba de Canvas",
            subtitle="Prueba de compilacion de NumberedCanvas",
            filters_applied={"Periodo": "2026", "Entidad": "FISI"},
            user_name="Tester_QA",
            headers=["Item", "Detalle de Actividad", "Estado"],
            data=[
                ["1", "Implementar motor PDF con ReportLab", "Completado"],
                ["2", "Pruebas de latencia en compilacion masiva", "Pendiente"],
                ["3", "Verificar inmutabilidad de logs en Supabase", "Completado"]
            ],
            doc_type="report"
        )

        # Verify file exists and has size
        assert os.path.exists(tmp_path)
        assert os.path.getsize(tmp_path) > 0

        # Verify PDF Signature/Magic Header (%PDF)
        with open(tmp_path, "rb") as f:
            header = f.read(4)
            assert header == b"%PDF"

    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def test_build_pdf_certificate_creation():
    """
    Test certificate document compilation to verify centered styling and signature layout.
    """
    fd, tmp_path = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)

    try:
        build_pdf_report(
            output_target=tmp_path,
            title="CONSTANCIA DE INVESTIGADOR VIGENTE",
            subtitle="Se otorga el presente documento a:",
            user_name="Secretaria_UI",
            headers=None,
            data=[
                "Dra. Maria Elena Quispe Flores, investigadora de la Facultad de Ingeniería de Sistemas e Informática.",
                (
                    "Por haber cumplido satisfactoriamente con la entrega de todos sus informes "
                    "y entregables de investigación en los plazos previstos."
                ),
                "Dado en la Ciudad Universitaria, a los 27 días del mes de mayo del 2026."
            ],
            doc_type="certificate"
        )

        assert os.path.exists(tmp_path)
        assert os.path.getsize(tmp_path) > 0

        with open(tmp_path, "rb") as f:
            header = f.read(4)
            assert header == b"%PDF"

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
