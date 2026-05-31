import datetime
import copy
import re
import unicodedata

def parse_epoch_ms(ms):
    """
    Parses a millisecond epoch timestamp into a YYYY-MM-DD string.
    If parsing fails, returns None.
    """
    if ms is None:
        return None
    try:
        # Convert ms to float seconds
        seconds = float(ms) / 1000.0
        # Use UTC timezone to ensure consistency
        dt = datetime.datetime.fromtimestamp(seconds, tz=datetime.timezone.utc)
        return dt.strftime('%Y-%m-%d')
    except (ValueError, TypeError, OverflowError):
        return None

def normalize_researcher_record(record):
    """
    Normalizes a raw researcher record from the RENACYT API
    into a standardized, clean snake_case dictionary.
    Formats all timestamp fields in both normalized and raw representations.
    """
    if not record or not isinstance(record, dict):
        return {}
    
    nombres = record.get("nombres") or ""
    paterno = record.get("apellidoPaterno") or ""
    materno = record.get("apellidoMaterno") or ""
    
    parts = [nombres, paterno, materno]
    nombre_completo = " ".join([p.strip() for p in parts if p and p.strip()])
    
    # Format dates in the raw record
    raw_record = copy.deepcopy(record)
    for k, v in raw_record.items():
        if k.lower().startswith("fecha") and isinstance(v, (int, float)):
            parsed = parse_epoch_ms(v)
            if parsed:
                raw_record[k] = parsed
    
    return {
        "id": record.get("id"),
        "codigo_registro": record.get("codigoRegistro"),
        "tipo_documento": record.get("tipoDocumento"),
        "numero_documento": record.get("numeroDocumento"),
        "apellido_paterno": record.get("apellidoPaterno"),
        "apellido_materno": record.get("apellidoMaterno"),
        "nombres": record.get("nombres"),
        "nombre_completo": nombre_completo,
        "email": record.get("emailNotificar"),
        "orcid": record.get("orcid"),
        "cti_vitae": record.get("ctiVitae"),
        "grupo": record.get("grupo"),
        "nivel": record.get("nivel"),
        "condicion": record.get("condicion"),
        "institucion_laboral_principal": record.get("institucionLaboralPrincipal"),
        "institucion_laboral_actual": record.get("institucionLaboralActual"),
        "genero": record.get("genero"),
        
        # Date conversions
        "fecha_inicio_vigencia": parse_epoch_ms(record.get("fechaInicioVigencia")),
        "fecha_fin_vigencia": parse_epoch_ms(record.get("fechaFinVigencia")),
        "fecha_registro_activo": parse_epoch_ms(record.get("fechaRegistroActivo")),
        "fecha_ingreso_renacyt": parse_epoch_ms(record.get("fechaIngresoRenacyt")),
        "fecha_ultima_prod_cientifica": parse_epoch_ms(record.get("fechaUltimaProdCientifica")),
        
        "calificaciones_previas": record.get("calificacionesPrevias"),
        
        # Formatted raw record preserved here
        "_raw": raw_record
    }

