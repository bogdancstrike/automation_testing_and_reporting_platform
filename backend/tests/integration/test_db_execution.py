import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from src.core.db import Base
import src.models_all  # noqa: F401
from src.catalog.models import Project, Target, TestDefinition
from src.execution.models import RunQueue, TestRun
from src.catalog import service as catalog_service
from src.execution import service as execution_service
from src.execution import queue as execution_queue
from src.execution.runner import execute_run, mark_run_running
from src.testkit.result import CANCELED

# PostgreSQL Test Database URL
TEST_DATABASE_URL = "postgresql+psycopg2://qtp:qtp@localhost:5432/qtp"

@pytest.fixture
def db_session():
    # Use real Postgres engine for tests
    engine = create_engine(TEST_DATABASE_URL)
    
    # Drop existing tables to ensure clean state
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    db = Session()
    try:
        # Seed default project
        p = Project(key="default", name="Default Project")
        db.add(p)
        db.flush()
        yield db
    finally:
        db.close()

def test_enqueue_and_claim(db_session):
    db = db_session
    # 1. Create target
    catalog_service.create_target(db, {
        "key": "demo",
        "name": "Demo Target",
        "base_url": "http://example.com"
    })
    
    # 2. Create test definition
    test_def = catalog_service.create_request_test(db, {
        "key": "ui.test",
        "name": "UI Test",
        "config": {
            "target": "demo",
            "method": "GET",
            "url": "/get",
            "assertions": [{"type": "status_code", "operator": "equals", "expected": 200}]
        }
    })
    
    # 3. Enqueue run
    run = execution_service.enqueue_run(db, db.get(TestDefinition, test_def["id"]))
    assert run.status == "queued"
    
    # 4. Claim run (worker with matching capabilities)
    # If capabilities don't match (e.g. CLI only), shouldn't claim
    claimed = execution_queue.claim_next(db, "worker-1", ("cli",))
    assert claimed is None
    
    # Matching capability (http)
    claimed = execution_queue.claim_next(db, "worker-1", ("http",))
    assert claimed is not None
    assert claimed.id == run.id
    assert claimed.status == "claimed"
    assert claimed.worker_name == "worker-1"


def test_mark_run_running_is_visible_before_final_result(db_session):
    db = db_session
    catalog_service.create_target(db, {
        "key": "demo",
        "name": "Demo Target",
        "base_url": "http://example.com"
    })
    test_def = catalog_service.create_request_test(db, {
        "key": "ui.running",
        "name": "Running Visibility Test",
        "config": {
            "target": "demo",
            "method": "GET",
            "url": "/get",
        }
    })
    run = execution_service.enqueue_run(db, db.get(TestDefinition, test_def["id"]))
    db.commit()

    Session = sessionmaker(bind=db.get_bind(), expire_on_commit=False)
    with Session() as worker_db:
        worker_run = worker_db.get(TestRun, run.id)
        mark_run_running(worker_db, worker_run, "worker-1")
        worker_db.commit()

    db.expire(run)
    visible = db.get(TestRun, run.id)
    assert visible.status == "running"
    assert visible.worker_name == "worker-1"
    assert visible.started_at is not None


def test_cancel_queued_run(db_session):
    db = db_session
    catalog_service.create_target(db, {
        "key": "demo",
        "name": "Demo Target",
        "base_url": "http://example.com"
    })
    test_def = catalog_service.create_request_test(db, {
        "key": "ui.test",
        "name": "UI Test",
        "config": {
            "target": "demo",
            "method": "GET",
            "url": "/get",
        }
    })
    run = execution_service.enqueue_run(db, db.get(TestDefinition, test_def["id"]))
    
    # Cancel while queued
    res = execution_service.cancel_run(db, run.id)
    assert res["status"] == "canceled"
    assert run.status == "canceled"
    assert run.error_category == "canceled"
    
    # Queue item should be marked done
    q_items = db.scalars(select(RunQueue).where(RunQueue.test_run_id == run.id)).all()
    assert all(q.status == "done" for q in q_items)

