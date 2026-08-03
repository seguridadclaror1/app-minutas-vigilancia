import { useEffect } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import './SessionNoticeToast.css';

interface SessionNoticeToastProps {
  onClose: () => void;
  autoHideDuration?: number;
}

export function SessionNoticeToast({ onClose, autoHideDuration = 10000 }: SessionNoticeToastProps) {
  useEffect(() => {
    if (autoHideDuration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [onClose, autoHideDuration]);

  return (
    <div className="session-notice-toast-container" id="session-notice-toast">
      <div className="session-notice-toast">
        <div className="session-notice-icon-wrapper">
          <ShieldCheck size={22} />
        </div>
        <div className="session-notice-body">
          <span className="session-notice-title">Inicio de Sesión Detectado</span>
          <span className="session-notice-message">
            Se cerró automáticamente la sesión activa que estaba abierta en otro dispositivo por razones de seguridad.
          </span>
        </div>
        <button 
          className="session-notice-close-btn" 
          onClick={onClose} 
          aria-label="Cerrar notificación"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
