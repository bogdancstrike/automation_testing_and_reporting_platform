import base64
import hashlib
from cryptography.fernet import Fernet
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.config import Config
from src.catalog.models import Secret

_fernet_instance = None

def _get_fernet() -> Fernet:
    global _fernet_instance
    if _fernet_instance is None:
        key_src = Config.SECRET_ENCRYPTION_KEY.encode("utf-8")
        h = hashlib.sha256(key_src).digest()
        key = base64.urlsafe_b64encode(h)
        _fernet_instance = Fernet(key)
    return _fernet_instance

def encrypt(val: str) -> str:
    return _get_fernet().encrypt(val.encode("utf-8")).decode("utf-8")

def decrypt(val: str) -> str:
    return _get_fernet().decrypt(val.encode("utf-8")).decode("utf-8")

def get_secrets_for_project(db: Session, project_id: str) -> dict[str, str]:
    secrets = db.scalars(select(Secret).where(Secret.project_id == project_id)).all()
    return {s.name: decrypt(s.encrypted_value) for s in secrets}

def create_secret(db: Session, project_id: str, name: str, value: str) -> Secret:
    # Check if secret already exists
    s = db.scalars(select(Secret).where(Secret.project_id == project_id, Secret.name == name)).first()
    enc_val = encrypt(value)
    if s:
        s.encrypted_value = enc_val
    else:
        s = Secret(project_id=project_id, name=name, encrypted_value=enc_val)
        db.add(s)
    db.flush()
    return s
