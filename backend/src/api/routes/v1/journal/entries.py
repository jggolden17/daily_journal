import uuid
import datetime as dt
from sqlalchemy import select
from api.api_schemas.journal.entries import (
    CalendarEntrySchema,
    EntryCreateSchema,
    EntryCreateWithDateSchema,
    EntryPatchSchema,
    EntrySchema,
    EntryWithDateSchema,
)
from api.api_schemas.generic import (
    PageParams,
    PaginatedResponse,
    SingleItemResponse,
    SortParams,
)
from api.db.base_data_manager import DataValidationError
from api.db.database import DBSessionDep
from api.db.models.journal.threads import ThreadsModel
from api.middleware.auth import CurrentUser
from api.routes.route_prefix import ENTRIES_URL
from api.routes.route_types import OptionalUUIDList, RequiredUUIDList
from api.services.journal.entries import DecryptedEntryModel, EntriesService
from api.utils.utils import (
    create_paged_response,
    create_response,
    validate_page_params,
    validate_sort_params,
    validate_user_id_authorization,
)
from api.utils.logger import log
from fastapi import APIRouter, Depends, HTTPException, Query, status

router = APIRouter(prefix="/" + ENTRIES_URL)


@router.get("", response_model=PaginatedResponse[EntrySchema])
async def get_data(
    session: DBSessionDep,
    current_user: CurrentUser,
    ids: OptionalUUIDList = None,
    page_params: PageParams = Depends(validate_page_params),
    sort_params: SortParams = Depends(validate_sort_params),
) -> PaginatedResponse[list[EntrySchema]]:
    """get (with pagination)"""
    try:
        data, total_records = await EntriesService(
            session
        ).get_all_paginated_with_decryption(
            ids,
            page_params,
            sort_params,
        )
        return create_paged_response(page_params, sort_params, total_records, data)
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )


@router.post("", response_model=SingleItemResponse[list[EntrySchema]])
async def create_data(
    entries: list[EntryCreateSchema],
    session: DBSessionDep,
    current_user: CurrentUser,
) -> SingleItemResponse[list[EntrySchema]]:
    """create"""
    try:
        data = await EntriesService(session).create_with_encryption(schemas=entries)
        return create_response(data)
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )


@router.patch("", response_model=SingleItemResponse[list[EntrySchema]])
async def update_data(
    entries: list[EntryPatchSchema],
    session: DBSessionDep,
    current_user: CurrentUser,
) -> SingleItemResponse[list[EntrySchema]]:
    """update"""
    try:
        data = await EntriesService(session).patch_with_encryption(schemas=entries)
        return create_response(data)
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )
    except Exception as e:
        import traceback

        log.exception(
            f"Error in patch entries bulk: {type(e).__name__}: {e}\n{traceback.format_exc()}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Internal server error", "message": str(e)},
        )


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_data(
    ids: RequiredUUIDList,
    session: DBSessionDep,
    current_user: CurrentUser,
) -> None:
    """delete"""
    try:
        await EntriesService(session).delete(ids=ids)
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )


@router.get(
    "/date/{date}", response_model=SingleItemResponse[list[EntryWithDateSchema]]
)
async def get_entries_by_date(
    date: dt.date,
    session: DBSessionDep,
    current_user: CurrentUser,
    user_id: uuid.UUID = Query(..., description="User ID to filter entries"),
) -> SingleItemResponse[list[EntryWithDateSchema]]:
    """
    get all entries for a specific date (joining entries to threads).
    """
    validate_user_id_authorization(user_id, current_user)
    try:
        service = EntriesService(session)
        entries_with_threads = await service.get_entries_by_date(user_id, date)

        entries_with_date = []
        for entry_tuple in entries_with_threads:
            entry: DecryptedEntryModel = entry_tuple[0]
            thread = entry_tuple[1]
            entries_with_date.append(
                EntryWithDateSchema(
                    id=entry.id,
                    thread_id=entry.thread_id,
                    raw_markdown=entry.raw_markdown,
                    date=thread.date,
                    written_at=entry.written_at,
                    created_at=entry.created_at,
                    updated_at=entry.updated_at,
                )
            )

        return create_response(entries_with_date)
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )


