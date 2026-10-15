#!/usr/bin/env node

/**
 * sync-research.mjs
 * 
 * Tự động đồng bộ dữ liệu hội thảo nghiên cứu khoa học từ Google Drive JSON (Spark) vào IFA-RH.
 * Nguồn dữ liệu: File IFA_RH_CONFERENCES.json tại thư mục IFA_RH_DATA trên Google Drive.
 * 
 * Được chạy định kỳ bởi GitHub Actions vào mỗi thứ Hai lúc 03:00 AM (giờ Việt Nam, UTC+7),
 * hoặc chạy thủ công qua workflow_dispatch / CLI.
 * 
 * Tham số dòng lệnh:
 *   --dry-run          : Chạy thử nghiệm, phân tích đối chiếu dữ liệu nhưng không ghi vào Firestore
 *   --folder-id <id>   : Folder ID Google Drive tùy chọn (mặc định: 1bizJ43wLrsSWUIRBpBsBi2NpMZZ9bidI)
 *   --file-name <name> : Tên file JSON tùy chọn (mặc định: IFA_RH_CONFERENCES.json)
 *   github_schedule | github_dispatch | manual_cli (nguồn kích hoạt)
 */

import process from 'node:process';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { executeResearchSync } from '../src/services/researchSyncService.ts';
import {
  DEFAULT_DRIVE_FOLDER_ID,
  DEFAULT_DRIVE_FILE_NAME,
} from '../src/services/researchDriveJsonService.ts';

// Patch global fetch for Google Drive API key origin/referer verification in Node.js
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const headers = new Headers(opts?.headers || {});
  if (!headers.has('Referer')) {
    headers.set('Referer', 'https://ifa-rh.web.app');
  }
  if (!headers.has('Origin')) {
    headers.set('Origin', 'https://ifa-rh.web.app');
  }
  return originalFetch(url, { ...opts, headers });
};

// Parse command-line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

const folderIdIdx = args.indexOf('--folder-id');
const customFolderId = folderIdIdx !== -1 ? args[folderIdIdx + 1] : DEFAULT_DRIVE_FOLDER_ID;

const fileNameIdx = args.indexOf('--file-name');
const customFileName = fileNameIdx !== -1 ? args[fileNameIdx + 1] : DEFAULT_DRIVE_FILE_NAME;

const runSourceArg = args.find(a => !a.startsWith('--'));
const runSource = runSourceArg || (process.env.GITHUB_ACTIONS ? (process.env.GITHUB_EVENT_NAME === 'schedule' ? 'github_schedule' : 'github_dispatch') : 'manual_cli');

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return getFirestore(existingApps[0]);
  }

  const saKeyJson = process.env.IFA_RH_SA_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_IFA_RH || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saKeyJson) {
    try {
      const sa = JSON.parse(saKeyJson);
      const app = initializeApp({
        credential: cert(sa),
        projectId: sa.project_id || 'ifa-rh',
      });
      return getFirestore(app);
    } catch (parseErr) {
      console.error('Lỗi phân tích cú pháp IFA_RH_SA_KEY:', parseErr.message);
      throw parseErr;
    }
  }

  const app = initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'ifa-rh',
  });
  return getFirestore(app);
}

