from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings

security = HTTPBearer()

_cached_jwks = None


def get_jwks():
    global _cached_jwks
    if _cached_jwks is None:
        import urllib.request
        import json
        jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        try:
            with urllib.request.urlopen(jwks_url, timeout=5) as response:
                _cached_jwks = json.loads(response.read().decode())
        except Exception as e:
            print(f"[JWT DEBUG] Failed to fetch JWKS from {jwks_url}: {e}")
            raise e
    return _cached_jwks


def verify_with_jwks(token: str, header: dict):
    global _cached_jwks
    jwks = get_jwks()

    kid = header.get("kid")
    public_key = None
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            public_key = key
            break

    if not public_key:
        # Key might have rotated, clear cache and try once more
        _cached_jwks = None
        jwks = get_jwks()
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                public_key = key
                break

    if not public_key:
        raise JWTError("Public key not found in JWKS")

    payload = jwt.decode(
        token,
        public_key,
        algorithms=[header["alg"]],
        audience="authenticated"
    )
    return payload


def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    if not settings.JWT_SECRET and not settings.SUPABASE_URL:
        # If no settings are set, allow all for dev purposes (mock auth)
        return {
            "sub": "dev-user",
            "email": "dev@unmsm.edu.pe",
            "app_metadata": {"rol_sistema": "Administrador"}
        }

    try:
        token = credentials.credentials
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")

        if alg in ("ES256", "RS256"):
            if not settings.SUPABASE_URL:
                raise JWTError(
                    "SUPABASE_URL must be configured to verify "
                    "asymmetric tokens"
                )
            payload = verify_with_jwks(token, header)
        else:
            # Fallback to symmetric key verification (HS256)
            secret = settings.JWT_SECRET
            import base64
            try:
                padded = secret + "=" * ((4 - len(secret) % 4) % 4)
                decoded = base64.b64decode(padded)
                if len(decoded) in (32, 64):
                    secret = decoded
            except Exception:
                pass

            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                audience="authenticated"
            )
        return payload
    except JWTError as e:
        try:
            unverified_header = jwt.get_unverified_header(token)
            print(f"[JWT DEBUG] Token Header: {unverified_header}")
        except Exception as header_err:
            print(
                f"[JWT DEBUG] Failed to get unverified header: {header_err}"
            )
        print(
            f"[JWT DEBUG] JWT Verification Failed: {e} | "
            f"Token length: {len(token)}"
        )
        from app.core.logger import logger
        logger.error("JWT Verification Failed", exc_info=e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(payload: dict = Depends(verify_token)):
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Optional: fetch user from DB to verify if active, etc.
    return payload


def check_role(allowed_roles: list[str]):
    """
    Dependencia genérica para proteger endpoints según una lista
    de roles permitidos.
    """
    def role_checker(payload: dict = Depends(get_current_user)):
        from app.core.logger import logger
        
        app_metadata = payload.get("app_metadata", {}) or {}
        user_metadata = payload.get("user_metadata", {}) or {}
        
        rol = (
            payload.get("rol_sistema")
            or app_metadata.get("rol_sistema")
            or user_metadata.get("rol_sistema")
            or payload.get("role")
            or app_metadata.get("role")
            or user_metadata.get("role")
        )
        
        # Admin check bypass - Admin can do EVERYTHING
        if rol and str(rol).strip().lower() == "administrador":
            logger.info(f"[SECURITY] User is Administrador. Bypassing role checks for {allowed_roles}.")
            return payload
            
        if not rol or rol not in allowed_roles:
            logger.warning(
                f"[SECURITY] Access DENIED. Allowed roles: {allowed_roles}. "
                f"User ID: {payload.get('sub')}. User Role: {rol}. "
                f"App Metadata: {app_metadata}. User Metadata: {user_metadata}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Permisos insuficientes. Se requiere uno de: "
                    f"{allowed_roles}. Tu rol actual es: {rol}"
                )
            )
            
        logger.info(f"[SECURITY] Access granted for role: {rol}. User ID: {payload.get('sub')}.")
        return payload
    return role_checker


# Dependencias preconfiguradas
require_admin = check_role(["Administrador"])
require_staff = check_role(["Administrador", "Secretaria", "Jefe"])