SPANISH_FIRST_NAMES = {
    "ABDON", "ABEL", "ABELARDO", "ABRAHAM", "ABRAHAN", "ADA", "ADAN", "ADELA", "ADELAIDA", "ADELINA",
    "ADOLFO", "ADRIAN", "ADRIANA", "ADRIANO", "AGAPITO", "AGRIPINA", "AGUEDA", "AGUSTIN", "AGUSTINA", "AIDA",
    "ALAN", "ALBERTA", "ALBERTINA", "ALBERTO", "ALBINA", "ALBINO", "ALCIDES", "ALCIRA", "ALDO", "ALEJANDRA",
    "ALEJANDRINA", "ALEJANDRO", "ALEX", "ALEXANDER", "ALEXIS", "ALFONSO", "ALFREDO", "ALICIA", "ALIPIO", "ALVARO",
    "AMADEO", "AMADOR", "AMALIA", "AMANCIO", "AMANDA", "AMELIA", "AMERICA", "AMERICO", "AMILCAR", "AMPARO",
    "ANA", "ANALI", "ANASTACIA", "ANASTACIO", "ANATOLIA", "ANDERSON", "ANDREA", "ANDRES", "ANDY", "ANGEL",
    "ANGELA", "ANGELICA", "ANGELINA", "ANGELITA", "ANIBAL", "ANICETO", "ANITA", "ANSELMO", "ANTENOR", "ANTERO",
    "ANTHONY", "ANTONIA", "ANTONIETA", "ANTONIO", "APOLINARIO", "APOLONIA", "AQUILES", "AQUILINA", "AQUILINO", "ARACELI",
    "ARCADIO", "ARISTIDES", "ARMANDINA", "ARMANDO", "ARNALDO", "ARNULFO", "ARTEMIO", "ARTURO", "ASUNCION", "ASUNCIONA",
    "ASUNTA", "AUGUSTA", "AUGUSTO", "AUREA", "AURELIA", "AURELIO", "AURORA", "AVELINA", "AVELINO", "AYDE",
    "AYDEE", "AZUCENA", "BACILIA", "BACILIO", "BALTAZAR", "BALVINA", "BARBARA", "BARTOLOME", "BASILIA", "BASILIO",
    "BEATRIZ", "BENEDICTA", "BENEDICTO", "BENIGNA", "BENIGNO", "BENITA", "BENITO", "BENJAMIN", "BERNABE", "BERNARDINA",
    "BERNARDINO", "BERNARDO", "BERTA", "BERTHA", "BERTILA", "BETSY", "BETTY", "BLANCA", "BONIFACIO", "BRAULIO",
    "BRENDA", "BRIGIDA", "BRUNO", "BUENAVENTURA", "CALIXTO", "CAMILO", "CANDELARIA", "CARINA", "CARLA", "CARLOS",
    "CARLOTA", "CARMELA", "CARMEN", "CAROL", "CAROLINA", "CASILDA", "CASIMIRA", "CASIMIRO", "CATALINA", "CATALINO",
    "CATHERINE", "CECILIA", "CECILIO", "CEFERINA", "CEFERINO", "CELESTINA", "CELESTINO", "CELIA", "CELINA", "CELINDA",
    "CELSO", "CESAR", "CHARLES", "CHRISTIAN", "CINDY", "CINTHIA", "CINTHYA", "CIPRIANA", "CIPRIANO", "CIRILA",
    "CIRILO", "CIRO", "CLARA", "CLAUDIA", "CLAUDIO", "CLEMENCIA", "CLEMENTE", "CLEMENTINA", "CLEOFE", "CLEVER",
    "CLORINDA", "CLOTILDE", "CONCEPCION", "CONSTANTINA", "CONSTANTINO", "CONSUELO", "CORINA", "CORNELIO", "COSME", "CRISTHIAN",
    "CRISTIAN", "CRISTINA", "CRISTOBAL", "CRUZ", "CYNTHIA", "DALIA", "DALILA", "DAMIAN", "DAMIANA", "DANIEL",
    "DANIELA", "DANNY", "DANTE", "DANY", "DARIA", "DARIO", "DARWIN", "DAVID", "DAYSI", "DEISY",
    "DELFIN", "DELFINA", "DELIA", "DELICIA", "DEMETRIA", "DEMETRIO", "DENIS", "DENISSE", "DENNIS", "DEYSI",
    "DIANA", "DIEGO", "DIGNA", "DINA", "DIOGENES", "DIOMEDES", "DIONICIA", "DIONICIO", "DIONISIA", "DIONISIO",
    "DOLORES", "DOMINGA", "DOMINGO", "DOMITILA", "DONATA", "DONATILA", "DONATO", "DORA", "DORALIZA", "DORILA",
    "DORIS", "DOROTEA", "EBER", "EDDY", "EDELMIRA", "EDER", "EDGAR", "EDGARD", "EDGARDO", "EDILBERTO",
    "EDINSON", "EDISON", "EDITA", "EDITH", "EDMUNDO", "EDSON", "EDUARDA", "EDUARDO", "EDWAR", "EDWARD",
    "EDWIN", "EDY", "EFRAIN", "ELADIO", "ELBA", "ELDA", "ELDER", "ELEAZAR", "ELENA", "ELEODORO",
    "ELEUTERIA", "ELEUTERIO", "ELI", "ELIA", "ELIANA", "ELIAS", "ELIDA", "ELIO", "ELISA", "ELISEO",
    "ELITA", "ELIZABET", "ELIZABETH", "ELMER", "ELOISA", "ELOY", "ELSA", "ELVA", "ELVER", "ELVIA",
    "ELVIRA", "ELVIS", "EMERITA", "EMERSON", "EMILIA", "EMILIANA", "EMILIANO", "EMILIO", "EMMA", "EMPERATRIZ",
    "ENCARNACION", "ENITH", "ENMA", "ENRIQUE", "ENRIQUETA", "EPIFANIA", "EPIFANIO", "ERASMO", "ERICA", "ERICK",
    "ERICKA", "ERIK", "ERIKA", "ERLINDA", "ERMELINDA", "ERNESTINA", "ERNESTO", "ESMERALDA", "ESPERANZA", "ESTANISLAO",
    "ESTEBAN", "ESTEFANIA", "ESTELA", "ESTHER", "ETELVINA", "EUDOCIA", "EUFEMIA", "EUGENIA", "EUGENIO", "EULALIA",
    "EULOGIA", "EULOGIO", "EUSEBIA", "EUSEBIO", "EUSTAQUIA", "EUSTAQUIO", "EVA", "EVANGELINA", "EVARISTA", "EVARISTO",
    "EVELIN", "EVELYN", "EVER", "EZEQUIEL", "FABIAN", "FABIANA", "FABIO", "FABIOLA", "FANNY", "FANY",
    "FAUSTA", "FAUSTINA", "FAUSTINO", "FAUSTO", "FEDERICO", "FELICIA", "FELICIANA", "FELICIANO", "FELICITA", "FELICITAS",
    "FELIPA", "FELIPE", "FELIX", "FERMIN", "FERMINA", "FERNANDO", "FIDEL", "FIDELA", "FIDENCIO", "FILOMENA",
    "FILOMENO", "FIORELA", "FIORELLA", "FLAVIA", "FLAVIO", "FLOR", "FLORA", "FLORENCIA", "FLORENCIO", "FLORENTINA",
    "FLORENTINO", "FLORINDA", "FORTUNATA", "FORTUNATO", "FRANCISCA", "FRANCISCO", "FRANCO", "FRANK", "FRANKLIN", "FREDDY",
    "FREDESVINDA", "FREDY", "FRIDA", "FROILAN", "GABINA", "GABINO", "GABRIEL", "GABRIELA", "GABY", "GENARA",
    "GENARO", "GENOVEVA", "GEORGINA", "GERALDINE", "GERARDO", "GERMAN", "GERONIMO", "GERSON", "GIANCARLO", "GILBERTO",
    "GILDA", "GILMER", "GINA", "GINO", "GIOVANA", "GIOVANNA", "GISELA", "GISELLA", "GISSELA", "GIULIANA",
    "GLADIS", "GLADYS", "GLICERIO", "GLORIA", "GODOFREDO", "GONZALO", "GRACIELA", "GREGORIA", "GREGORIO", "GRIMALDO",
    "GRISELDA", "GUADALUPE", "GUIDO", "GUILLERMA", "GUILLERMINA", "GUILLERMO", "GUMERCINDA", "GUMERCINDO", "GUSTAVO", "GUZMAN",
    "HAROLD", "HAYDEE", "HEBER", "HEBERT", "HECTOR", "HELEN", "HENRRY", "HENRY", "HERBERT", "HERLINDA",
    "HERMELINDA", "HERMENEGILDO", "HERMES", "HERMINIA", "HERMINIO", "HERMOGENES", "HERNAN", "HILARIA", "HILARIO", "HILDA",
    "HILDEBRANDO", "HIPOLITA", "HIPOLITO", "HONORATA", "HONORATO", "HORACIO", "HORTENCIA", "HUGO", "HUMBERTO", "IDA",
    "IGNACIA", "IGNACIO", "INES", "INGRID", "INOCENCIO", "IRENE", "IRIS", "IRMA", "ISAAC", "ISABEL",
    "ISAIAS", "ISIDORA", "ISIDORO", "ISIDRO", "ISMAEL", "ISRAEL", "ITALO", "IVAN", "IVONNE", "JACINTA",
    "JACINTO", "JACK", "JACKELINE", "JACQUELINE", "JAIME", "JAIRO", "JAMES", "JANET", "JANETH", "JAQUELINE",
    "JAVIER", "JEAN", "JENNIFER", "JENNY", "JENY", "JESSICA", "JESUS", "JESUSA", "JHON", "JHONATAN",
    "JHONNY", "JHONY", "JIMMY", "JOAQUIN", "JOEL", "JOHAN", "JOHANA", "JOHANNA", "JOHN", "JOHNNY",
    "JONATHAN", "JORGE", "JOSE", "JOSEFA", "JOSEFINA", "JOSEPH", "JOSUE", "JOVITA", "JUAN", "JUANA",
    "JUANITA", "JUDITH", "JULIA", "JULIAN", "JULIANA", "JULIO", "JULISSA", "JULY", "JUNIOR", "JUSTA",
    "JUSTINA", "JUSTINIANO", "JUSTINO", "JUSTO", "JUVENAL", "KAREN", "KARIN", "KARINA", "KARLA", "KATHERINE",
    "KATIA", "KATTY", "KATY", "KELLY", "KELY", "KETTY", "KEVIN", "LADY", "LAURA", "LAZARO",
    "LEANDRO", "LEIDY", "LENIN", "LEOCADIA", "LEON", "LEONARDA", "LEONARDO", "LEONCIA", "LEONCIO", "LEONEL",
    "LEONIDAS", "LEONILA", "LEONOR", "LEOPOLDO", "LESLIE", "LESLY", "LETICIA", "LEYDI", "LIBIA", "LIDA",
    "LIDIA", "LILA", "LILI", "LILIA", "LILIAN", "LILIANA", "LILY", "LINA", "LINDA", "LINO",
    "LISBETH", "LITA", "LIVIA", "LIZ", "LIZANDRO", "LIZARDO", "LIZBETH", "LIZETH", "LOLA", "LORENA",
    "LORENZA", "LORENZO", "LOURDES", "LUCAS", "LUCIA", "LUCIANA", "LUCIANO", "LUCILA", "LUCINDA", "LUCIO",
    "LUCRECIA", "LUCY", "LUIS", "LUISA", "LUPE", "LUZ", "LUZMILA", "MABEL", "MACARIO", "MADELEINE",
    "MAGALI", "MAGALY", "MAGDA", "MAGDALENA", "MAGNA", "MAGNO", "MANUEL", "MANUELA", "MARCELA", "MARCELINA",
    "MARCELINO", "MARCELO", "MARCIA", "MARCIAL", "MARCIANO", "MARCO", "MARCOS", "MARGARITA", "MARGOT", "MARIA",
    "MARIANA", "MARIANELA", "MARIANO", "MARIBEL", "MARIELA", "MARIELLA", "MARILU", "MARILUZ", "MARILYN", "MARINA",
    "MARINO", "MARIO", "MARISOL", "MARITA", "MARITZA", "MARIVEL", "MARLENE", "MARLENI", "MARLENY", "MARLON",
    "MARTA", "MARTHA", "MARTIN", "MARTINA", "MARUJA", "MARY", "MATEO", "MATIAS", "MATILDE", "MAURA",
    "MAURICIA", "MAURICIO", "MAURO", "MAX", "MAXIMA", "MAXIMILIANA", "MAXIMILIANO", "MAXIMINA", "MAXIMO", "MAYRA",
    "MELANIA", "MELANIO", "MELCHOR", "MELCHORA", "MELINA", "MELISSA", "MELITON", "MELQUIADES", "MELVA", "MERCEDES",
    "MERLY", "MERY", "MICAELA", "MICHAEL", "MICHEL", "MIGUEL", "MIGUELINA", "MILAGRITOS", "MILAGROS", "MILENA",
    "MILTON", "MILUSKA", "MIRIAM", "MIRIAN", "MIRTHA", "MISAEL", "MODESTA", "MODESTO", "MOISES", "MONICA",
    "NADIA", "NANCY", "NARCISA", "NARCISO", "NATALIA", "NATALY", "NATIVIDAD", "NAZARIO", "NELIDA", "NELLY",
    "NELSON", "NELY", "NEMECIO", "NEMESIO", "NERI", "NERIDA", "NERY", "NESTOR", "NICANOR", "NICOLAS",
    "NICOLASA", "NICOLAZA", "NIDIA", "NIEVES", "NILA", "NILDA", "NILO", "NILTON", "NINFA", "NOE",
    "NOELIA", "NOEMI", "NOLBERTO", "NORA", "NORMA", "OCTAVIA", "OCTAVIO", "OFELIA", "OLGA", "OLIMPIA",
    "OLINDA", "OLIVIA", "OMAR", "ORFELINDA", "ORLANDO", "OSCAR", "OSWALDO", "OTILIA", "PABLO", "PAMELA",
    "PAOLA", "PASCUAL", "PASCUALA", "PASTOR", "PATRICIA", "PATRICIO", "PAUL", "PAULA", "PAULINA", "PAULINO",
    "PAULO", "PEDRO", "PEPE", "PERCY", "PETER", "PETRONA", "PETRONILA", "PILAR", "PIO", "PLACIDA",
    "PORFIRIO", "PRIMITIVA", "PRIMITIVO", "PROSPERO", "PRUDENCIA", "PRUDENCIO", "RAFAEL", "RAMIRO", "RAMON", "RAQUEL",
    "RAUL", "RAYDA", "RAYMUNDO", "REBECA", "REGINA", "REINA", "REMIGIO", "RENATO", "RENE", "RENEE",
    "RENZO", "REYNA", "REYNALDO", "RICARDINA", "RICARDO", "RICHAR", "RICHARD", "RIGOBERTO", "RINA", "RITA",
    "ROBER", "ROBERT", "ROBERTA", "ROBERTO", "ROBINSON", "ROCIO", "RODOLFO", "RODRIGO", "ROGELIA", "ROGELIO",
    "ROGER", "ROLANDO", "ROMAN", "ROMEL", "ROMULO", "RONAL", "RONALD", "RONY", "ROQUE", "ROSA",
    "ROSALIA", "ROSALINA", "ROSALINDA", "ROSANA", "ROSARIO", "ROSAS", "ROSAURA", "ROSENDO", "ROSITA", "ROSMERY",
    "ROSSANA", "ROXANA", "ROY", "RUBEN", "RUDY", "RUFINO", "RUFUS", "RUPERTO", "RUTH", "SABINA",
    "SABINO", "SADITH", "SALOME", "SALOMON", "SALVADOR", "SAMUEL", "SANDRA", "SANDRO", "SANDY", "SANTA",
    "SANTIAGO", "SANTOS", "SANTOSA", "SANTUSA", "SARA", "SARITA", "SATURNINA", "SATURNINO", "SAUL", "SEBASTIAN",
    "SEBASTIANA", "SEGUNDA", "SEGUNDINA", "SEGUNDO", "SERAFIN", "SERAFINA", "SERAPIO", "SERGIO", "SEVERO", "SHEYLA",
    "SHIRLEY", "SILVANA", "SILVERIA", "SILVERIO", "SILVESTRE", "SILVIA", "SILVIO", "SIMEON", "SIMON", "SIMONA",
    "SIXTO", "SOCORRO", "SOFIA", "SOLEDAD", "SONIA", "SUSAN", "SUSANA", "SUSY", "TANIA", "TARCILA",
    "TATIANA", "TEOBALDO", "TEODOCIA", "TEODOCIO", "TEODOLINDA", "TEODORA", "TEODORO", "TEODOSIA", "TEODOSIO", "TEOFILA",
    "TEOFILO", "TERESA", "TEREZA", "TIBURCIO", "TIMOTEA", "TIMOTEO", "TITO", "TOMAS", "TOMASA", "TONY",
    "TORIBIA", "TORIBIO", "TRINIDAD", "UBALDO", "ULISES", "URBANO", "URSULA", "VALENTIN", "VALENTINA", "VALERIA",
    "VALERIANA", "VALERIANO", "VALERIO", "VANESSA", "VENANCIO", "VERONICA", "VICENTA", "VICENTE", "VICENTINA", "VICTOR",
    "VICTORIA", "VICTORIANO", "VIDAL", "VILMA", "VIOLETA", "VIRGILIO", "VIRGINIA", "VIVIANA", "VLADIMIR", "WAGNER",
    "WALTER", "WASHINGTON", "WENCESLAO", "WENDY", "WILBER", "WILBERT", "WILDER", "WILFREDO", "WILIAN", "WILLIAM",
    "WILLIAMS", "WILLIAN", "WILLY", "WILMA", "WILMER", "WILSON", "YANET", "YANETH", "YANINA", "YENI",
    "YENNY", "YENY", "YESENIA", "YESICA", "YESSENIA", "YESSICA", "YNES", "YOLANDA", "YONI", "YONY",
    "YOVANA", "YRENE", "YRIS", "YRMA", "YSABEL", "YULI", "YULIANA", "YULY", "YURI", "ZACARIAS",
    "ZAIDA", "ZENAIDA", "ZENOBIA", "ZENON", "ZOILA", "ZONIA", "ZORAIDA", "ZOSIMO", "ZULEMA"
}

