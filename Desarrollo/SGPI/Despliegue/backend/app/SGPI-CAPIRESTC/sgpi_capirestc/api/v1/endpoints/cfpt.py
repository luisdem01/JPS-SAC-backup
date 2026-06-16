import base64
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from typing import List, Optional

from app.db.session import get_db
from app.core.logger import logger
from app.models.domain import Publicacion, Tesis, Investigador, GrupoInvestigacion
from app.core.security import get_current_user
from app.core.audit import log_audit_event
from sgpi_capirestc.schemas.cfpt_schemas import (
    RegistroProduccionResponse, 
    ConfirmarPayload, 
    ValidarDoiResponse,
    GrupoInvestigacionResumen,
    InvestigadorResumen,
    InvestigadorVinculado
)

router = APIRouter()

def encode_tesis_id(url: str) -> str:
    return "tes-" + base64.urlsafe_b64encode(url.encode()).decode().rstrip('=')

def decode_tesis_id(encoded: str) -> str:
    if encoded.startswith("tes-"):
        encoded = encoded[4:]
    padding = '=' * (4 - len(encoded) % 4)
    return base64.urlsafe_b64decode((encoded + padding).encode()).decode()

@router.get("/producciones", response_model=List[RegistroProduccionResponse])
async def list_producciones(
    buscar: Optional[str] = None,
    tipo: Optional[str] = 'todos',
    estado: Optional[str] = 'todos',
    indexacion: Optional[str] = 'todas',
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    resultados = []
    
    # 1. Fetch Publicaciones
    if tipo in ['todos', 'articulo']:
        stmt_pub = select(Publicacion, GrupoInvestigacion).outerjoin(
            GrupoInvestigacion, Publicacion.id_grupo == GrupoInvestigacion.id_grupo
        )
        filters_pub = []
        if estado != 'todos':
            filters_pub.append(func.unaccent(Publicacion.estado_validacion).ilike(func.unaccent(estado)))
        if indexacion != 'todas':
            filters_pub.append(func.unaccent(Publicacion.fuente_origen).ilike(func.unaccent(indexacion)))
        if buscar:
            term = f"%{buscar}%"
            filters_pub.append(or_(
                func.unaccent(Publicacion.titulo_articulo).ilike(func.unaccent(term)),
                func.unaccent(Publicacion.doi_codigo).ilike(func.unaccent(term))
            ))
        if filters_pub:
            stmt_pub = stmt_pub.where(and_(*filters_pub))
            
        res_pub = await db.execute(stmt_pub)
        for p, g in res_pub.all():
            grupo_vinculado = None
            if g:
                grupo_vinculado = GrupoInvestigacionResumen(
                    id=g.id_grupo,
                    nombre=g.nombre_grupo,
                    siglas=g.siglas,
                    facultad=g.facultad
                )
            resultados.append(RegistroProduccionResponse(
                id=f"pub-{p.id_publicacion}",
                tipo="articulo",
                titulo=p.titulo_articulo,
                autores=g.nombre_grupo if g else "Grupo no vinculado", 
                fecha=p.created_at.strftime("%Y-%m-%d") if p.created_at else "1970-01-01",
                fuente=p.fuente_origen or "MANUAL",
                estado=p.estado_validacion.lower() if p.estado_validacion else "pendiente",
                doi=p.doi_codigo,
                issn=p.issn,
                volNum=p.volumen,
                revista=p.nombre_revista,
                cuartil=p.cuartil_impacto,
                grupoVinculado=grupo_vinculado
            ))

    # 2. Fetch Tesis
    if tipo in ['todos', 'tesis']:
        stmt_tes = select(Tesis, Investigador).outerjoin(
            Investigador, Tesis.dni_asesor == Investigador.dni
        )
        filters_tes = []
        if estado != 'todos':
            filters_tes.append(func.unaccent(Tesis.estado_validacion).ilike(func.unaccent(estado)))
        if indexacion != 'todas':
            filters_tes.append(func.unaccent(Tesis.fuente_origen).ilike(func.unaccent(indexacion)))
        if buscar:
            term = f"%{buscar}%"
            filters_tes.append(or_(
                func.unaccent(Tesis.titulo_tesis).ilike(func.unaccent(term)),
                func.unaccent(Tesis.autor_estudiante_texto).ilike(func.unaccent(term))
            ))
        if filters_tes:
            stmt_tes = stmt_tes.where(and_(*filters_tes))
            
        res_tes = await db.execute(stmt_tes)
        for t, inv in res_tes.all():
            investigadores_vinculados = []
            if inv:
                investigadores_vinculados.append(
                    InvestigadorVinculado(
                        investigador=InvestigadorResumen(
                            id=inv.dni,
                            nombre=f"{inv.nombres} {inv.apellidos}",
                            dni=inv.dni,
                            departamento=inv.departamento_academico
                        ),
                        rol="Asesor"
                    )
                )
            resultados.append(RegistroProduccionResponse(
                id=encode_tesis_id(t.url_cybertesis),
                tipo="tesis",
                titulo=t.titulo_tesis,
                autores=t.asesor_texto if t.asesor_texto else "Asesor no detectado",
                fecha=t.created_at.strftime("%Y-%m-%d") if t.created_at else "1970-01-01",
                fuente=t.fuente_origen or "CYBERTESIS",
                estado=t.estado_validacion.lower() if t.estado_validacion else "pendiente",
                tipoTesis=t.tipo_trabajo,
                urlCybertesis=t.url_cybertesis,
                tesista=t.autor_estudiante_texto,
                investigadoresVinculados=investigadores_vinculados
            ))

    return resultados

@router.get("/producciones/{id}", response_model=RegistroProduccionResponse)
async def get_produccion(id: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if id.startswith("pub-"):
        pub_id = int(id[4:])
        stmt = select(Publicacion, GrupoInvestigacion).outerjoin(
            GrupoInvestigacion, Publicacion.id_grupo == GrupoInvestigacion.id_grupo
        ).where(Publicacion.id_publicacion == pub_id)
        res = await db.execute(stmt)
        row = res.first()
        if not row:
            raise HTTPException(status_code=404, detail="Publicacion no encontrada")
        p, g = row
        grupo_vinculado = None
        if g:
            grupo_vinculado = GrupoInvestigacionResumen(
                id=g.id_grupo,
                nombre=g.nombre_grupo,
                siglas=g.siglas,
                facultad=g.facultad
            )
        return RegistroProduccionResponse(
            id=id,
            tipo="articulo",
            titulo=p.titulo_articulo,
            autores=g.nombre_grupo if g else "Grupo no vinculado",
            fecha=p.created_at.strftime("%Y-%m-%d") if p.created_at else "1970-01-01",
            fuente=p.fuente_origen or "MANUAL",
            estado=p.estado_validacion.lower() if p.estado_validacion else "pendiente",
            doi=p.doi_codigo,
            issn=p.issn,
            volNum=p.volumen,
            revista=p.nombre_revista,
            cuartil=p.cuartil_impacto,
            grupoVinculado=grupo_vinculado
        )
    elif id.startswith("tes-"):
        url = decode_tesis_id(id)
        stmt = select(Tesis, Investigador).outerjoin(
            Investigador, Tesis.dni_asesor == Investigador.dni
        ).where(Tesis.url_cybertesis == url)
        res = await db.execute(stmt)
        row = res.first()
        if not row:
            from app.core.cache import cache_get
            cache_key = f"cybertesis:item:{id}"
            cached_data = None
            try:
                cached_data = await cache_get(cache_key)
            except Exception as cache_err:
                logger.error(f"Error consultando cache para tesis {id}: {cache_err}")
                
            if cached_data:
                return RegistroProduccionResponse(
                    id=id,
                    tipo="tesis",
                    titulo=cached_data.get("titulo_tesis"),
                    autores=cached_data.get("asesor_texto") or "Asesor no detectado",
                    fecha=f"{cached_data.get('anio_publicacion')}-01-01" if cached_data.get("anio_publicacion") else "1970-01-01",
                    fuente="CYBERTESIS",
                    estado="pendiente",
                    isExternal=True,
                    tipoTesis=cached_data.get("tipo_trabajo"),
                    urlCybertesis=cached_data.get("url_cybertesis"),
                    tesista=cached_data.get("autor_estudiante_texto"),
                    investigadoresVinculados=[]
                )
            raise HTTPException(status_code=404, detail="Tesis no encontrada")
        t, inv = row
        investigadores_vinculados = []
        if inv:
            investigadores_vinculados.append(
                InvestigadorVinculado(
                    investigador=InvestigadorResumen(
                        id=inv.dni,
                        nombre=f"{inv.nombres} {inv.apellidos}",
                        dni=inv.dni,
                        departamento=inv.departamento_academico
                    ),
                    rol="Asesor"
                )
            )
        return RegistroProduccionResponse(
            id=id,
            tipo="tesis",
            titulo=t.titulo_tesis,
            autores=t.asesor_texto if t.asesor_texto else "Asesor no detectado",
            fecha=t.created_at.strftime("%Y-%m-%d") if t.created_at else "1970-01-01",
            fuente=t.fuente_origen or "CYBERTESIS",
            estado=t.estado_validacion.lower() if t.estado_validacion else "pendiente",
            tipoTesis=t.tipo_trabajo,
            urlCybertesis=t.url_cybertesis,
            tesista=t.autor_estudiante_texto,
            investigadoresVinculados=investigadores_vinculados
        )
    raise HTTPException(status_code=400, detail="Formato de ID inválido")

@router.post("/producciones/{id}/confirmar", response_model=RegistroProduccionResponse)
async def confirmar_produccion(id: str, payload: ConfirmarPayload, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if id != payload.id:
        raise HTTPException(status_code=400, detail="ID en path y body no coinciden")
        
    if id.startswith("pub-"):
        pub_id = int(id[4:])
        p = await db.get(Publicacion, pub_id)
        if not p:
            raise HTTPException(status_code=404, detail="Publicacion no encontrada")
            
        if payload.id_grupo:
            p.id_grupo = payload.id_grupo
            p.estado_validacion = "validado"
        if payload.doi: p.doi_codigo = payload.doi
        if payload.issn: p.issn = payload.issn
        if payload.volNum: p.volumen = payload.volNum
        if payload.revista: p.nombre_revista = payload.revista
        if payload.cuartil: p.cuartil_impacto = payload.cuartil
        
        await db.commit()
        await log_audit_event(db, "UPDATE", "publicacion", str(pub_id), None, {"estado_validacion": "Validado"}, current_user.get("sub"))
        return await get_produccion(id, db, current_user)
        
    elif id.startswith("tes-"):
        url = decode_tesis_id(id)
        t = await db.get(Tesis, url)
        if not t:
            raise HTTPException(status_code=404, detail="Tesis no encontrada")
            
        t.estado_validacion = "validado"
        asesor = next((i for i in payload.investigadoresVinculados if i.rol.lower() == 'asesor'), None)
        if asesor:
            t.dni_asesor = asesor.investigadorId
            
        await db.commit()
        await log_audit_event(db, "UPDATE", "tesis", url, None, {"estado_validacion": "Validado"}, current_user.get("sub"))
        return await get_produccion(id, db, current_user)
        
    raise HTTPException(status_code=400, detail="Formato de ID inválido")

@router.get("/validar-doi", response_model=ValidarDoiResponse)
async def validar_doi(doi: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Publicacion).where(Publicacion.doi_codigo == doi)
    res = await db.execute(stmt)
    p = res.scalars().first()
    
    if p:
        return ValidarDoiResponse(duplicado=True, existenteId=f"pub-{p.id_publicacion}")
    return ValidarDoiResponse(duplicado=False)

@router.get("/grupos-investigacion", response_model=List[GrupoInvestigacionResumen])
async def list_grupos_investigacion(
    query: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(GrupoInvestigacion).where(GrupoInvestigacion.estado_grupo == 'Activo')
    if query:
        term = f"%{query}%"
        stmt = stmt.where(or_(
            func.unaccent(GrupoInvestigacion.nombre_grupo).ilike(func.unaccent(term)),
            func.unaccent(GrupoInvestigacion.siglas).ilike(func.unaccent(term))
        ))
    res = await db.execute(stmt)
    resultados = []
    for g in res.scalars().all():
        resultados.append(GrupoInvestigacionResumen(
            id=g.id_grupo,
            nombre=g.nombre_grupo,
            siglas=g.siglas,
            facultad=g.facultad
        ))
    return resultados
