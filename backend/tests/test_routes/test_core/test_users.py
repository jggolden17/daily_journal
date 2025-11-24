"""Tests for /api/latest/users endpoints."""

import httpx
import pytest
from tests.conftest import AuthenticatedClient


class TestUsersEndpoints:
    """Tests for /api/latest/users endpoints."""

    def test_get_users_empty(
        self, client: AuthenticatedClient, authenticated_user: dict
    ):
        """Test GET /api/latest/users returns authenticated user initially."""
        response = client.get("/api/latest/users")
        assert response.status_code == 200

        data = response.json()
        assert "data" in data
        assert "total_records" in data
        # require at least the authenticated user created for tests
        assert len(data["data"]) >= 1
        assert data["total_records"] >= 1
        # verify auth user in the list
        user_ids = [user["id"] for user in data["data"]]
        assert authenticated_user["id"] in user_ids

    def test_create_users_valid(self, client: AuthenticatedClient, load_test_data):
        """Test POST /api/latest/users with valid data."""
        test_data = load_test_data("core/users/valid.json")

        response = client.post("/api/latest/users", json=test_data)
        assert response.status_code == 200

        result = response.json()
        assert "data" in result
        assert len(result["data"]) == 2

        created_users = result["data"]
        for i, user in enumerate(created_users):
            assert "id" in user
            assert user["email"] == test_data[i]["email"]
            assert user["external_auth_sub"] == test_data[i]["external_auth_sub"]
            assert "created_at" in user
            assert "updated_at" in user

        # Cleanup: delete created users
        user_ids = [user["id"] for user in created_users]
        client.delete("/api/latest/users", params={"ids": user_ids})

    def test_create_users_invalid_email(
        self, client: AuthenticatedClient, load_test_data
    ):
        """Test POST /api/latest/users with invalid email."""
        test_data = load_test_data("core/users/invalid_email.json")

        response = client.post("/api/latest/users", json=test_data)
        assert response.status_code == 422  # Validation error

    def test_create_users_invalid_missing_fields(
        self, client: AuthenticatedClient, load_test_data
    ):
        """Test POST /api/latest/users with missing required fields."""
        test_data = load_test_data("core/users/invalid_missing_fields.json")

        response = client.post("/api/latest/users", json=test_data)
        assert response.status_code == 422  # Validation error

    def test_patch_users(self, client: AuthenticatedClient, test_user: dict):
        """Test PATCH /api/latest/users."""
        patch_data = [
            {"id": str(test_user["id"]), "external_auth_sub": "updated_auth_sub"}
        ]

        response = client.patch("/api/latest/users", json=patch_data)
        assert response.status_code == 200

        result = response.json()
        assert "data" in result
        assert len(result["data"]) == 1
        assert result["data"][0]["external_auth_sub"] == "updated_auth_sub"
        assert result["data"][0]["id"] == str(test_user["id"])

    def test_upsert_users(self, client: AuthenticatedClient):
        """Test POST /api/latest/users/upsert."""
        upsert_data = [
            {"email": "upsert_test@example.com", "external_auth_sub": "upsert_auth_sub"}
        ]

        response = client.post("/api/latest/users/upsert", json=upsert_data)
        print(response.text)
        assert response.status_code == 200

        result = response.json()
        assert "data" in result
        assert len(result["data"]) == 1
        created_user = result["data"][0]

        # upsert again with new email but same external_auth_sub (should update based on email, not ID)
        upsert_data_2 = [
            {
                "email": "updated_upsert_test@example.com",
                "external_auth_sub": "upsert_auth_sub",
            }
        ]

        response2 = client.post("/api/latest/users/upsert", json=upsert_data_2)
        assert response2.status_code == 200

        result2 = response2.json()
        assert (
            result2["data"][0]["external_auth_sub"] == created_user["external_auth_sub"]
        )
        assert result2["data"][0]["email"] == "updated_upsert_test@example.com"
        # Should be the same user (same ID)
        assert result2["data"][0]["id"] == created_user["id"]

        # Cleanup
        client.delete("/api/latest/users", params={"ids": [created_user["id"]]})

    def test_delete_users(self, client: AuthenticatedClient, test_user: dict):
        """Test DELETE /api/latest/users."""
        user_id = test_user["id"]

        response = client.delete("/api/latest/users", params={"ids": [str(user_id)]})
        assert response.status_code == 204

        # Verify user is deleted
        get_response = client.get("/api/latest/users", params={"ids": [str(user_id)]})
        assert get_response.status_code == 200
        data = get_response.json()
        assert len(data["data"]) == 0

    def test_get_users_with_pagination(self, client: AuthenticatedClient):
        """Test GET /api/latest/users with pagination."""
        # Create multiple users
        users_data = [
            {
                "email": f"pagination_test_{i}@example.com",
                "external_auth_sub": f"sub_{i}",
            }
            for i in range(5)
        ]

        create_response = client.post("/api/latest/users", json=users_data)
        assert create_response.status_code == 200
        created_users = create_response.json()["data"]
        user_ids = [user["id"] for user in created_users]

        try:
            # Test pagination
            response = client.get(
                "/api/latest/users", params={"page": 1, "page_size": 2}
            )
            assert response.status_code == 200

            data = response.json()
            assert len(data["data"]) == 2
            assert data["total_records"] >= 5

            # Test next page
            response2 = client.get(
                "/api/latest/users", params={"page": 2, "page_size": 2}
            )
            assert response2.status_code == 200
            data2 = response2.json()
            assert len(data2["data"]) == 2
        finally:
            # Cleanup
            client.delete("/api/latest/users", params={"ids": user_ids})

    def test_get_users_with_sorting(self, client: AuthenticatedClient):
        """Test GET /api/latest/users with sorting."""
        # Create users with different emails
        users_data = [
            {"email": "zebra@example.com", "external_auth_sub": "sub_z"},
            {"email": "apple@example.com", "external_auth_sub": "sub_a"},
        ]

        create_response = client.post("/api/latest/users", json=users_data)
        assert create_response.status_code == 200
        created_users = create_response.json()["data"]
        user_ids = [user["id"] for user in created_users]

        try:
            # Test sorting by email ascending
            response = client.get(
                "/api/latest/users", params={"sort_by": "email", "sort_order": "asc"}
            )
            assert response.status_code == 200

            data = response.json()
            if len(data["data"]) >= 2:
                # Find our created users in the response
                emails = [
                    user["email"]
                    for user in data["data"]
                    if user["email"] in ["apple@example.com", "zebra@example.com"]
                ]
                if "apple@example.com" in emails and "zebra@example.com" in emails:
                    apple_idx = emails.index("apple@example.com")
                    zebra_idx = emails.index("zebra@example.com")
                    assert apple_idx < zebra_idx  # apple comes before zebra
        finally:
            # Cleanup
            client.delete("/api/latest/users", params={"ids": user_ids})
