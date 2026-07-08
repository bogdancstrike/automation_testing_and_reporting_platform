"""Import every ORM model so ``Base.metadata`` is complete.

Imported by the DB init script and by Alembic's env before create_all/autogenerate.
"""
from src.catalog import models as _catalog          # noqa: F401
from src.execution import models as _execution        # noqa: F401
from src.scheduling import models as _scheduling       # noqa: F401
from src.comments import models as _comments         # noqa: F401
from src.audit import models as _audit               # noqa: F401

__all__ = ["_catalog", "_execution", "_scheduling", "_comments", "_audit"]
from src.audit.models import AuditEvent
import src.audit.db_events
