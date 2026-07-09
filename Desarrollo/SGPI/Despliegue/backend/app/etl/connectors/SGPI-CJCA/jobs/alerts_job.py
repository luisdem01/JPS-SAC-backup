import os
import sys
import uuid
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any

# Configurar variables de entorno y ruta del conector VRIP
from dotenv import load_dotenv

load_dotenv()

# Priorizar el vrip_connector local si existe en el directorio principal (al mismo nivel que la carpeta jobs)
local_parent = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if os.path.exists(os.path.join(local_parent, "vrip_connector")):
    if local_parent not in sys.path:
        sys.path.insert(0, local_parent)
else:
    vrip_path = os.getenv("VRIP_CONNECTOR_PATH", "C:/Users/marec/Desktop/VRIP")
    if vrip_path not in sys.path:
        sys.path.insert(0, vrip_path)

try:
    from vrip_connector.engines.vrip_convocatorias import VripConvocatoriasExtractor
    from vrip_connector.utils.date_parser import parse_spanish_date
except ImportError as e:
    print(f"Error al importar el conector de VRIP: {e}")
    # Definimos mocks simples para pruebas robustas e independientes en caso de fallar la carga externa
    VripConvocatoriasExtractor = None
    parse_spanish_date = None

from sqlalchemy.orm import Session  # noqa: E402
from db.models import Convocatoria, LogAuditoria  # noqa: E402
from colorama import Fore, Style, init  # noqa: E402

init(autoreset=True)


