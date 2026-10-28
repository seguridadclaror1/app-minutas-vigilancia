import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Laptop, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Building2, 
  Hash, 
  CheckCircle, 
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
  CheckCircle2,
  Sparkles,
  Save,
  Home,
  ClipboardList,
  Users,
  BarChart3,
  ChevronDown,
  Power
} from 'lucide-react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useGeocerca } from '../../hooks/useGeocerca';
import ModalConfirmarSalida from '../../components/ModalConfirmarSalida';
import LectorSerialCamara from './LectorSerialCamara';
import type { Sede } from '../../types/database';
import { generateUUID } from '../../utils/uuid';
import { ZONA_HORARIA_COLOMBIA } from '../../utils/fechasColombia';
import './RegistroActivo.css';

export type TipoMovimiento = 'entrada' | 'salida';

export type TipologiaActivo = string;

export interface CatalogoTipologia {
  id: string;
  numero: string;
  nombre: string;
  subtitulo: string;
  ejemplos: string;
  iconoClave: string;
  colorIcono: string;
  fondoIcono: string;
  bordeIcono: string;
  subelementos: string[];
}

export const CATALOGO_TIPOLOGIAS: CatalogoTipologia[] = [
  {
    id: 'computo',
    numero: '1',
    nombre: 'Equipos de Cómputo y Portátiles',
    subtitulo: 'Laptops, computadores, tablets y estaciones móviles',
    ejemplos: 'Portátil corporativo, MacBook, laptop personal de trabajo, cargador o docking station.',
    iconoClave: 'computo',
    colorIcono: '#2563eb',
    fondoIcono: '#eff6ff',
    bordeIcono: '#bfdbfe',
    subelementos: [
      'Portátil Corporativo / Laboral',
      'Portátil Personal de Trabajo',
      'Tablet / iPad de Operación',
      'Docking Station / Cargador / Monitor Portátil'
    ]
  },
  {
    id: 'telecom',
    numero: '2',
    nombre: 'Equipos de Red y Telecomunicaciones',
    subtitulo: 'Routers, switches, antenas y módems de enlace',
    ejemplos: 'Router empresarial, switch de red, módem de prueba, antena de radioenlace, transceptor.',
    iconoClave: 'telecom',
    colorIcono: '#0d9488',
    fondoIcono: '#f0fdfa',
    bordeIcono: '#99f6e4',
    subelementos: [
      'Router / Módem Empresarial',
      'Switch / Patch Panel / Conmutador',
      'Antena / Radioenlace / Transceptor',
      'Access Point / Repetidor de Red'
    ]
  },
  {
    id: 'herramientas',
    numero: '3',
    nombre: 'Herramientas Técnicas y de Medición',
    subtitulo: 'OTDR, fusionadoras, multímetros y analizadores',
    ejemplos: 'Fusionadora de fibra óptica, reflectómetro OTDR, medidor de potencia, multímetro digital, pinza voltiamperimétrica.',
    iconoClave: 'herramientas',
    colorIcono: '#ea580c',
    fondoIcono: '#fff7ed',
    bordeIcono: '#fed7aa',
    subelementos: [
      'Fusionadora de Fibra Óptica',
      'Reflectómetro OTDR / Medidor Óptico',
      'Multímetro Digital / Pinza Voltiamperimétrica',
      'Generador de Tonos / Probador de Cableado'
    ]
  },
  {
    id: 'mobiliario',
    numero: '4',
    nombre: 'Mobiliario y Enseres de Oficina',
    subtitulo: 'Sillas, escritorios, archivadores y cajoneras',
    ejemplos: 'Silla ergonómica, archivador metálico, mesa auxiliar, lockers, tablero acrílico.',
    iconoClave: 'mobiliario',
    colorIcono: '#9333ea',
    fondoIcono: '#faf5ff',
    bordeIcono: '#e9d5ff',
    subelementos: [
      'Silla Ergonómica / Operativa',
      'Archivador Metálico / Cajonera',
      'Mesa de Trabajo / Escritorio Auxiliar',
      'Locker / Casillero / Estantería'
    ]
  },
  {
    id: 'otro',
    numero: '5',
    nombre: 'Otros Equipos y Elementos',
    subtitulo: 'CCTV, periféricos, equipos de seguridad o varios',
    ejemplos: 'Cámara de seguridad, biométrico de acceso, radio de comunicación, proyector, EPP especial.',
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
  tipo_movimiento?: TipoMovimiento;
  sede_id: string;
  sede_nombre?: string;
  responsable: string;
  cedula: string;
  empresa: string;
  tipologia: TipologiaActivo;
  serial: string;
  motivo_ingreso: string;
  motivo_salida?: string | null;
  fecha_hora?: string;
  fecha_hora_ingreso?: string;
  fecha_hora_salida?: string | null;
  usuario_ingreso_id?: string;
  usuario_ingreso_nombre?: string | null;
  usuario_salida_id?: string | null;
  usuario_salida_nombre?: string | null;
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

/**
 * Convierte un timestamp a hora legible en formato Colombia
 */
export function formatearFechaHoraColombia(valor?: string | null): string {
  if (!valor) return '';
  try {
    const d = new Date(valor);
    if (isNaN(d.getTime())) return valor;
    return d.toLocaleString('es-CO', {
      timeZone: ZONA_HORARIA_COLOMBIA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (_) {
    return valor;
  }
}

export default function RegistroActivo() {
  const navigate = useNavigate();
  const { perfil, signOut } = useAuth();

  // Estado del menú desplegable de perfil
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSignOut() {
    setShowLogoutModal(false);
    await signOut();
  }

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
  const [candidatos_detectados, setCandidatos_detectados] = useState<string[]>([]);
  const [activo_reconocido, setActivo_reconocido] = useState<{
    tipologia: string;
    empresa: string;
    responsable?: string;
    total_visitas: number;
  } | null>(null);
  const [persona_reconocida, setPersona_reconocida] = useState<{
    responsable: string;
    empresa?: string;
    origen?: string;
  } | null>(null);
  const [buscando_cedula, setBuscando_cedula] = useState(false);
  const [motivo_ingreso, setMotivo_ingreso] = useState('');
  const [motivo_salida, setMotivo_salida] = useState('');

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

  // Estados de interfaz y datos
  const [registros, setRegistros] = useState<RegistroActivoItem[]>([]);
  const [mensaje_exito, setMensaje_exito] = useState('');
  const [error_formulario, setError_formulario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [activo_remoto_salida, setActivo_remoto_salida] = useState<RegistroActivoItem | null>(null);

  // 1. Cargar catálogo de sedes
  useEffect(() => {
    async function cargar_sedes() {
      try {
        const { data, error } = await supabase.from('sedes').select('*').order('nombre');
        if (!error && data && data.length > 0) {
          setSedes(data as Sede[]);
        } else {
          // Fallback con sedes locales si no hay conexión
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
    }

    cargar_sedes();
  }, []);

  // 2. Cargar movimientos de la sede desde Supabase
  const cargar_movimientos_sede = useCallback(async (id_sede: string) => {
    if (!id_sede) return;
    try {
      const { data, error } = await supabase
        .from('movimientos_activos')
        .select(`
          id,
          sede_id,
          serial,
          tipologia,
          responsable,
          cedula,
          empresa,
          motivo_ingreso,
          fecha_hora_ingreso,
          usuario_ingreso_id,
          usuario_ingreso_nombre,
          estado_ciclo,
          motivo_salida,
          fecha_hora_salida,
          usuario_salida_id,
          usuario_salida_nombre
        `)
        .eq('sede_id', id_sede)
        .order('fecha_hora_ingreso', { ascending: false });

      if (error) {
        console.warn('Consulta a movimientos_activos en Supabase:', error.message);
        // Fallback a localStorage
        const guardados = localStorage.getItem(CLAVE_STORAGE_ACTIVOS);
        if (guardados) {
          try {
            setRegistros(JSON.parse(guardados));
          } catch (_) {}
        }
        return;
      }

      if (data) {
        const sede_actual = sedes.find(s => s.id === id_sede);
        const nombre_sede = sede_actual?.nombre || 'Sede';
        const mapeados: RegistroActivoItem[] = data.map((item: any) => ({
          id: item.id,
          sede_id: item.sede_id,
          sede_nombre: nombre_sede,
          responsable: item.responsable,
          cedula: item.cedula,
          empresa: item.empresa,
          tipologia: item.tipologia,
          serial: item.serial,
          motivo_ingreso: item.motivo_ingreso,
          motivo_salida: item.motivo_salida,
          fecha_hora: item.fecha_hora_ingreso,
          fecha_hora_ingreso: item.fecha_hora_ingreso,
          fecha_hora_salida: item.fecha_hora_salida,
          usuario_ingreso_id: item.usuario_ingreso_id,
          usuario_ingreso_nombre: item.usuario_ingreso_nombre,
          usuario_salida_id: item.usuario_salida_id,
          usuario_salida_nombre: item.usuario_salida_nombre,
          estado_ciclo: item.estado_ciclo
        }));
        setRegistros(mapeados);
        try {
          localStorage.setItem(CLAVE_STORAGE_ACTIVOS, JSON.stringify(mapeados));
        } catch (_) {}
      }
    } catch (err) {
      console.error('Error al sincronizar movimientos con Supabase:', err);
    }
  }, [sedes]);

  // 3. Suscripción en tiempo real (Supabase Realtime) cuando se activa la sede
  useEffect(() => {
    if (!sede_id) return;
    cargar_movimientos_sede(sede_id);

    const canal = supabase
      .channel(`realtime-activos-${sede_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'Minuta_seguridad',
          table: 'movimientos_activos',
          filter: `sede_id=eq.${sede_id}`
        },
        () => {
          cargar_movimientos_sede(sede_id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [sede_id, cargar_movimientos_sede]);

  // Guardar en localStorage como caché secundario
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
  const manejar_serial_detectado = (
    serial_extraido: string, 
    _foto?: File, 
    _url_foto?: string, 
    candidatos_extraidos?: string[]
  ) => {
    if (serial_extraido) {
      setSerial(serial_extraido.toUpperCase());
    }
    if (candidatos_extraidos && candidatos_extraidos.length > 0) {
      setCandidatos_detectados(candidatos_extraidos);
    } else if (serial_extraido) {
      setCandidatos_detectados([serial_extraido.toUpperCase()]);
    } else {
      setCandidatos_detectados([]);
    }
  };

  // 4. Autocompletado Predictivo Inteligente (Memoria del Activo al Escanear o Digitar)
  useEffect(() => {
    const serial_limpio = serial.trim().toUpperCase();
    if (tipo_movimiento !== 'entrada' || serial_limpio.length < 4) {
      setActivo_reconocido(null);
      return;
    }

    let cancelado = false;

    async function buscar_historial_activo() {
      // A. Consultar en Supabase el historial global de visitas de este serial
      try {
        const { data, error } = await supabase
          .from('movimientos_activos')
          .select('tipologia, empresa, responsable, cedula, fecha_hora_ingreso')
          .ilike('serial', serial_limpio)
          .order('fecha_hora_ingreso', { ascending: false });

        if (!cancelado && !error && data && data.length > 0) {
          const mas_reciente = data[0];
          setActivo_reconocido({
            tipologia: mas_reciente.tipologia,
            empresa: mas_reciente.empresa,
            responsable: mas_reciente.responsable,
            total_visitas: data.length
          });

          // Precargar automáticamente datos preexistentes
          setTipologia(prev => prev ? prev : mas_reciente.tipologia);
          setEmpresa(prev => prev ? prev : mas_reciente.empresa);
          setResponsable(prev => prev ? prev : mas_reciente.responsable);
          setCedula(prev => prev ? prev : formatearCedulaMiles(mas_reciente.cedula));
          return;
        }
      } catch (e) {
        console.warn('Búsqueda predictiva en Supabase falló (usando memoria local):', e);
      }

      // B. Fallback a memoria local
      if (!cancelado) {
        const anteriores = registros.filter(r => r.serial.trim().toUpperCase() === serial_limpio);
        if (anteriores.length > 0) {
          const mas_reciente = anteriores[0];
          setActivo_reconocido({
            tipologia: mas_reciente.tipologia,
            empresa: mas_reciente.empresa,
            responsable: mas_reciente.responsable,
            total_visitas: anteriores.length
          });

          setTipologia(prev => prev ? prev : mas_reciente.tipologia);
          setEmpresa(prev => prev ? prev : mas_reciente.empresa);
          setResponsable(prev => prev ? prev : mas_reciente.responsable);
          setCedula(prev => prev ? prev : formatearCedulaMiles(mas_reciente.cedula));
        } else {
          setActivo_reconocido(null);
        }
      }
    }

    const timer = setTimeout(buscar_historial_activo, 300);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [serial, tipo_movimiento, registros]);

  // 4b. Autocompletado Predictivo Inteligente al Digitar la Cédula
  const buscar_historial_por_cedula = useCallback(async (cedula_input: string) => {
    const cedula_limpia = cedula_input.replace(/\D/g, '');
    if (tipo_movimiento !== 'entrada' || cedula_limpia.length < 5) {
      setPersona_reconocida(null);
      return;
    }

    setBuscando_cedula(true);

    try {
      // 1. Consultar en movimientos_activos el último registro con esa cédula
      const { data, error } = await supabase
        .from('movimientos_activos')
        .select('responsable, empresa, fecha_hora_ingreso')
        .eq('cedula', cedula_limpia)
        .order('fecha_hora_ingreso', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const mas_reciente = data[0];
        setPersona_reconocida({
          responsable: mas_reciente.responsable,
          empresa: mas_reciente.empresa,
          origen: 'Historial de Activos'
        });

        if (mas_reciente.responsable) {
          setResponsable(mas_reciente.responsable);
        }
        if (mas_reciente.empresa) {
          setEmpresa(mas_reciente.empresa);
        }
        setBuscando_cedula(false);
        return;
      }

      // 2. Si no está en movimientos_activos, consultar en perfiles (usuarios registrados)
      const { data: dataPerfil, error: errorPerfil } = await supabase
        .from('perfiles')
        .select('nombre, rol')
        .eq('cedula', cedula_limpia)
        .limit(1);

      if (!errorPerfil && dataPerfil && dataPerfil.length > 0) {
        const perfilEncontrado = dataPerfil[0];
        setPersona_reconocida({
          responsable: perfilEncontrado.nombre,
          empresa: 'Claro / Operación',
          origen: 'Personal Registrado'
        });

        if (perfilEncontrado.nombre) {
          setResponsable(perfilEncontrado.nombre);
        }
        setEmpresa(prev => prev ? prev : 'Claro');
        setBuscando_cedula(false);
        return;
      }

      // 3. Fallback a registros en memoria local
      const anterior = registros.find(r => r.cedula === cedula_limpia);
      if (anterior) {
        setPersona_reconocida({
          responsable: anterior.responsable,
          empresa: anterior.empresa,
          origen: 'Caché Local'
        });
        if (anterior.responsable) setResponsable(anterior.responsable);
        if (anterior.empresa) setEmpresa(anterior.empresa);
        setBuscando_cedula(false);
        return;
      }

      setPersona_reconocida(null);
    } catch (err) {
      console.warn('Error al buscar historial de la persona por cédula:', err);
      setPersona_reconocida(null);
    } finally {
      setBuscando_cedula(false);
    }
  }, [tipo_movimiento, registros]);

  // Hook diferido para consultar por cédula mientras el usuario digita
  useEffect(() => {
    const cedula_limpia = cedula.replace(/\D/g, '');
    if (tipo_movimiento !== 'entrada' || cedula_limpia.length < 5) {
      setPersona_reconocida(null);
      return;
    }

    const timer = setTimeout(() => {
      buscar_historial_por_cedula(cedula);
    }, 350);

    return () => clearTimeout(timer);
  }, [cedula, tipo_movimiento, buscar_historial_por_cedula]);

  // 5. Búsqueda de activo en SALIDA (en memoria local y consulta directa a Supabase)
  const serial_busqueda = serial.trim().toUpperCase();
  const activo_local_salida = (tipo_movimiento === 'salida' && serial_busqueda && sede_id)
    ? registros.find(r => 
        r.sede_id === sede_id && 
        r.serial.trim().toUpperCase() === serial_busqueda && 
        r.estado_ciclo === 'en_sede'
      )
    : null;

  useEffect(() => {
    if (tipo_movimiento !== 'salida' || !serial_busqueda || !sede_id || activo_local_salida) {
      setActivo_remoto_salida(null);
      return;
    }

    let cancelado = false;
    async function buscar_remoto_salida() {
      try {
        const { data, error } = await supabase
          .from('movimientos_activos')
          .select('*')
          .eq('sede_id', sede_id)
          .ilike('serial', serial_busqueda)
          .eq('estado_ciclo', 'en_sede')
          .order('fecha_hora_ingreso', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!cancelado && !error && data) {
          const sede_nombre = sedes.find(s => s.id === data.sede_id)?.nombre || 'Sede';
          setActivo_remoto_salida({
            id: data.id,
            sede_id: data.sede_id,
            sede_nombre,
            serial: data.serial,
            tipologia: data.tipologia,
            responsable: data.responsable,
            cedula: data.cedula,
            empresa: data.empresa,
            motivo_ingreso: data.motivo_ingreso,
            fecha_hora: data.fecha_hora_ingreso,
            fecha_hora_ingreso: data.fecha_hora_ingreso,
            fecha_hora_salida: data.fecha_hora_salida,
            usuario_ingreso_id: data.usuario_ingreso_id,
            usuario_ingreso_nombre: data.usuario_ingreso_nombre,
            estado_ciclo: data.estado_ciclo
          });
        } else if (!cancelado) {
          setActivo_remoto_salida(null);
        }
      } catch (_) {
        if (!cancelado) setActivo_remoto_salida(null);
      }
    }

    const timer = setTimeout(buscar_remoto_salida, 250);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [tipo_movimiento, serial_busqueda, sede_id, activo_local_salida, sedes]);

  const activo_encontrado_salida = activo_local_salida || activo_remoto_salida;

  // 6. Manejar guardado de ENTRADA (Persistencia en Supabase)
  const manejar_guardar_entrada = async (e: React.FormEvent) => {
    e.preventDefault();
    setError_formulario('');
    setMensaje_exito('');

    // Validación de Geocerca GPS Satelital
    if (!geocerca.estaDentroGeocerca || !geocerca.sedeAutorizada || !sede_id) {
      setError_formulario('Acceso Denegado: Su dispositivo debe encontrarse físicamente en la sede autorizada.');
      return;
    }

    if (!perfil?.id) {
      setError_formulario('Sesión no identificada. Por favor vuelva a iniciar sesión.');
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
      setError_formulario('Por favor indique el motivo del ingreso del activo.');
      return;
    }

    setGuardando(true);

    const sede_encontrada = sedes.find(s => s.id === sede_id);
    const nombre_sede = sede_encontrada ? sede_encontrada.nombre : 'Sede Confirmada';
    const nuevo_id = generateUUID();
    const ahora_iso = new Date().toISOString();

    const nuevo_registro: RegistroActivoItem = {
      id: nuevo_id,
      sede_id,
      sede_nombre: nombre_sede,
      responsable: responsable_limpio,
      cedula: cedula_limpia,
      empresa: empresa_limpia,
      tipologia,
      serial: serial_limpio,
      motivo_ingreso: motivo_limpio,
      fecha_hora: ahora_iso,
      fecha_hora_ingreso: ahora_iso,
      usuario_ingreso_id: perfil.id,
      usuario_ingreso_nombre: perfil.nombre,
      estado_ciclo: 'en_sede'
    };

    try {
      // Inserción en Supabase
      const { error: errorInsert } = await supabase
        .from('movimientos_activos')
        .insert({
          id: nuevo_id,
          sede_id,
          serial: serial_limpio,
          tipologia,
          responsable: responsable_limpio,
          cedula: cedula_limpia,
          empresa: empresa_limpia,
          motivo_ingreso: motivo_limpio,
          usuario_ingreso_id: perfil.id,
          usuario_ingreso_nombre: perfil.nombre,
          estado_ciclo: 'en_sede'
        });

      if (errorInsert) {
        console.error('Error insertando en Supabase:', errorInsert);
        if (errorInsert.message?.includes('does not exist') || errorInsert.code === '42P01') {
          setError_formulario('Aviso: La tabla "movimientos_activos" aún no existe en Supabase. Ejecute el SQL correspondiente.');
        } else {
          setError_formulario(`Error al guardar en base de datos: ${errorInsert.message}`);
        }
        // Guardar copia local de respaldo
        const nueva_lista = [nuevo_registro, ...registros];
        actualizar_registros_locales(nueva_lista);
      } else {
        const nueva_lista = [nuevo_registro, ...registros.filter(r => r.id !== nuevo_id)];
        actualizar_registros_locales(nueva_lista);
        setMensaje_exito(`¡Entrada registrada con éxito para ${responsable_limpio} (Serial: ${serial_limpio})!`);
      }
    } catch (err: any) {
      console.error('Excepción al registrar entrada:', err);
      setError_formulario(`Error inesperado: ${err?.message || err}`);
      const nueva_lista = [nuevo_registro, ...registros];
      actualizar_registros_locales(nueva_lista);
    } finally {
      // Limpiar campos para el siguiente registro
      setResponsable('');
      setCedula('');
      setEmpresa('');
      setTipologia('');
      setSerial('');
      setCandidatos_detectados([]);
      setActivo_reconocido(null);
      setPersona_reconocida(null);
      setBuscando_cedula(false);
      setMotivo_ingreso('');
      setGuardando(false);

      setTimeout(() => {
        setMensaje_exito('');
      }, 4500);
    }
  };

  // 7. Manejar guardado de SALIDA (Actualización en Supabase)
  const manejar_guardar_salida = async (e: React.FormEvent) => {
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

    if (!perfil?.id) {
      setError_formulario('Sesión no identificada. Por favor vuelva a iniciar sesión.');
      return;
    }

    const motivo_salida_limpio = motivo_salida.trim();
    if (!motivo_salida_limpio) {
      setError_formulario('Por favor indique el motivo de salida del activo.');
      return;
    }

    setGuardando(true);
    const ahora_iso = new Date().toISOString();
    const id_objetivo = activo_encontrado_salida.id;

    try {
      const { error: errorUpdate } = await supabase
        .from('movimientos_activos')
        .update({
          estado_ciclo: 'salido',
          motivo_salida: motivo_salida_limpio,
          fecha_hora_salida: ahora_iso,
          usuario_salida_id: perfil.id,
          usuario_salida_nombre: perfil.nombre
        })
        .eq('id', id_objetivo);

      if (errorUpdate) {
        console.error('Error actualizando salida en Supabase:', errorUpdate);
        setError_formulario(`Error al registrar salida en base de datos: ${errorUpdate.message}`);
      } else {
        setMensaje_exito(`¡Salida registrada con éxito! El activo ${activo_encontrado_salida.serial} ha sido marcado como retirado de la sede.`);
      }

      // Actualizar estado local
      const lista_actualizada = registros.map(r => {
        if (r.id === id_objetivo) {
          return {
            ...r,
            estado_ciclo: 'salido' as const,
            fecha_hora_salida: ahora_iso,
            motivo_salida: motivo_salida_limpio,
            usuario_salida_id: perfil.id,
            usuario_salida_nombre: perfil.nombre
          };
        }
        return r;
      });
      actualizar_registros_locales(lista_actualizada);
      setActivo_remoto_salida(null);
    } catch (err: any) {
      console.error('Excepción al registrar salida:', err);
      setError_formulario(`Error inesperado: ${err?.message || err}`);
    } finally {
      // Limpiar campos de salida
      setSerial('');
      setCandidatos_detectados([]);
      setActivo_reconocido(null);
      setMotivo_salida('');
      setGuardando(false);

      setTimeout(() => {
        setMensaje_exito('');
      }, 4500);
    }
  };

  // Validación estricta de todos los campos obligatorios para activar el botón Guardar
  const formularioEntradaValido = Boolean(
    !guardando &&
    !geocerca.cargandoUbicacion &&
    geocerca.estaDentroGeocerca &&
    geocerca.sedeAutorizada &&
    sede_id &&
    serial.trim().length > 0 &&
    cedula.replace(/\D/g, '').length >= 4 &&
    responsable.trim().length > 0 &&
    empresa.trim().length > 0 &&
    tipologia.trim().length > 0 &&
    motivo_ingreso.trim().length > 0
  );

  // Métricas calculadas para la sede seleccionada en tiempo real
  const registros_sede = registros.filter(r => r.sede_id === sede_id);
  const total_en_sede = registros_sede.filter(r => r.estado_ciclo === 'en_sede' || (!r.estado_ciclo && r.tipo_movimiento === 'entrada')).length;
  const total_salidos = registros_sede.filter(r => r.estado_ciclo === 'salido').length;
  const total_movimientos = registros_sede.length;

  // Estado y filtro del buscador de historial en la sede (serial, nombre o cédula)
  const [termino_busqueda_historial, setTermino_busqueda_historial] = useState('');
  const registros_filtrados = useMemo(() => {
    const t = termino_busqueda_historial.trim().toLowerCase();
    const t_numerico = termino_busqueda_historial.replace(/\D/g, '');

    return registros_sede.filter((item) => {
      if (!t) return true;

      const coincideSerial = item.serial?.toLowerCase().includes(t);
      const coincideResponsable = item.responsable?.toLowerCase().includes(t);
      const coincideEmpresa = item.empresa?.toLowerCase().includes(t);
      const coincideTipologia = item.tipologia?.toLowerCase().includes(t);

      const cedulaLimpiaItem = item.cedula ? item.cedula.replace(/\D/g, '') : '';
      const coincideCedula = (
        item.cedula?.toLowerCase().includes(t) ||
        (Boolean(t_numerico) && cedulaLimpiaItem.includes(t_numerico))
      );

      return coincideSerial || coincideResponsable || coincideEmpresa || coincideTipologia || coincideCedula;
    });
  }, [registros_sede, termino_busqueda_historial]);

  return (
    <div className="registro-activos-page">
      {/* ── Header Corporativo Enterprise ─────────────────────────── */}
      <header className="registro-activos-header">
        <div className="activos-header-left">
          <button 
            className="activos-back-pill" 
            onClick={() => navigate('/')} 
            aria-label="Volver a Inicio"
            data-tooltip="Volver a Inicio"
          >
            <ArrowLeft size={16} />
            <span className="back-pill-text">Inicio</span>
          </button>

          <div className="activos-header-divider" />

          <div className="activos-title-badge">
            <Boxes size={18} color="#da2d34" />
            <h1>
              <span className="title-text-full">Control de Entrada y Salida de Activos</span>
              <span className="title-text-short">Control de Activos</span>
            </h1>
          </div>
        </div>

        <div className="activos-header-right">
          {/* Profile Dropdown */}
          <div className="profile-dropdown-wrapper" ref={profileRef}>
            <button
              className={`profile-chip-btn ${isProfileOpen ? 'active' : ''}`}
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              aria-label="Menú de usuario"
              data-tooltip="Mi Cuenta y Opciones"
            >
              <div className="avatar-circle">
                {perfil?.nombre?.charAt(0) || 'S'}
              </div>
              <div className="profile-chip-info">
                <span className="profile-chip-name">{perfil?.nombre?.split(' ')[0] || 'Samir'}</span>
                <span className="profile-chip-role">{perfil?.rol || 'Administrador'}</span>
              </div>
              <ChevronDown size={14} className={`chip-chevron ${isProfileOpen ? 'rotate' : ''}`} />
            </button>

            {isProfileOpen && (
              <div className="profile-menu-dropdown animate-fade-in">
                <div className="dropdown-user-header">
                  <p className="dropdown-user-name">{perfil?.nombre || 'Samir Bolívar'}</p>
                  <p className="dropdown-user-cedula">CC: {perfil?.cedula || '—'}</p>
                  <span className="dropdown-user-badge">{perfil?.rol || 'Administrador'}</span>
                </div>
                
                <div className="dropdown-divider" />
                
                <div className="dropdown-menu-list">
                  <button className="dropdown-item" onClick={() => { setIsProfileOpen(false); navigate('/'); }}>
                    <Home size={16} />
                    <span>Página de Inicio</span>
                  </button>
                  <button className="dropdown-item" onClick={() => { setIsProfileOpen(false); navigate('/seguimiento'); }}>
                    <ClipboardList size={16} />
                    <span>Seguimiento de Minutas</span>
                  </button>
                  {perfil?.rol === 'administrador' && (
                    <>
                      <button className="dropdown-item" onClick={() => { setIsProfileOpen(false); navigate('/admin/usuarios'); }}>
                        <Users size={16} />
                        <span>Gestión de Usuarios</span>
                      </button>
                      <button className="dropdown-item" onClick={() => { setIsProfileOpen(false); navigate('/metricas'); }}>
                        <BarChart3 size={16} />
                        <span>Métricas y Reportes</span>
                      </button>
                    </>
                  )}
                </div>

                <div className="dropdown-divider" />

                <button 
                  className="dropdown-item item-danger" 
                  onClick={() => {
                    setIsProfileOpen(false);
                    setShowLogoutModal(true);
                  }}
                >
                  <Power size={16} />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modal de Confirmación de Cierre de Sesión */}
      <ModalConfirmarSalida 
        isOpen={showLogoutModal} 
        onClose={() => setShowLogoutModal(false)} 
        onConfirm={handleSignOut} 
      />

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
              setCandidatos_detectados([]);
              setActivo_reconocido(null);
              setPersona_reconocida(null);
            }}
          >
            <div className="btn-toggle-icono">
              <ArrowDownLeft size={15} strokeWidth={2.4} />
            </div>
            <span className="btn-toggle-texto">Entrada a Sede</span>
          </button>
          <button
            type="button"
            className={`btn-toggle-movimiento ${tipo_movimiento === 'salida' ? 'activo-salida' : ''}`}
            onClick={() => {
              setTipo_movimiento('salida');
              setError_formulario('');
              setCandidatos_detectados([]);
              setActivo_reconocido(null);
              setPersona_reconocida(null);
            }}
          >
            <div className="btn-toggle-icono">
              <ArrowUpRight size={15} strokeWidth={2.4} />
            </div>
            <span className="btn-toggle-texto">Salida de Sede</span>
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

            {/* 2. Sede (Geocerca Satelital) */}
            <div className="form-grupo">
              <label className="form-label">
                <Building2 size={16} color="#da2d34" />
                <span>Sede <span className="requerido">*</span></span>
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

            {/* 3. Escáner con Cámara (Solo Cámara en vivo) */}
            <div className="form-grupo">
              <label className="form-label">
                <Hash size={16} color="#da2d34" />
                <span>Escáner del Serial con Cámara</span>
              </label>
              <LectorSerialCamara
                serial_actual={serial}
                al_detectar_serial={manejar_serial_detectado}
              />
            </div>

            {/* 4. Serial del Activo */}
            <div className="form-grupo">
              <label className="form-label">
                <Hash size={16} color="#da2d34" />
                <span>Número de Serie (Serial) <span className="requerido">*</span></span>
              </label>
              <input
                type="text"
                className="form-input input-serial"
                placeholder="Escriba o escanee el serial del equipo"
                value={serial}
                onChange={(e) => setSerial(e.target.value.toUpperCase())}
                required
              />

              {/* Selector de opciones detectadas al escanear */}
              {candidatos_detectados.length > 1 && (
                <div className="selector-candidatos-contenedor">
                  <div className="selector-candidatos-cabecera">
                    <Sparkles size={14} color="#da2d34" />
                    <span>Opciones detectadas al escanear (toque para elegir):</span>
                  </div>
                  <div className="selector-candidatos-chips">
                    {candidatos_detectados.map((cand, idx) => {
                      const es_seleccionado = serial.trim().toUpperCase() === cand.trim().toUpperCase();
                      return (
                        <button
                          key={`${cand}-${idx}`}
                          type="button"
                          className={`chip-candidato-selector ${es_seleccionado ? 'activo' : ''}`}
                          onClick={() => setSerial(cand.trim().toUpperCase())}
                          title={`Seleccionar ${cand}`}
                        >
                          {es_seleccionado && <CheckCircle2 size={13} />}
                          <span>{cand}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notificación de activo reconocido en historial (Autocompletado Predictivo) */}
              {activo_reconocido && (
                <div className="banner-activo-reconocido">
                  <div className="banner-reconocido-icono">
                    <Sparkles size={18} color="#16a34a" />
                  </div>
                  <div className="banner-reconocido-cuerpo">
                    <div className="banner-reconocido-titulo">
                      <span>¡Activo Reconocido en Historial!</span>
                      <span className="badge-visitas-previas">
                        {activo_reconocido.total_visitas} {activo_reconocido.total_visitas === 1 ? 'visita previa' : 'visitas previas'}
                      </span>
                    </div>
                    <div className="banner-reconocido-detalles">
                      <span>Tipología: <strong>{activo_reconocido.tipologia}</strong></span>
                      <span>•</span>
                      <span>Empresa: <strong>{activo_reconocido.empresa}</strong></span>
                      {activo_reconocido.responsable && (
                        <>
                          <span>•</span>
                          <span>Portador habitual: <strong>{activo_reconocido.responsable}</strong></span>
                        </>
                      )}
                    </div>
                    <span className="banner-reconocido-nota">
                      ✓ Datos completados automáticamente. Puede modificarlos si este ingreso corresponde a otra persona o motivo.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Cédula de la Persona (Formato con miles en vivo y Autocompletado Predictivo) */}
            <div className="form-grupo">
              <label className="form-label">
                <CreditCard size={16} color="#da2d34" />
                <span>Cédula de la Persona <span className="requerido">*</span></span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  className="form-input"
                  placeholder="Ej: 1.045.678.901"
                  value={cedula}
                  onChange={manejar_cambio_cedula}
                  onBlur={() => buscar_historial_por_cedula(cedula)}
                  required
                />
                {buscando_cedula && (
                  <span style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '11px',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <RotateCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    Buscando...
                  </span>
                )}
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Formato automático con puntos de miles. Si la persona ya está registrada, sus datos se completarán abajo.
              </span>

              {/* Notificación de persona reconocida en historial por Cédula */}
              {persona_reconocida && (!activo_reconocido || persona_reconocida.responsable !== activo_reconocido.responsable) && (
                <div className="banner-activo-reconocido">
                  <div className="banner-reconocido-icono">
                    <Sparkles size={18} color="#16a34a" />
                  </div>
                  <div className="banner-reconocido-cuerpo">
                    <div className="banner-reconocido-titulo">
                      <span>¡Persona Registrada Encontrada!</span>
                      {persona_reconocida.origen && (
                        <span className="badge-visitas-previas">
                          {persona_reconocida.origen}
                        </span>
                      )}
                    </div>
                    <div className="banner-reconocido-detalles">
                      <span>Responsable: <strong>{persona_reconocida.responsable}</strong></span>
                      {persona_reconocida.empresa && (
                        <>
                          <span>•</span>
                          <span>Empresa: <strong>{persona_reconocida.empresa}</strong></span>
                        </>
                      )}
                    </div>
                    <span className="banner-reconocido-nota">
                      ✓ Responsable y empresa autocompletados. Puede modificarlos si este ingreso corresponde a otra persona o motivo.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 6. Persona Responsable del Ingreso */}
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

            {/* 7. Empresa a la que pertenece */}
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

            {/* 8. Tipología del Activo (Catálogo Táctil / Bottom Sheet Móvil) */}
            <div className="form-grupo">
              <label className="form-label">
                {categoriaActual ? (
                  renderizarIconoTipologia(categoriaActual.iconoClave, 16, '#da2d34')
                ) : (
                  <Layers size={16} color="#da2d34" />
                )}
                <span>Tipología del Activo <span className="requerido">*</span></span>
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

            {/* 9. Motivo del Ingreso del Activo */}
            <div className="form-grupo">
              <label className="form-label">
                <FileQuestion size={16} color="#da2d34" />
                <span>Motivo del Ingreso del Activo <span className="requerido">*</span></span>
              </label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Describa el motivo por el que ingresa el activo a la sede (ej. mantenimiento, labores diarias, revisión técnica)..."
                value={motivo_ingreso}
                onChange={(e) => setMotivo_ingreso(e.target.value)}
                required
              />
            </div>

            {/* Botón Guardar Entrada */}
            <button
              type="submit"
              className="btn-guardar-registro"
              disabled={!formularioEntradaValido}
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
                  <Save size={20} />
                  <span>Guardar</span>
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

            {/* Sede (Geocerca Satelital) */}
            <div className="form-grupo">
              <label className="form-label">
                <Building2 size={16} color="#da2d34" />
                <span>Sede <span className="requerido">*</span></span>
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
                className="form-input input-serial"
                placeholder="Escriba el serial del equipo a retirar..."
                value={serial}
                onChange={(e) => setSerial(e.target.value.toUpperCase())}
              />

              {/* Selector de opciones detectadas al escanear para Salida */}
              {candidatos_detectados.length > 1 && (
                <div className="selector-candidatos-contenedor">
                  <div className="selector-candidatos-cabecera">
                    <Sparkles size={14} color="#da2d34" />
                    <span>Opciones detectadas al escanear (toque para elegir):</span>
                  </div>
                  <div className="selector-candidatos-chips">
                    {candidatos_detectados.map((cand, idx) => {
                      const es_seleccionado = serial.trim().toUpperCase() === cand.trim().toUpperCase();
                      return (
                        <button
                          key={`${cand}-${idx}`}
                          type="button"
                          className={`chip-candidato-selector ${es_seleccionado ? 'activo' : ''}`}
                          onClick={() => setSerial(cand.trim().toUpperCase())}
                          title={`Buscar y seleccionar ${cand}`}
                        >
                          {es_seleccionado && <CheckCircle2 size={13} />}
                          <span>{cand}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
                    <span className="activo-dato-valor">
                      {formatearFechaHoraColombia(activo_encontrado_salida.fecha_hora_ingreso || activo_encontrado_salida.fecha_hora)}
                    </span>
                  </div>
                  <div className="activo-dato-item">
                    <span className="activo-dato-etiqueta">Motivo de Ingreso</span>
                    <span className="activo-dato-valor">{activo_encontrado_salida.motivo_ingreso || 'No especificado'}</span>
                  </div>
                  {activo_encontrado_salida.usuario_ingreso_nombre && (
                    <div className="activo-dato-item">
                      <span className="activo-dato-etiqueta">Vigilante de Entrada</span>
                      <span className="activo-dato-valor">{activo_encontrado_salida.usuario_ingreso_nombre}</span>
                    </div>
                  )}
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
              <span>Movimientos de la Sede</span>
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
            <div className="historial-activos-cabecera">
              <h3 className="historial-activos-titulo">
                Historial de Activos
              </h3>
              <div className="historial-search-box">
                <Search size={15} className="historial-search-icon" />
                <input
                  type="text"
                  placeholder="Buscar serial, nombre o CC..."
                  value={termino_busqueda_historial}
                  onChange={(e) => setTermino_busqueda_historial(e.target.value)}
                  className="historial-search-input"
                  aria-label="Buscar por serial, nombre o cédula"
                />
                {termino_busqueda_historial && (
                  <button
                    type="button"
                    className="btn-limpiar-busqueda-activos"
                    onClick={() => setTermino_busqueda_historial('')}
                    title="Limpiar búsqueda"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {registros_sede.length === 0 ? (
              <div className="inventario-vacio">
                <span>No hay activos registrados en esta sede todavía.</span>
              </div>
            ) : registros_filtrados.length === 0 ? (
              <div className="inventario-vacio">
                <span>No se encontraron activos para "<strong>{termino_busqueda_historial}</strong>".</span>
                <button
                  type="button"
                  onClick={() => setTermino_busqueda_historial('')}
                  className="btn-restablecer-filtro-activos"
                >
                  Restablecer búsqueda
                </button>
              </div>
            ) : (
              <div className="activos-items-lista">
                {registros_filtrados.map((item) => (
                  <div key={item.id} className="activo-item-tarjeta">
                    <div className="activo-item-header">
                      <div className="activo-item-info-principal">
                        <span className={`badge-movimiento ${item.estado_ciclo === 'salido' ? 'salida' : 'entrada'}`}>
                          {item.estado_ciclo === 'salido' ? '🔴 Salido' : '🟢 En Sede'}
                        </span>
                        <span className="activo-serial-texto">{item.serial}</span>
                      </div>
                    </div>

                    <div className="activo-item-detalles">
                      <span><strong>Responsable:</strong> {item.responsable} (CC: {formatearCedulaMiles(item.cedula)})</span>
                      <span><strong>Empresa:</strong> {item.empresa} • <strong>Tipo:</strong> {item.tipologia}</span>
                      <span>
                        <strong>Ingreso:</strong> {formatearFechaHoraColombia(item.fecha_hora_ingreso || item.fecha_hora)}
                        {item.usuario_ingreso_nombre && ` • Vigilante: ${item.usuario_ingreso_nombre}`}
                      </span>
                      {item.motivo_ingreso && (
                        <span><strong>Motivo Ingreso:</strong> {item.motivo_ingreso}</span>
                      )}
                      {item.fecha_hora_salida && (
                        <span>
                          <strong>Salida:</strong> {formatearFechaHoraColombia(item.fecha_hora_salida)} • <strong>Motivo:</strong> {item.motivo_salida || 'Sin motivo'}
                          {item.usuario_salida_nombre && ` • Autorizó: ${item.usuario_salida_nombre}`}
                        </span>
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
