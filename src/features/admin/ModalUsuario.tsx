import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import PremiumSelect from '../../components/PremiumSelect';
import type { Perfil } from '../../types/database';
import { supabaseAdmin } from '../../config/supabaseAdmin';
import { supabase } from '../../config/supabase';

interface ModalUsuarioProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (msg?: string) => void;
  usuarioEdit?: Perfil;
}

export default function ModalUsuario({ isOpen, onClose, onSaved, usuarioEdit }: ModalUsuarioProps) {
  const [formData, setFormData] = useState({
    nombre: '',
    cedula: '',
    rol: 'vigilante',
    estado: 'activo',
    contrasena: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (usuarioEdit) {
      setFormData({
        nombre: usuarioEdit.nombre,
        cedula: usuarioEdit.cedula,
        rol: usuarioEdit.rol,
        estado: usuarioEdit.estado,
        contrasena: usuarioEdit.contrasena || ''
      });
    } else {
      setFormData({ nombre: '', cedula: '', rol: 'vigilante', estado: 'activo', contrasena: '' });
    }
    setError('');
  }, [usuarioEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.cedula || !formData.nombre || !formData.contrasena) {
      setError('Por favor completa todos los campos.');
      return;
    }

    setLoading(true);

    try {
      if (usuarioEdit) {
        // ACTUALIZAR USUARIO

        // 1. Actualizar contraseña en auth.users (si cambió y si tenemos permisos de admin)
        if (formData.contrasena !== usuarioEdit.contrasena) {
          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            usuarioEdit.id,
            { password: formData.contrasena }
          );
          if (authError) {
            console.error('Error auth:', authError);
            throw new Error(`Error de Supabase: ${authError.message}`);
          }
        }

        // 2. Actualizar metadatos en perfiles usando el cliente normal
        const { error: updateError } = await supabase
          .from('perfiles')
          .update({
            nombre: formData.nombre,
            cedula: formData.cedula,
            rol: formData.rol,
            estado: formData.estado,
            contrasena: formData.contrasena
          })
          .eq('id', usuarioEdit.id);

        if (updateError) throw updateError;

      } else {
        // CREAR USUARIO (requiere admin)
        const { error: signUpError } = await supabaseAdmin.auth.admin.createUser({
          email: `${formData.cedula}@minutas.com`,
          password: formData.contrasena,
          email_confirm: true,
          user_metadata: {
            cedula: formData.cedula,
            nombre: formData.nombre,
            rol: formData.rol,
            contrasena: formData.contrasena
          }
        });

        if (signUpError) {
          console.error('Error signup:', signUpError);
          throw new Error(`Error de Supabase al crear: ${signUpError.message}`);
        }
      }

      onSaved('Guardado con éxito');
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || 'Ocurrió un error inesperado.';

      // Traducción de errores comunes de Supabase
      if (errMsg.includes('Password should be at least 6 characters')) {
        errMsg = 'La contraseña debe tener al menos 6 caracteres.';
      } else if (errMsg.includes('User already registered')) {
        errMsg = 'Este usuario ya está registrado en el sistema.';
      } else if (errMsg.includes('invalid email')) {
        errMsg = 'El formato del correo/cédula es inválido.';
      }

      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in">
        <div className="modal-header">
          <h2>{usuarioEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
          <button className="btn-icon" onClick={onClose} disabled={loading}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="login-error" style={{ margin: 0 }}>
                <span className="error-icon">!</span>
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Cédula</label>
              <input
                type="text"
                className="form-input"
                value={formData.cedula}
                onChange={e => setFormData({ ...formData, cedula: e.target.value.replace(/\D/g, '') })}
                disabled={!!usuarioEdit || loading} // La cédula forma el email, mejor no permitir cambiarla si es edición
                placeholder="Ej: 1234567890"
              />
              {usuarioEdit && <small style={{ color: '#64748b' }}>La cédula no se puede modificar tras la creación.</small>}
            </div>

            <div className="form-group">
              <label className="form-label">Nombre Completo</label>
              <input
                type="text"
                className="form-input"
                value={formData.nombre}
                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Rol</label>
              <PremiumSelect
                value={formData.rol}
                onChange={val => setFormData({ ...formData, rol: val })}
                options={[
                  { value: 'administrador', label: 'Administrador' },
                  { value: 'supervisor', label: 'Supervisor' },
                  { value: 'vigilante', label: 'Vigilante' }
                ]}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                type="text"
                className="form-input"
                value={formData.contrasena}
                onChange={e => setFormData({ ...formData, contrasena: e.target.value })}
                disabled={loading}
              />
            </div>

          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-crear" disabled={loading}>
              {loading && <Loader2 size={16} className="spin-icon" />}
              {usuarioEdit ? 'Guardar Cambios' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
