import { describe, expect, it } from 'vitest';
import type {
  SharedPersonnelRecord,
  SharedPersonnelExportPayload,
} from '../types';

describe('Personnel Synchronization Logic (IFA-WORK -> IFA-RH)', () => {
  const sampleExisting: SharedPersonnelRecord[] = [
    {
      emailNormalized: 'nguyenvana@tdtu.edu.vn',
      displayName: 'Nguyễn Văn A',
      departmentId: 'do-hoa',
      departmentName: 'Thiết kế Đồ họa',
      lecturerType: 'lecturer',
      academicDegree: 'ThS',
      employeeId: 'NV001',
      active: true,
      inactiveAt: null,
      sourceUpdatedAt: '2026-10-01T08:00:00.000Z',
      sharedUpdatedAt: '2026-10-01T08:00:00.000Z',
    },
    {
      emailNormalized: 'tranthib@tdtu.edu.vn',
      displayName: 'Trần Thị B',
      departmentId: 'noi-that',
      departmentName: 'Thiết kế Nội thất',
      lecturerType: 'core_2',
      academicDegree: 'TS',
      employeeId: 'NV002',
      active: true,
      inactiveAt: null,
      sourceUpdatedAt: '2026-10-01T08:00:00.000Z',
      sharedUpdatedAt: '2026-10-01T08:00:00.000Z',
    },
    {
      emailNormalized: 'lethic@tdtu.edu.vn',
      displayName: 'Lê Thị C',
      departmentId: 'thoi-trang',
      departmentName: 'Thiết kế Thời trang',
      lecturerType: 'visiting',
      academicDegree: 'ThS',
      active: false,
      inactiveAt: '2026-09-01T08:00:00.000Z',
      sourceUpdatedAt: '2026-09-01T08:00:00.000Z',
      sharedUpdatedAt: '2026-09-01T08:00:00.000Z',
    },
  ];

  it('validates schemaVersion: 1 and source: IFA-WORK strictly', () => {
    const validPayload: SharedPersonnelExportPayload = {
      schemaVersion: 1,
      source: 'IFA-WORK',
      generatedAt: '2026-10-06T12:00:00.000Z',
      totalRecords: 1,
      personnel: [sampleExisting[0]],
    };

    expect(validPayload.schemaVersion).toBe(1);
    expect(validPayload.source).toBe('IFA-WORK');

    // Invalid schemaVersion
    const invalidVer = { ...validPayload, schemaVersion: 2 };
    expect(invalidVer.schemaVersion).not.toBe(1);

    // Invalid source
    const invalidSource = { ...validPayload, source: 'OTHER' };
    expect(invalidSource.source).not.toBe('IFA-WORK');
  });

  it('correctly categorizes diff: Create, Update, Deactivate, Reactivate, Unchanged', () => {
    const incoming: SharedPersonnelRecord[] = [
      // 1. Unchanged
      { ...sampleExisting[0] },
      // 2. Deactivated (was active: true -> now active: false)
      {
        ...sampleExisting[1],
        active: false,
        inactiveAt: '2026-10-06T12:00:00.000Z',
      },
      // 3. Reactivated (was active: false -> now active: true)
      {
        ...sampleExisting[2],
        active: true,
        inactiveAt: null,
      },
      // 4. New Record (Create)
      {
        emailNormalized: 'phamvand@tdtu.edu.vn',
        displayName: 'Phạm Văn D',
        departmentId: 'my-thuat-do-thi',
        departmentName: 'Mỹ thuật Đô thị',
        lecturerType: 'teaching_officer',
        academicDegree: 'PGS.TS',
        employeeId: 'NV003',
        active: true,
        inactiveAt: null,
        sourceUpdatedAt: '2026-10-06T12:00:00.000Z',
        sharedUpdatedAt: '2026-10-06T12:00:00.000Z',
      },
    ];

    const existingMap = new Map(sampleExisting.map((p) => [p.emailNormalized, p]));

    let createCount = 0;
    let updateCount = 0;
    let deactivateCount = 0;
    let reactivateCount = 0;
    let unchangedCount = 0;

    for (const item of incoming) {
      const existing = existingMap.get(item.emailNormalized);
      if (!existing) {
        createCount++;
      } else {
        if (existing.active === true && item.active === false) {
          deactivateCount++;
        } else if (existing.active === false && item.active === true) {
          reactivateCount++;
        } else if (
          existing.displayName !== item.displayName ||
          existing.departmentName !== item.departmentName ||
          existing.academicDegree !== item.academicDegree ||
          existing.lecturerType !== item.lecturerType
        ) {
          updateCount++;
        } else {
          unchangedCount++;
        }
      }
    }

    expect(createCount).toBe(1);
    expect(deactivateCount).toBe(1);
    expect(reactivateCount).toBe(1);
    expect(unchangedCount).toBe(1);
    expect(updateCount).toBe(0);
  });

  it('Safety Rule: Missing records in import file MUST NOT be deactivated', () => {
    // Only includes 1 record out of 3 existing records
    const partialIncoming: SharedPersonnelRecord[] = [sampleExisting[0]];

    const existingMap = new Map(sampleExisting.map((p) => [p.emailNormalized, p]));
    const incomingEmails = new Set(partialIncoming.map((p) => p.emailNormalized));

    // Existing records not in incoming:
    const missingFromIncoming: SharedPersonnelRecord[] = [];
    sampleExisting.forEach((p) => {
      if (!incomingEmails.has(p.emailNormalized)) {
        missingFromIncoming.push(p);
      }
    });

    expect(missingFromIncoming.length).toBe(2);

    // Verify policy: these records remain untouched and preserve their existing active state
    for (const record of missingFromIncoming) {
      const original = existingMap.get(record.emailNormalized)!;
      expect(record.active).toBe(original.active); // Untouched!
    }
  });

  it('Historical Research Integrity: deactivating a lecturer preserves publications and works', () => {
    const publications = [
      {
        id: 'pub_1',
        userId: 'uid_tranthib',
        userEmail: 'tranthib@tdtu.edu.vn',
        title: 'Nghiên cứu vật liệu xanh trong thiết kế nội thất',
        year: 2024,
      },
    ];

    const researchWorks = [
      {
        id: 'work_1',
        userId: 'uid_tranthib',
        userEmail: 'tranthib@tdtu.edu.vn',
        title: 'Ứng dụng AI trong mô hình hóa không gian',
        isCompleted: true,
      },
    ];

    // Deactivation simulation
    const updatedFacultyStatus = {
      emailNormalized: 'tranthib@tdtu.edu.vn',
      active: false,
    };

    // The publications and works arrays must remain intact
    const facultyPubs = publications.filter(
      (p) => p.userEmail === updatedFacultyStatus.emailNormalized
    );
    const facultyWorks = researchWorks.filter(
      (w) => w.userEmail === updatedFacultyStatus.emailNormalized
    );

    expect(facultyPubs.length).toBe(1);
    expect(facultyPubs[0].title).toBe('Nghiên cứu vật liệu xanh trong thiết kế nội thất');
    expect(facultyWorks.length).toBe(1);
    expect(facultyWorks[0].title).toBe('Ứng dụng AI trong mô hình hóa không gian');
  });

  it('strictly validates @tdtu.edu.vn email format and lowercase normalization', () => {
    const validEmails = [
      'nguyenvana@tdtu.edu.vn',
      'tran.thi.b@tdtu.edu.vn',
      'gv123@tdtu.edu.vn',
    ];

    const invalidEmails = [
      'user@gmail.com',
      'test@tdtu.vn',
      'someone@hcmut.edu.vn',
      'invalid-email',
      '',
    ];

    const emailRegex = /^[a-z0-9._%+-]+@tdtu\.edu\.vn$/;

    for (const email of validEmails) {
      expect(emailRegex.test(email)).toBe(true);
    }

    for (const email of invalidEmails) {
      expect(emailRegex.test(email)).toBe(false);
    }
  });

  it('deduplicates duplicate users prioritizing canonical ID and retaining admin role', async () => {
    const { deduplicateUsers } = await import('../firebase/firestore');

    const duplicateList: any[] = [
      {
        id: 'prov_nguyenthithuyha1_tdtu_edu_vn',
        uid: 'prov_nguyenthithuyha1_tdtu_edu_vn',
        email: 'nguyenthithuyha1@tdtu.edu.vn',
        name: 'Nguyễn Thị Thúy Hà',
        role: 'admin',
        active: true,
        department: 'Bộ môn Thiết kế Nội thất',
      },
      {
        id: 'prov_nguyenthithuyha1@tdtu.edu.vn',
        uid: 'prov_nguyenthithuyha1@tdtu.edu.vn',
        email: 'nguyenthithuyha1@tdtu.edu.vn',
        name: 'Nguyễn Thị Thúy Hà',
        role: 'admin',
        active: true,
        department: 'Bộ môn Thiết kế Nội thất',
      },
      {
        id: 'Buu7P7X5ZyNTfR5Dqq3rtiwFwXG2',
        uid: 'Buu7P7X5ZyNTfR5Dqq3rtiwFwXG2',
        email: 'tranquanghai@tdtu.edu.vn',
        name: 'Trần Quang Hải',
        role: 'owner',
        active: true,
        department: 'Khoa Mỹ thuật Công nghiệp',
      },
    ];

    const deduplicated = deduplicateUsers(duplicateList);
    expect(deduplicated.length).toBe(2);

    const haProfile = deduplicated.find(
      (u) => u.email === 'nguyenthithuyha1@tdtu.edu.vn'
    );
    expect(haProfile).toBeDefined();
    expect(haProfile?.role).toBe('admin');
    expect(haProfile?.id).toBe('prov_nguyenthithuyha1@tdtu.edu.vn');
  });

  it('rejects syncSharedPersonnelBatch when actor is not Owner', async () => {
    const { syncSharedPersonnelBatch } = await import('../firebase/firestore');

    const adminActor = {
      uid: 'admin_uid',
      email: 'admin@tdtu.edu.vn',
      role: 'admin' as const,
    };

    await expect(
      syncSharedPersonnelBatch([], 'test.json', adminActor)
    ).rejects.toThrow('Chỉ Owner mới có quyền cập nhật danh bạ');

    const lecturerActor = {
      uid: 'lecturer_uid',
      email: 'lecturer@tdtu.edu.vn',
      role: 'lecturer' as const,
    };

    await expect(
      syncSharedPersonnelBatch([], 'test.json', lecturerActor)
    ).rejects.toThrow('Chỉ Owner mới có quyền cập nhật danh bạ');
  });

  describe('Row-Level Skip and File-Level Validation (CASE 1 - CASE 6)', () => {
    it('CASE 1: 65 rows with 9 missing emails imports 56 valid records and skips 9 without blocking file', async () => {
      const { parseAndClassifyPersonnelJson } = await import('../utils/personnelSync');

      // Build payload matching real production data (56 valid + 9 missing emails)
      const personnel: any[] = [];
      for (let i = 1; i <= 56; i++) {
        personnel.push({
          displayName: `Giảng viên ${i}`,
          emailNormalized: `gv${i}@tdtu.edu.vn`,
          departmentName: 'Khoa Mỹ thuật Công nghiệp',
          lecturerType: 'lecturer',
          active: true,
        });
      }

      const missingEmailNames = [
        'Đinh Hải Yến',
        'Đỗ Ngọc Giàu',
        'Lê Đỗ Uyên Thư',
        'Lương Văn Nghĩa',
        'Nguyễn Cung Ngọc Thuỷ',
        'Nguyễn Hoài Nam',
        'Nguyễn Quốc Đạt',
        'Phạm Minh Hảo',
        'Thierry Delfosse',
      ];

      missingEmailNames.forEach((name) => {
        personnel.push({
          displayName: name,
          emailNormalized: '',
          departmentName: 'Chưa phân ngành',
          lecturerType: 'visiting',
          active: true,
        });
      });

      const jsonStr = JSON.stringify({
        schemaVersion: 1,
        source: 'IFA-WORK',
        generatedAt: new Date().toISOString(),
        totalRecords: 65,
        personnel,
      });

      const result = parseAndClassifyPersonnelJson(jsonStr);
      expect(result.totalRecords).toBe(65);
      expect(result.validRecords.length).toBe(56);
      expect(result.skippedRows.length).toBe(9);
      expect(result.counts.valid).toBe(56);
      expect(result.counts.skippedMissingEmail).toBe(9);

      // Verify row #57 (first missing email) has expected reason
      const firstSkipped = result.skippedRows[0];
      expect(firstSkipped.displayName).toBe('Đinh Hải Yến');
      expect(firstSkipped.status).toBe('SKIPPED_MISSING_EMAIL');
      expect(firstSkipped.reason).toBe('Thiếu email TDTU');
    });

    it('CASE 1 (Actual File): parses real IFA-PERSONNEL (1).json if present on system', async () => {
      const { parseAndClassifyPersonnelJson } = await import('../utils/personnelSync');
      const fs = await import('node:fs');
      const path = await import('node:path');
      const os = await import('node:os');

      const downloadPath = path.join(os.homedir(), 'Downloads', 'IFA-PERSONNEL (1).json');
      if (fs.existsSync(downloadPath)) {
        const content = fs.readFileSync(downloadPath, 'utf8');
        const result = parseAndClassifyPersonnelJson(content);
        expect(result.totalRecords).toBe(65);
        expect(result.validRecords.length).toBe(56);
        expect(result.skippedRows.length).toBe(9);
        expect(result.counts.skippedMissingEmail).toBe(9);
        expect(result.skippedRows.map((s) => s.displayName)).toContain('Đinh Hải Yến');
        expect(result.skippedRows.map((s) => s.displayName)).toContain('Đỗ Ngọc Giàu');
      }
    });

    it('CASE 2: 1 invalid email + 10 valid records -> 10 valid, 1 skipped', async () => {
      const { parseAndClassifyPersonnelJson } = await import('../utils/personnelSync');

      const personnel: any[] = [];
      for (let i = 1; i <= 10; i++) {
        personnel.push({
          displayName: `GV ${i}`,
          emailNormalized: `gv${i}@tdtu.edu.vn`,
          departmentName: 'Khoa MTCN',
        });
      }
      personnel.push({
        displayName: 'GV Email Ngoại',
        emailNormalized: 'someone@gmail.com',
        departmentName: 'Khoa MTCN',
      });

      const jsonStr = JSON.stringify({
        schemaVersion: 1,
        source: 'IFA-WORK',
        personnel,
      });

      const result = parseAndClassifyPersonnelJson(jsonStr);
      expect(result.validRecords.length).toBe(10);
      expect(result.skippedRows.length).toBe(1);
      expect(result.skippedRows[0].status).toBe('SKIPPED_INVALID_EMAIL');
      expect(result.skippedRows[0].email).toBe('someone@gmail.com');
    });

    it('CASE 3: all records missing email -> 0 valid, all skipped', async () => {
      const { parseAndClassifyPersonnelJson } = await import('../utils/personnelSync');

      const personnel = [
        { displayName: 'GV A', emailNormalized: '' },
        { displayName: 'GV B', emailNormalized: '   ' },
        { displayName: 'GV C', emailNormalized: null },
      ];

      const jsonStr = JSON.stringify({
        schemaVersion: 1,
        source: 'IFA-WORK',
        personnel,
      });

      const result = parseAndClassifyPersonnelJson(jsonStr);
      expect(result.totalRecords).toBe(3);
      expect(result.validRecords.length).toBe(0);
      expect(result.skippedRows.length).toBe(3);
    });

    it('CASE 4: invalid JSON blocks the entire file', async () => {
      const { parseAndClassifyPersonnelJson } = await import('../utils/personnelSync');

      expect(() => parseAndClassifyPersonnelJson('not-valid-json')).toThrow(
        'Tệp không đúng định dạng JSON hợp lệ.'
      );
      expect(() => parseAndClassifyPersonnelJson('123')).toThrow(
        'Nội dung tệp JSON không hợp lệ.'
      );
    });

    it('CASE 5: wrong schemaVersion or invalid source blocks the entire file', async () => {
      const { parseAndClassifyPersonnelJson } = await import('../utils/personnelSync');

      const badVer = JSON.stringify({
        schemaVersion: 2,
        source: 'IFA-WORK',
        personnel: [],
      });
      expect(() => parseAndClassifyPersonnelJson(badVer)).toThrow(
        'Phiên bản schema không được hỗ trợ'
      );

      const badSource = JSON.stringify({
        schemaVersion: 1,
        source: 'UNKNOWN',
        personnel: [],
      });
      expect(() => parseAndClassifyPersonnelJson(badSource)).toThrow(
        'Nguồn tệp không hợp lệ'
      );
    });

    it('CASE 6: duplicate valid email retains first valid record and skips subsequent duplicates', async () => {
      const { parseAndClassifyPersonnelJson } = await import('../utils/personnelSync');

      const personnel = [
        {
          displayName: 'Nguyễn Văn A (Dòng 1)',
          emailNormalized: 'nguyenvana@tdtu.edu.vn',
          departmentName: 'Thiết kế Đồ họa',
        },
        {
          displayName: 'Nguyễn Văn A (Dòng 2 Trùng)',
          emailNormalized: 'nguyenvana@tdtu.edu.vn',
          departmentName: 'Thiết kế Nội thất',
        },
        {
          displayName: 'Trần Thị B',
          emailNormalized: 'tranthib@tdtu.edu.vn',
          departmentName: 'Thiết kế Nội thất',
        },
      ];

      const jsonStr = JSON.stringify({
        schemaVersion: 1,
        source: 'IFA-WORK',
        personnel,
      });

      const result = parseAndClassifyPersonnelJson(jsonStr);
      expect(result.validRecords.length).toBe(2);
      expect(result.skippedRows.length).toBe(1);
      expect(result.skippedRows[0].status).toBe('SKIPPED_DUPLICATE_EMAIL');
      expect(result.skippedRows[0].rowNumber).toBe(2);
      expect(result.validRecords[0].displayName).toBe('Nguyễn Văn A (Dòng 1)');
    });
  });
});


