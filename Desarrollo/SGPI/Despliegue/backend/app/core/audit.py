import uuid
import logging
from typing import Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.domain import LogAuditoria

logger = logging.getLogger(__name__)

async def log_audit_event(
    db: AsyncSession,
    tipo_evento: str,
    entidad_afectada: Optional[str] = None,
    pk_entidad: Optional[str] = None,
    valor_anterior: Optional[Any] = None,
    valor_nuevo: Optional[Any] = None,
    id_usuario: Optional[str] = None,
    ip_origen: Optional[str] = None,
    resultado: str = "Exito",
    detalle_error: Optional[str] = None
):
    """
    Inserta un registro inmutable en la tabla de auditoría.
    Usa una sesión INDEPENDIENTE para no afectar la transacción del endpoint principal.
    Nunca propaga excepciones — la auditoría es siempre no-crítica.
    """
    from app.db.session import AsyncSessionLocal

    # Parsear id_usuario a UUID — si falla o no existe en la tabla
    # usuario local, simplemente se guarda NULL (ON DELETE SET NULL).
    parsed_user_id: Optional[uuid.UUID] = None
    if isinstance(id_usuario, str) and id_usuario:
        try:
            parsed_user_id = uuid.UUID(id_usuario)
        except (ValueError, AttributeError):
            logger.warning(
                f"[AUDIT] id_usuario '{id_usuario}' no es un UUID válido — se guarda NULL."
            )

    log_entry = LogAuditoria(
        id_log=uuid.uuid4(),
        tipo_evento=tipo_evento,
        entidad_afectada=entidad_afectada,
        pk_entidad=pk_entidad,
        valor_anterior=valor_anterior,
        valor_nuevo=valor_nuevo,
        id_usuario=parsed_user_id,
        ip_origen=ip_origen,
        resultado=resultado,
        detalle_error=detalle_error,
    )

    # Usar sesión propia para aislar completamente la auditoría
    try:
        async with AsyncSessionLocal() as audit_session:
            async with audit_session.begin():
                audit_session.add(log_entry)
        logger.debug(
            f"[AUDIT] Registrado: {tipo_evento} sobre {entidad_afectada}({pk_entidad})"
        )
        return log_entry
    except Exception as audit_err:
        # Si el id_usuario no existe en tabla usuario local (FK), reintentar con NULL
        if "foreign key" in str(audit_err).lower() and parsed_user_id is not None:
            logger.warning(
                f"[AUDIT] id_usuario {parsed_user_id} no existe en tabla usuario local. "
                f"Reintentando con id_usuario=NULL."
            )
            log_entry.id_usuario = None
            try:
                async with AsyncSessionLocal() as audit_session2:
                    async with audit_session2.begin():
                        audit_session2.add(log_entry)
                logger.debug("[AUDIT] Registrado con id_usuario=NULL.")
                return log_entry
            except Exception as retry_err:
                logger.error(
                    f"[AUDIT] Fallo al reintentar auditoría (operación no crítica): {retry_err}"
                )
        else:
            logger.error(
                f"[AUDIT] Fallo al registrar auditoría (operación no crítica): {audit_err}"
            )
        return None
