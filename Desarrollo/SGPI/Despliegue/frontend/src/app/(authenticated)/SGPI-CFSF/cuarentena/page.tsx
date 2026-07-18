'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import { PageHeader } from '@/SGPI-CFU/components/shared';
import { Button, Toast } from '@/SGPI-CFU/components/ui';
import { syncService, type QuarantineItem, type QuarantineListData, type RelatedQuarantineTesis } from '@/SGPI-CFU/lib/services/syncService';
import { ApiClientError } from '@/SGPI-CFU/lib/api/client';

export default function CuarentenaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<QuarantineListData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
  
  const [confirmMassResolve, setConfirmMassResolve] = useState<{
    id: number;
    dni: string;
    asesor: string;
    count: number;
    relatedItems: RelatedQuarantineTesis[];
  } | null>(null);

  const [toast, setToast] = useState<{
    title: string;
    description?: string;
    variant: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const showToastMessage = useCallback((title: string, description?: string, variant: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setToast({ title, description, variant });
  }, []);

  // Auto-cierra el Toast después de 4s
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Cierra el modal con tecla Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalItem) {
        setModalItem(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalItem]);

  const handleResolve = async (id: number, action: 'aprobar' | 'rechazar', requireDni: boolean, massResolve: boolean = false) => {
    const dni = dniMap[id];
    if (action === 'aprobar' && requireDni && !dni) {
      showToastMessage('Error de Validación', 'Debes ingresar un DNI válido para aprobar esta tesis.', 'error');
      return;
    }

    setResolvingId(id);
    try {
      await syncService.resolveQuarantine(id, {
        action,
        dni_corregido: action === 'aprobar' && requireDni ? dni : undefined,
        resolucion_masiva: massResolve,
      });
      showToastMessage(
        'Acción completada',
        action === 'aprobar' 
          ? 'El registro ha sido aprobado e integrado correctamente.' 
          : 'El registro ha sido rechazado correctamente.',
        'success'
      );
      await fetchList();
    } catch (e) {
      showToastMessage('Error', e instanceof ApiClientError ? e.message : 'Error al procesar la acción.', 'error');
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
                              <div className="flex flex-col gap-1.5">
                                {!!item.datos_conflicto?.asesor_texto && (
                                  <div className="text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                    <span className="font-semibold">Asesor:</span> {String(item.datos_conflicto.asesor_texto)}
                                  </div>
                                )}
                                <input
                                  type="text"
                                  placeholder="DNI del asesor"
                                  className="h-8 px-2 text-[12px] border border-slate-300 rounded"
                                  value={dniMap[item.id_pendiente] || ''}
                                  onChange={(e) => setDniMap(prev => ({ ...prev, [item.id_pendiente]: e.target.value }))}
                                />
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                loading={resolvingId === item.id_pendiente}
                                onClick={() => handleResolve(item.id_pendiente, 'aprobar', isTesis, false)}
                              >
                                Aprobar
                              </Button>
                              {isTesis && item.related_count !== undefined && item.related_count > 0 && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                  loading={resolvingId === item.id_pendiente}
                                  onClick={() => {
                                    const dni = dniMap[item.id_pendiente];
                                    if (!dni) {
                                      showToastMessage('Error de Validación', 'Debes ingresar un DNI válido para aprobar esta tesis.', 'error');
                                      return;
                                    }
                                    setConfirmMassResolve({
                                      id: item.id_pendiente,
                                      dni: dni,
                                      asesor: String(item.datos_conflicto?.asesor_texto || 'Desconocido'),
                                      count: item.related_count || 0,
                                      relatedItems: item.related_items || []
                                    });
                                  }}
                                >
                                  Resolución Masiva {`(+${item.related_count})`}
                                </Button>
                              )}
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={resolvingId === item.id_pendiente}
                                onClick={() => handleResolve(item.id_pendiente, 'rechazar', false, false)}
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
      {mounted && modalItem && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black bg-opacity-50 p-4">
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
        </div>,
        document.body
      )}

      {/* Modal de Confirmación de Resolución Masiva */}
      {mounted && confirmMassResolve && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded shadow-xl max-w-lg w-full p-6 flex flex-col border border-slate-200">
            <h3 className="font-bold text-lg text-slate-800 mb-2">Confirmación de Resolución Masiva</h3>
            <div className="text-[13px] text-slate-600 mb-4 leading-relaxed flex flex-col gap-3">
              <p>
                Se han encontrado <span className="font-bold text-indigo-600">{confirmMassResolve.count} tesis adicionales</span> en cuarentena asociadas al asesor &ldquo;<span className="font-semibold">{confirmMassResolve.asesor}</span>&rdquo;.
              </p>
              
              <div className="bg-slate-50 border border-slate-200 rounded p-3 max-h-[180px] overflow-y-auto">
                <span className="font-semibold text-slate-700 block mb-1 text-[12px]">Tesis afectadas que se aprobarán:</span>
                <ul className="list-disc pl-5 space-y-1 text-[12px] text-slate-600">
                  {confirmMassResolve.relatedItems.map((tesis, i) => (
                    <li key={tesis.id_pendiente || i}>
                      <span className="font-medium text-slate-800">&ldquo;{tesis.titulo_tesis}&rdquo;</span>
                      <span className="text-slate-400 font-sans text-[11px] block">Estudiante/Autor: {tesis.autor}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p>
                Si apruebas este registro con el DNI <span className="font-mono font-semibold bg-slate-100 px-1 py-0.5 rounded">{confirmMassResolve.dni}</span>, las otras tesis también se actualizarán y aprobarán de forma automática. ¿Deseas continuar?
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <Button variant="secondary" onClick={() => setConfirmMassResolve(null)}>Cancelar</Button>
              <Button 
                variant="primary" 
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => {
                  handleResolve(confirmMassResolve.id, 'aprobar', true, true);
                  setConfirmMassResolve(null);
                }}
              >
                Confirmar y Aprobar
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast de éxito/error (centrado en la pantalla con estilos inline para evitar interferencias de layout o compilación) */}
      {mounted && toast && createPortal(
        <div
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
          }}
          className="shadow-2xl animate-fade-in"
        >
          <Toast
            variant={toast.variant}
            title={toast.title}
            description={toast.description}
          />
        </div>,
        document.body
      )}
    </MainLayout>
  );
}