@router.get("/calendar", response_model=SingleItemResponse[list[CalendarEntrySchema]])
async def get_calendar(
    session: DBSessionDep,
    current_user: CurrentUser,
    user_id: uuid.UUID = Query(..., description="User ID to filter entries"),
    start_date: dt.date = Query(..., description="Start date of the range (inclusive)"),
    end_date: dt.date = Query(..., description="End date of the range (inclusive)"),
) -> SingleItemResponse[list[CalendarEntrySchema]]:
    """
    get calendar data for a date range, indicating which dates have entries
    """
    validate_user_id_authorization(user_id, current_user)
    try:
        if start_date > end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="start_date must be less than or equal to end_date",
            )

        service = EntriesService(session)
        dates_with_entries = await service.get_days_with_entries(
            user_id, start_date, end_date
        )

        calendar_entries = []
        current_date = start_date
        while current_date <= end_date:
            calendar_entries.append(
                CalendarEntrySchema(
                    date=current_date,
                    has_entry=current_date in dates_with_entries,
                )
            )
            current_date += dt.timedelta(days=1)

        return create_response(calendar_entries)
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Internal server error", "message": str(e)},
        )


@router.get(
    "/by_user_id/{entry_id}", response_model=SingleItemResponse[EntryWithDateSchema]
)
async def get_entry_by_id(
    entry_id: uuid.UUID,
    session: DBSessionDep,
    current_user: CurrentUser,
) -> SingleItemResponse[EntryWithDateSchema]:
    """
    get a single entry by ID with its thread date.
    """
    try:
        service = EntriesService(session)
        result = await service.get_entry_by_id_with_thread(entry_id)

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Entry not found for id {entry_id}",
            )

        entry: DecryptedEntryModel = result[0]
        thread = result[1]

        # Validate user authorization
        validate_user_id_authorization(thread.user_id, current_user)

        return create_response(
            EntryWithDateSchema(
                id=entry.id,
                thread_id=entry.thread_id,
                raw_markdown=entry.raw_markdown,
                date=thread.date,
                written_at=entry.written_at,
                created_at=entry.created_at,
                updated_at=entry.updated_at,
            )
        )
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Internal server error", "message": str(e)},
        )


@router.post("/with-thread", response_model=SingleItemResponse[EntryWithDateSchema])
async def create_entry_with_thread(
    entry_data: EntryCreateWithDateSchema,
    session: DBSessionDep,
    current_user: CurrentUser,
) -> SingleItemResponse[EntryWithDateSchema]:
    """
    create an entry and upsert a thread for the given date.
    """
    validate_user_id_authorization(entry_data.user_id, current_user)
    try:
        service = EntriesService(session)
        entry: DecryptedEntryModel = await service.create_entry_with_thread(
            user_id=entry_data.user_id,
            date=entry_data.date,
            raw_markdown=entry_data.raw_markdown,
        )

        stmt = select(ThreadsModel).where(ThreadsModel.id == entry.thread_id)
        thread = await session.scalar(stmt)

        if not thread:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Thread not found after entry creation",
            )

        return create_response(
            EntryWithDateSchema(
                id=entry.id,
                thread_id=entry.thread_id,
                raw_markdown=entry.raw_markdown,
                date=thread.date,
                written_at=entry.written_at,
                created_at=entry.created_at,
                updated_at=entry.updated_at,
            )
        )
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "Validation error", "message": str(ve)},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Internal server error", "message": str(e)},
        )


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: uuid.UUID,
    session: DBSessionDep,
    current_user: CurrentUser,
) -> None:
    """
    delete an entry and its thread if it's the last entry in the thread.
    """
    try:
        service = EntriesService(session)
        await service.delete_entry_with_thread_cleanup(entry_id)
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Internal server error", "message": str(e)},
        )
