"""
Configuración centralizada de facultades, carreras y keywords para SGPI.
Facilita la expansión futura de nuevas carreras con un solo cambio.
"""

FACULTAD_NOMBRE = "Ingeniería de Sistemas e Informática"
FACULTAD_NOMBRE_COMPLETO = "Facultad de Ingeniería de Sistemas e Informática"

# Lista oficial y variantes comunes para catálogos y filtros
ESCUELAS_PROFESIONALES = [
    "Ingeniería de Sistemas",
    "Ingeniería de Software",
    "Ciencia de la Computación",
    "Ciencias de la Computación",
    "Inteligencia Artificial",
]

# Keywords precisas para filtrado/sincronización (carreras principales)
FISI_KEYWORDS = [
    "sistemas", "software", "informática", "informatica",
    "computación", "computacion", "ingeniería de sistemas",
    "ingenieria de sistemas", "fisi",
    # Nuevas carreras
    "ciencia de la computación", "ciencia de la computacion",
    "ciencias de la computación", "ciencias de la computacion",
    "inteligencia artificial",
]

# Términos técnicos adicionales usados por el motor de reglas para validar relevancia académica
EXTENDED_FISI_KEYWORDS = FISI_KEYWORDS + [
    "algoritmo", 
    "programacion", "programación", 
    "tecnologia de la informacion", "tecnología de la información",
    "datos", 
    "redes", 
    "comunicaciones", "telecomunicaciones", 
    "digital"
]

# Consultas para cosecha de repositorios (Ej. Cybertesis)
CYBERTESIS_QUERIES = [
    "Ingeniería de Sistemas e Informática",
    "Ingeniería de Software",
    "Facultad de Ingeniería de Sistemas e Informática",
    "Ciencia de la Computación",
    "Ciencias de la Computación",
    "Inteligencia Artificial",
]
