import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          padding: '1.5rem',
          backgroundColor: '#fff8f7',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <AlertTriangle size={32} color="#da2d34" />
          </div>
          
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#1e293b',
            marginBottom: '0.5rem'
          }}>
            Ocurrió un problema inesperado
          </h2>
          
          <p style={{
            fontSize: '0.875rem',
            color: '#64748b',
            maxWidth: '360px',
            marginBottom: '1.5rem',
            lineHeight: 1.5
          }}>
            La aplicación experimentó un inconveniente temporal al procesar la información. Por favor toque el botón a continuación para recargar.
          </p>

          <button
            onClick={this.handleReload}
            style={{
              backgroundColor: '#da2d34',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(218,45,52,0.2)'
            }}
          >
            <RefreshCw size={18} />
            Recargar Aplicación
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
