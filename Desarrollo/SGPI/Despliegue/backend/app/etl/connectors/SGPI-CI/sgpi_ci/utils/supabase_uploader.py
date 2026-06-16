import json
import requests
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sgpi_ci.config import settings, DEFAULT_CHUNK_SIZE


class SupabaseUploader:
    """
    Encapsula la comunicación con Supabase mediante llamadas RPC via HTTP REST.
    Usa SUPABASE_SERVICE_KEY para operar con SECURITY DEFINER (bypasa RLS).
    """

    def __init__(self) -> None:
        pass

    @staticmethod
    def _serialize(obj: Any) -> Any:
        """Convierte Decimal a float para serialización JSON."""
        if isinstance(obj, Decimal):
            return float(obj)
        raise TypeError(f"Tipo no serializable: {type(obj)}")

    def fetch_grupos(self) -> List[Dict[str, Any]]:
        """Obtiene el catálogo de grupos de investigación para Fuzzy Matching de FKs."""
        settings.validate()
        headers = {
            "apikey": settings.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}"
        }
        url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/grupo_investigacion?select=id_grupo,nombre_grupo,siglas,codigo_grupo"
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error obteniendo grupos de BD: {e}")
            return []

    def fetch_investigadores(self) -> List[Dict[str, Any]]:
        """Obtiene todos los investigadores registrados para mapeo local y evitar consultas redundantes."""
        settings.validate()
        headers = {
            "apikey": settings.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}"
        }
        url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/investigador?select=dni,nombres,apellidos,institucion_principal,codigo_renacyt,orcid,categoria_renacyt,estado_renacyt,url_cti_vitae,investigador_sm,is_external"
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error obteniendo investigadores de BD: {e}")
            return []

    def fetch_lineas_investigacion(self) -> List[str]:
        """Obtiene las líneas de investigación oficiales desde linea_investigacion."""
        settings.validate()
        headers = {
            "apikey": settings.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}"
        }
        url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/linea_investigacion?select=nombre"
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            if data and isinstance(data, list):
                return [item.get("nombre") for item in data if item.get("nombre")]
            return []
        except Exception as e:
            print(f"Error obteniendo lineas de investigacion de BD: {e}")
            return []

    def fetch_departamentos(self) -> List[str]:
        """Obtiene los departamentos académicos oficiales."""
        settings.validate()
        headers = {
            "apikey": settings.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}"
        }
        url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/departamento_academico?select=nombre"
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            if data and isinstance(data, list):
                return [item.get("nombre") for item in data if item.get("nombre")]
            return []
        except Exception as e:
            print(f"Error obteniendo departamentos de BD: {e}")
            return []

    def upsert_linea_investigacion(self, nombre: str, estado: str = 'Pendiente') -> None:
        """Registra una línea de investigación (si no existe, se inserta como Pendiente)."""
        settings.validate()
        headers = {
            "apikey": settings.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=ignore-duplicates"
        }
        url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/linea_investigacion"
        try:
            payload = {"nombre": nombre, "estado": estado}
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
        except Exception as e:
            print(f"Error al registrar línea de investigación '{nombre}': {e}")

    def upsert_departamento_academico(self, nombre: str, estado: str = 'Pendiente') -> None:
        """Registra un departamento académico (si no existe, se inserta como Pendiente)."""
        settings.validate()
        headers = {
            "apikey": settings.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=ignore-duplicates"
        }
        url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/departamento_academico"
        try:
            payload = {"nombre": nombre, "estado": estado}
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
        except Exception as e:
            print(f"Error al registrar departamento académico '{nombre}': {e}")



    def upload(
        self,
        rpc_name: str,
        records: List[Dict[str, Any]],
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        quiet: bool = False,
        id_usuario: Optional[str] = None,
    ) -> Dict[str, int]:
        """
        Envía registros validados a Supabase en batches mediante llamada RPC.

        Args:
            rpc_name:   Nombre de la función RPC en Supabase.
            records:    Lista de dicts validados por Pydantic.
            chunk_size: Registros por llamada (default: 200).
            quiet:      Suprime mensajes de progreso si True.
            id_usuario: ID del usuario (UUID) que ejecuta la importación.

        Returns:
            {'insertados': n, 'actualizados': n, 'fallidos': n}

        Raises:
            ConnectionError: [EX4] Si hay un error de red durante la carga.
            """
        settings.validate()

        totals: Dict[str, int] = {"procesados": 0, "fallidos": 0}

        chunks = [
            records[i : i + chunk_size]
            for i in range(0, len(records), chunk_size)
        ]
        total_chunks = len(chunks)
        
        headers = {
            "apikey": settings.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json"
        }
        
        url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/rpc/{rpc_name}"

        for idx, chunk in enumerate(chunks, 1):
            if not quiet:
                print(f"  Chunk {idx}/{total_chunks} — {len(chunk)} registros...")

            try:
                # Serializar Decimal → float antes de enviar
                payload_json = json.loads(
                    json.dumps(chunk, default=self._serialize)
                )

                body = {"payload": payload_json}
                if id_usuario:
                    body["id_usuario"] = id_usuario

                response = requests.post(
                    url,
                    headers=headers,
                    json=body
                )
                
                response.raise_for_status()
                data = response.json()

                if data and isinstance(data, dict):
                    totals["procesados"]  += data.get("procesados", 0)
                    totals["fallidos"]    += data.get("fallidos", 0)

            except Exception as e:
                # [EX4]: Cada chunk es una llamada RPC independiente.
                # Si el chunk N falla, los chunks 1..N-1 ya fueron commiteados en Supabase.
                # NO hay rollback de la importación completa — solo del chunk fallido.
                committed = idx - 1
                raise ConnectionError(
                    f"[EX4] Error en chunk {idx}/{total_chunks} de la carga a Supabase.\n"
                    f"Los {committed} chunk(s) anteriores ya fueron commiteados y NO se revierten.\n"
                    f"Ejecuta '--preview' para diagnosticar el archivo antes de reintentar.\n"
                    f"Detalle técnico: {e}\nResponse: {getattr(e.response, 'text', '') if hasattr(e, 'response') else ''}"
                ) from e

        return totals