def test_cancel_running_run_cooperative(db_session):
    db = db_session
    catalog_service.create_target(db, {
        "key": "demo",
        "name": "Demo Target",
        "base_url": "http://example.com"
    })
    test_def = catalog_service.create_request_test(db, {
        "key": "ui.test2",
        "name": "UI Test 2",
        "config": {
            "target": "demo",
            "steps": [
                {"id": "step1", "name": "Step 1", "method": "GET", "url": "/get"},
                {"id": "step2", "name": "Step 2", "method": "GET", "url": "/get"},
            ]
        }
    })
    run = execution_service.enqueue_run(db, db.get(TestDefinition, test_def["id"]))
    
    # Claim run
    claimed = execution_queue.claim_next(db, "worker-1", ("http",))
    assert claimed is not None
    assert claimed.status == "claimed"
    
    # Request cancellation while running/claimed
    res = execution_service.cancel_run(db, run.id)
    assert res["status"] == "claimed"
    assert res["cancel_requested"] is True
    assert run.cancel_requested is True

    # When execute_run is called, should check cancel_requested and mark CANCELED
    execute_run(db, run, "worker-1")
    assert run.status == CANCELED
    assert run.error_category == "canceled"

def test_encrypted_secrets(db_session):
    from src.core.secrets import create_secret, get_secrets_for_project, decrypt
    db = db_session
    p = db.scalars(select(Project).where(Project.key == "default")).first()
    project_id = p.id
    
    # Create secret
    secret = create_secret(db, project_id, "my_token", "super_secret_value_123")
    assert secret.name == "my_token"
    # Ensure it's stored encrypted
    assert secret.encrypted_value != "super_secret_value_123"
    
    # Decrypt and check
    decrypted = decrypt(secret.encrypted_value)
    assert decrypted == "super_secret_value_123"
    
    # Fetch all secrets for project
    all_secrets = get_secrets_for_project(db, project_id)
    assert all_secrets == {"my_token": "super_secret_value_123"}

def test_delete_request_test_refuses_active_runs(db_session):
    from src.core.errors import ConflictError

    db = db_session
    catalog_service.create_target(db, {
        "key": "demo", "name": "Demo Target", "base_url": "http://example.com"})
    test_def = catalog_service.create_request_test(db, {
        "key": "ui.del", "name": "UI Del",
        "config": {"target": "demo", "method": "GET", "url": "/get"}})
    test_id = test_def["id"]

    # A queued (non-terminal) run must block deletion with a 409 ConflictError.
    run = execution_service.enqueue_run(db, db.get(TestDefinition, test_id))
    assert run.status == "queued"
    with pytest.raises(ConflictError) as ei:
        catalog_service.delete_request_test(db, test_id)
    assert ei.value.status_code == 409
    assert ei.value.details.get("active_runs") == 1
    assert db.get(TestDefinition, test_id) is not None  # nothing deleted

    # Once the run reaches a terminal state, deletion succeeds.
    execution_service.cancel_run(db, run.id)
    assert run.status == CANCELED
    result = catalog_service.delete_request_test(db, test_id)
    assert result == {"deleted": test_id}
    assert db.get(TestDefinition, test_id) is None


def test_audit_logging(db_session):
    from src.audit.service import log_audit
    from src.audit.models import AuditEvent
    db = db_session
    p = db.scalars(select(Project).where(Project.key == "default")).first()
    project_id = p.id
    
    # Create audit event
    evt = log_audit(db, project_id, "test.create", "alice", "test", "test-123", {"name": "test-name"})
    
    # Query database
    db_evt = db.scalars(select(AuditEvent).where(AuditEvent.id == evt.id)).first()
    assert db_evt is not None
    assert db_evt.project_id == project_id
    assert db_evt.action == "test.create"
    assert db_evt.actor == "alice"
    assert db_evt.entity_type == "test"
    assert db_evt.entity_id == "test-123"
    assert db_evt.context == {"name": "test-name"}
