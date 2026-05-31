"""
RENACYT Connector Module
A robust, zero-dependency Python connector to interact with the Peru CONCYTEC RENACYT API database.
Exposes both an object-oriented client and convenient single-lookup utility functions.
"""

from renacyt_connector.api import (
    RenacytConnector,
    RenacytError,
    RenacytConnectionError,
    RenacytAPIError
)
from renacyt_connector.utils import extract_lastnames

# Convenient, high-level package functions for quick lookups
def search_by_dni(dni, verify_ssl=False):
    """
    Looks up a researcher by DNI or Passport ID.
    Returns a cleaned normalized dictionary, or None if not found.
    """
    client = RenacytConnector(verify_ssl=verify_ssl)
    return client.search_by_dni(dni)

def search_by_orcid(orcid, verify_ssl=False):
    """
    Looks up a researcher by ORCID identifier.
    Returns a cleaned normalized dictionary, or None if not found.
    """
    client = RenacytConnector(verify_ssl=verify_ssl)
    return client.search_by_orcid(orcid)

def search_by_codigo(code, verify_ssl=False):
    """
    Looks up a researcher by their CONCYTEC Renacyt code.
    Returns a cleaned normalized dictionary, or None if not found.
    """
    client = RenacytConnector(verify_ssl=verify_ssl)
    return client.search_by_codigo(code)

def search_by_name(name, page=1, page_size=10, verify_ssl=False):
    """
    Searches for researchers by partial full name matching.
    Returns a dictionary containing 'total' and 'data' (list of records).
    """
    client = RenacytConnector(verify_ssl=verify_ssl)
    return client.search_by_name(name, page=page, page_size=page_size)

def search_by_institution(institution, page=1, page_size=10, verify_ssl=False):
    """
    Searches for researchers by self-declared CTI VITAE main institution.
    Returns a dictionary containing 'total' and 'data' (list of records).
    """
    client = RenacytConnector(verify_ssl=verify_ssl)
    return client.search_by_institution(institution, page=page, page_size=page_size)

def search_by_lastname(lastname, page=1, page_size=10, verify_ssl=False):
    """
    Searches for researchers by partial last name matching.
    Returns a dictionary containing 'total' and 'data' (list of records).
    """
    client = RenacytConnector(verify_ssl=verify_ssl)
    return client.search_by_lastname(lastname, page=page, page_size=page_size)

__all__ = [
    'RenacytConnector',
    'RenacytError',
    'RenacytConnectionError',
    'RenacytAPIError',
    'search_by_dni',
    'search_by_orcid',
    'search_by_codigo',
    'search_by_name',
    'search_by_institution',
    'search_by_lastname',
    'extract_lastnames'
]
