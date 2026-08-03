/**
 * Traduce mensajes de error tecnicos en ingles de Supabase / Postgres / Auth
 * a mensajes claros y profesionales en espanol.
 */
export function translateError(error: any): string {
  if (!error) return 'Ocurrió un error inesperado.';

  const rawMessage = (
    typeof error === 'string'
      ? error
      : error?.message || error?.error_description || error?.details || String(error)
  ).toLowerCase();

  // 1. Usuario ya registrado / duplicado
  if (
    rawMessage.includes('already been registered') ||
    rawMessage.includes('already registered') ||
    rawMessage.includes('user_already_exists') ||
    rawMessage.includes('unique constraint') ||
    rawMessage.includes('perfiles_cedula_key') ||
    rawMessage.includes('duplicate key')
  ) {
    return 'Este usuario (número de cédula) ya se encuentra registrado en el sistema.';
  }

  // 2. Contrasena corta
  if (
    rawMessage.includes('password should be at least') ||
    rawMessage.includes('password is too short') ||
    rawMessage.includes('at least 6 characters')
  ) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }

  // 3. Credenciales invalidas
  if (
    rawMessage.includes('invalid login credentials') ||
    rawMessage.includes('invalid_credentials')
  ) {
    return 'Número de identificación o contraseña incorrecta.';
  }

  // 4. Formato invalido de cedula / email
  if (
    rawMessage.includes('invalid email') ||
    rawMessage.includes('email_invalid')
  ) {
    return 'El número de identificación o cédula ingresado no es válido.';
  }

  // 5. Exceso de intentos / Rate limit
  if (
    rawMessage.includes('rate limit') ||
    rawMessage.includes('too many requests')
  ) {
    return 'Demasiados intentos. Por favor espere un momento e intente de nuevo.';
  }

  // 6. Restriccion de clave foranea al eliminar usuarios o minutas
  if (
    rawMessage.includes('violates foreign key constraint') ||
    rawMessage.includes('foreign key constraint')
  ) {
    return 'No se puede eliminar este usuario porque ya tiene minutas registradas en el sistema.';
  }

  // 7. Permisos o sesion faltante
  if (
    rawMessage.includes('auth session missing') ||
    rawMessage.includes('jwt expired') ||
    rawMessage.includes('service_role')
  ) {
    return 'Error de permisos o sesión de administrador. Intente iniciar sesión nuevamente.';
  }

  // 8. Problemas de red o conexion
  if (
    rawMessage.includes('failed to fetch') ||
    rawMessage.includes('network') ||
    rawMessage.includes('networkError')
  ) {
    return 'Error de conexión a internet. Verifique su red e intente de nuevo.';
  }

  // Si el mensaje ya esta formateado en espanol (contiene tildes o palabras en espanol)
  if (typeof error === 'string') {
    return error;
  }

  if (error?.message && typeof error.message === 'string') {
    // Si la cadena de mensaje no parece ser puramente un texto generico en ingles, se devuelve
    if (/Error al|No se pudo|Por favor|Ocurrió|incorrecta|cédula/i.test(error.message)) {
      return error.message;
    }
  }

  return 'Ocurrió un error al procesar la solicitud. Por favor intente nuevamente.';
}
