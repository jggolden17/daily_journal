"""Tests for /api/latest/threads endpoints."""

import datetime as dt
import httpx
import pytest
from tests.conftest import AuthenticatedClient


class TestThreadsEndpoints:
    """Tests for /api/latest/threads endpoints."""

    def test_get_threads_empty(self, client: AuthenticatedClient):
        """Test GET /api/latest/threads returns empty list initially."""
        response = client.get("/api/latest/threads")
        assert response.status_code == 200

        data = response.json()
        assert "data" in data
        assert "total_records" in data
        assert len(data["data"]) == 0
        assert data["total_records"] == 0

    def test_create_thread_requires_user(
        self, client: AuthenticatedClient, authenticated_user: dict
    ):
        """Test thread creation with valid user."""
        thread_data = [
            {"user_id": str(authenticated_user["id"]), "date": str(dt.date.today())}
        ]

        response = client.post("/api/latest/threads", json=thread_data)
        assert response.status_code == 200

        result = response.json()
        assert "data" in result
        assert len(result["data"]) == 1

        created_thread = result["data"][0]
        assert created_thread["user_id"] == str(authenticated_user["id"])
        assert created_thread["date"] == str(dt.date.today())
        assert "id" in created_thread
        assert "created_at" in created_thread

        # Cleanup
        client.delete("/api/latest/threads", params={"ids": [created_thread["id"]]})

    def test_create_thread_invalid_user_id(
        self, client: AuthenticatedClient, load_test_data
    ):
        """Test thread creation with non-existent user_id."""
        test_data = load_test_data("journal/threads/invalid_user_id.json")

        response = client.post("/api/latest/threads", json=test_data)
        # Should fail validation or return error (403 if user_id doesn't match authenticated user, 404 if user doesn't exist)
        assert response.status_code in [400, 403, 404, 422]

    def test_create_thread_duplicate_date(
        self, client: AuthenticatedClient, authenticated_user: dict
    ):
        """Test that creating threads with duplicate user_id+date fails."""
        thread_date = dt.date.today()
        thread_data = [
            {"user_id": str(authenticated_user["id"]), "date": str(thread_date)}
        ]

        # Create first thread
        response1 = client.post("/api/latest/threads", json=thread_data)
        assert response1.status_code == 200
        created_thread = response1.json()["data"][0]
        thread_id = created_thread["id"]

        try:
            # Try to create duplicate
            response2 = client.post("/api/latest/threads", json=thread_data)
            # Should fail due to unique constraint
            assert response2.status_code in [400, 409, 422]
        finally:
            # Cleanup
            client.delete("/api/latest/threads", params={"ids": [thread_id]})

    def test_get_threads_by_ids(self, client: AuthenticatedClient, test_thread: dict):
        """Test GET /api/latest/threads with specific IDs."""
        thread_id = test_thread["id"]

        response = client.get("/api/latest/threads", params={"ids": [str(thread_id)]})
        assert response.status_code == 200

        data = response.json()
        assert len(data["data"]) == 1
        assert data["data"][0]["id"] == thread_id

    def test_patch_threads(self, client: AuthenticatedClient, test_thread: dict):
        """Test PATCH /api/latest/threads."""
        new_date = dt.date.today() + dt.timedelta(days=1)
        patch_data = [{"id": str(test_thread["id"]), "date": str(new_date)}]

        response = client.patch("/api/latest/threads", json=patch_data)
        assert response.status_code == 200

        result = response.json()
        assert result["data"][0]["date"] == str(new_date)

    def test_upsert_threads(
        self, client: AuthenticatedClient, authenticated_user: dict
    ):
        """Test POST /api/latest/threads/upsert."""
        thread_date = dt.date.today() + dt.timedelta(days=2)
        upsert_data = [
            {"user_id": str(authenticated_user["id"]), "date": str(thread_date)}
        ]

        # First upsert (create)
        response1 = client.post("/api/latest/threads/upsert", json=upsert_data)
        assert response1.status_code == 200
        created_thread = response1.json()["data"][0]
        thread_id = created_thread["id"]

        try:
            # Second upsert with same data (should return existing)
            response2 = client.post("/api/latest/threads/upsert", json=upsert_data)
            assert response2.status_code == 200
            assert response2.json()["data"][0]["id"] == thread_id
        finally:
            # Cleanup
            client.delete("/api/latest/threads", params={"ids": [thread_id]})

    def test_delete_threads(self, client: AuthenticatedClient, test_thread: dict):
        """Test DELETE /api/latest/threads."""
        thread_id = test_thread["id"]

        response = client.delete(
            "/api/latest/threads", params={"ids": [str(thread_id)]}
        )
        assert response.status_code == 204

        # Verify thread is deleted
        get_response = client.get(
            "/api/latest/threads", params={"ids": [str(thread_id)]}
        )
        assert get_response.status_code == 200
        data = get_response.json()
        assert len(data["data"]) == 0
