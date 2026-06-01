import argparse
import sys
from db.connection import SessionLocal, engine, Base
from jobs.alerts_job import AlertsJob
from colorama import Fore, Style, init

init(autoreset=True)


def main():
    """
    Punto de entrada de línea de comandos (CLI) idóneo para schedulers externos
    como Render Cron o Tareas Programadas de Windows.
    """
    parser = argparse.ArgumentParser(description="CLI Cron Runner para el Job de Semaforización de Alertas VRIP.")
    parser.add_argument(
        "--user-id",
        type=str,
        default=None,
        help="UUID del Administrador que ejecuta el proceso. Por defecto es None (ejecución automática).",
    )
    parser.add_argument(
        "--year",
        type=int,
        default=None,
        help="Año académico a sincronizar (ej. 2026). Por defecto sincroniza el año actual.",
    )
    args = parser.parse_args()

    # Validar formato del UUID de usuario si se suministró
    if args.user_id:
        try:
            import uuid

            uuid.UUID(args.user_id)
        except ValueError:
            print(f"{Fore.RED}Error: El parámetro --user-id debe tener un formato UUID válido.{Style.RESET_ALL}")
            sys.exit(1)

    print(f"{Fore.GREEN}Inicializando base de datos...{Style.RESET_ALL}")
    try:
        # Asegurar creación de tablas en entornos de desarrollo local/SQLite
        Base.metadata.create_all(bind=engine)
    except Exception as db_err:
        print(f"{Fore.RED}Error al conectar a la base de datos: {db_err}{Style.RESET_ALL}")
        sys.exit(1)

    print(f"{Fore.GREEN}Generando sesión de base de datos...{Style.RESET_ALL}")
    db = SessionLocal()
    try:
        # Instanciar y ejecutar el Job
        job = AlertsJob(db=db, ejecutado_por_id=args.user_id)
        result = job.execute(year=args.year)

        if result.get("resultado") == "Error":
            print(f"{Fore.RED}El Job finalizó con errores. Verifique los logs.{Style.RESET_ALL}")
            sys.exit(2)
        else:
            print(f"{Fore.GREEN}Ejecución CLI completada exitosamente.{Style.RESET_ALL}")
            sys.exit(0)

    except Exception as run_err:
        print(f"{Fore.RED}Fallo crítico en el runner: {run_err}{Style.RESET_ALL}")
        sys.exit(3)
    finally:
        db.close()


if __name__ == "__main__":
    main()
