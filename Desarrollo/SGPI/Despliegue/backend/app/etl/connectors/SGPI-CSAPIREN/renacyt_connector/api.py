import httpx
import asyncio
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

    async def _apply_rate_limit(self):
        """Applies a polite sleep if the last query happened too recently."""
        if self.rate_limit_delay <= 0:
            return
            
        elapsed = time.time() - self._last_request_time
        if elapsed < self.rate_limit_delay:
            sleep_time = self.rate_limit_delay - elapsed
            logger.debug(f"Rate limiting: sleeping for {sleep_time:.2f} seconds...")
            await asyncio.sleep(sleep_time)

    async def _request(self, endpoint_path, method="GET", payload=None):
        """
        Executes an HTTP request with built-in retries, failovers, and rate limiting.
        """
        await self._apply_rate_limit()
        
        # Keep track of errors across all endpoints to raise a descriptive exception if everything fails
        all_errors = []
        
        # httpx takes verification argument: verify_ssl or ssl_context
        # If verify_ssl is False, pass verify=False, else verify=True or the ssl_context
        verify_param = self.ssl_context if not self.verify_ssl else True

        async with httpx.AsyncClient(verify=verify_param, timeout=self.timeout) as client:
            for base_url in self.base_urls:
                url = f"{base_url.rstrip('/')}/{endpoint_path.lstrip('/')}"
                
                for attempt in range(1, self.max_retries + 1):
                    logger.info(f"Connecting to: {url} (Attempt {attempt}/{self.max_retries})")
                    
                    try:
                        response = await client.request(
                            method=method,
                            url=url,
                            json=payload,
                            headers=self.DEFAULT_HEADERS
                        )
                        self._last_request_time = time.time()
                        
                        # Handle client-side errors immediately as before
                        if 400 <= response.status_code < 500:
                            raise RenacytAPIError(f"Client API Request Error: HTTP Error {response.status_code} on {url}")
                        
                        response.raise_for_status()
                        
                        try:
                            return response.json()
                        except (json.JSONDecodeError, ValueError) as je:
                            raise RenacytAPIError(f"Server returned invalid JSON format: {je}")
                                
                    except httpx.HTTPStatusError as he:
                        status = he.response.status_code
                        err_msg = f"HTTP Error {status} on {url}"
                        logger.warning(err_msg)
                        all_errors.append(err_msg)
                        
                    except httpx.RequestError as ce:
                        err_msg = f"Connection Error on {url}: {ce}"
                        logger.warning(err_msg)
                        all_errors.append(err_msg)
                        
                    # Exponential backoff for retries of the current endpoint
                    if attempt < self.max_retries:
                        backoff = attempt * 2.0
                        logger.debug(f"Retrying in {backoff} seconds...")
                        await asyncio.sleep(backoff)
                
                # If we reach here, this base_url failed after max_retries. Let's try the next endpoint in line.
                logger.warning(f"Endpoint {base_url} failed all attempts. Trying next fallback URL...")

        # If we exhausted all base URLs and attempts
        raise RenacytConnectionError(
            f"Failed to execute request on all endpoints. Technical logs:\n" + "\n".join(all_errors)
        )

    @property
    def semaphore(self):
        """Lazy initializer for asyncio.Semaphore."""
        if not hasattr(self, "_semaphore") or self._semaphore is None:
            self._semaphore = asyncio.Semaphore(5)
        return self._semaphore

    async def search(self, criteria, page=1, page_size=10, normalize=True):
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
        
        async def fetch_reglamento(reg):
            endpoint = f"actoRegistral/obtenerActosRegistralesActivos/reglamento/{reg}/pagina/{page}/numeroRegistros/{page_size}"
            async with self.semaphore:
                try:
                    res = await self._request(endpoint, method="POST", payload=criteria)
                    return reg, res, None
                except Exception as e:
                    logger.warning(f"Error querying reglamento {reg}: {e}")
                    return reg, None, e

        tasks = [fetch_reglamento(reg) for reg in reglamentos]
        results = await asyncio.gather(*tasks)
        
        combined_data = []
        total = 0
        success_count = 0
        last_error = None
        empty_res = None
        
        for reg, res, err in results:
            if err:
                last_error = err
                continue
            
            success_count += 1
            if res and isinstance(res, dict):
                data = res.get("data", [])
                total += res.get("total", 0)
                if isinstance(data, list) and len(data) > 0:
                    combined_data.extend(data)
                elif empty_res is None:
                    empty_res = res
                    
        # If all reglamentos failed, raise the last error (or RenacytAPIError)
        if success_count == 0:
            if last_error:
                raise last_error
            raise RenacytAPIError("Expected dictionary response containing 'total' and 'data'.")
            
        # Deduplicate raw records by unique fields
        deduped_data = []
        seen = set()
        for record in combined_data:
            if not isinstance(record, dict):
                continue
            # Deduplicate using camelCase keys (since raw records are camelCase)
            doc_id = record.get("numeroDocumento") or record.get("codigoRegistro") or record.get("id")
            if doc_id:
                if doc_id not in seen:
                    seen.add(doc_id)
                    deduped_data.append(record)
            else:
                deduped_data.append(record)
                
        # Limit to page_size
        paginated_data = deduped_data[:page_size]
        
        if normalize:
            normalized_data = [normalize_researcher_record(item) for item in paginated_data]
            return {
                "total": total,
                "data": normalized_data
            }
            
        return {
            "total": total,
            "data": paginated_data
        }

    async def search_by_dni(self, dni, normalize=True):
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
        
        res = await self.search(criteria, page=1, page_size=1, normalize=normalize)
        if res["total"] > 0 and len(res["data"]) > 0:
            return res["data"][0]
        return None

    async def search_by_orcid(self, orcid, normalize=True):
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
        
        res = await self.search(criteria, page=1, page_size=1, normalize=normalize)
        if res["total"] > 0 and len(res["data"]) > 0:
            return res["data"][0]
        return None

    async def search_by_codigo(self, code, normalize=True):
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
        
        res = await self.search(criteria, page=1, page_size=1, normalize=normalize)
        if res["total"] > 0 and len(res["data"]) > 0:
            return res["data"][0]
        return None

    async def search_by_name(self, name, page=1, page_size=10, normalize=True):
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
        
        return await self.search(criteria, page=page, page_size=page_size, normalize=normalize)

    async def search_by_institution(self, institution, page=1, page_size=10, normalize=True):
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
        
        return await self.search(criteria, page=page, page_size=page_size, normalize=normalize)

    async def search_by_lastname(self, lastname, page=1, page_size=10, normalize=True):
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
            
        return await self.search(criteria, page=page, page_size=page_size, normalize=normalize)

    async def search_by_fullname(self, fullname, page=1, page_size=10, normalize=True):
        """
        Queries the RENACYT database using multiple parallel search strategies
        to allow combined queries of names and surnames.
        Returns a dictionary containing 'total' and the deduplicated matching 'data' list.
        """
        import json

        clean_fullname = str(fullname).strip()
        words = [w.strip() for w in clean_fullname.split() if w.strip()]
        if not words:
            return {"total": 0, "data": []}

        # Build different search criteria sets (heuristics)
        candidate_criterias = []

        def add_crit(fields_dict):
            crit = []
            keys = list(fields_dict.keys())
            for i, key in enumerate(keys):
                field_id = 4 if key == "a.nombres" else 999
                crit.append({
                    "id": field_id,
                    "campo": key,
                    "valor": fields_dict[key],
                    "operadorBusqueda": "ilike",
                    "operadorLogico": "and"
                })
            candidate_criterias.append(crit)

        # 1. Whole query as name
        add_crit({"a.nombres": clean_fullname})
        
        # 2. Single word searches
        if len(words) == 1:
            add_crit({"a.apellido_paterno": words[0]})
            add_crit({"a.apellido_materno": words[0]})
        
        # 3. Two words A B
        elif len(words) == 2:
            # Surnames: paternal A, maternal B
            add_crit({"a.apellido_paterno": words[0], "a.apellido_materno": words[1]})
            # Name A, paternal B
            add_crit({"a.nombres": words[0], "a.apellido_paterno": words[1]})
            # Name A, maternal B
            add_crit({"a.nombres": words[0], "a.apellido_materno": words[1]})
            # Paternal A, Name B
            add_crit({"a.apellido_paterno": words[0], "a.nombres": words[1]})
            # Maternal A, Name B
            add_crit({"a.apellido_materno": words[0], "a.nombres": words[1]})
            
        # 4. Three words A B C
        elif len(words) == 3:
            # Name A B, paternal C
            add_crit({"a.nombres": f"{words[0]} {words[1]}", "a.apellido_paterno": words[2]})
            # Name A B, maternal C
            add_crit({"a.nombres": f"{words[0]} {words[1]}", "a.apellido_materno": words[2]})
            # Name A, paternal B, maternal C
            add_crit({"a.nombres": words[0], "a.apellido_paterno": words[1], "a.apellido_materno": words[2]})
            # Paternal A, maternal B, Name C
            add_crit({"a.apellido_paterno": words[0], "a.apellido_materno": words[1], "a.nombres": words[2]})
            # Name B, paternal C
            add_crit({"a.nombres": words[1], "a.apellido_paterno": words[2]})
            # Name A, paternal C
            add_crit({"a.nombres": words[0], "a.apellido_paterno": words[2]})
            # Name B, maternal C
            add_crit({"a.nombres": words[1], "a.apellido_materno": words[2]})
            # Name A, maternal C
            add_crit({"a.nombres": words[0], "a.apellido_materno": words[2]})

        # 5. Four or more words
        if len(words) >= 4:
            # Full Name A B, paternal C, maternal D
            add_crit({"a.nombres": f"{words[0]} {words[1]}", "a.apellido_paterno": words[2], "a.apellido_materno": words[3]})
            # First Name A, paternal C, maternal D
            add_crit({"a.nombres": words[0], "a.apellido_paterno": words[2], "a.apellido_materno": words[3]})
            # Middle Name B, paternal C, maternal D
            add_crit({"a.nombres": words[1], "a.apellido_paterno": words[2], "a.apellido_materno": words[3]})
            # Name A B, paternal C
            add_crit({"a.nombres": f"{words[0]} {words[1]}", "a.apellido_paterno": words[2]})
            # Name A B, maternal D
            add_crit({"a.nombres": f"{words[0]} {words[1]}", "a.apellido_materno": words[3]})
            # Middle name B, paternal C
            add_crit({"a.nombres": words[1], "a.apellido_paterno": words[2]})

        # Deduplicate criteria lists
        unique_criterias = []
        seen = set()
        for crit in candidate_criterias:
            serialized = json.dumps(crit, sort_keys=True)
            if serialized not in seen:
                seen.add(serialized)
                unique_criterias.append(crit)

        # Helper to execute a single search
        async def run_search(crit):
            try:
                res = await self.search(crit, page=1, page_size=page_size, normalize=normalize)
                return res.get("data", [])
            except Exception as e:
                logger.warning(f"Renacyt search error for criteria {crit}: {e}")
                return []

        # Execute in parallel using asyncio.gather
        tasks = [run_search(crit) for crit in unique_criterias]
        results = await asyncio.gather(*tasks)

        merged_data = []
        for res_list in results:
            merged_data.extend(res_list)

        # Deduplicate results by document number
        deduped_data = []
        seen_docs = set()
        for record in merged_data:
            doc = record.get("numero_documento") or record.get("codigo_registro") or record.get("id")
            if doc:
                if doc not in seen_docs:
                    seen_docs.add(doc)
                    deduped_data.append(record)
            else:
                deduped_data.append(record)

        # Virtual pagination
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_data = deduped_data[start_idx:end_idx]

        return {
            "total": len(deduped_data),
            "data": paginated_data
        }


