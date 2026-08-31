import ExcelJS from 'exceljs';

export interface MinutaReporte {
  fecha_hora: string;
  cedula: string;
  vigilante: string;
  sede: string;
  tipo: string;
  descripcion: string;
}

export async function descargarReporteExcel(minutas: MinutaReporte[], tituloPeriodo: string) {
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
  subCell.value = `Generado: ${new Date().toLocaleString('es-CO')} | Total Registros: ${minutas.length}`;
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
      new Date(m.fecha_hora).toLocaleString('es-CO', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
      }),
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

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Reporte_Minutas_${new Date().toISOString().slice(0, 10)}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
