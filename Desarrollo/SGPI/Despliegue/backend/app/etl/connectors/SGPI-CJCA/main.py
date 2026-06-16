from datetime import datetime
from typing import Optional
from fastapi import FastAPI, BackgroundTasks, Depends, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from db.connection import get_db, engine, Base
from jobs.alerts_job import AlertsJob

# Crear las tablas en la base de datos de desarrollo local/SQLite si no existen
# En producción, esto normalmente se maneja por migraciones, pero es ideal para asegurar "out-of-the-box" local.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SGPI - API de Semaforización de Alertas VRIP",
    description=(
        "Microservicio orquestador para la captura, sincronización y auditoría "
        "del ciclo de vida de convocatorias del VRIP."
    ),
    version="1.0.0",
)

# Habilitar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def run_sync_in_background(user_id: Optional[str]):
    """
    Función helper para ejecutar el Job en segundo plano de manera segura
    liberando inmediatamente el endpoint del cliente.
    """
    from db.connection import SessionLocal

    db = SessionLocal()
    try:
        job = AlertsJob(db=db, ejecutado_por_id=user_id)
        job.execute()
    finally:
        db.close()


@app.get("/health", status_code=status.HTTP_200_OK)
def health_check(db: Session = Depends(get_db)):
    """
    Endpoint keep-alive consultado por UptimeRobot para mitigar cold starts.
    Verifica que la base de datos esté accesible.
    """
    try:
        # Intenta una consulta básica en la BD
        db.execute(Base.metadata.tables["convocatoria"].select().limit(1))
        db_status = "online"
    except Exception as e:
        db_status = f"offline: {e}"

    return {"status": "healthy", "timestamp": datetime.now().isoformat(), "database": db_status}


@app.post("/sync/vrip", status_code=status.HTTP_202_ACCEPTED)
def trigger_vrip_sync(
    background_tasks: BackgroundTasks,
    x_user_id: Optional[str] = Header(
        None, description="UUID del Administrador que inicia la sincronización (simulación JWT)"
    ),
):
    """
    Activa bajo demanda (CU03) la sincronización de convocatorias del VRIP en segundo plano.
    Responde con 202 Accepted de inmediato (< 2 segundos de latencia).
    """
    # Si viene el UUID de usuario, validamos el formato básico
    if x_user_id:
        try:
            import uuid

            uuid.UUID(x_user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="El header X-User-Id debe tener un formato UUID válido."
            )

    # Añadir a las tareas en segundo plano de FastAPI
    background_tasks.add_task(run_sync_in_background, x_user_id)

    return {
        "resultado": "Sincronización Iniciada",
        "detalle": "La captura y reconciliación de convocatorias del VRIP está ejecutándose en segundo plano.",
        "ejecutado_por": x_user_id if x_user_id else "SISTEMA (Cron / Background)",
        "timestamp": datetime.now().isoformat(),
    }
