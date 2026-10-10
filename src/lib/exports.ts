import { dateLabel, fa } from './jalali';

export type RecordEntry = { date: string; nissan: number; arisan: number; khavar: number; note: string };
export type WageRates = { nissan: number; arisan: number; khavar: number };
const wages = (r: RecordEntry, rates: WageRates) => r.nissan * rates.nissan + r.arisan * rates.arisan + r.khavar * rates.khavar;
const totalWages = (rows: RecordEntry[], rates: WageRates) => rows.reduce((sum, r) => sum + wages(r, rates), 0);
export const totalOf = (r: RecordEntry) => r.nissan + r.arisan + r.khavar;
export const sumRows = (rows: RecordEntry[]) => rows.reduce((sum, r) => ({ nissan: sum.nissan + r.nissan, arisan: sum.arisan + r.arisan, khavar: sum.khavar + r.khavar, total: sum.total + totalOf(r) }), { nissan: 0, arisan: 0, khavar: 0, total: 0 });

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const headers = ['تاریخ', 'نیسان', 'آریسان', 'خاور', 'جمع کل', 'توضیحات', 'دستمزد نیسان (تومان)', 'دستمزد آریسان (تومان)', 'دستمزد خاور (تومان)', 'جمع دستمزد (تومان)'];
const cells = (r: RecordEntry, rates: WageRates) => [dateLabel(r.date), r.nissan, r.arisan, r.khavar, totalOf(r), r.note, r.nissan * rates.nissan, r.arisan * rates.arisan, r.khavar * rates.khavar, wages(r, rates)];
const totals = (rows: RecordEntry[], rates: WageRates) => { const s = sumRows(rows); return ['مجموع', s.nissan, s.arisan, s.khavar, s.total, '', s.nissan * rates.nissan, s.arisan * rates.arisan, s.khavar * rates.khavar, totalWages(rows, rates)]; };

export function exportCsv(rows: RecordEntry[], filename: string, rates: WageRates) {
  const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const text = '\uFEFF' + [headers, ...rows.map(r => cells(r, rates)), totals(rows, rates)].map(row => row.map(quote).join(',')).join('\r\n');
  save(new Blob([text], { type: 'text/csv;charset=utf-8' }), filename + '.csv');
}
export function exportExcel(rows: RecordEntry[], filename: string, rates: WageRates) {
  const rowXml = (row: (string | number)[]) => `<Row>${row.map(value => `<Cell><Data ss:Type="${typeof value === 'number' ? 'Number' : 'String'}">${escapeXml(String(value))}</Data></Cell>`).join('')}</Row>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#DBEEE8" ss:Pattern="Solid"/></Style></Styles><Worksheet ss:Name="گزارش تخلیه"><Table>${rowXml(headers)}${rows.map(r => rowXml(cells(r, rates))).join('')}${rowXml(totals(rows, rates))}</Table></Worksheet></Workbook>`;
  save(new Blob(['\uFEFF', xml], { type: 'application/vnd.ms-excel;charset=utf-8' }), filename + '.xls');
}

async function drawReport(rows: RecordEntry[], title: string, rates: WageRates): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = Math.max(1000, 540 + rows.length * 64);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  const { width: w, height: h } = canvas;
  ctx.fillStyle = '#f6f8f7'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(44, 44, w - 88, h - 88);
  ctx.fillStyle = '#08795b'; ctx.fillRect(44, 44, w - 88, 14);
  ctx.direction = 'rtl'; ctx.textAlign = 'right';
  ctx.fillStyle = '#172b2a'; ctx.font = 'bold 46px Vazirmatn, sans-serif';
  ctx.fillText('مدیریت تخلیه بار روزانه', 1100, 145);
  ctx.font = '30px Vazirmatn, sans-serif'; ctx.fillStyle = '#5e7370'; ctx.fillText(title, 1100, 207);
  ctx.font = '24px Vazirmatn, sans-serif'; ctx.fillText(`تعداد روزهای ثبت‌شده: ${fa(rows.length)}`, 1100, 255);
  const totals = sumRows(rows);
  ctx.fillStyle = '#e8f5ef'; ctx.fillRect(85, 289, 1030, 105);
  ctx.fillStyle = '#08795b'; ctx.font = 'bold 29px Vazirmatn, sans-serif';
  ctx.fillText(`مجموع کل: ${fa(totals.total)} بار`, 1065, 354);
  ctx.font = '24px Vazirmatn, sans-serif';
  ctx.fillText(`نیسان ${fa(totals.nissan)}  |  آریسان ${fa(totals.arisan)}  |  خاور ${fa(totals.khavar)}`, 670, 354);
  ctx.fillStyle = '#344b48'; ctx.font = '22px Vazirmatn, sans-serif';
  ctx.fillText(`جمع دستمزد: ${fa(totalWages(rows, rates).toLocaleString('en-US'))} تومان  |  نرخ هر بار: نیسان ${fa(rates.nissan.toLocaleString('en-US'))}، آریسان ${fa(rates.arisan.toLocaleString('en-US'))}، خاور ${fa(rates.khavar.toLocaleString('en-US'))}`, 1080, 414);
  const cols = [1080, 755, 625, 495, 365];
  ctx.fillStyle = '#eaf0ed'; ctx.fillRect(85, 435, 1030, 58);
  ctx.fillStyle = '#334b48'; ctx.font = 'bold 24px Vazirmatn, sans-serif';
  ['تاریخ', 'نیسان', 'آریسان', 'خاور', 'جمع'].forEach((label, i) => ctx.fillText(label, cols[i], 474));
  ctx.font = '23px Vazirmatn, sans-serif';
  rows.forEach((r, i) => {
    const y = 493 + i * 64;
    if (i % 2 === 1) { ctx.fillStyle = '#f7faf8'; ctx.fillRect(85, y, 1030, 64); }
    ctx.fillStyle = '#314642';
    [dateLabel(r.date), fa(r.nissan), fa(r.arisan), fa(r.khavar), fa(totalOf(r))].forEach((value, index) => ctx.fillText(value, cols[index], y + 42));
  });
  return canvas;
}

function makePdf(jpeg: Uint8Array, imageWidth: number, imageHeight: number): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const offsets = [0];
  const add = (part: string | Uint8Array) => { const bytes = typeof part === 'string' ? encoder.encode(part) : part; chunks.push(bytes); offset += bytes.length; };
  add('%PDF-1.4\n');
  const obj = (number: number, body: string) => { offsets[number] = offset; add(`${number} 0 obj\n${body}\nendobj\n`); };
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  offsets[4] = offset;
  add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  add(jpeg); add('\nendstream\nendobj\n');
  const draw = 'q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n';
  obj(5, `<< /Length ${encoder.encode(draw).length} >>\nstream\n${draw}endstream`);
  const xref = offset;
  add('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) add(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}
export async function exportImageOrPdf(rows: RecordEntry[], title: string, filename: string, type: 'jpg' | 'pdf', rates: WageRates) {
  const canvas = await drawReport(rows, title, rates);
  const data = canvas.toDataURL('image/jpeg', 0.92);
  const raw = atob(data.split(',')[1]);
  const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
  if (type === 'jpg') save(new Blob([bytes], { type: 'image/jpeg' }), filename + '.jpg');
  else save(makePdf(bytes, canvas.width, canvas.height), filename + '.pdf');
}
export function exportBackup(rows: RecordEntry[], rates: WageRates) {
  save(new Blob([JSON.stringify({ version: 2, records: rows, rates, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' }), 'poshtiban-bar-' + Date.now() + '.json');
}
