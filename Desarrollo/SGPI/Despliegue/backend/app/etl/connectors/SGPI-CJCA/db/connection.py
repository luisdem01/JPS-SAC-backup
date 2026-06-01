import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Cargar variables de entorno
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("Error: La variable de entorno DATABASE_URL no está configurada.")

# Configuraciones específicas según el tipo de base de datos
engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    # SQLite requiere deshabilitar el chequeo del mismo hilo para peticiones concurrentes en desarrollo
    engine_kwargs["connect_args"] = {"check_same_thread": False}

# Crear el motor de base de datos de SQLAlchemy
engine = create_engine(DATABASE_URL, **engine_kwargs)

# Configurar el generador de sesiones
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base para definir los modelos ORM
Base = declarative_base()


def get_db():
    """
    Generador de contexto para obtener sesiones de base de datos de forma segura.
    Se asegura de cerrar la conexión en caso de errores o al finalizar el bloque de código.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
