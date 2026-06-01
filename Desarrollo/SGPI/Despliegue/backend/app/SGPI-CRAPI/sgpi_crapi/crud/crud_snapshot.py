from sgpi_capirestc.crud.crud_base import CRUDBase
from app.models.domain import SnapshotPOI
from sgpi_crapi.schemas.report_schemas import SnapshotPOICreate
from pydantic import BaseModel


class SnapshotPOIUpdate(BaseModel):
    # Los snapshots son inmutables por diseño, por lo tanto no se define update schema
    pass


class CRUDSnapshotPOI(CRUDBase[SnapshotPOI, SnapshotPOICreate, SnapshotPOIUpdate]):
    pass


snapshot_poi = CRUDSnapshotPOI(SnapshotPOI)