def to_title_case(s: str) -> str:
    """
    Converts a name string to Title Case, keeping Spanish prepositions 
    and conjunctions in lowercase.
    """
    lowercase_words = {"de", "del", "la", "las", "los", "el", "y", "e", "o", "a"}
    words = s.strip().split()
    result = []
    for i, w in enumerate(words):
        w_lower = w.lower()
        if i == 0 or w_lower not in lowercase_words:
            result.append(w_lower.capitalize())
        else:
            result.append(w_lower)
    return " ".join(result)

def extract_lastnames(name: str) -> str:
    """
    Parses a researcher's raw name string, cleans role prefixes, academic titles, 
    commas, and extracts exactly two standardized last names (paternal and maternal).
    """
    if not name or not isinstance(name, str):
        return ""
        
    raw_name = name.strip()
    
    # 1. Detect and remove prefix [A-Z]_
    has_prefix = False
    prefix_match = re.match(r"^([A-Z])_", raw_name)
    if prefix_match:
        has_prefix = True
        raw_name = raw_name[2:].strip()
        
    # 2. Remove academic titles
    TITLES_REGEX = r"(?i)\b(Dr|Dra|Mg|Mag|Ing|Lic|MSc|Ph\.?D|Prof)\b\.?"
    clean_name = re.sub(TITLES_REGEX, "", raw_name).strip()
    
    # 3. Check for comma (Lastnames, Firstnames)
    if "," in clean_name:
        lastnames_part = clean_name.split(",")[0].strip()
        return to_title_case(lastnames_part)
        
    # 4. No comma. Split into words
    words = clean_name.split()
    if len(words) <= 2:
        return to_title_case(" ".join(words))
        
    # Check if we had a role prefix or if the first word is NOT a known first name
    # We strip accents from the first word for matching against SPANISH_FIRST_NAMES
    first_word_clean = "".join(
        c for c in unicodedata.normalize('NFD', words[0].upper()) 
        if unicodedata.category(c) != 'Mn'
    )
    
    if has_prefix or (first_word_clean not in SPANISH_FIRST_NAMES):
        # Format is likely: Lastnames Firstnames (e.g. Rodriguez Rodriguez Ciro)
        # We take the first two words as the last names
        return to_title_case(" ".join(words[:2]))
    else:
        # Format is likely: Firstnames Lastnames (e.g. David Santos Mauricio Sanchez)
        # We take the last two words as the last names
        return to_title_case(" ".join(words[-2:]))
