import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Camera, Image, X, Loader2, Save } from 'lucide-react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../hooks/useAuth';
import PremiumSelect from '../../components/PremiumSelect';
import { ConfirmacionModal } from './ConfirmacionModal';
import './NuevaMinuta.css';
import type { Sede, TipoNovedad } from '../../types/database';

import { generateUUID } from '../../utils/uuid';
import { compressImage } from '../../utils/imageCompressor';
import { translateError } from '../../utils/errorTranslator';
import { ZONA_HORARIA_COLOMBIA } from '../../utils/fechasColombia';

export default function NuevaMinuta() {
  const navigate = useNavigate();
  const { perfil } = useAuth();

  const [sedes, setSedes] = useState<Sede[]>([]);
  const [tiposNovedad, setTiposNovedad] = useState<TipoNovedad[]>([]);

  const [sedeId, setSedeId] = useState('');
  const [tipoNovedadId, setTipoNovedadId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [fotoUrls, setFotoUrls] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [showConfirmacion, setShowConfirmacion] = useState(false);

  // Estados de progreso de carga optimizada (Opción 3 UI Premium)
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [uploadProgressPercent, setUploadProgressPercent] = useState(0);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [sedesRes, novedadesRes] = await Promise.all([
          supabase.from('sedes').select('*').order('nombre'),
          supabase.from('tipos_novedad').select('*').order('nombre')
        ]);

        if (sedesRes.data) setSedes(sedesRes.data as Sede[]);
        if (novedadesRes.data) setTiposNovedad(novedadesRes.data as TipoNovedad[]);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setInitialLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFotos(prev => [...prev, ...newFiles]);

      const newUrls = newFiles.map(file => URL.createObjectURL(file));
      setFotoUrls(prev => [...prev, ...newUrls]);
    }
  };

  const removeFoto = (index: number) => {
    URL.revokeObjectURL(fotoUrls[index]);
    setFotos(prev => prev.filter((_, i) => i !== index));
    setFotoUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!sedeId || !tipoNovedadId || !descripcion.trim()) {
      setError('Por favor, complete todos los campos obligatorios.');
      return;
    }

    if (!perfil) {
      setError('Error de autenticación. Intente iniciar sesión nuevamente.');
      return;
    }

    setLoading(true);
    setUploadProgressPercent(5);
    setUploadStatusText('Optimizando fotos...');

    try {
      // 1. OPCION 1: Compresión de imágenes en el cliente (HTML5 Canvas)
      const compressedFiles: File[] = [];
      for (let i = 0; i < fotos.length; i++) {
        setUploadStatusText(`Optimizando foto ${i + 1} de ${fotos.length}...`);
        const compressed = await compressImage(fotos[i]);
        compressedFiles.push(compressed);
        setUploadProgressPercent(5 + Math.round(((i + 1) / fotos.length) * 20));
      }

      // Generar el ID de la minuta por adelantado para usarlo en las rutas de las fotos
      const minutaId = generateUUID();
      let evidenciasToInsert: any[] = [];

      // 2. OPCION 2: Subida paralela ultra rápida de evidencias ANTES de guardar en BD
      if (compressedFiles.length > 0) {
        setUploadStatusText(`Subiendo ${compressedFiles.length} evidencias a la nube...`);
        let completedUploads = 0;

        const uploadPromises = compressedFiles.map(async (foto) => {
          const fileExt = foto.name.split('.').pop() || 'jpg';
          const fileName = `${minutaId}/${generateUUID()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('evidencias_minutas')
            .upload(fileName, foto, {
              contentType: foto.type || 'image/jpeg',
              upsert: true
            });

          if (uploadError) {
            console.error('Error subiendo imagen:', uploadError);
            throw uploadError;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('evidencias_minutas')
            .getPublicUrl(fileName);

          completedUploads++;
          setUploadProgressPercent(25 + Math.round((completedUploads / compressedFiles.length) * 60));
          setUploadStatusText(`Subiendo evidencias (${completedUploads}/${compressedFiles.length})...`);

          return {
            minuta_id: minutaId,
            url_imagen: publicUrl
          };
        });

        // Esperar a que TODAS las fotos se suban correctamente.
        // Si una falla por mala conexión, el error se captura y no se guarda nada en BD.
        evidenciasToInsert = await Promise.all(uploadPromises);
      }

      // 3. Insertar minuta y evidencias en la base de datos (SOLO si las fotos se subieron con éxito)
      setUploadStatusText('Guardando registro de minuta...');
      setUploadProgressPercent(90);

      const { error: minutaError } = await supabase
        .from('minutas')
        .insert({
          id: minutaId,
          usuario_id: perfil.id,
          sede_id: sedeId,
          tipo_novedad_id: tipoNovedadId,
          descripcion: descripcion.trim()
        });

      if (minutaError) throw minutaError;

      if (evidenciasToInsert.length > 0) {
        setUploadStatusText('Finalizando registro...');
        setUploadProgressPercent(95);

        const { error: evidenciaError } = await supabase
          .from('evidencias')
          .insert(evidenciasToInsert);

        if (evidenciaError) {
          // Intentar revertir la minuta si falla la evidencia por alguna razón extrema
          await supabase.from('minutas').delete().eq('id', minutaId);
          console.error('Error al guardar evidencias:', evidenciaError);
          throw evidenciaError;
        }
      }

      setUploadProgressPercent(100);
      setUploadStatusText('¡Registro completado!');

      // Éxito, mostrar modal
      setLoading(false);
      setShowConfirmacion(true);
    } catch (err: any) {
      console.error('Error al guardar:', err);
      setError(translateError(err));
      setLoading(false);
      setUploadStatusText('');
      setUploadProgressPercent(0);
    }
  };

  if (initialLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh' }}>
        <Loader2 className="spin-icon" size={32} color="#da2d34" />
      </div>
    );
  }

  return (
    <div className="nueva-minuta-page">
      <header className="minuta-header">
        <button 
          className="back-btn" 
          onClick={() => navigate(-1)} 
          aria-label="Volver"
          data-tooltip="Volver"
        >
          <ArrowLeft size={24} />
        </button>
        <h1>Registrar Anotación</h1>
      </header>

      <main className="minuta-content animate-fade-in">
        <form className="minuta-form" onSubmit={handleSubmit}>

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

          <div className="form-group">
            <label className="form-label">Sede <span className="required-asterisk">*</span></label>
            <PremiumSelect
              value={sedeId}
              onChange={setSedeId}
              options={sedes.map(sede => ({ value: sede.id, label: sede.nombre }))}
              placeholder="Seleccione una sede..."
              searchable={true}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tipo de Anotación <span className="required-asterisk">*</span></label>
            <PremiumSelect
              value={tipoNovedadId}
              onChange={setTipoNovedadId}
              options={tiposNovedad.map(tipo => ({ value: tipo.id, label: tipo.nombre }))}
              placeholder="Seleccione un tipo..."
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Evidencias Fotográficas</label>
            <div className="fotos-section">
              {/* Input para tomar foto directamente desde la cámara */}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={cameraInputRef}
                onChange={handleFotoChange}
                style={{ display: 'none' }}
                disabled={loading}
              />

              {/* Input para seleccionar múltiples imágenes de la galería */}
              <input
                type="file"
                accept="image/*"
                multiple
                ref={galleryInputRef}
                onChange={handleFotoChange}
                style={{ display: 'none' }}
                disabled={loading}
              />

              <div className="fotos-grid">
                {fotoUrls.map((url, index) => (
                  <div key={index} className="foto-preview">
                    <img src={url} alt={`Evidencia ${index + 1}`} />
                    <button
                      type="button"
                      className="remove-foto-btn"
                      onClick={() => removeFoto(index)}
                      disabled={loading}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className="add-foto-btn"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={loading}
                  title="Tomar foto con la cámara"
                >
                  <Camera size={22} />
                  <span>Cámara</span>
                </button>

                <button
                  type="button"
                  className="add-foto-btn"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={loading}
                  title="Seleccionar de la galería"
                >
                  <Image size={22} />
                  <span>Galería</span>
                </button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Descripción <span className="required-asterisk">*</span></label>
            <textarea
              className="form-textarea"
              placeholder="Describa la novedad detalladamente..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* OPCION 3: Indicador de Progreso Premium de Carga */}
          {loading && (
            <div className="upload-progress-container animate-fade-in">
              <div className="upload-progress-header">
                <div className="upload-progress-status">
                  <Loader2 className="spin-icon" size={18} color="#da2d34" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>{uploadStatusText}</span>
                </div>
                <span className="upload-progress-percent">{uploadProgressPercent}%</span>
              </div>
              <div className="upload-progress-track">
                <div
                  className="upload-progress-bar"
                  style={{ width: `${uploadProgressPercent}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="login-error animate-fade-in" role="alert" style={{ marginTop: 0 }}>
              <span className="error-icon">!</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="submit-btn"
            disabled={loading || !sedeId || !tipoNovedadId || !descripcion.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="spin-icon" size={20} />
                Guardando...
              </>
            ) : (
              <>
                <Save size={20} />
                Guardar Registro
              </>
            )}
          </button>
        </form>
      </main>

      {showConfirmacion && (
        <ConfirmacionModal
          sedeNombre={sedes.find(s => s.id === sedeId)?.nombre}
          tipoNovedadNombre={tiposNovedad.find(t => t.id === tipoNovedadId)?.nombre}
          onClose={() => navigate('/', { replace: true })}
        />
      )}
    </div>
  );
}
