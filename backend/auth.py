"""Authentication helpers: password hashing, JWT issuing/decoding, and the
FastAPI dependency that guards write endpoints.

Design rationale (for reviewers):
- Passwords are hashed with bcrypt (via passlib). bcrypt is a salted,
  deliberately-slow hash, so a leaked database does not expose usable
  passwords. We never store or return plaintext.
- Sessions use a stateless JWT (JSON Web Token) signed with a backend
  secret. The token carries only the username in its ``sub`` claim plus an
  expiry; the server can verify it without a session store. The signing
  secret lives in the ``JWT_SECRET`` environment variable, mirroring how
  the Mongo URI is kept server-side.
- ``get_current_user`` is applied only to write routes. Read routes stay
  public, so anyone can browse proposals and feedback without an account.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

try:
    from users_DTO import UserPublicDTO
    from persistence.persistence import UserRepository
except ImportError:
    from backend.users_DTO import UserPublicDTO
    from backend.persistence.persistence import UserRepository


# bcrypt operates on bytes and rejects inputs longer than 72 bytes, so we
# encode and bound the password before hashing/verifying.
_BCRYPT_MAX_BYTES = 72


def _to_bcrypt_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


# JWT configuration. The secret MUST be set in production via env var;
# the dev fallback keeps local runs working but is not for deployment.
JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-insecure-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "720"))  # 12 hours

# tokenUrl is where clients obtain a token; used by FastAPI's docs UI.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)


def hash_password(password: str) -> str:
    """Return a bcrypt hash (with embedded salt) for a plaintext password."""
    hashed = bcrypt.hashpw(_to_bcrypt_bytes(password), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Check a plaintext password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(_to_bcrypt_bytes(password), password_hash.encode("utf-8"))
    except Exception:
        return False


def create_access_token(username: str) -> str:
    """Issue a signed JWT whose subject is the username."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_EXPIRE_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[str]:
    """Return the username from a valid token, or None if invalid/expired."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None
    username = payload.get("sub")
    if not username or not isinstance(username, str):
        return None
    return username


def get_user_repository(request: Request) -> UserRepository:
    """Build a UserRepository from the shared database handle."""
    db = request.app.state.database
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB is not configured or unavailable.",
        )
    return UserRepository(db)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    users: UserRepository = Depends(get_user_repository),
) -> UserPublicDTO:
    """FastAPI dependency: require a valid token and return the current user.

    Raise 401 if the token is missing, invalid, expired, or the user no
    longer exists. Apply this only to routes that create or modify data.
    """
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated. Log in to submit feedback.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_error

    username = decode_token(token)
    if username is None:
        raise credentials_error

    record = users.get_by_username(username)
    if record is None:
        raise credentials_error

    return UserPublicDTO(username=record.username, created_at=record.created_at)
