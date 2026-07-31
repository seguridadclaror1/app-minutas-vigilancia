import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import './Login.css';

export default function Login() {
  const { signIn } = useAuth();
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validaciones
    if (!cedula.trim()) {
      setError('Ingrese su número de identificación.');
      return;
    }
    if (!password.trim()) {
      setError('Ingrese su contraseña.');
      return;
    }

    setLoading(true);
    const result = await signIn(cedula.trim(), password);
    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  }

  return (
    <div className="login-page">
      <main className="login-container animate-fade-in">
        {/* Logo Header */}
        <header className="login-header">
          <div className="login-logo-wrapper">
            <img
              src="/Logo_Claro-sin fondo.png"
              alt="Logo Claro"
              className="login-logo"
              width={96}
              height={96}
            />
          </div>
          <h1 className="login-title">Minutas de Vigilancia</h1>
          <p className="login-subtitle">
            Ingrese sus credenciales para acceder al sistema
          </p>
        </header>

        {/* Formulario */}
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {/* Campo Cédula */}
          <div className="form-group">
            <label htmlFor="cedula" className="form-label">
              Número de Identificación
            </label>
            <div className="input-wrapper">
              <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
              </svg>
              <input
                id="cedula"
                type="text"
                inputMode="numeric"
                placeholder="Ej: 1234567890"
                className={`form-input form-input-icon ${error && !cedula ? 'input-error' : ''}`}
                value={cedula}
                onChange={(e) => {
                  setCedula(e.target.value.replace(/\D/g, ''));
                  setError('');
                }}
                autoComplete="username"
                disabled={loading}
              />
            </div>
          </div>

          {/* Campo Contraseña */}
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Contraseña
            </label>
            <div className="input-wrapper">
              <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              </svg>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Ingrese su contraseña"
                className={`form-input form-input-icon input-password ${error && !password ? 'input-error' : ''}`}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Mensaje de error */}
          {error && (
            <div className="login-error animate-fade-in" role="alert">
              <span className="error-icon">!</span>
              <span>{error}</span>
            </div>
          )}

          {/* Botón Ingresar */}
          <button
            type="submit"
            className="login-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="spin-icon" size={20} />
                Ingresando...
              </>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>

        {/* Footer */}
        <footer className="login-footer">
          <p>Sistema de seguridad • Claro Colombia</p>
        </footer>
      </main>
    </div>
  );
}
