import { LogOut } from 'lucide-react';

interface ModalConfirmarSalidaProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ModalConfirmarSalida({ isOpen, onClose, onConfirm }: ModalConfirmarSalidaProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div 
        className="modal-content delete-modal animate-scale-up" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="delete-modal-icon">
          <div className="logout-modal-icon-circle">
            <LogOut size={26} color="#da2d34" />
          </div>
        </div>
        <h3 className="delete-modal-title">¿Cerrar Sesión?</h3>
        <p className="delete-modal-text">
          ¿Estás seguro de que deseas salir del sistema? Tendrás que ingresar tus credenciales nuevamente para acceder.
        </p>
        <div className="delete-modal-actions">
          <button 
            type="button"
            className="btn-cancel" 
            onClick={onClose}
          >
            Cancelar
          </button>
          <button 
            type="button"
            className="btn-danger" 
            onClick={onConfirm}
          >
            Sí, cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
