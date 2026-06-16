import io
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from .schemas import PDFGenerationRequest
from core.engine import build_pdf_report

# Setup Router
router = APIRouter(prefix="/api/pdf", tags=["pdf-engine"])
logger = logging.getLogger("pdf-engine")


@router.post("/generate")
def generate_pdf(request: PDFGenerationRequest):
    """
    Endpoint genérico que recibe los datos tabulares, filtros y metadatos,
    compila el PDF institucional en memoria y lo transmite en streaming (descarga directa).
    Cumple con el requisito funcional de CU11 (Exportar reporte).
    """
    try:
        logger.info(f"Iniciando generación de PDF [{request.doc_type}] solicitado por {request.user_requesting}")

        # Validate data if it's a tabular report
        if request.doc_type == "report":
            if not request.columns or not request.data:
                raise ValueError("Para reportes tabulares, 'columns' y 'data' son campos obligatorios.")

        buffer = io.BytesIO()

        # Build document flow in memory
        build_pdf_report(
            output_target=buffer,
            title=request.title,
            subtitle=request.subtitle,
            filters_applied=request.filters_applied,
            user_name=request.user_requesting,
            headers=request.columns,
            data=request.data,
            col_widths=request.col_widths,
            doc_type=request.doc_type,
        )

        # Move pointer to the beginning of stream
        buffer.seek(0)

        # Generate friendly and safe filename for downloading
        safe_title = "".join(c for c in request.title if c.isalnum() or c in (" ", "_", "-")).strip()
        safe_title = safe_title.replace(" ", "_")
        filename = f"{safe_title}_{request.doc_type}.pdf"

        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        }

        return StreamingResponse(buffer, media_type="application/pdf", headers=headers)

    except ValueError as val_err:
        logger.warning(f"Error de validación al generar PDF: {str(val_err)}")
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        logger.error(f"Error interno del motor de PDF: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno al preparar el archivo PDF. Intente nuevamente.")
