import { escapeCSVField } from '@shared/csv';

export function exportCsv(headers: string[], rows: unknown[][], filename: string): void {
  const headerLine = headers.join(',');
  const dataLines = rows.map((row) => row.map(escapeCSVField).join(','));
  const blob = new Blob([[headerLine, ...dataLines].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
