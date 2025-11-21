"""Tests for /api/latest/metrics endpoints."""

import httpx
import pytest


class TestMetricsEndpoints:
    """Tests for /api/latest/metrics endpoints."""

    def test_get_metrics_empty(self, client: httpx.Client):
        """Test GET /api/latest/metrics returns empty list initially."""
        response = client.get("/api/latest/metrics")
        assert response.status_code == 200

        data = response.json()
        assert "data" in data
        assert "total_records" in data
        assert len(data["data"]) == 0
        assert data["total_records"] == 0

    def test_create_metrics_valid(self, client: httpx.Client, test_thread: dict):
        """Test POST /api/latest/metrics with valid data."""
        metric_data = [
            {
                "thread_id": str(test_thread["id"]),
                "sleep_quality": 6,
                "physical_activity": 6,
                "overall_mood": 7,
                "hours_paid_work": 8.0,
                "hours_personal_work": 2.0,
            }
        ]

        response = client.post("/api/latest/metrics", json=metric_data)
        assert response.status_code == 200

        result = response.json()
        assert "data" in result
        assert len(result["data"]) == 1

        created_metric = result["data"][0]
        assert created_metric["thread_id"] == str(test_thread["id"])
        assert created_metric["sleep_quality"] == 6
        assert created_metric["physical_activity"] == 6
        assert "id" in created_metric

        # Cleanup
        client.delete("/api/latest/metrics", params={"ids": [created_metric["id"]]})

    def test_create_metrics_invalid_thread_id(
        self, client: httpx.Client, load_test_data
    ):
        """Test POST /api/latest/metrics with non-existent thread_id."""
        test_data = load_test_data("journal/metrics/invalid_thread_id.json")

        response = client.post("/api/latest/metrics", json=test_data)
        # Should fail validation or return error
        assert response.status_code in [400, 404, 422]

    def test_create_metrics_with_additional_metrics(
        self, client: httpx.Client, test_thread: dict
    ):
        """Test POST /api/latest/metrics with additional_metrics JSONB field."""
        metric_data = [
            {
                "thread_id": str(test_thread["id"]),
                "sleep_quality": 7,
                "additional_metrics": {
                    "water_intake": 8,
                    "steps": 10_000,
                    "meditation_minutes": 15,
                },
            }
        ]

        response = client.post("/api/latest/metrics", json=metric_data)
        assert response.status_code == 200

        result = response.json()
        created_metric = result["data"][0]

        assert created_metric["additional_metrics"] is not None
        assert created_metric["additional_metrics"]["water_intake"] == 8
        assert created_metric["additional_metrics"]["steps"] == 10000

        # Cleanup
        client.delete("/api/latest/metrics", params={"ids": [created_metric["id"]]})

    def test_get_metrics_by_ids(self, client: httpx.Client, test_metric: dict):
        """Test GET /api/latest/metrics with specific IDs."""
        metric_id = test_metric["id"]

        response = client.get("/api/latest/metrics", params={"ids": [str(metric_id)]})
        assert response.status_code == 200

        data = response.json()
        assert len(data["data"]) == 1
        assert data["data"][0]["id"] == metric_id

    def test_patch_metrics(self, client: httpx.Client, test_metric: dict):
        """Test PATCH /api/latest/metrics."""
        patch_data = [
            {"id": str(test_metric["id"]), "sleep_quality": 5, "overall_mood": 3}
        ]

        response = client.patch("/api/latest/metrics", json=patch_data)
        assert response.status_code == 200

        result = response.json()
        assert result["data"][0]["sleep_quality"] == 5
        assert result["data"][0]["overall_mood"] == 3

    def test_upsert_metrics(self, client: httpx.Client, test_thread: dict):
        """Test POST /api/latest/metrics/upsert."""
        upsert_data = [
            {
                "thread_id": str(test_thread["id"]),
                "sleep_quality": 3,
                "physical_activity": 1,
            }
        ]

        # First upsert (create)
        response1 = client.post("/api/latest/metrics/upsert", json=upsert_data)
        assert response1.status_code == 200
        created_metric = response1.json()["data"][0]
        metric_id = created_metric["id"]

        try:
            # Second upsert with same thread_id (should update based on thread_id, not ID)
            upsert_data_2 = [
                {
                    "thread_id": str(test_thread["id"]),
                    "sleep_quality": 5,
                }
            ]

            response2 = client.post("/api/latest/metrics/upsert", json=upsert_data_2)
            assert response2.status_code == 200
            result2 = response2.json()
            assert result2["data"][0]["sleep_quality"] == 5
            # Should be the same metric (same ID)
            assert result2["data"][0]["id"] == metric_id
        finally:
            # Cleanup
            client.delete("/api/latest/metrics", params={"ids": [metric_id]})

    def test_delete_metrics(self, client: httpx.Client, test_metric: dict):
        """Test DELETE /api/latest/metrics."""
        metric_id = test_metric["id"]

        response = client.delete(
            "/api/latest/metrics", params={"ids": [str(metric_id)]}
        )
        assert response.status_code == 204

        # Verify metric is deleted
        get_response = client.get(
            "/api/latest/metrics", params={"ids": [str(metric_id)]}
        )
        assert get_response.status_code == 200
        data = get_response.json()
        assert len(data["data"]) == 0

    def test_create_metrics_with_datetime_fields(
        self, client: httpx.Client, test_thread: dict
    ):
        """Test POST /api/latest/metrics with datetime fields (asleep_by, awoke_at)."""
        import datetime as dt

        metric_data = [
            {
                "thread_id": str(test_thread["id"]),
                "asleep_by": "2024-01-15T22:30:00Z",
                "awoke_at": "2024-01-16T07:00:00Z",
                "sleep_quality": 6,
            }
        ]

        response = client.post("/api/latest/metrics", json=metric_data)
        assert response.status_code == 200

        result = response.json()
        created_metric = result["data"][0]

        assert created_metric["asleep_by"] is not None
        assert created_metric["awoke_at"] is not None

        # Cleanup
        client.delete("/api/latest/metrics", params={"ids": [created_metric["id"]]})

    def test_metrics_unique_constraint(self, client: httpx.Client, test_thread: dict):
        """Test that metrics have unique constraint on thread_id."""
        metric_data = [{"thread_id": str(test_thread["id"]), "sleep_quality": 6}]

        # Create first metric
        response1 = client.post("/api/latest/metrics", json=metric_data)
        assert response1.status_code == 200
        created_metric = response1.json()["data"][0]
        metric_id = created_metric["id"]

        try:
            # Try to create second metric with same thread_id
            response2 = client.post("/api/latest/metrics", json=metric_data)
            # Should fail due to unique constraint on thread_id
            assert response2.status_code in [400, 409, 422]
        finally:
            # Cleanup
            client.delete("/api/latest/metrics", params={"ids": [metric_id]})
