"""Backend-driven pagination, search, filter, and sort helpers."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from src.core.errors import ValidationError


@dataclass(frozen=True)
class PageParams:
    page: int = 1
    page_size: int = 20
    q: str = ""
    sort: str | None = None
    order: str = "asc"


def parse_page(args: dict[str, Any], *, default_sort: str | None = None,
               default_order: str = "asc", max_page_size: int = 100) -> PageParams:
    try:
        page = max(int(args.get("page", 1) or 1), 1)
        page_size = int(args.get("page_size", 20) or 20)
    except (TypeError, ValueError):
        raise ValidationError("page and page_size must be numbers")
    page_size = min(max(page_size, 1), max_page_size)
    order = str(args.get("order", default_order) or default_order).lower()
    if order not in ("asc", "desc"):
        raise ValidationError("order must be asc or desc")
    return PageParams(
        page=page,
        page_size=page_size,
        q=str(args.get("q", "") or "").strip(),
        sort=args.get("sort") or default_sort,
        order=order,
    )


def apply_sort(stmt: Select, params: PageParams, allowed: dict[str, Any]) -> Select:
    if not params.sort:
        return stmt
    column = allowed.get(params.sort)
    if column is None:
        raise ValidationError(f"unsupported sort field {params.sort!r}")
    return stmt.order_by(column.desc() if params.order == "desc" else column.asc())


def envelope(items: list[Any], total: int, params: PageParams) -> dict[str, Any]:
    return {
        "items": items,
        "page": params.page,
        "page_size": params.page_size,
        "total": total,
        "sort": params.sort,
        "order": params.order,
    }


def page_scalars(db: Session, stmt: Select, params: PageParams,
                 serializer: Callable[[Any], dict[str, Any]]) -> dict[str, Any]:
    total = int(db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0)
    rows = list(db.scalars(
        stmt.offset((params.page - 1) * params.page_size).limit(params.page_size)
    ).all())
    return envelope([serializer(row) for row in rows], total, params)
