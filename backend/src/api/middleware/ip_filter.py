"""IP filtering middleware for application-level IP restrictions."""

import os
from typing import Optional
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from api.utils.logger import log

ALLOWED_IPS_ENV = os.environ.get("ALLOWED_IPS", "")
ALLOWED_IPS = (
    [ip.strip() for ip in ALLOWED_IPS_ENV.split(",") if ip.strip()]
    if ALLOWED_IPS_ENV
    else []
)


class IPFilterMiddleware(BaseHTTPMiddleware):
    """
    filter requests by IP address (if ALLOWED_IPS is set)
    This will usually be disabled, but in future I like the idea of it.

    Note: cr sets the X-Forwarded-For header, but headers can be spoofed if
    requests don't go through cr's load balancer.
    AFAIK requests will always go through cr's load balancer, so this is not a concern.
    See here: https://docs.cloud.google.com/functions/docs/reference/headers#x-forwarded-for
    """

    async def dispatch(self, request: Request, call_next):
        if not ALLOWED_IPS:
            response = await call_next(request)
            return response

        client_ip = request.client.host if request.client else None

        # X-Forwarded-For header set by cr
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # X-Forwarded-For can contain multiple IPs, take first
            client_ip = forwarded_for.split(",")[0].strip()
        # also check X-Real-IP header (some proxies set this)
        real_ip = request.headers.get("X-Real-IP")
        if real_ip and not client_ip:
            client_ip = real_ip.strip()

        if not client_ip:
            log.warning("Could not determine client IP for request")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Could not determine client IP address",
            )

        if client_ip not in ALLOWED_IPS:
            log.warning(f"Request from unauthorized IP: {client_ip}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="IP address not allowed"
            )

        response = await call_next(request)
        return response
