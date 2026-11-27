import hashlib
import secrets
import time
import os
import json
from collections import defaultdict, deque
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session as DBSession
from .database import get_db
from .models import Session, User


ROLES = {
    "estudiante": "Estudiante",
    "docente": "Docente",
    "escolares": "Servicios Escolares",
    "administrador": "Administrador",
    "tesoreria": "Tesorería",
    "vinculacion": "Vinculación",
    "evaluador": "Comité Evaluador de Becas",
    "auditor": "Auditor Institucional",
}

PRODUCTION = os.getenv("APP_ENV") == "production"
ORIGIN = os.getenv("APP_ORIGIN", "http://127.0.0.1:5173").rstrip("/")
ORIGINS = {
    value.strip().rstrip("/")
    for value in os.getenv("APP_ORIGINS", ORIGIN).split(",")
    if value.strip()
}
if PRODUCTION and any(not origin.startswith("https://") for origin in ORIGINS):
    raise RuntimeError("APP_ORIGIN debe utilizar HTTPS en producción.")


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def hash_password(password):
    salt = secrets.token_hex(16)
    key = hashlib.scrypt(
        password.encode(),
        salt=salt.encode(),
        n=2**17,
        r=8,
        p=1,
        maxmem=256 * 1024 * 1024,
    )
    return f"{salt}:{key.hex()}"


def verify_password(password, stored):
    salt, expected = stored.split(":")
    key = hashlib.scrypt(
        password.encode(),
        salt=salt.encode(),
        n=2**17,
        r=8,
        p=1,
        maxmem=256 * 1024 * 1024,
    )
    return secrets.compare_digest(key.hex(), expected)


def public_user(u):
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role,
        "profile": json.loads(u.profile),
        "display_name": u.display_name,
        "login_phone": u.login_phone,
        "google_linked": bool(u.google_sub),
    }


def current_user(request: Request, db: DBSession = Depends(get_db)):
    raw = request.cookies.get("session")
    session = db.get(Session, digest(raw)) if raw else None
    if not session or session.expires < time.time():
        raise HTTPException(401, "Inicia sesión para continuar.")
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        csrf = request.headers.get("X-CSRF-Token", "")
        if not secrets.compare_digest(csrf, session.csrf):
            raise HTTPException(
                403, "Sesión de formulario inválida. Recarga la página."
            )
    request.state.session = session
    return db.get(User, session.user_id)


def require_role(user, *roles):
    if user.role not in roles:
        raise HTTPException(403, "Tu rol no tiene permiso para esta acción.")


attempts = defaultdict(deque)


def rate_limit(request, key, limit=10):
    identity = (request.client.host, key)
    q = attempts[identity]
    while q and q[0] < time.time() - 900:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(
            429, "Demasiados intentos. Intenta nuevamente en 15 minutos."
        )
    q.append(time.time())
    # Bound memory for the local single-worker limiter; production uses a shared gateway limiter.
    if len(attempts) > 10000:
        expired = [k for k, v in attempts.items() if not v or v[-1] < time.time() - 900]
        for k in expired:
            attempts.pop(k, None)
