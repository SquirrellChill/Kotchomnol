"""Shared Supabase clients.

Two clients, two trust levels:

  get_supabase()
      anon key. Used for normal authentication actions.

  get_supabase_admin()
      service-role key. Used only for server-side admin operations.

HTTP/1.1 is forced because HTTP/2 requests to this Supabase project
are timing out in the current local environment.
"""

from functools import lru_cache

import httpx
from supabase import Client, ClientOptions, create_client

from app.core.config import settings


def _http_client() -> httpx.Client:
    """Create the HTTP client used by Supabase.

    HTTP/2 was timing out during auth.sign_up() in this environment.
    HTTP/1.1 successfully reaches the same Supabase endpoint.
    """
    return httpx.Client(
        http2=False,
        timeout=httpx.Timeout(
            connect=10.0,
            read=60.0,
            write=30.0,
            pool=10.0,
        ),
        follow_redirects=True,
    )


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    options = ClientOptions(
        httpx_client=_http_client(),
    )

    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY,
        options=options,
    )


@lru_cache(maxsize=1)
def get_supabase_admin() -> Client:
    options = ClientOptions(
        httpx_client=_http_client(),
    )

    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY,
        options=options,
    )