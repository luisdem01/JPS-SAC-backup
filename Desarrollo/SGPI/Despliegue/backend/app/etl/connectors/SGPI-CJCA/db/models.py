import uuid
from sqlalchemy import Column, Integer, String, Text, Numeric, Date, DateTime, JSON, UUID, func

# Reutilizar el Base definido en connection
from db.connection import Base


class Convocatoria(Base):
    __tablename__ = "convocatoria"

    id_convocatoria = Column(Integer, primary_key=True, autoincrement=True)
    resolucion_base = Column(String(100), unique=True, nullable=True)
    titulo_convocatoria = Column(Text, nullable=False)
    entidad_emisora = Column(String(100), server_default="VRIP-UNMSM", default="VRIP-UNMSM")
    presupuesto_maximo = Column(Numeric(12, 2), nullable=True)
    fecha_inicio_inscripcion = Column(Date, nullable=False)
    fecha_cierre = Column(Date, nullable=False)
    url_bases_vrip = Column(String(255), nullable=True)
    cambios_cronograma = Column(JSON, nullable=True)  # Mapea a JSONB en PostgreSQL y TEXT/JSON en SQLite
    estado_convocatoria = Column(String(50), server_default="Abierta", default="Abierta")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=func.now())

    def __repr__(self):
        return (
            f"<Convocatoria id={self.id_convocatoria} "
            f"titulo='{self.titulo_convocatoria[:30]}...' "
            f"estado='{self.estado_convocatoria}'>"
        )


class LogAuditoria(Base):
    __tablename__ = "log_auditoria"

    id_log = Column(UUID, primary_key=True, default=uuid.uuid4)
    tipo_evento = Column(String(50), nullable=False)  # e.g., 'SYNC_VRIP'
    entidad_afectada = Column(String(100), nullable=True)  # e.g., 'convocatoria'
    pk_entidad = Column(String(100), nullable=True)  # e.g., PK de la convocatoria o 'ALL'
    valor_anterior = Column(JSON, nullable=True)
    valor_nuevo = Column(JSON, nullable=True)
    id_usuario = Column(UUID, nullable=True)  # ID del usuario que lo ejecutó, si aplica
    ip_origen = Column(String(50), nullable=True)
    resultado = Column(String(20), nullable=False, server_default="Exito", default="Exito")  # 'Exito' o 'Error'
    detalle_error = Column(Text, nullable=True)
    timestamp_evento = Column(DateTime(timezone=True), server_default=func.now(), default=func.now())

    def __repr__(self):
        return f"<LogAuditoria id={self.id_log} tipo='{self.tipo_evento}' resultado='{self.resultado}'>"
