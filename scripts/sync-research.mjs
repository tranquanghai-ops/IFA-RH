#!/usr/bin/env node

/**
 * sync-research.mjs
 * 
 * Tự động đồng bộ dữ liệu hội thảo nghiên cứu khoa học từ Google Sheets trung gian (IFA Faculty Research) vào IFA-RH.
 * Nguồn dữ liệu: Google Sheets trung gian "IFA Faculty Research" (Tabs: HỘI THẢO & HOI THAO QT) nhận từ Spark qua IMPORTRANGE.
 * 
 * Được chạy định kỳ bởi GitHub Actions vào mỗi thứ Hai & thứ Năm lúc 04:00 AM (giờ Việt Nam, UTC+7),
 * hoặc chạy thủ công qua workflow_dispatch / CLI.
 * 
 * Tham số dòng lệnh:
 *   --dry-run          : Chạy thử nghiệm, phân tích đối chiếu dữ liệu nhưng không ghi vào Firestore
 *   --sheet-id <id>    : Spreadsheet ID tùy chọn (mặc định: 1ug0b4Holu6nGp6NwO-JViqe7XexeDLlwirqRELGwh4U)
 *   --tab-tn <name>    : Tên tab Trong nước (mặc định: HỘI THẢO)
 *   --tab-qt <name>    : Tên tab Quốc tế (mặc định: HOI THAO QT)
 *   github_schedule | github_dispatch | manual_cli (nguồn kích hoạt)
 */

import process from 'node:process';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { executeResearchSync } from '../src/services/researchSyncService.ts';
import {
  DEFAULT_RESEARCH_SHEET_ID,
  DEFAULT_RESEARCH_SHEET_NAME_TN,
  DEFAULT_RESEARCH_SHEET_NAME_QT,
  DEFAULT_RESEARCH_SPREADSHEET_TITLE,
  OFFICIAL_RESEARCH_SPREADSHEET_URL,
} from '../src/services/researchSheetService.ts';

// Patch global fetch for Google visualization API origin/referer verification in Node.js
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

const sheetIdIdx = args.indexOf('--sheet-id');
const customSheetId = sheetIdIdx !== -1 ? args[sheetIdIdx + 1] : DEFAULT_RESEARCH_SHEET_ID;

const tabTnIdx = args.indexOf('--tab-tn');
const customTabTN = tabTnIdx !== -1 ? args[tabTnIdx + 1] : DEFAULT_RESEARCH_SHEET_NAME_TN;