class AlertsJob:
    def __init__(self, db: Session, ejecutado_por_id: Optional[str] = None):
        """
        Inicializa el Job de Alertas.
        :param db: Sesión activa de SQLAlchemy.
        :param ejecutado_por_id: UUID del Administrador que ejecuta la sincronización, si aplica.
        """
        self.db = db
        self.ejecutado_por_id = ejecutado_por_id

    def execute(self, year: Optional[int] = None) -> Dict[str, Any]:
        """
        Ejecuta el ciclo completo de scraping, reconciliación, upsert e historización de cronogramas.
        """
        stats = {
            "registros_procesados": 0,
            "registros_creados": 0,
            "registros_actualizados": 0,
            "errores_procesamiento": 0,
        }

        target_year = year if year else date.today().year
        print(
            f"\n{Fore.CYAN}{Style.BRIGHT}"
            f"=== INICIANDO JOB DE SEMAFORIZACIÓN DE ALERTAS (VRIP {target_year}) ==="
            f"{Style.RESET_ALL}"
        )

        if VripConvocatoriasExtractor is None:
            err_msg = (
                f"No se pudo cargar el extractor de VRIP. "
                f"Verifique VRIP_CONNECTOR_PATH en su archivo .env. Ruta: {vrip_path}"
            )
            print(f"{Fore.RED}[JOB ERROR] {err_msg}{Style.RESET_ALL}")
            self._log_execution(resultado="Error", detalle_error=err_msg, stats=stats)
            return {"resultado": "Error", "detalle": err_msg}

        try:
            # 1. Ejecutar el Scraper de Convocatorias en Vivo
            extractor = VripConvocatoriasExtractor()
            convocatorias_scraped = extractor.extract(year=target_year)

            if not convocatorias_scraped:
                warning_msg = "El extractor no retornó ninguna convocatoria activa."
                print(f"{Fore.YELLOW}[JOB WARNING] {warning_msg}{Style.RESET_ALL}")
                self._log_execution(resultado="Exito", stats=stats, detalle_error=warning_msg)
                return {"resultado": "Exito", "detalle": warning_msg, "stats": stats}

            # 2. Procesar e integrar cada convocatoria
            for conv_model in convocatorias_scraped:
                try:
                    stats["registros_procesados"] += 1

                    # Convertir plazo_cierre a date. Si no se puede, usar un default seguro (30 días a futuro)
                    parsed_close_date = None
                    if conv_model.plazo_cierre:
                        try:
                            parsed_close_date = date.fromisoformat(conv_model.plazo_cierre)
                        except ValueError:
                            pass

                    if not parsed_close_date:
                        # Fallback seguro para cumplir la restricción NOT NULL de fecha_cierre
                        parsed_close_date = date.today() + timedelta(days=30)
                        print(
                            f"{Fore.YELLOW}[Reconciliación] Advertencia: "
                            f"Convocatoria '{conv_model.titulo[:40]}' sin fecha parseable. "
                            f"Usando default de 30 días a futuro.{Style.RESET_ALL}"
                        )

                    # Resolver el estado de la convocatoria
                    estado_resuelto = "Abierta"
                    if parsed_close_date < date.today():
                        estado_resuelto = "Cerrada"

                    # Buscar si la convocatoria ya existe en la base de datos por título o URL de bases
                    existing_conv = (
                        self.db.query(Convocatoria)
                        .filter(
                            (Convocatoria.titulo_convocatoria == conv_model.titulo)
                            | (Convocatoria.url_bases_vrip == conv_model.enlace)
                        )
                        .first()
                    )

                    if existing_conv:
                        # Lógica de ACTUALIZACIÓN (Upsert)
                        is_modified = False

                        # A) Historización del Cronograma (CU12) si cambia la fecha de cierre
                        if existing_conv.fecha_cierre != parsed_close_date:
                            print(
                                f"{Fore.YELLOW}[Historización Cronograma] "
                                f"Cambio de fecha detectado para '{existing_conv.titulo_convocatoria[:30]}...': "
                                f"{existing_conv.fecha_cierre} -> {parsed_close_date}{Style.RESET_ALL}"
                            )

                            historial = existing_conv.cambios_cronograma
                            if not isinstance(historial, list):
                                historial = []

                            motivo = (
                                "Ampliación de cronograma detectada automáticamente "
                                "en la sincronización en vivo del VRIP"
                            )
                            if parsed_close_date < existing_conv.fecha_cierre:
                                motivo = (
                                    "Adelanto de fecha de cierre detectado automáticamente "
                                    "en la sincronización en vivo del VRIP"
                                )

                            # Registrar el cambio en la auditoría del cronograma
                            historial.append(
                                {
                                    "fecha_anterior": existing_conv.fecha_cierre.isoformat(),
                                    "fecha_nueva": parsed_close_date.isoformat(),
                                    "motivo": motivo,
                                    "fecha_cambio": datetime.now().isoformat(),
                                }
                            )

                            # Actualizar campos
                            existing_conv.cambios_cronograma = historial
                            existing_conv.fecha_cierre = parsed_close_date
                            is_modified = True

                        # B) Actualizar otros campos si han cambiado
                        if conv_model.fecha_inicio:
                            try:
                                parsed_start_date = date.fromisoformat(conv_model.fecha_inicio)
                                if existing_conv.fecha_inicio_inscripcion != parsed_start_date:
                                    existing_conv.fecha_inicio_inscripcion = parsed_start_date
                                    is_modified = True
                            except ValueError:
                                pass

                        if existing_conv.url_bases_vrip != conv_model.enlace:
                            existing_conv.url_bases_vrip = conv_model.enlace
                            is_modified = True

                        if existing_conv.estado_convocatoria != estado_resuelto:
                            existing_conv.estado_convocatoria = estado_resuelto
                            is_modified = True

                        if is_modified:
                            stats["registros_actualizados"] += 1
                            print(
                                f"{Fore.GREEN}[Actualizado] "
                                f"'{existing_conv.titulo_convocatoria[:40]}...'{Style.RESET_ALL}"
                            )
                        else:
                            print(f"[Sin Cambios] '{existing_conv.titulo_convocatoria[:40]}...' ya está actualizada.")

                    else:
                        # Lógica de INSERCIÓN de nuevo registro
                        new_conv = Convocatoria(
                            titulo_convocatoria=conv_model.titulo,
                            entidad_emisora="VRIP-UNMSM",
                            presupuesto_maximo=None,  # Poblado manualmente por Secretaria o parseado en el futuro
                            # Para cumplir el NOT NULL. Preservado en futuras ejecuciones
                            fecha_inicio_inscripcion=date.fromisoformat(conv_model.fecha_inicio) if conv_model.fecha_inicio else date.today(),
                            fecha_cierre=parsed_close_date,
                            url_bases_vrip=conv_model.enlace,
                            cambios_cronograma=[],  # Vacío por ser primer registro
                            estado_convocatoria=estado_resuelto,
                        )
                        self.db.add(new_conv)
                        stats["registros_creados"] += 1
                        print(
                            f"{Fore.GREEN}{Style.BRIGHT}[Creado] "
                            f"Nueva convocatoria: '{conv_model.titulo[:40]}...'{Style.RESET_ALL}"
                        )

                except Exception as row_error:
                    stats["errores_procesamiento"] += 1
                    print(
                        f"{Fore.RED}[Fila Error] Error al procesar convocatoria "
                        f"'{conv_model.titulo[:40]}...': {row_error}{Style.RESET_ALL}"
                    )
                    continue

            # Confirmar los cambios en la base de datos
            self.db.commit()

            summary_msg = (
                f"Sincronización finalizada con éxito. Creados: {stats['registros_creados']}, "
                f"Actualizados: {stats['registros_actualizados']}, "
                f"Procesados: {stats['registros_procesados']}, "
                f"Errores: {stats['errores_procesamiento']}"
            )
            print(f"\n{Fore.GREEN}{Style.BRIGHT}=== {summary_msg} ==={Style.RESET_ALL}")

            # Registrar auditoría append-only
            self._log_execution(resultado="Exito", stats=stats)
            return {"resultado": "Exito", "stats": stats}

        except Exception as e:
            self.db.rollback()
            err_msg = f"Excepción general en la ejecución del Job: {str(e)}"
            print(f"{Fore.RED}{Style.BRIGHT}[FALLO GENERAL] {err_msg}{Style.RESET_ALL}")
            self._log_execution(resultado="Error", detalle_error=err_msg, stats=stats)
            return {"resultado": "Error", "detalle": err_msg}

    def _log_execution(self, resultado: str, stats: Dict[str, int], detalle_error: Optional[str] = None):
        """
        Escribe un registro de auditoría append-only de forma segura en log_auditoria.
        Respetando la restricción de inmutabilidad (T5 trigger en producción).
        """
        try:
            val_nuevo = {
                "origen": "VRIP_Scraper_Alerts_Job",
                "fecha_ejecucion": datetime.now().isoformat(),
                "registros_procesados": stats.get("registros_procesados", 0),
                "registros_creados": stats.get("registros_creados", 0),
                "registros_actualizados": stats.get("registros_actualizados", 0),
                "errores_fila": stats.get("errores_procesamiento", 0),
            }

            log = LogAuditoria(
                id_log=uuid.uuid4(),
                tipo_evento="SYNC_VRIP",
                entidad_afectada="convocatoria",
                pk_entidad="ALL",
                valor_anterior=None,
                valor_nuevo=val_nuevo,
                id_usuario=uuid.UUID(self.ejecutado_por_id) if self.ejecutado_por_id else None,
                ip_origen=None,
                resultado=resultado,
                detalle_error=detalle_error,
            )
            self.db.add(log)
            self.db.commit()
            print(f"{Fore.CYAN}[Auditoría] Registro grabado en log_auditoria ({resultado}).{Style.RESET_ALL}")
        except Exception as log_err:
            print(f"{Fore.RED}[Auditoría Error] No se pudo escribir en log_auditoria: {log_err}{Style.RESET_ALL}")
            self.db.rollback()
