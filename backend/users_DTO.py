"""User and authentication DTOs.

Simple username/password accounts for proviso. Reading proposals and
feedback is public; submitting feedback requires an authenticated user.

Design notes (for reviewers):
- Passwords are never stored or returned in plaintext. The stored record
  keeps only a bcrypt hash (see auth service). ``UserPublicDTO`` is the
  only user shape ever sent to clients and deliberately omits the hash.
- ``UserRecordDTO`` is the internal/persistence shape and is never returned
  by an API endpoint.
"""

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DTOModel(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True, str_strip_whitespace=True)


class UserRegisterDTO(DTOModel):
    """Request body for creating an account."""

    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=6, max_length=200)


class UserLoginDTO(DTOModel):
    """Request body for logging in."""

    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=200)


class UserPublicDTO(DTOModel):
    """User shape safe to return to clients (no password hash)."""

    username: str
    created_at: Optional[str] = None


class UserRecordDTO(DTOModel):
    """Internal persistence shape, including the bcrypt password hash.

    Never returned by an API endpoint.
    """

    username: str
    password_hash: str
    created_at: str


class TokenDTO(DTOModel):
    """JWT returned on successful register/login."""

    access_token: str
    token_type: str = "bearer"
    username: str
