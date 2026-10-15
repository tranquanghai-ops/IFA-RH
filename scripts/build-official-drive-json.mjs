import fs from 'node:fs';
import path from 'node:path';
import { validateConferencesJsonPayload } from '../src/services/researchDriveJsonService.ts';

const SPREADSHEET_ID = '1eLiEZNC-vidouurOJ-usM1wImJT0unaVceslm2cg-Do';

async function fetchSheetRows(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?sheet=${encodeURIComponent(
    sheetName
  )}&tqx=out:json&_t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const text = await res.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w\W]*)\);/);
  if (!match) throw new Error('Cannot parse gviz response');
  const json = JSON.parse(match[1]);
  const cols = json.table.cols.map((c) => (c.label || c.id || '').trim());
  const rows = json.table.rows.map((r, rowIdx) => {
    const obj = {};
    cols.forEach((col, colIdx) => {
      const cell = r.c[colIdx];
      // Prefer formatted value cell.f, then value cell.v
      const val = cell ? (cell.f !== undefined && cell.f !== null ? cell.f : cell.v) : '';
      obj[col] = typeof val === 'string' ? val.trim() : val != null ? String(val).trim() : '';
    });
    return obj;
  });
  return rows;
}

function parseVietnameseDateToIso(str) {
  if (!str) return '';
  const s = String(str).trim();
  if (
    s.toLowerCase().includes('chưa') ||
    s.toLowerCase().includes('chua') ||
    s.toLowerCase().includes('thường') ||
    s.toLowerCase().includes('liên tục')
  ) {
    return '';
  }
  // Try dd/mm/yyyy or d/m/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3];
    return `${year}-${month}-${day}`;
  }
  return '';
}

