import { useState } from 'react';
import { X, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '../../config/supabaseAdmin';
import { translateError } from '../../utils/errorTranslator';
import { toTitleCase } from '../../utils/formatters';

interface ModalCargaMasivaProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (msg?: string) => void;
}

interface UsuarioImport {
  cedula: string;
  nombre: string;
  rol: 'vigilante' | 'supervisor' | 'administrador';
  contrasena: string;
  isValid: boolean;
  errorMsg?: string;
  status?: 'pending' | 'loading' | 'success' | 'error';
  resultMsg?: string;
}

export default function ModalCargaMasiva({ isOpen, onClose, onSaved }: ModalCargaMasivaProps) {
  const [usuarios, setUsuarios] = useState<UsuarioImport[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);

  if (!isOpen) return null;

  // Descargar plantilla Excel (.xlsx) con desplegable nativo mediante ExcelJS
  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Usuarios');

      // Configurar columnas
      worksheet.columns = [
        { header: 'cedula', key: 'cedula', width: 18 },
        { header: 'nombre', key: 'nombre', width: 26 },
        { header: 'rol', key: 'rol', width: 20 },
        { header: 'contrasena', key: 'contrasena', width: 18 }
      ];

      // Formatear ÚNICAMENTE las celdas con título (A1..D1) en Rojo Claro
      ['A1', 'B1', 'C1', 'D1'].forEach(cellRef => {
        const cell = worksheet.getCell(cellRef);
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDA2D34' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });

      // Agregar filas de ejemplo con números de cédula
      worksheet.addRow({ cedula: 1001234567, nombre: 'Carlos Mendoza', rol: 'vigilante', contrasena: 'clave123' });
      worksheet.addRow({ cedula: 1007654321, nombre: 'Laura Restrepo', rol: 'supervisor', contrasena: 'clave123' });
      worksheet.addRow({ cedula: 1009876543, nombre: 'Admin General', rol: 'administrador', contrasena: 'admin2026' });

      // Aplicar formato numérico limpio a la columna cédula (A) y validación de datos a la columna rol (C)
      for (let r = 2; r <= 300; r++) {
        worksheet.getCell(`A${r}`).numFmt = '0';

        const cellRol = worksheet.getCell(`C${r}`);
        cellRol.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"vigilante,supervisor,administrador"'],
          showErrorMessage: true,
          errorTitle: 'Rol no válido',
          error: 'Seleccione un rol válido de la lista: vigilante, supervisor o administrador.'
        };
      }

      // Exportar archivo .xlsx
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'plantilla_usuarios_minutas.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generando plantilla Excel con ExcelJS:', err);
      alert('Error descargando la plantilla.');
    }
  };

  // Cambiar rol de una fila individual desde el selector desplegable de la tabla de vista previa
  const handleRolChange = (index: number, newRol: 'vigilante' | 'supervisor' | 'administrador') => {
    setUsuarios(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], rol: newRol };
      return copy;
    });
  };

  // Procesar archivo Excel (.xlsx / .xls) o CSV
  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convertir hoja a filas JSON
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawRows.length === 0) {
          alert('El archivo no contiene filas de datos.');
          return;
        }

        const parsed: UsuarioImport[] = [];
        const cedulasVistas = new Set<string>();

        for (const row of rawRows) {
          const keys = Object.keys(row);
          const getKey = (term: string) => keys.find(k => k.toLowerCase().includes(term));

          const cedulaKey = getKey('cedula') || getKey('cc') || getKey('id') || keys[0];
          const nombreKey = getKey('nombre') || getKey('usuario') || keys[1];
          const rolKey = getKey('rol') || getKey('perfil') || keys[2];
          const passKey = getKey('contrase') || getKey('pass') || getKey('clave') || keys[3];

          const cedulaRaw = String(row[cedulaKey] || '').replace(/\D/g, '');
          const nombre = toTitleCase(String(row[nombreKey] || ''));
          const rolRaw = String(row[rolKey] || '').toLowerCase().trim();
          const contrasena = String(row[passKey] || 'password123').trim();

          let rol: 'vigilante' | 'supervisor' | 'administrador' = 'vigilante';
          if (rolRaw.includes('admin')) rol = 'administrador';
          else if (rolRaw.includes('super')) rol = 'supervisor';

          let isValid = true;
          let errorMsg = '';

          if (!cedulaRaw) {
            isValid = false;
            errorMsg = 'Falta cédula válida';
          } else if (cedulaRaw.length < 5) {
            isValid = false;
            errorMsg = 'Cédula muy corta';
          } else if (!nombre) {
            isValid = false;
            errorMsg = 'Falta nombre completo';
          } else if (cedulasVistas.has(cedulaRaw)) {
            isValid = false;
            errorMsg = 'Cédula duplicada en archivo';
          } else {
            cedulasVistas.add(cedulaRaw);
          }

          parsed.push({
            cedula: cedulaRaw,
            nombre,
            rol,
            contrasena: contrasena || 'password123',
            isValid,
            errorMsg,
            status: 'pending'
          });
        }

        setUsuarios(parsed);
      } catch (err) {
        console.error('Error leyendo archivo Excel:', err);
        alert('No se pudo procesar el archivo. Asegúrese de que sea un archivo Excel (.xlsx, .xls) o CSV válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Iniciar la creación masiva
  const handleStartImport = async () => {
    const validUsers = usuarios.filter(u => u.isValid);
    if (validUsers.length === 0) {
      alert('No hay usuarios válidos para importar.');
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: validUsers.length });

    const updatedUsers = [...usuarios];
    let createdCount = 0;

    for (let i = 0; i < updatedUsers.length; i++) {
      const u = updatedUsers[i];
      if (!u.isValid) continue;

      u.status = 'loading';
      setUsuarios([...updatedUsers]);

      try {
        const { error: signUpError } = await supabaseAdmin.auth.admin.createUser({
          email: `${u.cedula}@minutas.com`,
          password: u.contrasena,
          email_confirm: true,
          user_metadata: {
            cedula: u.cedula,
            nombre: u.nombre,
            rol: u.rol,
            contrasena: u.contrasena
          }
        });

        if (signUpError) {
          u.status = 'error';
          u.resultMsg = translateError(signUpError);
        } else {
          u.status = 'success';
          u.resultMsg = 'Usuario creado con éxito';
          createdCount++;
        }
      } catch (err: any) {
        u.status = 'error';
        u.resultMsg = translateError(err);
      }

      setProgress({ current: createdCount, total: validUsers.length });
      setUsuarios([...updatedUsers]);
    }

    setIsProcessing(false);
    setIsFinished(true);
  };

  const handleReset = () => {
    setUsuarios([]);
    setFileName('');
    setIsProcessing(false);
    setIsFinished(false);
    setProgress({ current: 0, total: 0 });
  };

  const handleDone = () => {
    const createdCount = usuarios.filter(u => u.status === 'success').length;
    onSaved(`${createdCount} usuarios importados con éxito`);
  };

  const validCount = usuarios.filter(u => u.isValid).length;
  const invalidCount = usuarios.filter(u => !u.isValid).length;

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in" style={{ maxWidth: '660px', width: '95%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet color="#da2d34" size={24} />
            <h2>Carga Masiva de Usuarios (.xlsx)</h2>
          </div>
          <button className="btn-icon" onClick={onClose} disabled={isProcessing}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '75vh' }}>
          {usuarios.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#fff0ef', padding: '16px', borderRadius: '12px', border: '1px solid #ffe1df' }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#281716', lineHeight: 1.5 }}>
                  Suba un archivo de Excel <strong>.xlsx</strong> con la lista de usuarios. Asegúrese de incluir las columnas:
                  <code style={{ background: '#ffffff', padding: '2px 6px', borderRadius: '4px', margin: '0 4px', border: '1px solid #e4bdba' }}>
                    cedula, nombre, rol, contrasena
                  </code>
                </p>
                <button 
                  onClick={handleDownloadTemplate} 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '12px',
                    background: '#ffffff',
                    border: '1px solid #da2d34',
                    color: '#da2d34',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Download size={16} />
                  Descargar Plantilla Excel (.xlsx)
                </button>
              </div>

              {/* Zona Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragActive ? '#da2d34' : '#e4bdba'}`,
                  borderRadius: '16px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: dragActive ? '#fff0ef' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => document.getElementById('excelFileInput')?.click()}
              >
                <Upload size={36} color="#da2d34" style={{ marginBottom: '12px' }} />
                <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#281716' }}>
                  Arrastra tu archivo Excel (.xlsx) aquí o haz clic para seleccionar
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#906f6d' }}>
                  Formato soportado: .xlsx
                </p>
                <input
                  id="excelFileInput"
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Resumen del archivo cargado */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f7f3f2', padding: '12px 16px', borderRadius: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#281716' }}>📊 {fileName}</span>
                <button 
                  onClick={handleReset} 
                  disabled={isProcessing}
                  style={{ background: 'none', border: 'none', color: '#da2d34', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                  Cambiar archivo
                </button>
              </div>

              {/* Stats badges */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ background: '#e4fcf4', color: '#00875a', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 600 }}>
                  ✓ {validCount} Válidos
                </span>
                {invalidCount > 0 && (
                  <span style={{ background: '#ffe1df', color: '#ba1a1a', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 600 }}>
                    ⚠ {invalidCount} Con Advertencias/Errores
                  </span>
                )}
              </div>

              {/* Progress bar si está procesando */}
              {isProcessing && (
                <div style={{ background: '#fff0ef', padding: '12px 16px', borderRadius: '12px', border: '1px solid #ffe1df' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#da2d34' }}>
                    <span>Creando usuarios en Supabase...</span>
                    <span>{progress.current} de {progress.total}</span>
                  </div>
                  <div style={{ background: '#e4bdba', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        background: '#da2d34', 
                        height: '100%', 
                        width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                        transition: 'width 0.3s' 
                      }} 
                    />
                  </div>
                </div>
              )}

              {/* Tabla de Vista Previa */}
              <div style={{ overflowX: 'auto', maxHeight: '280px', border: '1px solid #e4bdba', borderRadius: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#fff8f7', borderBottom: '1px solid #e4bdba', color: '#5c403e' }}>
                      <th style={{ padding: '10px 12px' }}>Cédula</th>
                      <th style={{ padding: '10px 12px' }}>Nombre</th>
                      <th style={{ padding: '10px 12px' }}>Rol (Desplegable)</th>
                      <th style={{ padding: '10px 12px' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f7f3f2', background: !u.isValid ? '#fff5f5' : 'transparent' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{u.cedula || '-'}</td>
                        <td style={{ padding: '10px 12px' }}>{u.nombre || '-'}</td>
                        <td style={{ padding: '6px 12px' }}>
                          <select
                            className={`badge-rol ${u.rol}`}
                            value={u.rol}
                            disabled={isProcessing || u.status === 'success'}
                            onChange={(e) => handleRolChange(idx, e.target.value as 'vigilante' | 'supervisor' | 'administrador')}
                            style={{
                              border: '1px solid rgba(228, 189, 186, 0.6)',
                              borderRadius: '12px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: isProcessing || u.status === 'success' ? 'not-allowed' : 'pointer',
                              outline: 'none',
                              fontFamily: 'Inter, sans-serif'
                            }}
                          >
                            <option value="vigilante" style={{ background: '#ffffff', color: '#281716' }}>vigilante</option>
                            <option value="supervisor" style={{ background: '#ffffff', color: '#281716' }}>supervisor</option>
                            <option value="administrador" style={{ background: '#ffffff', color: '#281716' }}>administrador</option>
                          </select>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {u.status === 'loading' ? (
                            <Loader2 size={16} className="spin-icon" color="#da2d34" />
                          ) : u.status === 'success' ? (
                            <span style={{ color: '#00875a', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                              <CheckCircle2 size={16} /> Éxito
                            </span>
                          ) : u.status === 'error' ? (
                            <span style={{ color: '#ba1a1a', fontSize: '12px' }}>
                              ❌ {u.resultMsg}
                            </span>
                          ) : !u.isValid ? (
                            <span style={{ color: '#ba1a1a', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                              <AlertCircle size={14} /> {u.errorMsg}
                            </span>
                          ) : (
                            <span style={{ color: '#64748b' }}>Listo</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {usuarios.length > 0 && !isFinished ? (
            <>
              <button className="btn-cancel" onClick={onClose} disabled={isProcessing}>
                Cancelar
              </button>
              <button 
                className="btn-crear" 
                onClick={handleStartImport} 
                disabled={isProcessing || validCount === 0}
              >
                {isProcessing && <Loader2 size={16} className="spin-icon" />}
                {isProcessing ? 'Importando...' : `Importar ${validCount} Usuarios`}
              </button>
            </>
          ) : isFinished ? (
            <button className="btn-crear" onClick={handleDone}>
              Finalizar y Ver Usuarios
            </button>
          ) : (
            <button className="btn-cancel" onClick={onClose}>
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
