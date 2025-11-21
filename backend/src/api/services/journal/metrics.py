import datetime as dt
from api.db.base_data_manager import BaseDataManager
from api.db.models.journal.metrics import MetricsModel
from api.api_schemas.journal.metrics import (
    MetricCreateSchema,
    MetricPatchSchema,
)
from api.services.base_service import BaseService
from sqlalchemy.ext.asyncio import AsyncSession


def populate_create_model(
    schema: MetricCreateSchema,
    current_time: dt.datetime,
):
    """convert MetricCreateSchema to MetricsModel instance."""
    schema_dict = schema.model_dump()
    schema_dict.update(
        {
            "created_at": current_time,
            "updated_at": current_time,
        }
    )

    return MetricsModel(**schema_dict)


class MetricsService(
    BaseService[
        BaseDataManager[MetricsModel],
        MetricsModel,
        MetricCreateSchema,
        MetricPatchSchema,
    ]
):
    """service for managing journal metrics."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(
            session,
            data_manager=BaseDataManager,
            model=MetricsModel,
            create_schema=MetricCreateSchema,
            patch_schema=MetricPatchSchema,
            to_create_model=populate_create_model,
        )
