from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import require_staff
from app.core.audit import log_audit_event
from sgpi_crapi.schemas.report_schemas import ReportParams
from sgpi_crapi.services.report_service import generate_report_dispatched
from sgpi_cmee.services.adapter import adapt_report_to_generic_excel
from sgpi_cmee.services.excel_exporter import export_to_excel_generic

router = APIRouter()

@router.post("/export/excel")
async def export_excel(
    params: ReportParams,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    """
    Genera el reporte solicitado y lo exporta como archivo Excel Premium.
    Registra el evento de exportación en auditoría (RNF022).
    """
    try:
        report_data = await generate_report_dispatched(db, params)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    try:
        usuario_str = current_user.get("correo_institucional") or str(current_user.get("sub", "Usuario Autorizado"))
        generic_request = adapt_report_to_generic_excel(report_data, params.tipo_reporte, usuario_str)
        excel_buffer = export_to_excel_generic(generic_request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando Excel: {str(e)}")

    # Registrar evento de auditoría
    await log_audit_event(
        db=db,
        tipo_evento="EXPORT_REPORT",
        entidad_afectada="report_export",
        pk_entidad=f"tipo_{params.tipo_reporte.replace(' ', '_').lower()}",
        valor_nuevo={"parametros": params.model_dump(mode='json'), "formato": "excel"},
        id_usuario=current_user.get("sub"),
    )
    
    filename = f"SGPI_Reporte_{params.tipo_reporte.replace(' ', '_')}.xlsx"
    
    return StreamingResponse(
        excel_buffer, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
