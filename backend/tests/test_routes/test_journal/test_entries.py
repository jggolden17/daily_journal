"""Tests for /api/latest/entries endpoints."""

import datetime as dt
import httpx
import pytest


class TestEntriesEndpoints:
    """Tests for /api/latest/entries endpoints."""

    def test_get_entries_empty(self, client: httpx.Client):
        """Test GET /api/latest/entries returns empty list initially."""
        response = client.get("/api/latest/entries")
        assert response.status_code == 200

        data = response.json()
        assert "data" in data
        assert "total_records" in data
        assert len(data["data"]) == 0
        assert data["total_records"] == 0

    def test_create_entries_valid(self, client: httpx.Client, test_thread: dict):
        """Test POST /api/latest/entries with valid data."""
        entry_data = [
            {
                "thread_id": str(test_thread["id"]),
                "raw_markdown": "# Test Entry\n\nThis is a test entry.",
            }
        ]

        response = client.post("/api/latest/entries", json=entry_data)
        assert response.status_code == 200

        result = response.json()
        assert "data" in result
        assert len(result["data"]) == 1

        created_entry = result["data"][0]
        assert created_entry["thread_id"] == str(test_thread["id"])
        assert created_entry["raw_markdown"] == "# Test Entry\n\nThis is a test entry."
        assert "id" in created_entry

        # Cleanup
        client.delete(f"/api/latest/entries/{created_entry['id']}")

    def test_create_entries_invalid_thread_id(
        self, client: httpx.Client, load_test_data
    ):
        """Test POST /api/latest/entries with non-existent thread_id."""
        test_data = load_test_data("journal/entries/invalid_thread_id.json")

        response = client.post("/api/latest/entries", json=test_data)
        # Should fail validation or return error
        assert response.status_code in [400, 404, 422]

    def test_create_entry_with_date(self, client: httpx.Client, test_user: dict):
        """Test POST /api/latest/entries with date (creates entry and upserts thread)."""
        entry_date = dt.date.today()
        entry_data = {
            "user_id": str(test_user["id"]),
            "date": str(entry_date),
            "raw_markdown": "Entry created with date endpoint",
        }

        response = client.post("/api/latest/entries/with-thread", json=entry_data)
        assert response.status_code == 200

        result = response.json()
        assert "data" in result
        created_entry = result["data"]

        assert created_entry["date"] == str(entry_date)
        assert created_entry["raw_markdown"] == "Entry created with date endpoint"
        assert "id" in created_entry
        assert "thread_id" in created_entry

        # Cleanup
        client.delete(f"/api/latest/entries/{created_entry['id']}")

    def test_get_entries_by_date(
        self, client: httpx.Client, test_user: dict, test_thread: dict
    ):
        """Test GET /api/latest/entries/date/{date}."""
        entry_data = {
            "thread_id": str(test_thread["id"]),
            "raw_markdown": "Entry for date test",
        }

        # Create entry
        create_response = client.post("/api/latest/entries", json=[entry_data])
        assert create_response.status_code == 200
        created_entry = create_response.json()["data"][0]
        entry_id = created_entry["id"]

        try:
            # Get entries by date
            thread_date = test_thread["date"]
            response = client.get(
                f"/api/latest/entries/date/{thread_date}",
                params={"user_id": str(test_user["id"])},
            )
            assert response.status_code == 200

            result = response.json()
            assert "data" in result
            entries = result["data"]

            # Should find our entry
            entry_ids = [e["id"] for e in entries]
            assert entry_id in entry_ids

            # Verify entry has date field
            our_entry = next(e for e in entries if e["id"] == entry_id)
            assert our_entry["date"] == str(thread_date)
        finally:
            # Cleanup
            client.delete(f"/api/latest/entries/{entry_id}")

    def test_delete_entry_with_thread_cleanup(
        self, client: httpx.Client, test_user: dict
    ):
        """Test DELETE /api/latest/entries/{entry_id} cleans up thread if last entry."""
        entry_date = dt.date.today()

        # Create entry (which creates thread)
        entry_data = {
            "user_id": str(test_user["id"]),
            "date": str(entry_date),
            "raw_markdown": "Only entry in thread",
        }

        create_response = client.post(
            "/api/latest/entries/with-thread", json=entry_data
        )
        assert create_response.status_code == 200
        created_entry = create_response.json()["data"]
        entry_id = created_entry["id"]
        thread_id = created_entry["thread_id"]

        # Delete entry
        response = client.delete(f"/api/latest/entries/{entry_id}")
        assert response.status_code == 204

        # Verify thread is also deleted (since it was the last entry)
        thread_response = client.get("/api/latest/threads", params={"ids": [thread_id]})
        assert thread_response.status_code == 200
        thread_data = thread_response.json()
        assert len(thread_data["data"]) == 0

    def test_get_calendar(self, client: httpx.Client, test_user: dict):
        """Test GET /api/latest/entries/calendar."""
        start_date = dt.date.today()
        end_date = start_date + dt.timedelta(days=7)

        # Create entry for today
        entry_data = {
            "user_id": str(test_user["id"]),
            "date": str(start_date),
            "raw_markdown": "Calendar test entry",
        }

        create_response = client.post(
            "/api/latest/entries/with-thread", json=entry_data
        )
        assert create_response.status_code == 200
        created_entry = create_response.json()["data"]
        entry_id = created_entry["id"]

        try:
            # Get calendar data
            response = client.get(
                "/api/latest/entries/calendar",
                params={
                    "user_id": str(test_user["id"]),
                    "start_date": str(start_date),
                    "end_date": str(end_date),
                },
            )
            assert response.status_code == 200

            result = response.json()
            assert "data" in result
            calendar_entries = result["data"]

            # Should have entries for all dates in range
            assert len(calendar_entries) == 8  # 7 days + 1 (inclusive)

            # Find today's entry
            today_entry = next(
                (e for e in calendar_entries if e["date"] == str(start_date)), None
            )
            assert today_entry is not None
            assert today_entry["hasEntry"] is True

            # Find tomorrow's entry (should have no entry)
            tomorrow = start_date + dt.timedelta(days=1)
            tomorrow_entry = next(
                (e for e in calendar_entries if e["date"] == str(tomorrow)), None
            )
            assert tomorrow_entry is not None
            assert tomorrow_entry["hasEntry"] is False
        finally:
            # Cleanup
            client.delete(f"/api/latest/entries/{entry_id}")

    def test_patch_entries(self, client: httpx.Client, test_entry: dict):
        """Test PATCH /api/latest/entries."""
        patch_data = [
            {"id": str(test_entry["id"]), "raw_markdown": "Updated markdown content"}
        ]

        response = client.patch("/api/latest/entries", json=patch_data)
        assert (
            response.status_code == 200
        ), f"Patch failed with status {response.status_code}: {response.text}"

        result = response.json()
        assert result["data"][0]["raw_markdown"] == "Updated markdown content"

    def test_delete_entries(self, client: httpx.Client, test_entry: dict):
        """Test DELETE /api/latest/entries."""
        entry_id = test_entry["id"]

        response = client.delete("/api/latest/entries", params={"ids": [str(entry_id)]})
        assert response.status_code == 204

        # Verify entry is deleted
        get_response = client.get(
            "/api/latest/entries", params={"ids": [str(entry_id)]}
        )
        assert get_response.status_code == 200
        data = get_response.json()
        assert len(data["data"]) == 0
