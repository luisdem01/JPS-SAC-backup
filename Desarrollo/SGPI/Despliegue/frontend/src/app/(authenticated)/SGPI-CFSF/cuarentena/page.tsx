'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import { PageHeader } from '@/SGPI-CFU/components/shared';
import { Button } from '@/SGPI-CFU/components/ui';
import { syncService, type QuarantineItem, type QuarantineListData } from '@/SGPI-CFU/lib/services/syncService';
import { ApiClientError } from '@/SGPI-CFU/lib/api/client';

export default function CuarentenaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<QuarantineListData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtros
  const [estado, setEstado] = useState('Pendiente');
  const [entidad, setEntidad] = useState('');
  const [page, setPage] = useState(1);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await syncService.listQuarantine({ page, page_size: 20, estado, entidad: entidad || undefined });
      setData(res);
    } catch (e) {
      setErrorMsg(e instanceof ApiClientError ? e.message : 'Error al cargar la cuarentena.');
    } finally {
      setLoading(false);
    }
  }, [page, estado, entidad]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [dniMap, setDniMap] = useState<Record<number, string>>({});
  const [modalItem, setModalItem] = useState<QuarantineItem | null>(null);

  const handleResolve = async (id: number, action: 'aprobar' | 'rechazar', requireDni: boolean) => {
    const dni = dniMap[id];
    if (action === 'aprobar' && requireDni && !dni) {
      alert('Debes ingresar un DNI válido para aprobar esta tesis.');
      return;
    }

    setResolvingId(id);
    try {
      await syncService.resolveQuarantine(id, {
        action,
        dni_corregido: action === 'aprobar' && requireDni ? dni : undefined,
      });
      await fetchList();
    } catch (e) {
      alert(e instanceof ApiClientError ? e.message : 'Error al procesar la acción.');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación" subtitle="">
      <PageHeader
        title="Revisión de Cuarentena"
        description="Gestiona los registros que no pudieron ser reconciliados automáticamente (e.g. asesores no encontrados en Cybertesis)."
        actions={
          <Button
            variant="secondary"
            size="lg"
            onClick={() => router.push('/sincronizacion')}
          >
            ← Volver a Sincronización
          </Button>
        }
      />

      {errorMsg && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-sans">
          <span className="font-semibold">Error: </span>{errorMsg}
        </div>
      )}

      <div className="flex items-center gap-4 mb-4">
        <select
          className="h-9 px-3 text-[13px] border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-500"
          value={estado}
          onChange={(e) => { setEstado(e.target.value); setPage(1); }}
        >
          <option value="todos">Todos los estados</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Aprobado">Aprobado</option>
          <option value="Rechazado">Rechazado</option>
        </select>

        <select
          className="h-9 px-3 text-[13px] border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-500"
          value={entidad}
          onChange={(e) => { setEntidad(e.target.value); setPage(1); }}
        >
          <option value="">Todas las entidades</option>
          <option value="tesis">Tesis</option>
          <option value="investigador">Investigador</option>
          <option value="proyecto">Proyecto</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
        {loading && !data ? (
          <div className="p-8 text-center text-slate-500 text-sm">Cargando...</div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No se encontraron registros.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">Entidad</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">Datos Clave</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">Motivo Cuarentena</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((item) => {
                  const isTesis = item.entidad_afectada === 'tesis';
                  return (
                    <tr key={item.id_pendiente} className="hover:bg-slate-50">
                      <td className="px-4 py-3 align-top">
                        <div className="text-[13px] font-semibold text-slate-800">{item.entidad_afectada}</div>
                        <div className="text-[11px] text-slate-500 mt-1">{new Date(item.fecha_registro || '').toLocaleString('es-PE')}</div>
                        <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.estado === 'Pendiente' ? 'bg-amber-100 text-amber-700' :
                          item.estado === 'Aprobado' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {item.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-[12px] text-slate-700 max-w-[280px] overflow-hidden text-ellipsis font-mono bg-slate-50 p-2 rounded border border-slate-100 mb-2">
                          {Object.entries(item.datos_conflicto).slice(0, 3).map(([k, v]) => (
                            <div key={k} className="truncate" title={String(v)}>
                              <span className="font-bold text-slate-600">{k}:</span> {String(v)}
                            </div>
                          ))}
                          {Object.keys(item.datos_conflicto).length > 3 && (
                            <div className="text-slate-400 italic text-[10px] mt-1">
                              ... y {Object.keys(item.datos_conflicto).length - 3} campos más
                            </div>
                          )}
                        </div>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => setModalItem(item)}
                        >
                          Ver Detalles
                        </Button>
                      </td>
                      <td className="px-4 py-3 align-top text-[13px] text-red-600 max-w-[250px]">
                        {item.motivo_cuarentena}
                      </td>
                      <td className="px-4 py-3 align-top min-w-[200px]">
                        {item.estado === 'Pendiente' ? (
                          <div className="flex flex-col gap-2">
                            {isTesis && (
                              <input
                                type="text"
                                placeholder="DNI del asesor"
                                className="h-8 px-2 text-[12px] border border-slate-300 rounded"
                                value={dniMap[item.id_pendiente] || ''}
                                onChange={(e) => setDniMap(prev => ({ ...prev, [item.id_pendiente]: e.target.value }))}
                              />
                            )}
                            <div className="flex gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                loading={resolvingId === item.id_pendiente}
                                onClick={() => handleResolve(item.id_pendiente, 'aprobar', isTesis)}
                              >
                                Aprobar
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={resolvingId === item.id_pendiente}
                                onClick={() => handleResolve(item.id_pendiente, 'rechazar', false)}
                              >
                                Rechazar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[12px] text-slate-500">
                            Resuelto: {item.fecha_revision ? new Date(item.fecha_revision).toLocaleString('es-PE') : 'Fecha no registrada'}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && data.pages > 1 && (
        <div className="flex justify-center mt-6 gap-2">
          <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span className="px-4 py-1.5 text-[13px] font-semibold text-slate-700">Página {page} de {data.pages}</span>
          <Button variant="secondary" size="sm" disabled={page === data.pages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
        </div>
      )}

      {/* Modal de Detalles del Payload */}
      {modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-slate-200">
            <div className="px-5 py-3.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-semibold text-slate-800 text-[14px]">Payload Completo ({modalItem.entidad_afectada})</h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">ID Pendiente: {modalItem.id_pendiente}</p>
              </div>
              <button onClick={() => setModalItem(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1 bg-white">
              <pre className="font-mono text-[11.5px] text-slate-700 whitespace-pre-wrap break-all bg-slate-50 p-4 rounded border border-slate-200 leading-relaxed">
                {JSON.stringify(modalItem.datos_conflicto, null, 2)}
              </pre>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-end bg-slate-50">
              <Button variant="secondary" size="md" onClick={() => setModalItem(null)}>Cerrar Modal</Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
