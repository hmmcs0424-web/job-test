// 결과를 엑셀(Excel)에서 바로 열리는 CSV 파일로 내보내는 유틸
function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers, ...rows].map(row =>
    row.map(cell => escapeCsvField(String(cell))).join(',')
  );
  const csvContent = lines.join('\r\n');
  // Excel이 UTF-8을 올바르게 인식하도록 BOM 추가
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
