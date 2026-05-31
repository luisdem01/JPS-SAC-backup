import asyncio
from sqlalchemy import text
from app.db.session import engine

async def check():
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT id_usuario, correo_institucional, rol_sistema, estado_cuenta FROM public.usuario"))
        users = result.all()
        print("--- USUARIOS REGISTRADOS EN LA TABLA public.usuario ---")
        for u in users:
            print(f"ID: {u.id_usuario} | Email: {u.correo_institucional} | Rol: {u.rol_sistema} | Activo: {u.estado_cuenta}")
        print("-----------------------------------------------------")

if __name__ == "__main__":
    asyncio.run(check())