function extractYear(title, dateStr) {
  const m1 = String(title).match(/\b(202[4-9]|203[0-5])\b/);
  if (m1) return Number(m1[1]);
  const m2 = String(title).match(/['’](\d{2})\b/);
  if (m2) return 2000 + Number(m2[1]);
  const m3 = String(dateStr).match(/\b(202[4-9]|203[0-5])\b/);
  if (m3) return Number(m3[1]);
  return 2026;
}

function formatIsoNowVN() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`;
}

async function main() {
  console.log('--- Đang đọc Google Sheets nguồn từ Spark (1eLiEZNC-vidouurOJ-usM1wImJT0unaVceslm2cg-Do) ---');
  const tnRows = await fetchSheetRows('HOI THAO');
  const qtRows = await fetchSheetRows('HOI THAO QT');

  console.log(`Đã đọc ${tnRows.length} hội thảo trong nước (HOI THAO)`);
  console.log(`Đã đọc ${qtRows.length} hội thảo quốc tế (HOI THAO QT)`);

  const tnCodes = ['TN0001', 'TN0002', 'TN0003', 'TN0004', 'TN0005', 'TN0006', 'TN0007'];
  const qtCodes = ['QT0001', 'QT0002', 'QT0003'];

  const conferences = [];

  // 1. Process 7 TN Rows
  tnRows.forEach((row, idx) => {
    const code = tnCodes[idx];
    const title = row['Tên hội thảo / cơ hội'];
    const organizer = row['Đơn vị tổ chức'];
    const country = row['Quốc gia'] || 'Việt Nam';
    const eventDate = row['Ngày tổ chức'];
    const year = extractYear(title, eventDate);

    const fullPaperIso = parseVietnameseDateToIso(row['Hạn gửi toàn văn']);
    const abstractIso = parseVietnameseDateToIso(row['Hạn gửi tóm tắt']);
    const regIso = parseVietnameseDateToIso(row['Hạn đăng ký']);
    const deadlineIso = fullPaperIso || abstractIso || regIso || '';

    const fee = row['Phí tham dự / đăng bài'] || '';
    const feeStatus = fee.toLowerCase().includes('miễn phí')
      ? 'FREE'
      : fee.toLowerCase().includes('chưa xác minh') || !fee
      ? 'UNKNOWN'
      : 'SPECIFIED';

    const tags = (row['Từ khóa'] || '')
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter(Boolean);

    const item = {
      code,
      category: 'TN',
      title,
      organizer,
      country,
      year,
      type: row['Loại cơ hội'] || 'Hội thảo',
      level: row['Cấp độ'] || 'Quốc tế',
      topic: row['Chủ đề chính'] || '',
      field: row['Ngành phù hợp'] || 'Chung Khoa MTCN',
      suitability: row['Mức độ phù hợp MTCN'] || 'Phù hợp',
      abstractDeadline: abstractIso || undefined,
      fullPaperDeadline: fullPaperIso || undefined,
      registrationDeadline: regIso || undefined,
      deadline: deadlineIso,
      eventDate: eventDate || undefined,
      location: row['Địa điểm / hình thức'] || undefined,
      fee: fee || undefined,
      publicationFee: feeStatus === 'FREE' ? 'Miễn phí' : fee || 'Không rõ chi phí',
      registrationFee: feeStatus === 'FREE' ? 'Miễn phí' : 'Không rõ chi phí',
      feeStatus,
      publicationFormat: row['Hình thức xuất bản'] || undefined,
      indexing: row['Indexing / ISBN / ISSN / Scopus / WoS'] || undefined,
      content: row['Tóm tắt nội dung'] || title,
      directions: row['Gợi ý hướng bài cho GV MTCN'] || undefined,
      sourceUrl: row['Link nguồn chính thức'] || undefined,
      submissionUrl: row['Link nộp bài'] || undefined,
      status: row['Trạng thái'] || 'CÒN HẠN',
      notes: row['Ghi chú'] || undefined,
      tags: tags.length > 0 ? tags : undefined,
      discoveredAt: parseVietnameseDateToIso(row['Ngày phát hiện']) || undefined,
    };

    conferences.push(item);
  });

  // 2. Process 3 QT Rows
  qtRows.forEach((row, idx) => {
    const code = qtCodes[idx];
    const title = row['Tên hội thảo / cơ hội'];
    const organizer = row['Đơn vị tổ chức'];
    // For QT, keep exact foreign country (Ý, Đức, Nam Phi)
    let country = row['Quốc gia'] || 'Nước ngoài';
    if (country.includes('Nam Phi')) country = 'Nam Phi';
    else if (country.includes('Ý')) country = 'Ý';
    else if (country.includes('Đức')) country = 'Đức';

    const eventDate = row['Ngày tổ chức'];
    const year = extractYear(title, eventDate);

    const fullPaperIso = parseVietnameseDateToIso(row['Hạn gửi toàn văn']);
    const abstractIso = parseVietnameseDateToIso(row['Hạn gửi tóm tắt']);
    const regIso = parseVietnameseDateToIso(row['Hạn đăng ký']);
    const deadlineIso = fullPaperIso || abstractIso || regIso || '';

    const fee = row['Phí tham dự / đăng bài'] || '';
    const feeStatus = fee.toLowerCase().includes('miễn phí')
      ? 'FREE'
      : fee.toLowerCase().includes('chưa xác minh') || !fee
      ? 'UNKNOWN'
      : 'SPECIFIED';

    const tags = (row['Từ khóa'] || '')
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter(Boolean);

    const item = {
      code,
      category: 'QT',
      title,
      organizer,
      country,
      year,
      type: row['Loại cơ hội'] || 'Hội thảo',
      level: row['Cấp độ'] || 'Quốc tế',
      topic: row['Chủ đề chính'] || '',
      field: row['Ngành phù hợp'] || 'Chung Khoa MTCN',
      suitability: row['Mức độ phù hợp MTCN'] || 'Phù hợp',
      abstractDeadline: abstractIso || undefined,
      fullPaperDeadline: fullPaperIso || undefined,
      registrationDeadline: regIso || undefined,
      deadline: deadlineIso,
      eventDate: eventDate || undefined,
      location: row['Địa điểm / hình thức'] || undefined,
      fee: fee || undefined,
      publicationFee: feeStatus === 'FREE' ? 'Miễn phí' : fee || 'Không rõ chi phí',
      registrationFee: feeStatus === 'FREE' ? 'Miễn phí' : 'Không rõ chi phí',
      feeStatus,
      publicationFormat: row['Hình thức xuất bản'] || undefined,
      indexing: row['Indexing / ISBN / ISSN / Scopus / WoS'] || undefined,
      content: row['Tóm tắt nội dung'] || title,
      directions: row['Gợi ý hướng bài cho GV MTCN'] || undefined,
      sourceUrl: row['Link nguồn chính thức'] || undefined,
      submissionUrl: row['Link nộp bài'] || undefined,
      status: row['Trạng thái'] || 'MỚI',
      notes: row['Ghi chú'] || undefined,
      tags: tags.length > 0 ? tags : undefined,
      discoveredAt: parseVietnameseDateToIso(row['Ngày phát hiện']) || undefined,
    };

    conferences.push(item);
  });

  const payload = {
    schemaVersion: 1,
    revision: 1,
    runId: '20261015-01',
    generatedAt: formatIsoNowVN(),
    nextCodes: {
      TN: 'TN0008',
      QT: 'QT0004',
    },
    conferences,
  };

  // Validate payload
  console.log('\n--- Kiểm định payload bằng validateConferencesJsonPayload ---');
  const validation = validateConferencesJsonPayload(payload);
  if (!validation.isValid) {
    console.error('LỖI SCHEMA:', validation.error);
    process.exit(1);
  }
  console.log('Xác thực Schema thành công! File JSON hợp lệ 100%.');

  // Save to IFA_RH_CONFERENCES.json
  const outPath = path.resolve('IFA_RH_CONFERENCES.json');
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`Đã ghi file JSON thành công: ${outPath} (${fs.statSync(outPath).size} bytes)`);

  // Print summary comparison table
  console.log('\n=== BẢNG TỔNG HỢP 10 HỘI THẢO CHÍNH THỨC ===');
  payload.conferences.forEach((c) => {
    console.log(
      `[${c.code}] (${c.category}) ${c.title.substring(0, 50)}... | QG: ${c.country} | Hạn: ${
        c.deadline || '(Chưa rõ)'
      } | Ngày: ${c.eventDate || '(Chưa rõ)'} | Nguồn: ${c.sourceUrl}`
    );
  });
}

main().catch(console.error);
