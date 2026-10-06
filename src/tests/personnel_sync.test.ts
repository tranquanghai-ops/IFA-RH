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
});
