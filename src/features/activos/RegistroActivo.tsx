import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Laptop, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Building2, 
  Hash, 
  CheckCircle, 
  Trash2, 
  Boxes, 
  UserCheck, 
  MapPin, 
  Navigation, 
  RotateCw, 
  ShieldCheck, 
  AlertCircle, 
  Lock,
  Clock,
  CreditCard,
  Briefcase,
  FileQuestion,
  Search,
  Wifi,
  Wrench,
  X,
  ChevronRight,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '../../config/supabase';
import { useGeocerca } from '../../hooks/useGeocerca';
import LectorSerialCamara from './LectorSerialCamara';
import type { Sede } from '../../types/database';
import { generateUUID } from '../../utils/uuid';
import { ZONA_HORARIA_COLOMBIA } from '../../utils/fechasColombia';
import './RegistroActivo.css';

export type TipoMovimiento = 'entrada' | 'salida';

export type TipologiaActivo = string;

export interface CatalogoTipologia {
  id: string;
  numero: number;
  nombre: string;
  subtitulo: string;
  ejemplos: string;
  iconoClave: 'computo' | 'telecom' | 'mobiliario' | 'herramientas' | 'otro';
  colorIcono: string;
  fondoIcono: string;
  bordeIcono: string;
  subelementos: string[];
}

export const CATALOGO_TIPOLOGIAS: CatalogoTipologia[] = [
  {
    id: 'computo',
    numero: 1,
    nombre: 'Equipos de cómputo y tecnología',
    subtitulo: 'Computadores, periféricos y equipos de oficina tecnológica.',
    ejemplos: 'Portátiles, computadores de escritorio, monitores, impresoras, escáneres, teclados, mouse, UPS, servidores, discos externos y otros periféricos.',
    iconoClave: 'computo',
    colorIcono: '#2563eb',
    fondoIcono: '#eff6ff',
    bordeIcono: '#bfdbfe',
    subelementos: [
      'Portátil / Laptop',
      'Computador de Escritorio (PC)',
      'Monitor / Pantalla',
      'Impresora / Escáner',
      'Servidor / Equipo de Rack',
      'UPS / Regulador de Voltaje',
      'Disco Externo / Almacenamiento',
      'Teclado / Mouse / Accesorios',
      'Otro de Cómputo'
    ]
  },
  {
    id: 'telecom',
    numero: 2,
    nombre: 'Equipos de telecomunicaciones',
    subtitulo: 'Infraestructura activa y pasiva utilizada en la operación.',
    ejemplos: 'Routers, switches, OLT, ONT, radios de microondas, equipos de transmisión, tarjetas, módulos, fuentes, rectificadores, equipos de acceso y otros equipos de red.',
    iconoClave: 'telecom',
    colorIcono: '#0d9488',
    fondoIcono: '#f0fdfa',
    bordeIcono: '#99f6e4',
    subelementos: [
      'Router / Enrutador',
      'Switch / Conmutador',
      'OLT / ONT (Fibra Óptica)',
      'Radio de Microondas',
      'Equipo de Transmisión',
      'Tarjeta / Módulo de Red',
      'Fuente / Rectificador de Poder',
      'Antena / Equipo de Acceso',
      'Otro de Telecomunicaciones'
    ]
  },
  {
    id: 'mobiliario',
    numero: 3,
    nombre: 'Mobiliario y elementos de oficina',
    subtitulo: 'Bienes físicos utilizados en oficinas, salas técnicas y sedes.',
    ejemplos: 'Escritorios, sillas, archivadores, mesas, estanterías, gabinetes, aires acondicionados, televisores, neveras y demás mobiliario o electrodomésticos.',
    iconoClave: 'mobiliario',
    colorIcono: '#9333ea',
    fondoIcono: '#faf5ff',
    bordeIcono: '#e9d5ff',
    subelementos: [
      'Escritorio / Puesto de Trabajo',
      'Silla Ergonómica / Operativa',
      'Archivador / Gabinete Metálico',
      'Mesa de Reuniones / Estantería',
      'Aire Acondicionado',
      'Televisor / Monitor de Sala',
      'Nevera / Dispensador / Electrodoméstico',
      'Otro Mobiliario'
    ]
  },
  {
    id: 'herramientas',
    numero: 4,
    nombre: 'Herramientas y equipos técnicos / de planta',
    subtitulo: 'Equipos de trabajo en campo y mantenimiento de infraestructura.',
    ejemplos: 'Fusionadoras de fibra, reflectómetros OTDR, medidores ópticos, taladros, escaleras dieléctricas, plantas eléctricas y herramientas manuales.',
    iconoClave: 'herramientas',
    colorIcono: '#ea580c',
    fondoIcono: '#fff7ed',
    bordeIcono: '#fed7aa',
    subelementos: [
      'Fusionadora de Fibra Óptica',
      'OTDR / Medidor Óptico / Power Meter',
      'Escalera Dieléctrica',
      'Taladro / Herramienta Eléctrica',
      'Planta Eléctrica / Generador',
      'Caja de Herramientas Manuales',
      'Otro Equipo Técnico'
    ]
  },
  {
    id: 'otro',
    numero: 5,
    nombre: 'Otro Activo / Elemento Particular',
    subtitulo: 'Bienes o elementos especiales no clasificados previamente.',
    ejemplos: 'Equipos de seguridad física, dotación, elementos de protección personal, repuestos o activos varios.',
    iconoClave: 'otro',
    colorIcono: '#64748b',
    fondoIcono: '#f8fafc',
    bordeIcono: '#cbd5e1',
    subelementos: [
      'Equipo de Seguridad / CCTV / Control Acceso',
      'Elemento de Protección Personal (EPP)',
      'Repuesto / Accesorio de Instalación',
      'Activo Particular / No Especificado'
    ]
  }
];

