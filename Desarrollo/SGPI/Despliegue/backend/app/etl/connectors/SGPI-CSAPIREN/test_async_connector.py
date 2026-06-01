import asyncio
import sys
import os

# Asegurar que renacyt_connector esté en el PYTHONPATH
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from renacyt_connector.api import RenacytConnector

async def test_async_queries():
    print("Iniciando pruebas del conector RENACYT asíncrono...")
    connector = RenacytConnector(verify_ssl=False)
    connector.rate_limit_delay = 0.1 # delay mínimo para pruebas
    
    # 1. Búsqueda por DNI (DNI ficticio o real, probaremos con uno genérico de ejemplo)
    print("\n--- 1. Probando search_by_dni (DNI: 00000000) ---")
    try:
        res_dni = await connector.search_by_dni("10020030")
        print(f"Resultado búsqueda DNI: {res_dni}")
    except Exception as e:
        print(f"Error en búsqueda DNI: {e}")

    # 2. Búsqueda por nombre
    print("\n--- 2. Probando search_by_name (Nombre: Garcia) ---")
    try:
        res_name = await connector.search_by_name("Garcia", page_size=2)
        print(f"Total encontrados: {res_name.get('total', 0)}")
        print(f"Primeros registros:")
        for r in res_name.get("data", [])[:2]:
            print(f" - {r.get('nombres')} {r.get('apellido_paterno')} {r.get('apellido_materno')} (DNI: {r.get('numero_documento')})")
    except Exception as e:
        print(f"Error en búsqueda por nombre: {e}")

    # 3. Búsqueda robusta por nombre completo (heurística con gather)
    print("\n--- 3. Probando search_by_fullname (Nombre completo: Juan Garcia) ---")
    try:
        res_full = await connector.search_by_fullname("Juan Garcia", page_size=2)
        print(f"Total encontrados: {res_full.get('total', 0)}")
        for r in res_full.get("data", []):
            print(f" - {r.get('nombres')} {r.get('apellido_paterno')} {r.get('apellido_materno')} ({r.get('institucion_laboral_principal')})")
    except Exception as e:
        print(f"Error en búsqueda por nombre completo: {e}")

if __name__ == "__main__":
    # Configurar encode utf-8 en Windows para evitar errores con tildes y caracteres especiales
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    
    asyncio.run(test_async_queries())
