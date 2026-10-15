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
import { GoogleAuth } from 'google-auth-library';

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

async function getDriveAccessToken() {
  if (process.env.GOOGLE_DRIVE_ACCESS_TOKEN) {
    return process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  }
  const saKeyJson = process.env.IFA_RH_SA_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_IFA_RH || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saKeyJson) {
    try {
      const sa = JSON.parse(saKeyJson);
      const auth = new GoogleAuth({
        credentials: sa,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });
      const client = await auth.getClient();
      const tokenRes = await client.getAccessToken();
      if (tokenRes && tokenRes.token) {
        return tokenRes.token;
      }
    } catch (tokenErr) {
      console.warn('[DriveAuth] Không thể cấp Access Token từ Service Account (sẽ dùng Public API Key):', tokenErr.message);
    }
  }
  return undefined;
}

function decodeValue(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue?.values || []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue?.fields || {});
  return null;
}

function decodeFields(fields) {
  const result = {};
  for (const [k, v] of Object.entries(fields || {})) {
    result[k] = decodeValue(v);
  }
  return result;
}

function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(encodeValue) } };
  }
  if (typeof v === 'object') {
    return { mapValue: { fields: encodeFields(v) } };
  }
  return { stringValue: String(v) };
}

function encodeFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) {
      fields[k] = encodeValue(v);
    }
  }
  return fields;
}

function createRestSdk(accessToken) {
  const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'ifa-rh';
  const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  return {
    doc: (_db, col, id) => ({ col, id, path: `${col}/${id}` }),
    getDoc: async (ref) => {
      const url = `${BASE_URL}/${ref.path}`;
      const res = await originalFetch(url, { headers });
      if (res.status === 404) {
        return { exists: () => false, data: () => undefined };
      }
      if (!res.ok) {
        throw new Error(`getDoc failed [${res.status}]: ${await res.text()}`);
      }
      const data = await res.json();
      return {
        exists: () => true,
        data: () => ({ id: ref.id, ...decodeFields(data.fields) }),
      };
    },
    setDoc: async (ref, data, opts) => {
      const url = `${BASE_URL}/${ref.path}`;
      const fields = encodeFields(data);
      let fullUrl = url;
      if (opts?.merge) {
        const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
        fullUrl = `${url}?${mask}`;
      }
      const res = await originalFetch(fullUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) {
        throw new Error(`setDoc failed [${res.status}]: ${await res.text()}`);
      }
      return await res.json();
    },
    updateDoc: async (ref, data) => {
      const fields = encodeFields(data);
      const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
      const url = `${BASE_URL}/${ref.path}?${mask}`;
      const res = await originalFetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) {
        throw new Error(`updateDoc failed [${res.status}]: ${await res.text()}`);
      }
      return await res.json();
    },
    collection: (_db, path) => ({ path }),
    getDocs: async (colRef) => {
      let docs = [];
      let pageToken = '';
      do {
        const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
        const url = `${BASE_URL}/${colRef.path}?pageSize=300${pageParam}`;
        const res = await originalFetch(url, { headers });
        if (!res.ok) {
          throw new Error(`getDocs failed [${res.status}]: ${await res.text()}`);
        }
        const body = await res.json();
        if (Array.isArray(body.documents)) {
          for (const d of body.documents) {
            const id = d.name.split('/').pop();
            docs.push({
              id,
              data: () => ({ id, ...decodeFields(d.fields) }),
            });
          }
        }
        pageToken = body.nextPageToken || '';
      } while (pageToken);

      return { docs, size: docs.length };
    },
    addDoc: async (colRef, data) => {
      const autoId = `cand_auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const url = `${BASE_URL}/${colRef.path}/${autoId}`;
      const fields = encodeFields({ ...data, id: autoId });
      const res = await originalFetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) {
        throw new Error(`addDoc failed [${res.status}]: ${await res.text()}`);
      }
      return { id: autoId };
    },
    runTransaction: async (_db, fn) => {
      const tx = {
        get: async (ref) => {
          const url = `${BASE_URL}/${ref.path}`;
          const res = await originalFetch(url, { headers });
          if (res.status === 404) return { exists: () => false, data: () => undefined };
          const data = await res.json();
          return { exists: () => true, data: () => ({ id: ref.id, ...decodeFields(data.fields) }) };
        },
        set: async (ref, data, opts) => {
          const url = `${BASE_URL}/${ref.path}`;
          const fields = encodeFields(data);
          let fullUrl = url;
          if (opts?.merge) {
            const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
            fullUrl = `${url}?${mask}`;
          }
          await originalFetch(fullUrl, { method: 'PATCH', headers, body: JSON.stringify({ fields }) });
        },
      };
      return await fn(tx);
    },
    serverTimestamp: () => new Date().toISOString(),
  };
}

function getFirestoreSdkAndDb() {
  const saKeyJson = process.env.IFA_RH_SA_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_IFA_RH || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saKeyJson) {
    const db = initializeFirebaseAdmin();
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
    return { db, sdk: adminSdk, authMode: 'Firebase Service Account (Admin SDK)' };
  }

  // Workstation fallback: check if Firebase CLI login token exists
  const cfgPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (fs.existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (cfg.tokens?.access_token) {
        return {
          db: {},
          sdk: createRestSdk(cfg.tokens.access_token),
          authMode: `Firebase CLI Login (${cfg.user?.email || 'admin'}) via Firestore REST API`,
        };
      }
    } catch (e) {
      console.warn('Không đọc được token từ firebase-tools.json:', e.message);
    }
  }

  const db = initializeFirebaseAdmin();
  return { db, sdk: null, authMode: 'Application Default Credentials' };
}

async function main() {
  const driveAccessToken = await getDriveAccessToken();
  const { db, sdk: adminSdk, authMode } = getFirestoreSdkAndDb();

  console.log('=================================================================');
  console.log('IFA-RH — ĐỒNG BỘ CƠ HỘI NCKH TỪ GOOGLE DRIVE JSON (SPARK)');
  console.log(`Nguồn kích hoạt: ${runSource}`);
  console.log(`Chế độ Dry-Run : ${isDryRun ? 'BẬT (Chỉ phân tích, không ghi Firestore)' : 'TẮT (Ghi dữ liệu thật)'}`);
  console.log(`Drive Folder ID: ${customFolderId}`);
  console.log(`Drive File Name: ${customFileName}`);
  console.log(`Drive Auth Mode: ${driveAccessToken ? 'OAuth2 Bearer Token (Service Account)' : 'Google Drive API Key (Public Viewer)'}`);
  console.log(`Firestore Auth : ${authMode}`);
  console.log('=================================================================\n');

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
          accessToken: driveAccessToken,
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