export interface RegistroActivoItem {
  id: string;
  tipo_movimiento: TipoMovimiento;
  sede_id: string;
  sede_nombre: string;
  responsable: string;
  cedula: string;
  empresa: string;
  tipologia: TipologiaActivo;
  serial: string;
  motivo_ingreso: string;
  motivo_salida?: string;
  fecha_hora: string;
  fecha_hora_salida?: string;
  estado_ciclo: 'en_sede' | 'salido';
  foto_url?: string;
}

const CLAVE_STORAGE_ACTIVOS = 'minutas_control_activos_local';

/**
 * Formatea un número agregando puntos como separador de miles en tiempo real.
 * Ejemplo: "1000" -> "1.000", "1045678901" -> "1.045.678.901"
 */
export function formatearCedulaMiles(valor: string): string {
  const soloDigitos = valor.replace(/\D/g, '');
  if (!soloDigitos) return '';
  return soloDigitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export default function RegistroActivo() {
  const navigate = useNavigate();

  // Estados de navegación y sede
  const [tipo_movimiento, setTipo_movimiento] = useState<TipoMovimiento>('entrada');
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sede_id, setSede_id] = useState('');

  // Hook de Geocerca GPS Satelital
  const geocerca = useGeocerca(sedes);

  // Auto-fijar la sede si la geocerca satelital confirma presencia física en el puesto
  useEffect(() => {
    if (geocerca.sedeAutorizada) {
      setSede_id(geocerca.sedeAutorizada.id);
    } else {
      setSede_id('');
    }
  }, [geocerca.sedeAutorizada]);

  // Campos del formulario
  const [responsable, setResponsable] = useState('');
  const [cedula, setCedula] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [tipologia, setTipologia] = useState<TipologiaActivo>('');
  const [mostrarBottomSheet, setMostrarBottomSheet] = useState(false);
  const [serial, setSerial] = useState('');
  const [motivo_ingreso, setMotivo_ingreso] = useState('');
  const [motivo_salida, setMotivo_salida] = useState('');
  const [foto_url, setFoto_url] = useState<string>('');

  // Categoría actual seleccionada del catálogo (undefined si no ha seleccionado)
  const categoriaActual = CATALOGO_TIPOLOGIAS.find(c => c.nombre === tipologia);

  // Helper para renderizar los iconos temáticos del catálogo
  const renderizarIconoTipologia = (clave: string, size = 20, color?: string) => {
    switch (clave) {
      case 'computo':
        return <Laptop size={size} color={color || '#2563eb'} />;
      case 'telecom':
        return <Wifi size={size} color={color || '#0d9488'} />;
      case 'mobiliario':
        return <Boxes size={size} color={color || '#9333ea'} />;
      case 'herramientas':
        return <Wrench size={size} color={color || '#ea580c'} />;
      default:
        return <Layers size={size} color={color || '#64748b'} />;
    }
  };

  // Estados de interfaz y lista local
  const [registros, setRegistros] = useState<RegistroActivoItem[]>([]);
  const [mensaje_exito, setMensaje_exito] = useState('');
  const [error_formulario, setError_formulario] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Cargar sedes e historial local inicial
  useEffect(() => {
    async function cargar_datos() {
      try {
        const { data } = await supabase.from('sedes').select('*').order('nombre');
        if (data && data.length > 0) {
          setSedes(data as Sede[]);
        } else {
          // Fallback sedes locales si está offline
          const sedes_locales: Sede[] = [
            { id: '1', nombre: 'Sede Principal Bogotá' },
            { id: '2', nombre: 'Centro Operativo Medellín' },
            { id: '3', nombre: 'Sede Cali' },
            { id: '4', nombre: 'Sede Barranquilla' }
          ];
          setSedes(sedes_locales);
        }
      } catch (err) {
        console.error('Error al cargar sedes:', err);
      }

      // Cargar registros locales
      try {
        const guardados = localStorage.getItem(CLAVE_STORAGE_ACTIVOS);
        if (guardados) {
          setRegistros(JSON.parse(guardados));
        }
      } catch (e) {
        console.error('Error al cargar historial local de activos:', e);
      }
    }

    cargar_datos();
  }, []);

  // Guardar en localStorage cuando cambian los registros
  const actualizar_registros_locales = (nuevos: RegistroActivoItem[]) => {
    setRegistros(nuevos);
    try {
      localStorage.setItem(CLAVE_STORAGE_ACTIVOS, JSON.stringify(nuevos));
    } catch (e) {
      console.error('Error al persistir en localStorage:', e);
    }
  };

  // Manejar cambio en el campo de cédula con formateo automático de miles
  const manejar_cambio_cedula = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formateado = formatearCedulaMiles(e.target.value);
    setCedula(formateado);
  };

  // Callback cuando la cámara / OCR detecta un serial
  const manejar_serial_detectado = (serial_extraido: string, _foto?: File, url_foto?: string) => {
    if (serial_extraido) {
      setSerial(serial_extraido.toUpperCase());
    }
    if (url_foto) {
      setFoto_url(url_foto);
    }
  };

  // Activo localizado en salida
  const serial_busqueda = serial.trim().toUpperCase();
  const activo_encontrado_salida = (tipo_movimiento === 'salida' && serial_busqueda && sede_id)
    ? registros.find(r => 
        r.sede_id === sede_id && 
        r.serial.trim().toUpperCase() === serial_busqueda && 
        (r.estado_ciclo === 'en_sede' || (!r.estado_ciclo && r.tipo_movimiento === 'entrada'))
      )
    : null;

  // Manejar guardado de ENTRADA
  const manejar_guardar_entrada = (e: React.FormEvent) => {
    e.preventDefault();
    setError_formulario('');
    setMensaje_exito('');

    // Validación de Geocerca GPS
    if (!geocerca.estaDentroGeocerca || !geocerca.sedeAutorizada || !sede_id) {
      setError_formulario('Acceso Denegado: Su dispositivo debe encontrarse físicamente en la sede autorizada.');
      return;
    }

    const responsable_limpio = responsable.trim();
    const cedula_limpia = cedula.replace(/\D/g, '');
    const empresa_limpia = empresa.trim();
    const serial_limpio = serial.trim().toUpperCase();
    const motivo_limpio = motivo_ingreso.trim();

    if (!responsable_limpio) {
      setError_formulario('Por favor indique el nombre de la persona responsable del ingreso.');
      return;
    }

    if (!cedula_limpia || cedula_limpia.length < 4) {
      setError_formulario('Por favor ingrese un número de cédula válido.');
      return;
    }

    if (!empresa_limpia) {
      setError_formulario('Por favor indique la empresa a la que pertenece la persona.');
      return;
    }

    if (!tipologia) {
      setError_formulario('Por favor seleccione la tipología del activo.');
      return;
    }

    if (!serial_limpio) {
      setError_formulario('Por favor escanee o escriba el serial del equipo.');
      return;
    }

    if (!motivo_limpio) {
      setError_formulario('Por favor indique el motivo del ingreso del equipo.');
      return;
    }

    setGuardando(true);

    const sede_encontrada = sedes.find(s => s.id === sede_id);
    const nombre_sede = sede_encontrada ? sede_encontrada.nombre : 'Sede General';

    const nuevo_registro: RegistroActivoItem = {
      id: generateUUID(),
      tipo_movimiento: 'entrada',
      sede_id,
      sede_nombre: nombre_sede,
      responsable: responsable_limpio,
      cedula: cedula_limpia,
      empresa: empresa_limpia,
      tipologia,
      serial: serial_limpio,
      motivo_ingreso: motivo_limpio,
      fecha_hora: new Date().toLocaleString('es-CO', { 
        timeZone: ZONA_HORARIA_COLOMBIA,
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit'
      }),
      estado_ciclo: 'en_sede',
      foto_url
    };

    const nueva_lista = [nuevo_registro, ...registros];
    actualizar_registros_locales(nueva_lista);

    setMensaje_exito(`¡Entrada registrada con éxito para ${responsable_limpio} (Serial: ${nuevo_registro.serial})!`);
    
    // Limpiar campos para el siguiente registro
    setResponsable('');
    setCedula('');
    setEmpresa('');
    setTipologia('');
    setSerial('');
    setMotivo_ingreso('');
    setFoto_url('');
    setGuardando(false);

    setTimeout(() => {
      setMensaje_exito('');
    }, 4500);
  };

  // Manejar guardado de SALIDA
  const manejar_guardar_salida = (e: React.FormEvent) => {
    e.preventDefault();
    setError_formulario('');
    setMensaje_exito('');

    // Validación de Geocerca GPS
    if (!geocerca.estaDentroGeocerca || !geocerca.sedeAutorizada || !sede_id) {
      setError_formulario('Acceso Denegado: Su dispositivo debe encontrarse físicamente en la sede autorizada.');
      return;
    }

    if (!activo_encontrado_salida) {
      setError_formulario('No se puede registrar salida: el activo no fue localizado en el inventario actual de esta sede.');
      return;
    }

    const motivo_salida_limpio = motivo_salida.trim();
    if (!motivo_salida_limpio) {
      setError_formulario('Por favor indique el motivo de salida del equipo.');
      return;
    }

    setGuardando(true);

    const fecha_salida_ahora = new Date().toLocaleString('es-CO', { 
      timeZone: ZONA_HORARIA_COLOMBIA,
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    });

    const lista_actualizada = registros.map(r => {
      if (r.id === activo_encontrado_salida.id) {
        return {
          ...r,
          tipo_movimiento: 'salida' as TipoMovimiento,
          estado_ciclo: 'salido' as const,
          fecha_hora_salida: fecha_salida_ahora,
          motivo_salida: motivo_salida_limpio
        };
      }
      return r;
    });

    actualizar_registros_locales(lista_actualizada);

    setMensaje_exito(`¡Salida registrada con éxito! El activo ${activo_encontrado_salida.serial} ha sido marcado como retirado de la sede.`);

    // Limpiar campos de salida
    setSerial('');
    setMotivo_salida('');
    setGuardando(false);

    setTimeout(() => {
      setMensaje_exito('');
    }, 4500);
  };

  const eliminar_registro_prueba = (id: string) => {
    const filtrados = registros.filter(r => r.id !== id);
    actualizar_registros_locales(filtrados);
  };

  // Métricas calculadas para la sede seleccionada
  const registros_sede = registros.filter(r => r.sede_id === sede_id);
  const total_en_sede = registros_sede.filter(r => r.estado_ciclo === 'en_sede' || (!r.estado_ciclo && r.tipo_movimiento === 'entrada')).length;
  const total_salidos = registros_sede.filter(r => r.estado_ciclo === 'salido').length;
  const total_movimientos = registros_sede.length;

  return (
    <div className="registro-activos-page">
      {/* Barra superior de navegación */}
      <header className="registro-activos-header">
        <button className="btn-volver" onClick={() => navigate('/')} title="Volver al inicio">
          <ArrowLeft size={20} />
        </button>
        <div className="header-titulos">
          <h1 className="header-titulo">Control de Entrada y Salida de Activos</h1>
          <span className="header-subtitulo">Validación satelital y lectura de serial en vivo</span>
        </div>
      </header>

      <main className="registro-activos-contenedor">
        {/* Notificación de éxito */}
        {mensaje_exito && (
          <div className="notificacion-exito">
            <CheckCircle size={20} />
            <span>{mensaje_exito}</span>
          </div>
        )}

        {/* Notificación de error */}
        {error_formulario && (
          <div style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#b91c1c', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: 600 }}>
            {error_formulario}
          </div>
        )}

        {/* Selector de Movimiento: Entrada / Salida */}
        <div className="movimiento-toggle-contenedor">
          <button
            type="button"
            className={`btn-toggle-movimiento ${tipo_movimiento === 'entrada' ? 'activo-entrada' : ''}`}
            onClick={() => {
              setTipo_movimiento('entrada');
              setError_formulario('');
            }}
          >
            <ArrowDownLeft size={20} />
            <span>🟢 Entrada a Sede</span>
          </button>
          <button
            type="button"
            className={`btn-toggle-movimiento ${tipo_movimiento === 'salida' ? 'activo-salida' : ''}`}
            onClick={() => {
              setTipo_movimiento('salida');
              setError_formulario('');
            }}
          >
            <ArrowUpRight size={20} />
            <span>🔴 Salida de Sede</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* FORMULARIO DE ENTRADA                                         */}
        {/* ============================================================ */}
        {tipo_movimiento === 'entrada' ? (
          <form onSubmit={manejar_guardar_entrada} className="formulario-card">
            {/* 1. Banner de Fecha y Hora en tiempo real */}
            <div className="datetime-display">
              <Clock size={20} color="#64748b" />
              <span>
                {new Date().toLocaleString('es-CO', {
                  timeZone: ZONA_HORARIA_COLOMBIA,
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                })}
              </span>
            </div>

            {/* 2. Sede de la Operación (Geocerca Satelital) */}
            <div className="form-grupo">
              <label className="form-label">
                <Building2 size={16} color="#da2d34" />
                <span>Sede de la Operación <span className="requerido">*</span></span>
              </label>

              {/* Estado Geocerca: Éxito (Sede detectada y autorizada) */}
              {geocerca.estaDentroGeocerca && geocerca.sedeAutorizada ? (
                <div className="geocerca-panel geocerca-exito">
                  <div className="geocerca-cabecera">
                    <div className="geocerca-icono-titulo">
                      <ShieldCheck size={18} color="#16a34a" />
                      <span>Sede Confirmada por GPS Satelital</span>
                    </div>
                    <button
                      type="button"
                      onClick={geocerca.actualizarUbicacion}
                      className="btn-gps-recargar"
                      title="Actualizar señal GPS"
                      disabled={geocerca.cargandoUbicacion}
                    >
                      <RotateCw size={13} style={{ animation: geocerca.cargandoUbicacion ? 'spin 1s linear infinite' : 'none' }} />
                      <span>{geocerca.cargandoUbicacion ? 'Actualizando...' : 'Actualizar'}</span>
                    </button>
                  </div>
                  <div className="geocerca-cuerpo">
                    <span className="geocerca-sede-nombre">{geocerca.sedeAutorizada.nombre}</span>
                    <div className="geocerca-detalles">
                      <span className="geocerca-pill">
                        <Navigation size={12} />
                        A {geocerca.distanciaMetros ?? 0}m del punto central
                      </span>
                      {geocerca.coordenadas?.precision && (
                        <span className="geocerca-pill">
                          Precisión: ±{geocerca.coordenadas.precision}m
                        </span>
                      )}
                      <span className="geocerca-pill bloqueo">
                        <Lock size={12} />
                        Solo Lectura (Fijada por GPS)
                      </span>
                    </div>
                  </div>
                </div>
              ) : geocerca.cargandoUbicacion ? (
                /* Estado Geocerca: Obteniendo señal */
                <div className="geocerca-panel geocerca-cargando">
                  <div className="geocerca-cabecera">
                    <div className="geocerca-icono-titulo">
                      <MapPin size={18} className="geocerca-animacion-pulso" color="#2563eb" />
                      <span>Detectando puesto por GPS del dispositivo...</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Alineando coordenadas con las sedes registradas para control de activos.
                  </span>
                </div>
              ) : (
                /* Estado Geocerca: Fuera de rango o sin señal GPS */
                <div className="geocerca-panel geocerca-alerta">
                  <div className="geocerca-cabecera">
                    <div className="geocerca-icono-titulo">
                      <AlertCircle size={18} color="#dc2626" />
                      <span>
                        {geocerca.errorGps
                          ? 'Señal GPS no disponible'
                          : 'Dispositivo fuera de geocerca autorizada'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={geocerca.actualizarUbicacion}
                      className="btn-gps-recargar"
                      title="Reintentar señal GPS"
                    >
                      <RotateCw size={13} />
                      <span>Reintentar GPS</span>
                    </button>
                  </div>
                  <div className="geocerca-cuerpo">
                    <span className="geocerca-mensaje-error">
                      {geocerca.errorGps ?? (
                        <>
                          No se detecta presencia física dentro del radio de 150m de ninguna sede autorizada.
                          {geocerca.sedeMasCercana && (
                            <> Sede más cercana: <strong>{geocerca.sedeMasCercana.nombre}</strong> (a {geocerca.distanciaMetros}m).</>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Si no está confirmada por GPS, no se permite selección manual */}
              {(!geocerca.estaDentroGeocerca || !geocerca.sedeAutorizada) && (
                <span style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  ⛔ Por seguridad, no está permitido seleccionar la sede manualmente ni registrar movimientos fuera del puesto de vigilancia.
                </span>
              )}
            </div>

            {/* 3. Persona Responsable del Ingreso */}
            <div className="form-grupo">
              <label className="form-label">
                <UserCheck size={16} color="#da2d34" />
                <span>Persona Responsable del Ingreso <span className="requerido">*</span></span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Nombre y apellido completo"
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                onBlur={() => setResponsable(prev => prev.trim())}
                required
              />
            </div>

            {/* 4. Cédula de la Persona (Formato con miles en vivo) */}
            <div className="form-grupo">
              <label className="form-label">
                <CreditCard size={16} color="#da2d34" />
                <span>Cédula de la Persona <span className="requerido">*</span></span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                className="form-input"
                placeholder="Ej: 1.045.678.901"
                value={cedula}
                onChange={manejar_cambio_cedula}
                required
              />
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Formato automático con puntos de miles. Se almacena solo dígitos numéricos en base de datos.
              </span>
            </div>

            {/* 5. Empresa a la que pertenece */}
            <div className="form-grupo">
              <label className="form-label">
                <Briefcase size={16} color="#da2d34" />
                <span>Empresa a la que pertenece <span className="requerido">*</span></span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej: Claro, Prosegur, Contratista..."
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                onBlur={() => setEmpresa(prev => prev.trim())}
                required
              />
            </div>

            {/* 6. Tipología del Activo (Catálogo Táctil / Bottom Sheet Móvil) */}
            <div className="form-grupo">
              <label className="form-label">
                {categoriaActual ? (
                  renderizarIconoTipologia(categoriaActual.iconoClave, 16, '#da2d34')
                ) : (
                  <Layers size={16} color="#da2d34" />
                )}
                <span>Tipología del Activo / Equipo <span className="requerido">*</span></span>
              </label>
              <div 
                className={`bottom-sheet-trigger ${!categoriaActual ? 'sin-seleccion' : ''}`}
                onClick={() => setMostrarBottomSheet(true)}
                role="button"
                tabIndex={0}
              >
                <div className="trigger-info-principal">
                  {categoriaActual ? (
                    <>
                      <div 
                        className="trigger-icono-caja" 
                        style={{ backgroundColor: categoriaActual.fondoIcono, borderColor: categoriaActual.bordeIcono }}
                      >
                        {renderizarIconoTipologia(categoriaActual.iconoClave, 22, categoriaActual.colorIcono)}
                      </div>
                      <div className="trigger-textos">
                        <span className="trigger-titulo">{categoriaActual.numero}. {categoriaActual.nombre}</span>
                        <span className="trigger-subtitulo">{categoriaActual.subtitulo}</span>
                      </div>
                    </>
                  ) : (
                    <div className="trigger-placeholder">
                      <div className="trigger-icono-caja" style={{ backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }}>
                        <Layers size={22} color="#64748b" />
                      </div>
                      <div className="trigger-textos">
                        <span className="trigger-titulo" style={{ color: '#475569', fontWeight: 600 }}>
                          Seleccione la tipología del activo...
                        </span>
                        <span className="trigger-subtitulo">
                          Toque para abrir el catálogo y ver los ejemplos admitidos
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <button 
                  type="button" 
                  className="btn-trigger-accion" 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setMostrarBottomSheet(true); 
                  }}
                >
                  <span>{categoriaActual ? 'Cambiar' : 'Explorar'}</span>
                  <ChevronRight size={16} />
                </button>
              </div>
              <span className="trigger-ayuda-texto">
                Toque el recuadro para abrir el catálogo táctil con todos los ejemplos y descripciones admitidas.
              </span>
            </div>

            {/* 7. Escáner con Cámara (Solo Cámara en vivo) */}
            <div className="form-grupo">
              <label className="form-label">
                <Hash size={16} color="#da2d34" />
                <span>Escáner de Serial con Cámara (OCR / Código de Barras)</span>
              </label>
              <LectorSerialCamara
                serial_actual={serial}
                al_detectar_serial={manejar_serial_detectado}
              />
            </div>

            {/* 8. Serial del Activo */}
            <div className="form-grupo">
              <label className="form-label">
                <Hash size={16} color="#da2d34" />
                <span>Número de Serie (Serial) <span className="requerido">*</span></span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Escriba o escanee el serial del equipo"
                value={serial}
                onChange={(e) => setSerial(e.target.value.toUpperCase())}
                required
              />
            </div>

            {/* 9. Motivo de Ingreso */}
            <div className="form-grupo">
              <label className="form-label">
                <FileQuestion size={16} color="#da2d34" />
                <span>Motivo de Ingreso del Equipo <span className="requerido">*</span></span>
              </label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Describa el motivo por el que ingresa el equipo a la sede (ej. mantenimiento, labores diarias, revisión técnica)..."
                value={motivo_ingreso}
                onChange={(e) => setMotivo_ingreso(e.target.value)}
                required
              />
            </div>

            {/* Botón Guardar Entrada */}
            <button
              type="submit"
              className="btn-guardar-registro"
              disabled={guardando || !serial.trim() || geocerca.cargandoUbicacion || !geocerca.estaDentroGeocerca || !geocerca.sedeAutorizada || !sede_id}
            >
              {geocerca.cargandoUbicacion ? (
                <span>Detectando señal GPS del puesto...</span>
              ) : !geocerca.estaDentroGeocerca || !geocerca.sedeAutorizada ? (
                <>
                  <Lock size={20} />
                  <span>Bloqueado: Fuera del Puesto de Vigilancia</span>
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  <span>Guardar Entrada de Activo</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* ============================================================ */
          /* FORMULARIO Y BÚSQUEDA INTELIGENTE DE SALIDA                  */
          /* ============================================================ */
          <div className="formulario-card">
            {/* Banner de Fecha y Hora en tiempo real */}
            <div className="datetime-display">
              <Clock size={20} color="#64748b" />
              <span>
                {new Date().toLocaleString('es-CO', {
                  timeZone: ZONA_HORARIA_COLOMBIA,
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                })}
              </span>
            </div>

            {/* Sede de la Operación (Geocerca Satelital) */}
            <div className="form-grupo">
              <label className="form-label">
                <Building2 size={16} color="#da2d34" />
                <span>Sede de la Operación <span className="requerido">*</span></span>
              </label>

              {geocerca.estaDentroGeocerca && geocerca.sedeAutorizada ? (
                <div className="geocerca-panel geocerca-exito">
                  <div className="geocerca-cabecera">
                    <div className="geocerca-icono-titulo">
                      <ShieldCheck size={18} color="#16a34a" />
                      <span>Sede Confirmada por GPS Satelital</span>
                    </div>
                    <button
                      type="button"
                      onClick={geocerca.actualizarUbicacion}
                      className="btn-gps-recargar"
                      title="Actualizar señal GPS"
                      disabled={geocerca.cargandoUbicacion}
                    >
                      <RotateCw size={13} style={{ animation: geocerca.cargandoUbicacion ? 'spin 1s linear infinite' : 'none' }} />
                      <span>{geocerca.cargandoUbicacion ? 'Actualizando...' : 'Actualizar'}</span>
                    </button>
                  </div>
                  <div className="geocerca-cuerpo">
                    <span className="geocerca-sede-nombre">{geocerca.sedeAutorizada.nombre}</span>
                    <div className="geocerca-detalles">
                      <span className="geocerca-pill">
                        <Navigation size={12} />
                        A {geocerca.distanciaMetros ?? 0}m del punto central
                      </span>
                      <span className="geocerca-pill bloqueo">
                        <Lock size={12} />
                        Solo Lectura (Fijada por GPS)
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="geocerca-panel geocerca-alerta">
                  <div className="geocerca-cabecera">
                    <div className="geocerca-icono-titulo">
                      <AlertCircle size={18} color="#dc2626" />
                      <span>Dispositivo fuera de geocerca autorizada</span>
                    </div>
                  </div>
                  <span className="geocerca-mensaje-error">
                    Para consultar y registrar salidas debe encontrarse físicamente en la sede autorizada.
                  </span>
                </div>
              )}
            </div>

            {/* Escáner de Serial con Cámara para Salida */}
            <div className="form-grupo">
              <label className="form-label">
                <Search size={16} color="#da2d34" />
                <span>Escanear o Digitar Serial para Salida <span className="requerido">*</span></span>
              </label>
              <LectorSerialCamara
                serial_actual={serial}
                al_detectar_serial={manejar_serial_detectado}
              />
            </div>

            {/* Input para digitar serial */}
            <div className="form-grupo">
              <input
                type="text"
                className="form-input"
                placeholder="Escriba el serial del equipo a retirar..."
                value={serial}
                onChange={(e) => setSerial(e.target.value.toUpperCase())}
              />
            </div>

            {/* Caso A: Activo encontrado en la sede actual */}
            {activo_encontrado_salida && (
              <div className="activo-encontrado-card">
                <div className="activo-encontrado-header">
                  <div className="activo-encontrado-titulo">
                    <CheckCircle size={18} color="#16a34a" />
                    <span>Activo Localizado en Sede</span>
                  </div>
                  <span className="geocerca-pill" style={{ background: '#dcfce7', color: '#166534', fontWeight: 700 }}>
                    Serial: {activo_encontrado_salida.serial}
                  </span>
                </div>

                <div className="activo-datos-grid">
                  <div className="activo-dato-item">
                    <span className="activo-dato-etiqueta">Responsable de Ingreso</span>
                    <span className="activo-dato-valor">{activo_encontrado_salida.responsable}</span>
                  </div>
                  <div className="activo-dato-item">
                    <span className="activo-dato-etiqueta">Cédula</span>
                    <span className="activo-dato-valor">{formatearCedulaMiles(activo_encontrado_salida.cedula)}</span>
                  </div>
                  <div className="activo-dato-item">
                    <span className="activo-dato-etiqueta">Empresa</span>
                    <span className="activo-dato-valor">{activo_encontrado_salida.empresa}</span>
                  </div>
                  <div className="activo-dato-item">
                    <span className="activo-dato-etiqueta">Tipología</span>
                    <span className="activo-dato-valor">{activo_encontrado_salida.tipologia}</span>
                  </div>
                  <div className="activo-dato-item">
                    <span className="activo-dato-etiqueta">Fecha y Hora de Ingreso</span>
                    <span className="activo-dato-valor">{activo_encontrado_salida.fecha_hora}</span>
                  </div>
                  <div className="activo-dato-item">
                    <span className="activo-dato-etiqueta">Motivo de Ingreso</span>
                    <span className="activo-dato-valor">{activo_encontrado_salida.motivo_ingreso || 'No especificado'}</span>
                  </div>
                </div>

                {/* Motivo de Salida Obligatorio */}
                <div className="form-grupo" style={{ marginTop: '8px' }}>
                  <label className="form-label" style={{ color: '#166534' }}>
                    <FileQuestion size={16} color="#16a34a" />
                    <span>Motivo de Salida del Equipo <span className="requerido">*</span></span>
                  </label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Describa el motivo por el cual sale el equipo (ej. fin de jornada laboral, devolución a proveedor, traslado)..."
                    value={motivo_salida}
                    onChange={(e) => setMotivo_salida(e.target.value)}
                    required
                  />
                </div>

                {/* Botón de Confirmación de Salida */}
                <button
                  type="button"
                  onClick={manejar_guardar_salida}
                  className="btn-guardar-registro"
                  style={{ background: '#da2d34' }}
                  disabled={guardando || !motivo_salida.trim() || !geocerca.estaDentroGeocerca || !geocerca.sedeAutorizada}
                >
                  <ArrowUpRight size={20} />
                  <span>Confirmar y Guardar Salida de Activo</span>
                </button>
              </div>
            )}

            {/* Caso B: Serial digitado pero NO encontrado en esta sede */}
            {serial_busqueda && !activo_encontrado_salida && (
              <div className="activo-alerta-busqueda">
                <AlertCircle size={18} color="#dc2626" />
                <span>
                  No se encontró ningún activo registrado en <strong>{sedes.find(s => s.id === sede_id)?.nombre || 'esta sede'}</strong> con el serial <strong>{serial_busqueda}</strong>, o el activo ya registró su salida previamente.
                </span>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* PANEL DE RESUMEN E HISTORIAL DE ACTIVOS EN SEDE              */}
        {/* ============================================================ */}
        <section className="inventario-resumen-card">
          <div className="inventario-header">
            <h2 className="inventario-titulo">
              <Boxes size={20} color="#da2d34" />
              <span>Inventario y Movimientos en Sede</span>
            </h2>
            <span style={{ fontSize: '12px', color: '#5c403e', fontWeight: 600 }}>
              {sedes.find(s => s.id === sede_id)?.nombre || 'Sede actual'}
            </span>
          </div>

          <div className="metricas-activos-grid">
            <div className="metrica-activo-caja">
              <span className="metrica-numero" style={{ color: '#16a34a' }}>{total_en_sede}</span>
              <span className="metrica-etiqueta">Activos en Sede</span>
            </div>
            <div className="metrica-activo-caja">
              <span className="metrica-numero" style={{ color: '#da2d34' }}>{total_salidos}</span>
              <span className="metrica-etiqueta">Salidas Realizadas</span>
            </div>
            <div className="metrica-activo-caja">
              <span className="metrica-numero" style={{ color: '#281716' }}>{total_movimientos}</span>
              <span className="metrica-etiqueta">Total Movimientos</span>
            </div>
          </div>

          {/* Listado de Activos Registrados en la Sede */}
          <div className="inventario-lista-contenedor">
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#281716', margin: '8px 0' }}>
              Historial de Equipos en la Sede
            </h3>

            {registros_sede.length === 0 ? (
              <div className="inventario-vacio">
                <span>No hay activos registrados en esta sede todavía.</span>
              </div>
            ) : (
              <div className="activos-items-lista">
                {registros_sede.map((item) => (
                  <div key={item.id} className="activo-item-tarjeta">
                    <div className="activo-item-header">
                      <div className="activo-item-info-principal">
                        <span className={`badge-movimiento ${item.estado_ciclo === 'salido' ? 'salida' : 'entrada'}`}>
                          {item.estado_ciclo === 'salido' ? '🔴 Salido' : '🟢 En Sede'}
                        </span>
                        <span className="activo-serial-texto">{item.serial}</span>
                      </div>
                      <button
                        className="btn-eliminar-activo"
                        onClick={() => eliminar_registro_prueba(item.id)}
                        title="Eliminar de historial"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="activo-item-detalles">
                      <span><strong>Responsable:</strong> {item.responsable} (CC: {formatearCedulaMiles(item.cedula)})</span>
                      <span><strong>Empresa:</strong> {item.empresa} • <strong>Tipo:</strong> {item.tipologia}</span>
                      <span><strong>Ingreso:</strong> {item.fecha_hora}</span>
                      {item.motivo_ingreso && (
                        <span><strong>Motivo Ingreso:</strong> {item.motivo_ingreso}</span>
                      )}
                      {item.fecha_hora_salida && (
                        <span><strong>Salida:</strong> {item.fecha_hora_salida} • <strong>Motivo:</strong> {item.motivo_salida || 'Sin motivo'}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Modal Bottom Sheet Táctil (Opción 2) */}
      {mostrarBottomSheet && (
        <div className="bottom-sheet-overlay" onClick={() => setMostrarBottomSheet(false)}>
          <div className="bottom-sheet-container" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-drag-handle" />
            <div className="bottom-sheet-header">
              <div className="bottom-sheet-titulo-wrap">
                <h3 className="bottom-sheet-titulo">Catálogo de Tipologías de Activos</h3>
                <p className="bottom-sheet-subtitulo">Toque la categoría que corresponde al equipo que está ingresando:</p>
              </div>
              <button 
                type="button" 
                className="btn-cerrar-bottom-sheet" 
                onClick={() => setMostrarBottomSheet(false)}
                title="Cerrar catálogo"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bottom-sheet-lista">
              {CATALOGO_TIPOLOGIAS.map((cat) => {
                const esActiva = tipologia === cat.nombre;
                return (
                  <div
                    key={cat.id}
                    className={`bottom-sheet-tarjeta-item ${esActiva ? 'tarjeta-activa' : ''}`}
                    onClick={() => {
                      setTipologia(cat.nombre);
                      setMostrarBottomSheet(false);
                    }}
                  >
                    <div className="tarjeta-item-cabecera">
                      <div 
                        className="tarjeta-item-icono" 
                        style={{ backgroundColor: cat.fondoIcono, borderColor: cat.bordeIcono }}
                      >
                        {renderizarIconoTipologia(cat.iconoClave, 24, cat.colorIcono)}
                      </div>
                      <div className="tarjeta-item-titulos">
                        <h4 className="tarjeta-item-nombre">{cat.numero}. {cat.nombre}</h4>
                        <p className="tarjeta-item-desc">{cat.subtitulo}</p>
                      </div>
                      {esActiva && (
                        <div className="tarjeta-item-check">
                          <CheckCircle2 size={22} color="#16a34a" />
                        </div>
                      )}
                    </div>
                    <div className="tarjeta-item-ejemplos-box">
                      <p className="tarjeta-item-ejemplos-texto">{cat.ejemplos}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
