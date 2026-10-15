import { chromium } from 'playwright';

const KEY = 'AIzaSyC992nRuw5qkBpy7-AtC3BjbbnB1uoX1gA';
const FOLDER_ID = '1nOjBhXVwTaEsJzo8Ta23Uom2fQKx1BOo';
const FILE_ID = '1OS87vh1n7SOWIw2OQ6fs8qEZddZTmGoP';

async function testInRealBrowser() {
  console.log('=== KHỞI CHẠY TRÌNH DUYỆT CHROME THẬT (PLAYWRIGHT) ===');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('Đang truy cập trang production: https://ifa-rh.web.app...');
    await page.goto('https://ifa-rh.web.app', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('Trang đã tải xong:', page.url());

    // Thực thi JavaScript trực tiếp trong môi trường Chrome thật tại origin https://ifa-rh.web.app
    console.log('\n--- 1. Kiểm tra Drive API v3 List Files trong Chrome thật ---');
    const listResult = await page.evaluate(async ({ folderId, key }) => {
      try {
        const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
        const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,version,modifiedTime)&key=${key}`;
        const res = await fetch(url);
        const status = res.status;
        const statusText = res.statusText;
        const cors = res.headers.get('access-control-allow-origin');
        const data = await res.json();
        return { success: res.ok, status, statusText, cors, data };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }, { folderId: FOLDER_ID, key: KEY });

    console.log('Kết quả List Files từ Chrome:', JSON.stringify(listResult, null, 2));

    console.log('\n--- 2. Kiểm tra Drive API v3 Get File Content (alt=media) trong Chrome thật ---');
    const contentResult = await page.evaluate(async ({ fileId, key }) => {
      try {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${key}`;
        const res = await fetch(url);
        const status = res.status;
        const statusText = res.statusText;
        const cors = res.headers.get('access-control-allow-origin');
        const text = await res.text();
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          // ignore
        }
        return {
          success: res.ok,
          status,
          statusText,
          cors,
          bodyLength: text.length,
          parsedRevision: parsed?.revision,
          parsedRunId: parsed?.runId,
          conferencesCount: parsed?.conferences?.length
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }, { fileId: FILE_ID, key: KEY });

    console.log('Kết quả Get File Content từ Chrome:', JSON.stringify(contentResult, null, 2));

    const allPassed = listResult.success && contentResult.success && contentResult.conferencesCount === 3;
    console.log('\n==============================================');
    console.log('KẾT QUẢ KIỂM THỬ TRÌNH DUYỆT CHROME THẬT:', allPassed ? '✅ HOÀN TOÀN ĐẠT (PASS 100%)' : '❌ THẤT BẠI (FAIL)');
    console.log('==============================================');

  } catch (err) {
    console.error('Lỗi khi chạy browser:', err);
  } finally {
    if (browser) await browser.close();
  }
}

testInRealBrowser();
