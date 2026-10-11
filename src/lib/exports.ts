import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Media } from '@capacitor-community/media';
import { dateLabel, fa } from './jalali';

export type RecordEntry = { date: string; nissan: number; arisan: number; khavar: number; note: string; nissanRate?: number; arisanRate?: number; khavarRate?: number; cost?: number; received?: number };
export type WageRates = { nissan: number; arisan: number; khavar: number };
const wages = (r: RecordEntry, rates: WageRates) => r.nissan * (r.nissanRate ?? rates.nissan) + r.arisan * (r.arisanRate ?? rates.arisan) + r.khavar * (r.khavarRate ?? rates.khavar);
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
const cells = (r: RecordEntry, rates: WageRates) => [dateLabel(r.date), r.nissan, r.arisan, r.khavar, totalOf(r), r.note, r.nissan * (r.nissanRate ?? rates.nissan), r.arisan * (r.arisanRate ?? rates.arisan), r.khavar * (r.khavarRate ?? rates.khavar), wages(r, rates)];
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
  canvas.height = Math.max(1120, 690 + rows.length * 64);
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
  // Prominent colored wage summary card; deliberately excludes all finance/income fields.
  const wageGradient = ctx.createLinearGradient(85, 405, 1115, 535);
  wageGradient.addColorStop(0, '#075a50'); wageGradient.addColorStop(0.55, '#087f62'); wageGradient.addColorStop(1, '#176f91');
  ctx.fillStyle = wageGradient;
  ctx.beginPath(); ctx.roundRect(85, 408, 1030, 128, 20); ctx.fill();
  // Center the report wage title and amount inside the full colored card.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b8f0d9'; ctx.font = 'bold 30px Vazirmatn, sans-serif';
  ctx.fillText('جمع دستمزد کل این گزارش', 600, 449);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 42px Vazirmatn, sans-serif';
  ctx.fillText(`${fa(totalWages(rows, rates).toLocaleString('en-US'))} تومان`, 600, 493);
  const rateBoxes = [{x: 110, label: 'نرخ نیسان', value: rates.nissan}, {x: 430, label: 'نرخ آریسان', value: rates.arisan}, {x: 750, label: 'نرخ خاور', value: rates.khavar}];
  rateBoxes.forEach((item) => {
    ctx.fillStyle = '#ffffff24'; ctx.beginPath(); ctx.roundRect(item.x, 497, 285, 29, 9); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px Vazirmatn, sans-serif';
    ctx.textAlign = 'center'; ctx.fillText(`${item.label}: ${fa(item.value.toLocaleString('en-US'))} تومان`, item.x + 142, 518);
  });
  ctx.textAlign = 'right';
  const cols = [1080, 755, 625, 495, 365];
  // Colored rounded frame around the vehicle-count table header.
  const tableGradient = ctx.createLinearGradient(85, 550, 1115, 608);
  tableGradient.addColorStop(0, '#075a50'); tableGradient.addColorStop(0.55, '#087f62'); tableGradient.addColorStop(1, '#176f91');
  ctx.fillStyle = tableGradient; ctx.beginPath(); ctx.roundRect(85, 550, 1030, 58, 12); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px Vazirmatn, sans-serif';
  ['تاریخ', 'نیسان', 'آریسان', 'خاور', 'جمع'].forEach((label, i) => ctx.fillText(label, cols[i], 589));
  ctx.font = '23px Vazirmatn, sans-serif';
  rows.forEach((r, i) => {
    const y = 608 + i * 64;
    if (i % 2 === 1) { ctx.fillStyle = '#f7faf8'; ctx.fillRect(85, y, 1030, 64); }
    ctx.fillStyle = '#314642';
    [dateLabel(r.date), fa(r.nissan), fa(r.arisan), fa(r.khavar), fa(totalOf(r))].forEach((value, index) => ctx.fillText(value, cols[index], y + 42));
  });
  // Add a colored closing total row with a clear frame.
  const totalY = 608 + rows.length * 64;
  ctx.fillStyle = '#e0f3eb'; ctx.fillRect(85, totalY, 1030, 60);
  ctx.strokeStyle = '#08795b'; ctx.lineWidth = 2; ctx.strokeRect(85, totalY, 1030, 60);
  ctx.fillStyle = '#075a50'; ctx.font = 'bold 24px Vazirmatn, sans-serif';
  [ 'جمع کل', fa(sumRows(rows).nissan), fa(sumRows(rows).arisan), fa(sumRows(rows).khavar), fa(sumRows(rows).total) ].forEach((value, index) => ctx.fillText(value, cols[index], totalY + 39));
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
  if (type === 'jpg') {
    // In the installed Android app, save the real JPEG directly to the photo gallery.
    if (Capacitor.isNativePlatform()) {
      const albumName = 'مدیریت تخلیه بار';
      let albums = (await Media.getAlbums()).albums;
      let album = albums.find((item) => item.name === albumName);
      if (!album) {
        await Media.createAlbum({ name: albumName });
        albums = (await Media.getAlbums()).albums;
        album = albums.find((item) => item.name === albumName);
      }
      if (!album) throw new Error('گالری گزارش ساخته نشد');
      await Media.savePhoto({ path: data, albumIdentifier: album.identifier, fileName: filename.replace(/\.jpg$/i, '') });
    } else {
      save(new Blob([bytes], { type: 'image/jpeg' }), filename.replace(/\.jpg$/i, '') + '.jpg');
    }
  } else {
    save(makePdf(bytes, canvas.width, canvas.height), filename.replace(/\.pdf$/i, '') + '.pdf');
  }
}
export async function exportBackup(rows: RecordEntry[], bundle: { rateBook: unknown; moneyEntries: unknown }) {
  const filename = 'poshtiban-bar-' + Date.now() + '.json';
  const json = JSON.stringify({ version: 4, records: rows, rateBook: bundle.rateBook, moneyEntries: bundle.moneyEntries, exportedAt: new Date().toISOString() }, null, 2);
  if (Capacitor.isNativePlatform()) {
    // Android WebView downloads are not reliably written to public Downloads.
    // Write a real JSON file to app cache, then hand it to Android's native share/save sheet.
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const result = await Filesystem.writeFile({ path: filename, data: btoa(binary), directory: Directory.Cache, recursive: true });
    await Share.share({ title: 'نسخه پشتیبان مدیریت تخلیه بار', text: 'فایل نسخه پشتیبان برنامه مدیریت تخلیه بار', files: [result.uri], dialogTitle: 'انتخاب محل ذخیره نسخه پشتیبان' });
    return;
  }
  save(new Blob([json], { type: 'application/json;charset=utf-8' }), filename);
}
