/**
 * Convierte un texto a Formato Título (Primera letra de cada palabra en Mayúscula, el resto en Minúscula).
 * Ejemplo: "JUAN CARLOS PEREZ GOMEZ" -> "Juan Carlos Perez Gomez"
 */
export function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .filter(Boolean)
    .join(' ');
}
