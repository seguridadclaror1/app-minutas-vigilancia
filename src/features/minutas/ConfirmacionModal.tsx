import { CheckCircle2 } from 'lucide-react';
import './ConfirmacionModal.css';

interface ConfirmacionModalProps {
  onClose: () => void;
  sedeNombre?: string;
  tipoNovedadNombre?: string;
}

function formatFechaHoraSegura(date: Date = new Date()): string {
  try {
    return date.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year}, ${hours}:${minutes}`;
  }
}

export function ConfirmacionModal({ onClose, sedeNombre, tipoNovedadNombre }: ConfirmacionModalProps) {
  return (
    <div className="confirmacion-overlay" id="success-dialog">
      <div className="confirmacion-modal">
        <div className="confirmacion-content">
          <div className="confirmacion-icon-wrapper">
            <CheckCircle2 size={48} color="#da2d34" strokeWidth={1.5} />
          </div>
          <h2 className="confirmacion-title">¡Registro Exitoso!</h2>
          <p className="confirmacion-description">
            La minuta ha sido guardada y sincronizada correctamente en el sistema.
          </p>
          
          <div className="confirmacion-details">
            <div className="detail-item">
              <span className="detail-label">Fecha y Hora</span>
              <span className="detail-value">
                {formatFechaHoraSegura()}
              </span>
            </div>
            {sedeNombre && (
              <div className="detail-item">
                <span className="detail-label">Sede</span>
                <span className="detail-value">{sedeNombre}</span>
              </div>
            )}
            {tipoNovedadNombre && (
              <div className="detail-item">
                <span className="detail-label">Tipo Novedad</span>
                <span className="detail-value">{tipoNovedadNombre}</span>
              </div>
            )}
          </div>

          <button className="confirmacion-btn" onClick={onClose}>
            Volver al Inicio
          </button>
        </div>
      </div>
    </div>
  );
}
