import sys
import os
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

# Añadir el directorio app al path para poder importar
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.errors import handle_db_integrity_error

class MockDBAPIError:
    def __init__(self, sqlstate, constraint_name, message=""):
        self.sqlstate = sqlstate
        self.pgcode = sqlstate
        self.constraint_name = constraint_name
        self.message = message
        self.detail = message
        
    def __str__(self):
        return f"Mock exception: {self.message}"

def run_tests():
    print("=== Corriendo Pruebas de Traducción de Errores de Integridad ===")
    
    # Test Case 1: Unique Violation - Código de proyecto existente
    orig_err = MockDBAPIError("23505", "proyecto_pkey", "Key (codigo_proyecto)=(PROY-001) already exists.")
    e = IntegrityError("select", {}, orig_err)
    try:
        handle_db_integrity_error(e)
        assert False, "Debería lanzar HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "El código único de proyecto ingresado ya existe."
        print("Test 1 (UniqueViolation - Código Proyecto): PASSED")
        
    # Test Case 2: Unique Violation - Resolución duplicada
    orig_err = MockDBAPIError("23505", "proyecto_resolucion_aprobacion_key", "Key (resolucion_aprobacion)=(R.D. 123) already exists.")
    e = IntegrityError("select", {}, orig_err)
    try:
        handle_db_integrity_error(e)
        assert False, "Debería lanzar HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "Ya existe un proyecto registrado con este número de resolución."
        print("Test 2 (UniqueViolation - Resolución Proyecto): PASSED")

    # Test Case 3: Unique Violation - Grupo existente
    orig_err = MockDBAPIError("23505", "grupo_investigacion_pkey", "Key (codigo_grupo)=(GI-01) already exists.")
    e = IntegrityError("select", {}, orig_err)
    try:
        handle_db_integrity_error(e)
        assert False, "Debería lanzar HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "El código único de grupo ingresado ya existe."
        print("Test 3 (UniqueViolation - Código Grupo): PASSED")

    # Test Case 4: Foreign Key Violation - DNI no registrado
    orig_err = MockDBAPIError("23503", "investigador_proyecto_dni_investigador_fkey", "Key (dni_investigador)=(12345678) is not present in table 'investigador'.")
    e = IntegrityError("select", {}, orig_err)
    try:
        handle_db_integrity_error(e)
        assert False, "Debería lanzar HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "Uno o más investigadores no están registrados en el padrón de investigadores."
        print("Test 4 (ForeignKeyViolation - DNI Investigador): PASSED")

    # Test Case 5: Foreign Key Violation - Grupo no existe
    orig_err = MockDBAPIError("23503", "proyecto_codigo_grupo_fkey", "Key (codigo_grupo)=(GI-XXX) is not present in table 'grupo_investigacion'.")
    e = IntegrityError("select", {}, orig_err)
    try:
        handle_db_integrity_error(e)
        assert False, "Debería lanzar HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "El grupo de investigación seleccionado no existe."
        print("Test 5 (ForeignKeyViolation - Código Grupo): PASSED")

    # Test Case 6: Check Violation - Tipo de proyecto inválido
    orig_err = MockDBAPIError("23514", "proyecto_tipo_proyecto_check", "violates check constraint 'proyecto_tipo_proyecto_check'")
    e = IntegrityError("select", {}, orig_err)
    try:
        handle_db_integrity_error(e)
        assert False, "Debería lanzar HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "El tipo de proyecto ingresado no es válido (debe ser Básico o Aplicado)."
        print("Test 6 (CheckViolation - Tipo Proyecto): PASSED")

    # Test Case 7: Fallback - Substring check
    e = Exception("Mock general error with violates check constraint 'proyecto_estado_proyecto_check'")
    try:
        handle_db_integrity_error(e)
        assert False, "Debería lanzar HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "El estado de proyecto ingresado no es válido."
        print("Test 7 (Fallback - Substring matching): PASSED")

    print("=== ¡TODOS LOS TEST PASARON EXITOSAMENTE! ===")

if __name__ == "__main__":
    run_tests()
