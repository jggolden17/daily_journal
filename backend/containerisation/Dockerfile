FROM python:3.11-slim

# install curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# TODO - use pre-commit to convert poetry to requirements.txt and install from there
RUN pip install --no-cache-dir poetry>=1.8.0
WORKDIR /app
ENV POETRY_NO_INTERACTION=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache
COPY pyproject.toml poetry.lock ./
RUN poetry config virtualenvs.in-project true && \
    poetry install --only=main --no-root && \
    rm -rf $POETRY_CACHE_DIR

COPY src ./src
ENV PYTHONPATH=/app/src
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["uvicorn", "api.routes.main:app", "--host", "0.0.0.0", "--port", "8000"]

