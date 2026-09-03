import ExcelJS from 'exceljs';
import { formatearFechaHoraColombia, ZONA_HORARIA_COLOMBIA } from '../../utils/fechasColombia';

export interface MinutaReporte {
  fecha_hora: string;
  cedula: string;
  vigilante: string;
  sede: string;
  tipo: string;
  descripcion: string;
}

export interface PuestoAuditoriaReporte {
  sede: string;
  estado: string;
  totalPeriodo: number;
  promedioDiario: string;
  ultimaFecha: string;
  ultimoVigilante: string;
  cedula: string;
}

export async function descargarReporteExcel(
  minutas: MinutaReporte[],
  tituloPeriodo: string,
  puestos?: PuestoAuditoriaReporte[]
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Reporte de Minutas');

  // Fila de título corporativo
  worksheet.mergeCells('A1:F1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `REPORTE DE MINUTAS DE SEGURIDAD - CLARO COLOMBIA (${tituloPeriodo.toUpperCase()})`;
  titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDA2D34' }
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  // Fila de metadatos
  worksheet.mergeCells('A2:F2');
  const subCell = worksheet.getCell('A2');
  subCell.value = `Generado: ${new Date().toLocaleString('es-CO', { timeZone: ZONA_HORARIA_COLOMBIA })} | Total Registros: ${minutas.length}`;
  subCell.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF5C403E' } };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFE1DF' }
  };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 18;

  // Encabezados de tabla
  const headers = ['Fecha y Hora', 'Cédula', 'Vigilante', 'Sede', 'Tipo de Anotación', 'Descripción'];
  const headerRow = worksheet.addRow(headers);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF281716' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE4BDBA' } },
      bottom: { style: 'thin', color: { argb: 'FFE4BDBA' } },
      left: { style: 'thin', color: { argb: 'FFE4BDBA' } },
      right: { style: 'thin', color: { argb: 'FFE4BDBA' } }
    };
  });

  // Datos
  minutas.forEach((m, idx) => {
    const row = worksheet.addRow([
      formatearFechaHoraColombia(m.fecha_hora),
      m.cedula,
      m.vigilante,
      m.sede,
      m.tipo,
      m.descripcion
    ]);
    row.height = 20;
    
    // Color alternado
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF8F7' }
        };
      });
    }

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9.5 };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 6 ? 'left' : 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFF1D3D1' } },
        bottom: { style: 'thin', color: { argb: 'FFF1D3D1' } },
        left: { style: 'thin', color: { argb: 'FFF1D3D1' } },
        right: { style: 'thin', color: { argb: 'FFF1D3D1' } }
      };
    });
  });

  // Anchos de columna
  worksheet.columns = [
    { width: 19 }, // Fecha
    { width: 15 }, // Cédula
    { width: 26 }, // Vigilante
    { width: 24 }, // Sede
    { width: 20 }, // Tipo
    { width: 50 }  // Descripción
  ];

  // ─── Hoja Secundaria: Auditoría de Puestos de Vigilancia ────────
  if (puestos && puestos.length > 0) {
    const wsPuestos = workbook.addWorksheet('Auditoría de Puestos');

    wsPuestos.mergeCells('A1:G1');
    const titleAudit = wsPuestos.getCell('A1');
    titleAudit.value = `AUDITORÍA DE ACTIVIDAD POR PUESTO - CLARO COLOMBIA (${tituloPeriodo.toUpperCase()})`;
    titleAudit.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    titleAudit.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDA2D34' }
    };
    titleAudit.alignment = { horizontal: 'center', vertical: 'middle' };
    wsPuestos.getRow(1).height = 30;

    wsPuestos.mergeCells('A2:G2');
    const subAudit = wsPuestos.getCell('A2');
    subAudit.value = `Generado: ${new Date().toLocaleString('es-CO', { timeZone: ZONA_HORARIA_COLOMBIA })} | Total Puestos Auditados: ${puestos.length}`;
    subAudit.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF5C403E' } };
    subAudit.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFE1DF' }
    };
    subAudit.alignment = { horizontal: 'center', vertical: 'middle' };
    wsPuestos.getRow(2).height = 18;

    const headersPuestos = [
      'Puesto / Sede',
      'Estado de Actividad',
      'Minutas en Periodo',
      'Promedio Diario',
      'Última Actividad Registrada',
      'Último Vigilante',
      'Cédula Vigilante'
    ];
    const headerRowAudit = wsPuestos.addRow(headersPuestos);
    headerRowAudit.height = 24;
    headerRowAudit.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF281716' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE4BDBA' } },
        bottom: { style: 'thin', color: { argb: 'FFE4BDBA' } },
        left: { style: 'thin', color: { argb: 'FFE4BDBA' } },
        right: { style: 'thin', color: { argb: 'FFE4BDBA' } }
      };
    });

    puestos.forEach((p, idx) => {
      const row = wsPuestos.addRow([
        p.sede,
        p.estado,
        p.totalPeriodo,
        `${p.promedioDiario} / día`,
        p.ultimaFecha,
        p.ultimoVigilante,
        p.cedula
      ]);
      row.height = 20;

      let colorFondo = idx % 2 === 1 ? 'FFFFF8F7' : 'FFFFFFFF';
      if (p.totalPeriodo === 0) {
        colorFondo = 'FFFFEFEF'; // Rojo suave para inactivos
      } else if (p.estado.includes('Baja')) {
        colorFondo = 'FFFFFBEB'; // Amarillo suave para baja actividad
      }

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9.5 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colorFondo }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 1 || colNumber === 6 ? 'left' : 'center'
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFF1D3D1' } },
          bottom: { style: 'thin', color: { argb: 'FFF1D3D1' } },
          left: { style: 'thin', color: { argb: 'FFF1D3D1' } },
          right: { style: 'thin', color: { argb: 'FFF1D3D1' } }
        };
      });
    });

    wsPuestos.columns = [
      { width: 28 }, // Sede
      { width: 22 }, // Estado
      { width: 20 }, // Total
      { width: 18 }, // Promedio
      { width: 24 }, // Última fecha
      { width: 26 }, // Vigilante
      { width: 18 }  // Cédula
    ];
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Reporte_Minutas_${new Date().toISOString().slice(0, 10)}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
