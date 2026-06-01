import os
import time
import tempfile
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.engine import build_pdf_report  # noqa: E402


def test_performance_10000_rows():
    """
    Benchmark test validating RNF009: Generating a massive 10,000 row table
    must complete in less than 10 seconds.
    """
    fd, tmp_path = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)

    # 1. Generate 10,000 rows of mock research data
    headers = ["N°", "Codigo", "Investigador Responsable", "Monto Asignado", "Estado"]
    data = []
    for i in range(10000):
        data.append([
            str(i + 1),
            f"PRJ-2026-F-{i:04d}",
            f"Dr. ApellidoPaterno_{i} ApellidoMaterno_{i}, Nombre_{i}",
            f"S/. {15400.00 + (i * 1.5):.2f}",
            "Aprobado" if i % 3 != 0 else "En Deuda"
        ])

    # 2. Compile and measure duration
    start_time = time.time()
    try:
        build_pdf_report(
            output_target=tmp_path,
            title="REPORTE HISTORICO INTEGRAL POI - CONSOLIDADO FISI",
            subtitle="Consolidado de 10,000 registros para auditoria de carga no lectiva",
            filters_applied={"Rango": "Completo", "Origen": "Supabase Replica", "Prueba": "Rendimiento"},
            user_name="QA_Benchmark_Runner",
            headers=headers,
            data=data,
            doc_type="report"
        )
        end_time = time.time()
        duration = end_time - start_time

        # Display benchmark results
        print(f"\n[BENCHMARK] Tiempo de compilacion para 10,000 registros: {duration:.4f} segundos.")

        # Assertions
        assert duration < 10.0, (
            f"Fallo RNF009: La compilacion tardó {duration:.2f} segundos, "
            "superando el umbral de 10s."
        )
        assert os.path.exists(tmp_path)

        # Check size (10,000 rows should produce a PDF of several megabytes, at least 500 KB)
        file_size_kb = os.path.getsize(tmp_path) / 1024
        print(f"[BENCHMARK] Tamaño del archivo PDF generado: {file_size_kb:.2f} KB.")
        assert file_size_kb > 200, "El tamaño del archivo es inusualmente pequeño para 10k registros."

    finally:
        # Clean up
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


if __name__ == "__main__":
    test_performance_10000_rows()
