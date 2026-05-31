import urllib.request
import urllib.error
import ssl
import json
import time
import logging
from renacyt_connector.utils import normalize_researcher_record

# Setup default logger
logger = logging.getLogger("renacyt_connector")

class RenacytError(Exception):
    """Base exception for RENACYT connector errors."""
    pass

class RenacytConnectionError(RenacytError):
    """Raised when there are connection failures or all endpoints are down."""
    pass

class RenacytAPIError(RenacytError):
    """Raised when the API returns an error or invalid status code."""
    pass

class RenacytConnector:
    """
    A robust, zero-dependency client to query the CONCYTEC RENACYT database.
    Supports connection failovers, custom SSL settings, retries, and rate limiting.
    """
    DEFAULT_BASE_URLS = [
        "https://renacyt.concytec.gob.pe/renacyt-backend",
        "https://ctivitae.concytec.gob.pe/renacyt-backend"
    ]
    
    DEFAULT_HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }

    def __init__(self, base_urls=None, verify_ssl=False, rate_limit_delay=1.0, timeout=15, max_retries=3):
        """
        Initializes the RENACYT connector.
        
        :param base_urls: List of base URLs to use (with fallback order).
        :param verify_ssl: If False, skips SSL certificate validation (highly recommended for Peruvian gov sites).
        :param rate_limit_delay: Sleep time in seconds after any successful request to prevent server bans.
        :param timeout: Connection timeout in seconds.
        :param max_retries: Max retries for transient network or server errors.
        """
        self.base_urls = base_urls or self.DEFAULT_BASE_URLS
        if isinstance(self.base_urls, str):
            self.base_urls = [self.base_urls]
            
        self.verify_ssl = verify_ssl
        self.rate_limit_delay = rate_limit_delay
        self.timeout = timeout
        self.max_retries = max_retries
        
        # Configure SSL Context
        if not self.verify_ssl:
            self.ssl_context = ssl.create_default_context()
            self.ssl_context.check_hostname = False
            self.ssl_context.verify_mode = ssl.CERT_NONE
        else:
            self.ssl_context = ssl.create_default_context()
            
        self._last_request_time = 0.0

    def _apply_rate_limit(self):
        """Applies a polite sleep if the last query happened too recently."""
        if self.rate_limit_delay <= 0:
            return
            
        elapsed = time.time() - self._last_request_time
        if elapsed < self.rate_limit_delay:
            sleep_time = self.rate_limit_delay - elapsed
            logger.debug(f"Rate limiting: sleeping for {sleep_time:.2f} seconds...")
            time.sleep(sleep_time)

    def _request(self, endpoint_path, method="GET", payload=None):
        """
        Executes an HTTP request with built-in retries, failovers, and rate limiting.
        """
        self._apply_rate_limit()
        
        # Keep track of errors across all endpoints to raise a descriptive exception if everything fails
        all_errors = []
        
        # Prepare body data
        req_data = None
        if payload is not None:
            req_data = json.dumps(payload).encode('utf-8')

        for base_url in self.base_urls:
            url = f"{base_url.rstrip('/')}/{endpoint_path.lstrip('/')}"
            
            for attempt in range(1, self.max_retries + 1):
                logger.info(f"Connecting to: {url} (Attempt {attempt}/{self.max_retries})")
                
                req = urllib.request.Request(
                    url,
                    data=req_data,
                    headers=self.DEFAULT_HEADERS,
                    method=method
                )
                
                try:
                    with urllib.request.urlopen(req, context=self.ssl_context, timeout=self.timeout) as response:
                        res_body = response.read().decode('utf-8')
                        self._last_request_time = time.time()
                        
                        try:
                            parsed_json = json.loads(res_body)
                            return parsed_json
                        except json.JSONDecodeError as je:
                            raise RenacytAPIError(f"Server returned invalid JSON format: {je}")
                            
                except urllib.error.HTTPError as he:
                    status = he.code
                    err_msg = f"HTTP Error {status} on {url}"
                    logger.warning(err_msg)
                    
                    # If it's a client error (e.g. 400, 404), retrying or failing over won't help
                    if 400 <= status < 500:
                        raise RenacytAPIError(f"Client API Request Error: {err_msg}")
                    
                    all_errors.append(err_msg)
                    
                except (urllib.error.URLError, TimeoutError, ConnectionError) as ce:
                    err_msg = f"Connection Error on {url}: {ce}"
                    logger.warning(err_msg)
                    all_errors.append(err_msg)
                    
                # Exponential backoff for retries of the current endpoint
                if attempt < self.max_retries:
                    backoff = attempt * 2.0
                    logger.debug(f"Retrying in {backoff} seconds...")
                    time.sleep(backoff)
            
            # If we reach here, this base_url failed after max_retries. Let's try the next endpoint in line.
            logger.warning(f"Endpoint {base_url} failed all attempts. Trying next fallback URL...")

        # If we exhausted all base URLs and attempts
        raise RenacytConnectionError(
            f"Failed to execute request on all endpoints. Technical logs:\n" + "\n".join(all_errors)
        )

    def search(self, criteria, page=1, page_size=10, normalize=True):
        """
        Queries the RENACYT database using a list of filter criteria.
        
        :param criteria: List of dict criteria fields.
        :param page: The page number (1-indexed).
        :param page_size: Quantity of records per page.
        :param normalize: If True, cleans and normalizes response keys and dates.
        :return: A dictionary containing 'total' (int) and 'data' (list of records).
        """
        # Ensure criteria is a list (if empty list, it fetches all)
        if not isinstance(criteria, list):
            raise RenacytError("Criteria must be a list of filter dictionaries.")
            
        reglamentos = [21, 22, 23, 24, 25, 26, 27]
        raw_res = None
        last_error = None
        
        for reg in reglamentos:
            endpoint = f"actoRegistral/obtenerActosRegistralesActivos/reglamento/{reg}/pagina/{page}/numeroRegistros/{page_size}"
            try:
                temp_res = self._request(endpoint, method="POST", payload=criteria)
                if temp_res and temp_res.get("data") and len(temp_res.get("data")) > 0:
                    raw_res = temp_res
                    break  # Data real encontrada
                elif temp_res and raw_res is None:
                    raw_res = temp_res # Guardamos la respuesta vacía por si nadie tiene datos
            except RenacytAPIError as e:
                last_error = e
                if "404" in str(e):
                    continue  # Try next reglamento
                raise  # Other API errors should fail immediately
                
        if raw_res is None:
            if last_error:
                raise last_error
            raise RenacytAPIError("Expected dictionary response containing 'total' and 'data'.")
            
        if not isinstance(raw_res, dict):
            raise RenacytAPIError("Expected dictionary response containing 'total' and 'data'.")
            
        total = raw_res.get("total", 0)
        data = raw_res.get("data", [])
        
        if not isinstance(data, list):
            data = []
            
        if normalize:
            normalized_data = [normalize_researcher_record(item) for item in data]
            return {
                "total": total,
                "data": normalized_data
            }
            
        return {
            "total": total,
            "data": data
        }

    def search_by_dni(self, dni, normalize=True):
        """
        Quick helper to find a researcher by DNI / Passport number.
        Returns a dictionary representing the researcher, or None if not found.
        """
        clean_dni = str(dni).strip()
        criteria = [
            {
                "id": 7,
                "campo": "a.numero_documento",
                "valor": clean_dni,
                "operadorBusqueda": "=",
                "operadorLogico": "and"
            }
        ]
        
        res = self.search(criteria, page=1, page_size=1, normalize=normalize)
        if res["total"] > 0 and len(res["data"]) > 0:
            return res["data"][0]
        return None

    def search_by_orcid(self, orcid, normalize=True):
        """
        Quick helper to find a researcher by ORCID identifier (exact match).
        Returns a dictionary representing the researcher, or None if not found.
        """
        clean_orcid = str(orcid).strip()
        criteria = [
            {
                "id": 15,
                "campo": "b.id_orcid",
                "valor": clean_orcid,
                "operadorBusqueda": "=",
                "operadorLogico": "and"
            }
        ]
        
        res = self.search(criteria, page=1, page_size=1, normalize=normalize)
        if res["total"] > 0 and len(res["data"]) > 0:
            return res["data"][0]
        return None

    def search_by_codigo(self, code, normalize=True):
        """
        Quick helper to find a researcher by their CONCYTEC Renacyt Registration Code.
        Returns a dictionary representing the researcher, or None if not found.
        """
        clean_code = str(code).strip()
        criteria = [
            {
                "id": 13,
                "campo": "a.codigo_registro",
                "valor": clean_code,
                "operadorBusqueda": "=",
                "operadorLogico": "and"
            }
        ]
        
        res = self.search(criteria, page=1, page_size=1, normalize=normalize)
        if res["total"] > 0 and len(res["data"]) > 0:
            return res["data"][0]
        return None

    def search_by_name(self, name, page=1, page_size=10, normalize=True):
        """
        Queries the RENACYT database by researcher full name (partial match).
        Returns a dictionary containing 'total' and the 'data' matching list.
        """
        clean_name = str(name).strip()
        criteria = [
            {
                "id": 4,
                "campo": "a.nombres",
                "valor": clean_name,
                "operadorBusqueda": "ilike",
                "operadorLogico": "and"
            }
        ]
        
        return self.search(criteria, page=page, page_size=page_size, normalize=normalize)

    def search_by_institution(self, institution, page=1, page_size=10, normalize=True):
        """
        Queries the RENACYT database by self-declared CTI VITAE main institution (partial match).
        Returns a dictionary containing 'total' and the 'data' matching list.
        """
        clean_inst = str(institution).strip()
        criteria = [
            {
                "id": 33,
                "campo": "a.institucion_laboral_principal",
                "valor": clean_inst,
                "operadorBusqueda": "ilike",
                "operadorLogico": "and"
            }
        ]
        
        return self.search(criteria, page=page, page_size=page_size, normalize=normalize)

    def search_by_lastname(self, lastname, page=1, page_size=10, normalize=True):
        """
        Queries the RENACYT database by researcher last name(s).
        Supports single last name (searches paternal OR maternal)
        and double last name (searches paternal AND maternal).
        """
        clean_lastname = str(lastname).strip()
        words = [w.strip() for w in clean_lastname.split() if w.strip()]
        if not words:
            raise RenacytError("Last name query cannot be empty.")
            
        if len(words) >= 2:
            # Match first word as paternal and second word as maternal
            criteria = [
                {
                    "id": 999,
                    "campo": "a.apellido_paterno",
                    "valor": words[0],
                    "operadorBusqueda": "ilike",
                    "operadorLogico": "and"
                },
                {
                    "id": 999,
                    "campo": "a.apellido_materno",
                    "valor": words[1],
                    "operadorBusqueda": "ilike",
                    "operadorLogico": "and"
                }
            ]
        else:
            # Single word: match either paternal OR maternal
            criteria = [
                {
                    "id": 999,
                    "campo": "a.apellido_paterno",
                    "valor": words[0],
                    "operadorBusqueda": "ilike",
                    "operadorLogico": "or"
                },
                {
                    "id": 999,
                    "campo": "a.apellido_materno",
                    "valor": words[0],
                    "operadorBusqueda": "ilike",
                    "operadorLogico": "and"
                }
            ]
            
        return self.search(criteria, page=page, page_size=page_size, normalize=normalize)

