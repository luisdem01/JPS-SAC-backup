from sgpi_capirestc.crud.crud_base import CRUDBase
from app.models.domain import Publicacion
from sgpi_capirestc.schemas.domain_schemas import PublicacionCreate, PublicacionUpdate

class CRUDPublicacion(CRUDBase[Publicacion, PublicacionCreate, PublicacionUpdate]):
    pass

publicacion = CRUDPublicacion(Publicacion)
