from src.core.db import get_engine, Base; Base.metadata.create_all(get_engine())
