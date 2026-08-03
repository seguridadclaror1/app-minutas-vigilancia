import { ShieldAlert, LogOut } from 'lucide-react';
import './SessionDisplacedModal.css';

interface SessionDisplacedModalProps {
  onAcknowledge: () => void;
}

export function SessionDisplacedModal({ onAcknowledge }: SessionDisplacedModalProps) {
  const currentFormattedTime = new Date().toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return (
    <div className="session-displaced-overlay" id="session-displaced-modal">
      <div className="session-displaced-modal animate-scale-in">
        <div className="session-displaced-content">
          <div className="session-displaced-icon-wrapper">
            <ShieldAlert size={42} color="#da2d34" strokeWidth={1.75} />
          </div>

          <h2 className="session-displaced-title">Sesión Finalizada</h2>

          <p className="session-displaced-description">
            Se ha detectado un nuevo inicio de sesión en esta cuenta desde otro dispositivo. Por motivos de seguridad, la sesión en este dispositivo ha sido cerrada.
          </p>

          <div className="session-displaced-details">
            <div className="session-detail-item">
              <span className="session-detail-label">Motivo</span>
              <span className="session-detail-value">Inicio de sesión remoto</span>
            </div>
            <div className="session-detail-item">
              <span className="session-detail-label">Hora del evento</span>
              <span className="session-detail-value">{currentFormattedTime}</span>
            </div>
          </div>

          <button className="session-displaced-btn" onClick={onAcknowledge}>
            <LogOut size={18} />
            Entendido / Ir al Login
          </button>
        </div>
      </div>
    </div>
  );
}
