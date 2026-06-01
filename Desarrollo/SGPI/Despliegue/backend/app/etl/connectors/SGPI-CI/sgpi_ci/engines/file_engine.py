from pathlib import Path
from typing import Union

import pandas as pd


class InvalidFormatError(Exception):
    """[EX1] El archivo no tiene una extensión válida (.csv o .xlsx)."""


class FileEngine:
    """
    Motor de lectura de archivos tabulares.
    Detecta automáticamente el formato y retorna un DataFrame normalizado.
    Soporta: .xlsx (openpyxl) y .csv (UTF-8 con fallback a latin-1).
    """

    SUPPORTED_EXTENSIONS = {".xlsx", ".csv"}

    def load(self, path: Union[str, Path]) -> pd.DataFrame:
        """
        Carga un archivo Excel o CSV en un DataFrame de pandas.
        Todos los valores se leen como string (dtype=str) para evitar
        conversiones automáticas que corrompan DNIs con ceros a la izquierda.

        Args:
            path: Ruta al archivo de datos.

        Returns:
            DataFrame con datos crudos, columnas con strip, filas vacías eliminadas.

        Raises:
            FileNotFoundError: Si el archivo no existe.
            InvalidFormatError: [EX1] Si la extensión no es .xlsx ni .csv.
            RuntimeError: Si ocurre un error inesperado durante la lectura.
        """
        resolved = Path(path).resolve()

        if not resolved.exists():
            raise FileNotFoundError(
                f"Archivo no encontrado: '{resolved}'"
            )

        ext = resolved.suffix.lower()
        if ext not in self.SUPPORTED_EXTENSIONS:
            raise InvalidFormatError(
                f"[EX1] Formato no soportado: '{ext}'. "
                f"Por favor, suba un archivo .csv o .xlsx"
            )

        try:
            if ext == ".xlsx":
                df = pd.read_excel(
                    resolved,
                    engine="openpyxl",
                    dtype=str,
                    keep_default_na=False,
                )
            else:  # .csv
                # Intentar UTF-8 primero; si falla, usar latin-1 (común en exports de Windows)
                try:
                    df = pd.read_csv(resolved, dtype=str, encoding="utf-8", keep_default_na=False)
                except UnicodeDecodeError:
                    df = pd.read_csv(resolved, dtype=str, encoding="latin-1", keep_default_na=False)

            # Normalizar nombres de columna: eliminar espacios al inicio/fin
            df.columns = df.columns.str.strip()

            # Eliminar filas completamente vacías
            df = df.replace("", pd.NA).dropna(how="all").reset_index(drop=True)

            return df

        except (InvalidFormatError, FileNotFoundError):
            raise
        except Exception as e:
            raise RuntimeError(
                f"Error al leer '{resolved.name}': {e}"
            ) from e
