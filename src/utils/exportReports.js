export function inExportRange(dateStr, preset, from, to) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (preset === 'today') return normalized.getTime() === today.getTime();
  if (preset === 'week') {
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);
    return normalized >= weekAgo && normalized <= today;
  }
  if (preset === 'month') {
    return normalized.getMonth() === today.getMonth() && normalized.getFullYear() === today.getFullYear();
  }
  if (preset === 'custom' && from && to) {
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return true;
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return normalized >= start && normalized <= end;
  }
  return true; // 'all'
}

function sanitizeFilename(name) {
  return String(name || 'export').trim().replace(/[^a-z0-9_\- ]/gi, '').replace(/\s+/g, '_') || 'export';
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCSV(filename, headers, rows) {
  const escapeCell = (val) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const lines = [headers.map(escapeCell).join(',')];
  rows.forEach((row) => lines.push(row.map(escapeCell).join(',')));
  // Leading BOM ensures Excel/Google Sheets read the UTF-8 (peso sign, etc.) correctly.
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${sanitizeFilename(filename)}.csv`);
}

export async function downloadXLSX(filename, headers, rows, sheetName = 'Report') {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(String(sheetName).slice(0, 31) || 'Report');

  worksheet.addRow(headers);
  worksheet.getRow(1).font = { bold: true };
  rows.forEach((row) => worksheet.addRow(row));

  worksheet.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 2, 40);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  triggerDownload(blob, `${sanitizeFilename(filename)}.xlsx`);
}