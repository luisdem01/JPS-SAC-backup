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

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not settings.JWT_SECRET and not settings.SUPABASE_URL:
        # If no settings are set, allow all for dev purposes (mock auth)
        return {"sub": "dev-user", "email": "dev@unmsm.edu.pe", "app_metadata": {"rol_sistema": "Administrador"}}

    try:
        token = credentials.credentials
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")
        
        if alg in ("ES256", "RS256"):
            if not settings.SUPABASE_URL:
                raise JWTError("SUPABASE_URL must be configured to verify asymmetric tokens")
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
            print(f"[JWT DEBUG] Failed to get unverified header: {header_err}")
        print(f"[JWT DEBUG] JWT Verification Failed: {e} | Token length: {len(token)}")
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
    Dependencia genérica para proteger endpoints según una lista de roles permitidos.
    """
    def role_checker(payload: dict = Depends(get_current_user)):
        app_metadata = payload.get("app_metadata", {})
        rol = app_metadata.get("rol_sistema")
        if rol not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permisos insuficientes. Se requiere uno de: {allowed_roles}"
            )
        return payload
    return role_checker

# Dependencias preconfiguradas
require_admin = check_role(["Administrador"])
require_staff = check_role(["Administrador", "Secretaria", "Jefe"])
