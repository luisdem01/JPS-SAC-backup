from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, insert, delete
from sqlalchemy.sql import func
from typing import Dict, Any, List
from app.models.domain import ReconciliacionPendiente, LogAuditoria, Investigador, Proyecto, Publicacion, Tesis

class ReconciliationPersister:
    async def persist_quarantine(self, db: AsyncSession, entidad: str, llave_sugerida: str,
                                fuentes: List[str], conflicto: Dict[str, Any], motivo: str) -> None:
        """
        Guarda el registro en cuarentena.
        """
        pendiente = ReconciliacionPendiente(
            entidad_afectada=entidad,
            llave_primaria_sugerida=llave_sugerida,
            fuentes_involucradas=fuentes,
            datos_conflicto=conflicto,
            motivo_cuarentena=motivo,
            estado='Pendiente'
        )
        db.add(pendiente)

        # Mapear tipo_evento a un valor permitido por el CHECK constraint de log_auditoria
        _fuente_map = {
            'RENACYT':    'SYNC_RENACYT',
            'Cybertesis': 'SYNC_CYBERTESIS',
            'VRIP':       'SYNC_VRIP',
        }
        primera_fuente = fuentes[0] if fuentes else ''
        tipo_evento_log = _fuente_map.get(primera_fuente, 'INSERT')

        # Serializar datetimes antes de guardar en columna JSON
        import datetime
        conflicto_serializable = {
            k: v.isoformat() if isinstance(v, (datetime.datetime, datetime.date)) else v
            for k, v in conflicto.items()
        }

        # Auditoría de envío a cuarentena
        log = LogAuditoria(
            tipo_evento=tipo_evento_log,
            entidad_afectada='reconciliacion_pendientes',
            pk_entidad=llave_sugerida,
            valor_nuevo=conflicto_serializable,
            resultado='Exito',
            detalle_error=motivo
        )
        db.add(log)

        await db.commit()


    async def persist_resolved(self, db: AsyncSession, entidad: str, llave_pk: str, 
                             merged_data: Dict[str, Any], fuente_ganadora: str) -> None:
        """
        Guarda o actualiza el registro en la base de datos principal y genera auditoría de forma atómica.
        """
        try:
            is_update = False
            merged_data.pop('updated_at', None)
            
            if entidad == "investigador":
                result = await db.execute(select(Investigador).where(Investigador.dni == llave_pk))
                existing = result.scalars().first()
                # Asegurar campo requerido
                if 'departamento_academico' not in merged_data and not existing:
                    merged_data['departamento_academico'] = 'No Especificado'

                if existing:
                    await db.execute(update(Investigador).where(Investigador.dni == llave_pk).values(**merged_data, updated_at=func.now()))
                    is_update = True
                else:
                    await db.execute(insert(Investigador).values(**merged_data))

            elif entidad == "proyecto":
                result = await db.execute(select(Proyecto).where(Proyecto.codigo_proyecto == llave_pk))
                if result.scalars().first():
                    await db.execute(update(Proyecto).where(Proyecto.codigo_proyecto == llave_pk).values(**merged_data, updated_at=func.now()))
                    is_update = True
                else:
                    await db.execute(insert(Proyecto).values(**merged_data))

            elif entidad == "publicacion":
                # llave_pk para publicacion puede ser el doi_codigo o un id temporal si es nuevo
                stmt = select(Publicacion)
                if llave_pk and llave_pk != "NEW":
                    stmt = stmt.where(Publicacion.doi_codigo == llave_pk)
                else:
                    stmt = stmt.where(Publicacion.titulo_articulo == merged_data.get('titulo_articulo'))
                
                result = await db.execute(stmt)
                existing = result.scalars().first()
                if existing:
                    llave_pk = str(existing.id_publicacion) # override llave_pk para el log
                    await db.execute(update(Publicacion).where(Publicacion.id_publicacion == existing.id_publicacion).values(**merged_data))
                    is_update = True
                else:
                    await db.execute(insert(Publicacion).values(**merged_data))
                    
            elif entidad == "tesis":
                # llave_pk es url_cybertesis
                result = await db.execute(select(Tesis).where(Tesis.url_cybertesis == llave_pk))
                existing = result.scalars().first()
                # Cybertesis API devuelve texto que adaptamos a columnas de tesis
                # Este payload de Tesis tiene dni_asesor_reconciliado
                tesis_data = {
                    "url_cybertesis": merged_data.get("url_cybertesis", llave_pk),
                    "titulo_tesis": merged_data.get("titulo_tesis", "Sin Título"),
                    "asesor_texto": merged_data.get("asesor_texto", ""),
                    "dni_asesor": merged_data.get("dni_asesor_reconciliado", None),
                    "autor_estudiante_texto": merged_data.get("autor_estudiante_texto")
                }
                
                if existing:
                    await db.execute(update(Tesis).where(Tesis.url_cybertesis == llave_pk).values(**tesis_data))
                    is_update = True
                else:
                    await db.execute(insert(Tesis).values(**tesis_data))
            
            # Generar Auditoría (Misma transacción)
            import datetime
            from decimal import Decimal
            serializable_data = {}
            for k, v in merged_data.items():
                if isinstance(v, (datetime.datetime, datetime.date)):
                    serializable_data[k] = v.isoformat()
                elif isinstance(v, Decimal):
                    serializable_data[k] = float(v)
                else:
                    serializable_data[k] = v

            log = LogAuditoria(
                tipo_evento='UPDATE' if is_update else 'INSERT',
                entidad_afectada=entidad,
                pk_entidad=llave_pk,
                valor_nuevo=serializable_data,
                resultado='Exito',
                detalle_error=f"Reconciliado vía MRN. Fuente principal: {fuente_ganadora}"
            )
            db.add(log)
            
            await db.commit()
            
        except Exception as e:
            await db.rollback()
            raise e
            
    async def resolve_quarantine_item(self, db: AsyncSession, id_pendiente: int, action: str) -> None:
        """
        Resuelve un item de cuarentena aprobándolo (fuerza persist_resolved) o rechazándolo.
        """
        result = await db.execute(select(ReconciliacionPendiente).where(ReconciliacionPendiente.id_pendiente == id_pendiente))
        item = result.scalars().first()
        if not item or item.estado != 'Pendiente':
            raise ValueError("Item no encontrado o ya resuelto.")
            
        if action == 'aprobar':
            await self.persist_resolved(
                db, 
                entidad=item.entidad_afectada, 
                llave_pk=item.llave_primaria_sugerida, 
                merged_data=item.datos_conflicto, 
                fuente_ganadora="Resolución Manual Admin"
            )
            item.estado = 'Aprobado'
        elif action == 'rechazar':
            item.estado = 'Rechazado'
            
        db.add(item)
        await db.commit()

persister = ReconciliationPersister()