async function main() {
  console.log('=================================================================');
  console.log('IFA-RH — ĐỒNG BỘ CƠ HỘI NCKH TỪ GOOGLE DRIVE JSON (SPARK)');
  console.log(`Nguồn kích hoạt: ${runSource}`);
  console.log(`Chế độ Dry-Run : ${isDryRun ? 'BẬT (Chỉ phân tích, không ghi Firestore)' : 'TẮT (Ghi dữ liệu thật)'}`);
  console.log(`Drive Folder ID: ${customFolderId}`);
  console.log(`Drive File Name: ${customFileName}`);
  console.log('=================================================================\n');

  const db = initializeFirebaseAdmin();

  // Create SDK adapter bridging Firebase Admin SDK to executeResearchSync interface
  const adminSdk = {
    doc: (_db, col, id) => db.collection(col).doc(id),
    getDoc: async (ref) => {
      const snap = await ref.get();
      return {
        exists: () => snap.exists,
        data: () => snap.data(),
      };
    },
    setDoc: async (ref, data, opts) => ref.set(data, opts || {}),
    updateDoc: async (ref, data) => ref.update(data),
    collection: (_db, path) => db.collection(path),
    getDocs: async (colRef) => {
      const snap = await colRef.get();
      return {
        docs: snap.docs.map(d => ({
          id: d.id,
          data: () => d.data(),
        })),
        size: snap.size,
      };
    },
    addDoc: async (colRef, data) => {
      const docRef = await colRef.add(data);
      return { id: docRef.id };
    },
    runTransaction: (targetDb, updateFn) => db.runTransaction(async (transaction) => {
      const txAdapter = {
        get: async (ref) => {
          const snap = await transaction.get(ref);
          return {
            exists: () => snap.exists,
            data: () => snap.data(),
          };
        },
        set: (ref, data, opts) => transaction.set(ref, data, opts || {}),
        update: (ref, data) => transaction.update(ref, data),
        delete: (ref) => transaction.delete(ref),
      };
      return await updateFn(txAdapter);
    }),
    serverTimestamp: () => FieldValue.serverTimestamp(),
  };

  const user = {
    uid: 'system_cli_sync',
    email: runSource.includes('github') ? 'github-actions@ifa-rh.internal' : 'cli-admin@ifa-rh.internal',
    role: 'admin',
  };

  try {
    const outcome = await executeResearchSync({
      db,
      sdk: adminSdk,
      user,
      options: {
        runSource,
        dryRun: isDryRun,
        dataSource: 'drive_json',
        driveConfig: {
          folderId: customFolderId,
          fileName: customFileName,
        },
      },
    });

    if (outcome.skipped) {
      console.warn(`[SYNC SKIPPED] ${outcome.reason}`);
      return;
    }

    const { stats, durationMs, driveMeta, items } = outcome;
    console.log('=================================================================');
    console.log('KẾT QUẢ ĐỒNG BỘ:');
    if (driveMeta) {
      console.log(`- File Drive:            ${driveMeta.fileName} (ID: ${driveMeta.fileId}, Rev ${driveMeta.revision})`);
      console.log(`- Run ID:                ${driveMeta.runId}`);
    }
    console.log(`- Tổng số hội thảo đọc:  ${stats.read}`);
    console.log(`- Hợp lệ theo schema:    ${stats.valid}`);
    console.log(`- Mới tạo (chờ duyệt):   ${stats.created}`);
    console.log(`- Đề xuất cập nhật:      ${stats.updateProposals}`);
    console.log(`- Cập nhật trực tiếp:    ${stats.updated}`);
    console.log(`- Khớp dữ liệu cũ:       ${stats.matched}`);
    console.log(`- Trùng khớp không đổi:  ${stats.unchanged}`);
    console.log(`- Giữ sửa thủ công Admin:${stats.preservedAdmin}`);
    console.log(`- Trùng lặp / Bỏ qua:    ${stats.duplicates}`);
    console.log(`- Số lượt ghi thành công:${stats.successWrites}`);
    console.log(`- Lỗi:                   ${stats.errorCount}`);
    console.log(`- Thời gian thực thi:    ${((durationMs || 0) / 1000).toFixed(2)}s`);
    console.log('=================================================================');

    console.log('\nCHI TIẾT TỪNG HỘI THẢO:');
    for (const item of (items || [])) {
      console.log(`[${(item.code || '----').padEnd(6)}] [${(item.action || '').padEnd(20)}] ${item.title?.slice(0, 55).padEnd(55)} -> ${item.reason}`);
    }

    if (stats.errorCount > 0) {
      process.exitCode = 0;
    }
  } catch (err) {
    console.error('LỖI ĐỒNG BỘ THẤT BẠI:', err);
    process.exit(1);
  }
}

main();
