from sgpi_capirestc.crud.crud_base import CRUDBase
from app.models.domain import Usuario
from sgpi_capiac.schemas.capiac_schemas import UsuarioBase, UsuarioCreate, UsuarioUpdate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.config import settings
from supabase import create_client, Client
import uuid

# Inicializamos cliente de supabase admin síncrono para gestionar usuarios
# Usamos SUPABASE_KEY que debe ser el SERVICE_ROLE_KEY en el .env
supabase_admin: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

class CRUDUsuario(CRUDBase[Usuario, UsuarioCreate, UsuarioUpdate]):
    async def create_with_auth(self, db: AsyncSession, *, obj_in: UsuarioCreate, current_user_id: uuid.UUID = None) -> Usuario:
        # 1. Crear usuario en Supabase Auth
        # NOTA: Supabase python sdk admin_api es sincrono por defecto para create_user
        auth_response = supabase_admin.auth.admin.create_user({
            "email": obj_in.correo_institucional,
            "password": "Unmsm2026*", # Contraseña temporal
            "email_confirm": True, # Para evitar mandar correo de confirmación de momento
        })
        
        user_id_str = auth_response.user.id
        user_id_uuid = uuid.UUID(user_id_str)
        
        # 2. Actualizar o insertar en la tabla publica.usuario (debido al trigger de Supabase)
        db_obj = await db.get(Usuario, user_id_uuid)
        if not db_obj:
            db_obj = Usuario(
                id_usuario=user_id_uuid,
                correo_institucional=obj_in.correo_institucional,
                rol_sistema=obj_in.rol_sistema,
                estado_cuenta=obj_in.estado_cuenta if obj_in.estado_cuenta is not None else True
            )
            db.add(db_obj)
        else:
            db_obj.rol_sistema = obj_in.rol_sistema
            db_obj.estado_cuenta = obj_in.estado_cuenta if obj_in.estado_cuenta is not None else True
            # No necesitamos hacer db.add(db_obj) si usamos await db.get(), ya está en la sesión

        
        # Registrar log de auditoría
        from app.models.domain import LogAuditoria
        log = LogAuditoria(
            tipo_evento='USER_CREATED',
            entidad_afectada='usuario',
            pk_entidad=user_id_str,
            valor_nuevo={"correo": obj_in.correo_institucional, "rol": obj_in.rol_sistema},
            id_usuario=current_user_id,
            resultado='Exito'
        )
        db.add(log)
        
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update_status(self, db: AsyncSession, *, id_usuario: uuid.UUID, is_active: bool, current_user_id: uuid.UUID = None) -> Usuario:
        # 1. Obtener usuario de SQLAlchemy
        user = await self.get(db, id=id_usuario)
        if not user:
            return None
            
        valor_anterior = {"estado_cuenta": user.estado_cuenta}
        
        # 2. Actualizar estado en Supabase Auth (deshabilitar acceso)
        # auth.admin.update_user_by_id permite cambiar el ban_duration, pero una forma más limpia es no borrarlo
        # Simplemente con cambiar el estado en local el backend rechazará peticiones
        # Sin embargo, lo mejor es actualizar los user_metadata o similares.
        # Por ahora lo mantenemos solo en la base de datos SQL que rige el rol.
        
        user.estado_cuenta = is_active
        db.add(user)
        
        # Registrar log de auditoría
        from app.models.domain import LogAuditoria
        log = LogAuditoria(
            tipo_evento='USER_DEACTIVATED' if not is_active else 'USER_CREATED', # Usamos event_type
            entidad_afectada='usuario',
            pk_entidad=str(id_usuario),
            valor_anterior=valor_anterior,
            valor_nuevo={"estado_cuenta": is_active},
            id_usuario=current_user_id,
            resultado='Exito'
        )
        if is_active:
            log.tipo_evento = "UPDATE" # Evento genérico o crear uno habilitado
            
        db.add(log)
        
        await db.commit()
        await db.refresh(user)
        return user

usuario = CRUDUsuario(Usuario)
