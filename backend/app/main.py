import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from .core.auth import router as auth_router
from .core.google_oauth import router as google_router
from .core.security import ORIGINS, PRODUCTION
from .modules.titulacion.router import router as titles_router
from .modules.becas.router import router as becas_router
from .modules.evaluacion_docente.router import router as evaluations_router

if PRODUCTION and not os.getenv("SMTP_HOST"):
    raise RuntimeError("Configura SMTP antes de producción.")
app = FastAPI(
    title="UT de Oriental · Servicios universitarios",
    version="0.1.0",
    docs_url=None if PRODUCTION else "/api/docs",
    openapi_url="/api/openapi.json",
)


@app.middleware("http")
async def security(request: Request, call_next):
    if request.method not in ["GET", "HEAD", "OPTIONS"]:
        origin = request.headers.get("origin")
        if origin and origin.rstrip("/") not in ORIGINS:
            return JSONResponse({"detail": "Origen no autorizado."}, status_code=403)
        if request.headers.get("sec-fetch-site") == "cross-site":
            return JSONResponse(
                {"detail": "Solicitud externa no autorizada."}, status_code=403
            )
        try:
            size = int(request.headers.get("content-length", "0"))
        except ValueError:
            return JSONResponse(
                {"detail": "Tamaño de solicitud inválido."}, status_code=400
            )
        if size > 6 * 1024 * 1024:
            return JSONResponse(
                {"detail": "La solicitud supera el tamaño permitido."}, status_code=413
            )
    response = await call_next(request)
    response.headers.update(
        {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "same-origin",
            "Cache-Control": "no-store",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        }
    )
    if PRODUCTION:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    return response


@app.exception_handler(RequestValidationError)
async def validation(request, exc):
    errors = [
        {"field": ".".join(str(x) for x in e["loc"][1:]), "message": e["msg"]}
        for e in exc.errors()
    ]
    return JSONResponse(
        {"detail": "Revisa los datos del formulario.", "errors": errors},
        status_code=422,
    )


@app.exception_handler(SQLAlchemyError)
async def database_error(request, exc):
    import logging

    # Database exception details may contain personal values or OAuth data.
    logging.getLogger("uvicorn.error").error(
        "Error de base de datos (%s)", type(exc).__name__
    )
    return JSONResponse(
        {"detail": "No fue posible completar la operación. Intenta de nuevo."},
        status_code=503,
    )


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "uto",
        "environment": os.getenv("APP_ENV", "development"),
    }


app.include_router(auth_router)
app.include_router(google_router)
app.include_router(titles_router)
app.include_router(becas_router)
app.include_router(evaluations_router)
