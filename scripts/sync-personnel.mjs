#!/usr/bin/env node

/**
 * sync-personnel.mjs
 * 
 * Đồng bộ tự động danh bạ giảng viên từ IFA-WORK (Master) sang IFA-RH (Mirror).
 * Được chạy định kỳ bởi GitHub Actions vào mỗi thứ Hai hàng tuần hoặc chạy thủ công.
 * 
 * Các chế độ chạy:
 * 1. Toàn bộ tự động (Service Accounts):
 *    - IFA_WORK_SA_KEY: Service Account JSON của project ifa-work
 *    - IFA_RH_SA_KEY: Service Account JSON của project ifa-rh
 * 
 * 2. Nạp từ tệp JSON đã tải về:
 *    node scripts/sync-personnel.mjs --file ./IFA-PERSONNEL.json
 * 
 * 3. Chạy thử nghiệm (không ghi Firestore):
 *    node scripts/sync-personnel.mjs --dry-run
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import admin from 'firebase-admin';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const fileArgIndex = args.indexOf('--file');
const filePath = fileArgIndex !== -1 ? args[fileArgIndex + 1] : null;

async function main() {
  console.log('==================================================');
  console.log('IFA-RH: ĐỒNG BỘ DANH BẠ GIẢNG VIÊN TỪ IFA-WORK');
  console.log(`Thời điểm: ${new Date().toISOString()}`);
  if (isDryRun) console.log('Chế độ: --dry-run (Chỉ kiểm tra và tính diff, không ghi dữ liệu)');
  console.log('==================================================');

  let records = [];
  let sourceOrigin = 'IFA-WORK';
  let schemaVer = 1;

  if (filePath) {
    console.log(`Đang đọc dữ liệu từ tệp cục bộ: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      console.error(`Lỗi: Tệp ${filePath} không tồn tại.`);
      process.exit(1);
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.schemaVersion !== 1 || parsed.source !== 'IFA-WORK' || !Array.isArray(parsed.personnel)) {
      console.error('Lỗi: Cấu trúc tệp không hợp lệ. Yêu cầu schemaVersion: 1, source: "IFA-WORK", personnel: [].');
      process.exit(1);
    }
    records = parsed.personnel;
    schemaVer = parsed.schemaVersion;
  } else {
    // Service Account mode
    const workKeyStr = process.env.IFA_WORK_SA_KEY;
    const rhKeyStr = process.env.IFA_RH_SA_KEY;

    if (!workKeyStr || !rhKeyStr) {
      console.log('Lưu ý: Chưa cấu hình IFA_WORK_SA_KEY hoặc IFA_RH_SA_KEY.');
      console.log('Hướng dẫn: Để kích hoạt GitHub Actions tự động:');
      console.log('1. Vào GitHub repo Settings -> Secrets and variables -> Actions.');
      console.log('2. Thêm secret IFA_WORK_SA_KEY (Service account JSON của ifa-work).');
      console.log('3. Thêm secret IFA_RH_SA_KEY (Service account JSON của ifa-rh).');
      console.log('Trong trường hợp chạy thủ công, hãy dùng tham số: --file <đường_dẫn_tệp_IFA-PERSONNEL.json>');
      if (!isDryRun) {
        process.exit(1);
      }
      return;
    }

    console.log('Đang kết nối Firestore IFA-WORK và IFA-RH qua Admin SDK...');
    const workApp = admin.initializeApp(
      { credential: admin.credential.cert(JSON.parse(workKeyStr)) },
      'ifa-work-app'
    );
    const rhApp = admin.initializeApp(
      { credential: admin.credential.cert(JSON.parse(rhKeyStr)) },
      'ifa-rh-app'
    );

    const workDb = admin.firestore(workApp);
    const rhDb = admin.firestore(rhApp);

    console.log('Đang đọc collection sharedPersonnel từ IFA-WORK...');
    const workSnap = await workDb.collection('sharedPersonnel').get();
    console.log(`Tìm thấy ${workSnap.size} bản ghi trên IFA-WORK.`);

    records = workSnap.docs.map(d => d.data());
    await executeSync(rhDb, records, 'github_action', 'github-actions[bot]', isDryRun);
    return;
  }

  // File-based sync mode with IFA_RH_SA_KEY
  const rhKeyStr = process.env.IFA_RH_SA_KEY;
  if (!rhKeyStr && !isDryRun) {
    console.error('Lỗi: Cần IFA_RH_SA_KEY để ghi dữ liệu vào Firestore IFA-RH.');
    process.exit(1);
  }

  if (rhKeyStr) {
    const rhApp = admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(rhKeyStr)),
    });
    const rhDb = admin.firestore(rhApp);
    await executeSync(rhDb, records, 'manual_script', 'admin-cli', isDryRun);
  } else {
    console.log(`[DRY-RUN] Đã kiểm tra ${records.length} bản ghi thành công.`);
  }
}

async function executeSync(rhDb, incomingRecords, method, triggeredBy, dryRun) {
  const startTime = Date.now();
  console.log('Đang đọc danh bạ hiện có trên IFA-RH (collection sharedPersonnel)...');
  const existingSnap = await rhDb.collection('sharedPersonnel').get();
  const existingMap = new Map();
  existingSnap.docs.forEach(d => existingMap.set(d.id, d.data()));

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let deactivatedCount = 0;
  let reactivatedCount = 0;

  const now = new Date().toISOString();
  const batchList = [];

  for (const item of incomingRecords) {
    const emailNorm = (item.emailNormalized || item.email || '').trim().toLowerCase();
    if (!emailNorm || !emailNorm.endsWith('@tdtu.edu.vn')) continue;

    const existing = existingMap.get(emailNorm);
    const validRecord = {
      emailNormalized: emailNorm,
      displayName: item.displayName || item.name || '',
      departmentId: item.departmentId || '',
      departmentName: item.departmentName || item.department || 'Chưa phân ngành',
      lecturerType: item.lecturerType || 'lecturer',
      academicDegree: item.academicDegree || item.title || '',
      employeeId: item.employeeId || null,
      active: Boolean(item.active !== false),
      inactiveAt: item.active ? null : (item.inactiveAt || now),
      sourceUpdatedAt: item.sourceUpdatedAt || now,
      sharedUpdatedAt: now,
    };

    if (!existing) {
      createdCount++;
      batchList.push(validRecord);
    } else {
      let changed = false;
      if (existing.active === true && validRecord.active === false) {
        deactivatedCount++;
        changed = true;
      } else if (existing.active === false && validRecord.active === true) {
        reactivatedCount++;
        changed = true;
      }

      if (
        existing.displayName !== validRecord.displayName ||
        existing.departmentName !== validRecord.departmentName ||
        existing.lecturerType !== validRecord.lecturerType ||
        existing.academicDegree !== validRecord.academicDegree ||
        (existing.employeeId || null) !== (validRecord.employeeId || null)
      ) {
        changed = true;
      }

      if (changed) {
        updatedCount++;
      } else {
        unchangedCount++;
      }
      batchList.push(validRecord);
    }
  }

  console.log('--------------------------------------------------');
  console.log('KẾT QUẢ ĐỐI SOÁT (DIFF SUMMARY):');
  console.log(`- Tổng bản ghi nguồn:     ${incomingRecords.length}`);
  console.log(`- Mới tạo (Create):        +${createdCount}`);
  console.log(`- Cập nhật (Update):       ${updatedCount}`);
  console.log(`- Ngừng CT (Deactivated):  -${deactivatedCount}`);
  console.log(`- Tái kích hoạt:           +${reactivatedCount}`);
  console.log(`- Không đổi (Unchanged):   ${unchangedCount}`);
  console.log('--------------------------------------------------');

  if (dryRun) {
    console.log('[DRY-RUN] Hoàn tất. Không có dữ liệu nào được ghi.');
    return;
  }

  console.log(`Đang ghi ${batchList.length} bản ghi vào Firestore IFA-RH...`);
  const chunkSize = 400;
  for (let i = 0; i < batchList.length; i += chunkSize) {
    const chunk = batchList.slice(i, i + chunkSize);
    const batch = rhDb.batch();
    for (const rec of chunk) {
      const docRef = rhDb.collection('sharedPersonnel').doc(rec.emailNormalized);
      batch.set(docRef, rec, { merge: true });

      // Synchronize provisional user profile
      const userRef = rhDb.collection('users').doc(`prov_${rec.emailNormalized}`);
      batch.set(
        userRef,
        {
          id: `prov_${rec.emailNormalized}`,
          uid: `prov_${rec.emailNormalized}`,
          email: rec.emailNormalized,
          name: rec.displayName,
          department: rec.departmentName,
          academicDegree: rec.academicDegree,
          active: rec.active,
          updatedAt: now,
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

  const durationMs = Date.now() - startTime;
  const logId = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const logData = {
    id: logId,
    timestamp: now,
    method,
    triggeredBy,
    schemaVersion: 1,
    totalRecords: incomingRecords.length,
    createdCount,
    updatedCount,
    unchangedCount,
    deactivatedCount,
    reactivatedCount,
    durationMs,
  };

  await rhDb.collection('personnelSyncLogs').doc(logId).set(logData);
  console.log(`Đã lưu nhật ký đồng bộ: ${logId} (${durationMs}ms)`);

  // Write to GitHub Step Summary if available
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    const md = `### Kết quả Đồng bộ Danh bạ Giảng viên (IFA-WORK -> IFA-RH)
- **Thời gian**: ${now}
- **Phương thức**: ${method} (${triggeredBy})
- **Tổng số**: ${incomingRecords.length}
- **Tạo mới**: +${createdCount}
- **Cập nhật**: ${updatedCount}
- **Ngừng công tác**: ${deactivatedCount}
- **Kích hoạt lại**: ${reactivatedCount}
- **Không đổi**: ${unchangedCount}
- **Thời gian xử lý**: ${durationMs}ms
`;
    fs.appendFileSync(summaryFile, md);
  }
}

main().catch(err => {
  console.error('Lỗi khi thực hiện đồng bộ:', err);
  process.exit(1);
});