const tabQtIdx = args.indexOf('--tab-qt');
const customTabQT = tabQtIdx !== -1 ? args[tabQtIdx + 1] : DEFAULT_RESEARCH_SHEET_NAME_QT;

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
    runTransaction: async (_targetDb, updateFn) => {
      const beginUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:beginTransaction`;
      const maxRetries = 3;
      let attempt = 0;

      while (attempt < maxRetries) {
        attempt++;
        const beginRes = await originalFetch(beginUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ options: { readWrite: {} } }),
        });
        if (!beginRes.ok) {
          throw new Error(`beginTransaction failed [${beginRes.status}]: ${await beginRes.text()}`);
        }
        const { transaction } = await beginRes.json();
        const writes = [];

        const txAdapter = {
          get: async (ref) => {
            const url = `${BASE_URL}/${ref.path}?transaction=${encodeURIComponent(transaction)}`;
            const res = await originalFetch(url, { headers });
            if (res.status === 404) {
              return { exists: () => false, data: () => undefined };
            }
            if (!res.ok) {
              throw new Error(`tx.get failed [${res.status}]: ${await res.text()}`);
            }
            const data = await res.json();
            return {
              exists: () => true,
              data: () => ({ id: ref.id, ...decodeFields(data.fields) }),
            };
          },
          set: (ref, data, opts) => {
            const fields = encodeFields(data);
            const writeObj = {
              update: {
                name: `projects/${PROJECT_ID}/databases/(default)/documents/${ref.path}`,
                fields,
              },
            };
            if (opts?.merge) {
              writeObj.updateMask = { fieldPaths: Object.keys(data) };
            }
            writes.push(writeObj);
          },
          update: (ref, data) => {
            const fields = encodeFields(data);
            writes.push({
              update: {
                name: `projects/${PROJECT_ID}/databases/(default)/documents/${ref.path}`,
                fields,
              },
              updateMask: { fieldPaths: Object.keys(data) },
            });
          },
          delete: (ref) => {
            writes.push({
              delete: `projects/${PROJECT_ID}/databases/(default)/documents/${ref.path}`,
            });
          },
        };

        try {
          const userResult = await updateFn(txAdapter);
          const commitUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`;
          const commitRes = await originalFetch(commitUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ transaction, writes }),
          });
          if (!commitRes.ok) {
            const errBody = await commitRes.text();
            if (commitRes.status === 409 && attempt < maxRetries) {
              console.warn(`[Firestore REST Transaction] Xung đột (409), thử lại lần ${attempt + 1}/${maxRetries}...`);
              await new Promise(r => setTimeout(r, 200 * attempt));
              continue;
            }
            throw new Error(`commit failed [${commitRes.status}]: ${errBody}`);
          }
          return userResult;
        } catch (txErr) {
          try {
            const rollbackUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:rollback`;
            await originalFetch(rollbackUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify({ transaction }),
            });
          } catch (_rbErr) {
            // Ignore rollback network errors
          }
          if (attempt >= maxRetries || !String(txErr?.message || '').includes('409')) {
            throw txErr;
          }
        }
      }
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
  const { db, sdk: adminSdk, authMode } = getFirestoreSdkAndDb();

  console.log('=================================================================');
  console.log('IFA-RH — ĐỒNG BỘ CƠ HỘI NCKH TỪ GOOGLE SHEETS TRUNG GIAN (IFA Faculty Research)');
  console.log(`Nguồn kích hoạt: ${runSource}`);
  console.log(`Chế độ Dry-Run : ${isDryRun ? 'BẬT (Chỉ phân tích, không ghi Firestore)' : 'TẮT (Ghi dữ liệu thật)'}`);
  console.log(`Spreadsheet ID : ${customSheetId}`);
  console.log(`Tab Trong nước : ${customTabTN}`);
  console.log(`Tab Quốc tế    : ${customTabQT}`);
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
        dataSource: 'sheets',
        sheetConfig: {
          sheetId: customSheetId,
          sheetNameTN: customTabTN,
          sheetNameQT: customTabQT,
        },
      },
    });

    if (outcome.skipped) {
      console.warn('=================================================================');
      console.warn(`[SYNC SKIPPED / TẠM DỪNG] ${outcome.reason}`);
      console.warn('=================================================================');
      if (!isDryRun) {
        process.exit(1);
      }
      return;
    }

    const { stats, durationMs, sheetMeta, items } = outcome;
    const finalStatus = outcome.status || ((stats.failedWrites || 0) > 0 || stats.errorCount > 0 ? 'partial_success' : 'success');

    console.log('=================================================================');
    console.log(`KẾT QUẢ ĐỒNG BỘ: [${finalStatus.toUpperCase()}]`);
    if (sheetMeta) {
      console.log(`- Bảng tính Google Sheets:   ${sheetMeta.sheetTitle} (ID: ${sheetMeta.sheetId})`);
      console.log(`- Các tab đã đọc:            ${sheetMeta.tabs?.join(', ')}`);
      console.log(`- Số lượng phân nhóm:        ${sheetMeta.tnCount} Trong nước (TN), ${sheetMeta.qtCount} Quốc tế (QT)`);
    }
    console.log(`- Tổng số hội thảo đọc:       ${stats.read}`);
    console.log(`- Hợp lệ theo schema:         ${stats.valid}`);
    console.log(`- Mới tạo (chờ duyệt):        ${stats.created}`);
    console.log(`- Đề xuất cập nhật:           ${stats.updateProposals}`);
    console.log(`- Cập nhật trực tiếp:         ${stats.updated}`);
    console.log(`- Khớp dữ liệu cũ:            ${stats.matched}`);
    console.log(`- Trùng khớp không đổi:       ${stats.unchanged}`);
    console.log(`- Giữ sửa thủ công Admin:     ${stats.preservedAdmin}`);
    console.log(`- Ngoài phạm vi (out-of-scope):${stats.outOfScope || 0}`);
    console.log(`- Trùng lặp / Bỏ qua:         ${stats.duplicates}`);
    console.log(`-----------------------------------------------------------------`);
    console.log(`- Thao tác ghi dữ liệu NCKH:  ${stats.conferenceWrites ?? stats.successWrites}`);
    console.log(`- Thao tác ghi hệ thống/nhật ký: ${stats.systemWrites || 0}`);
    console.log(`- Tổng thao tác ghi thành công:  ${(stats.conferenceWrites ?? stats.successWrites) + (stats.systemWrites || 0)}`);
    console.log(`- Thao tác ghi thất bại:      ${stats.failedWrites || 0}`);
    console.log(`- Tổng số lỗi:                ${stats.errorCount}`);
    console.log(`- Thời gian thực thi:         ${((durationMs || 0) / 1000).toFixed(2)}s`);
    console.log('=================================================================');

    console.log('\nCHI TIẾT TỪNG HỘI THẢO:');
    for (const item of (items || [])) {
      console.log(`[${(item.code || '----').padEnd(6)}] [${(item.category || '--').padEnd(3)}] [${(item.action || '').padEnd(20)}] ${item.title?.slice(0, 50).padEnd(50)} -> ${item.reason}`);
    }

    if (finalStatus === 'failed') {
      console.error('\n[LỖI NGHIÊM TRỌNG] Quá trình đồng bộ thất bại hoàn toàn.');
      process.exit(1);
    } else if (finalStatus === 'partial_success') {
      console.warn('\n[CẢNH BÁO] Quá trình đồng bộ hoàn thành một phần (PARTIAL_SUCCESS) với lỗi ghi hoặc dữ liệu.');
      if ((stats.failedWrites || 0) > 0) {
        process.exit(1);
      }
    }
  } catch (err) {
    console.error('\n[LỖI NGHIÊM TRỌNG] Quá trình đồng bộ thất bại:', err);
    process.exit(1);
  }
}

main();
