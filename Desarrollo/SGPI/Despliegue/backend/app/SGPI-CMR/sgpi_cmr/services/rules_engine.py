from typing import Dict, Any, Tuple, Optional
from sgpi_cmr.schemas.incoming import InvestigadorInput, ProyectoInput, PublicacionInput, AsesorTesisInput
from sgpi_cmr.services.name_normalizer import normalizer
from app.core.faculty_config import EXTENDED_FISI_KEYWORDS
import os
import sys
import re

current_dir = os.path.dirname(os.path.abspath(__file__))
csapiren_path = os.path.abspath(os.path.join(current_dir, '..', '..', '..', 'etl', 'connectors', 'SGPI-CSAPIREN'))
if csapiren_path not in sys.path:
    sys.path.insert(0, csapiren_path)

try:
    from renacyt_connector.api import RenacytConnector
except ImportError:
    RenacytConnector = None

class ReconciliationRulesEngine:
    """
    Motor de Reglas para el Módulo de Reconciliación.
    Prioridades:
    1. Regla de Oro: Ingreso Manual (BD actual) > Cualquier fuente automática
    2. Investigador: RENACYT > RAIS
    3. Proyecto: VRIP > RAIS
    4. Publicacion: Indexadas > RAIS
    """

    def _is_manual_override(self, current_record: Dict[str, Any], field_name: str) -> bool:
        if not current_record:
            return False
        return bool(current_record.get("protegido_manualmente", False))

    def reconcile_investigador(self, current: Optional[Dict[str, Any]], incoming: InvestigadorInput, fuente: str) -> Tuple[Dict[str, Any], bool, str]:
        """
        Retorna (merged_data, requires_quarantine, reason)
        """
        incoming_dict = incoming.model_dump(exclude_unset=True, exclude_none=True)
        if not current:
            # Nuevo registro, insertarlo tal cual
            return incoming_dict, False, ""

        # Si está protegido manualmente, no se sobreescribe nada
        if self._is_manual_override(current, None):
            return current, False, ""

        merged = current.copy()
        requires_quarantine = False
        reason = ""

        # Regla: RENACYT gana a RAIS en grado, categoria, puntaje, etc.
        for field, value in incoming_dict.items():
            if field in ['grado_academico_max', 'categoria_renacyt', 'estado_renacyt', 'codigo_renacyt']:
                if fuente == 'RENACYT':
                    merged[field] = value
                elif fuente == 'RAIS' and not current.get(field):
                    merged[field] = value
                elif fuente == 'RAIS' and current.get(field):
                    # Conflicto: RAIS trata de pisar data que ya existe (posiblemente de RENACYT)
                    # No sobreescribir.
                    pass
            else:
                if fuente == 'RAIS' and current.get(field):
                    pass # RAIS nunca pisa datos que ya existen (Regla de oro simplificada)
                elif not current.get(field) or self._is_manual_override(current, field):
                    merged[field] = value
                    
        return merged, requires_quarantine, reason

    def reconcile_proyecto(self, current: Optional[Dict[str, Any]], incoming: ProyectoInput, fuente: str) -> Tuple[Dict[str, Any], bool, str]:
        incoming_dict = incoming.model_dump(exclude_unset=True, exclude_none=True)
        if not current:
            return incoming_dict, False, ""

        # Si está protegido manualmente, no se sobreescribe nada
        if self._is_manual_override(current, None):
            return current, False, ""

        merged = current.copy()
        
        # Regla: VRIP gana a RAIS pero solo en campos críticos
        for field, value in incoming_dict.items():
            if fuente == 'VRIP' and field in ['estado_proyecto', 'fecha_inicio', 'resolucion_aprobacion', 'presupuesto_asignado']:
                merged[field] = value
            elif not current.get(field):
                merged[field] = value

        return merged, False, ""

    def reconcile_publicacion(self, current: Optional[Dict[str, Any]], incoming: PublicacionInput, fuente: str) -> Tuple[Dict[str, Any], bool, str]:
        incoming_dict = incoming.model_dump(exclude_unset=True, exclude_none=True)
        if not current:
            return incoming_dict, False, ""

        # Si está protegido manualmente, no se sobreescribe nada
        if self._is_manual_override(current, None):
            return current, False, ""

        merged = current.copy()
        
        # Regla: Indexadas (Scopus/WoS) ganan a RAIS
        # Si la fuente es Scopus/WoS, sobreescribe RAIS. Si es RAIS, solo llena vacíos.
        es_indexada = fuente in ['Scopus', 'Web of Science', 'SciELO']
        for field, value in incoming_dict.items():
            if es_indexada:
                merged[field] = value
            elif fuente == 'RAIS' and not current.get(field):
                merged[field] = value

        # Si no hay DOI ni título muy similar, esto debería marcarse en la API para ir a cuarentena.
        return merged, False, ""

    async def reconcile_asesor_tesis(self, padron_investigadores: Dict[str, str], incoming: AsesorTesisInput, renacyt_client: Optional[Any] = None) -> Tuple[Dict[str, Any], bool, str]:
        incoming_dict = incoming.model_dump(exclude_unset=True, exclude_none=True)
        
        # Palabras clave de la FISI para filtrado centralizado
        fisi_keywords = EXTENDED_FISI_KEYWORDS
        
        titulo_tesis = incoming_dict.get("titulo_tesis", "").lower()
        # Verificar si la tesis es de la FISI por el título
        es_tesis_fisi = any(kw in titulo_tesis for kw in fisi_keywords)

        dni_encontrado = incoming_dict.get("dni_asesor")
        datos_renacyt = None
        
        if not dni_encontrado:
            match = normalizer.find_best_match(incoming_dict["asesor_texto"], padron_investigadores)
            if match:
                dni_encontrado, score = match

        if not dni_encontrado:
            # Intentar resolver vía RENACYT
            client_to_use = renacyt_client
            if not client_to_use and RenacytConnector:
                try:
                    client_to_use = RenacytConnector(verify_ssl=False)
                    client_to_use.rate_limit_delay = 0.1
                except Exception:
                    pass
            
            if client_to_use:
                asesor_clean = re.sub(r'^(Dr\.|Mg\.|Mag\.|Ing\.|Lic\.)\s*', '', incoming_dict["asesor_texto"], flags=re.IGNORECASE).strip()
                try:
                    res = await client_to_use.search_by_fullname(asesor_clean, page_size=10)
                    if res and res.get('total', 0) > 0 and res.get('data'):
                        best_score = 0.0
                        best_match = None
                        for r in res['data']:
                            c_full = f"{r.get('nombres', '')} {r.get('apellido_paterno', '')} {r.get('apellido_materno', '')}"
                            score = normalizer.calculate_similarity(asesor_clean, c_full)
                            if score > best_score:
                                best_score = score
                                best_match = r
                        
                        if best_score >= 80.0 and best_match:
                            dni_encontrado = best_match.get("numero_documento")
                            datos_renacyt = best_match
                except Exception:
                    pass

        if dni_encontrado:
            es_asesor_fisi = False
            if datos_renacyt:
                inst_principal = (datos_renacyt.get("institucion_laboral_principal") or "").lower()
                es_san_marcos = "san marcos" in inst_principal or "unmsm" in inst_principal
                es_asesor_fisi = es_san_marcos and any(kw in inst_principal for kw in fisi_keywords)
            else:
                # Si estaba en el padrón local, ya es de la FISI
                es_asesor_fisi = True

            # Filtro FISI estricto: la tesis debe ser de la FISI o el asesor de la FISI
            if es_tesis_fisi or es_asesor_fisi:
                incoming_dict["dni_asesor_reconciliado"] = dni_encontrado
                if datos_renacyt:
                    incoming_dict["datos_renacyt"] = datos_renacyt
                return incoming_dict, False, ""
            else:
                return incoming_dict, True, "Rechazado automáticamente: Esta investigación o su asesor corresponden a otra especialidad o facultad (no pertenecen a ninguna de las carreras de la FISI)."
        else:
            asesor_nombre = incoming_dict.get('asesor_texto', 'desconocido')
            return incoming_dict, True, f"No se pudo identificar al asesor '{asesor_nombre}' automáticamente en el padrón local de la FISI ni en RENACYT. Por favor, ingrese el DNI del asesor para aprobar este registro."

rules_engine = ReconciliationRulesEngine()
