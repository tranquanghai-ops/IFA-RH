# Tích Hợp Đồng Bộ Danh Bạ Giảng Viên (IFA-WORK & IFA-RH)

Hệ thống **IFA-RH (IFA Research Hub)** và **IFA-WORK** áp dụng mô hình phân tách trách nhiệm dữ liệu nhân sự như sau:

- **IFA-WORK = MASTER DIRECTORY (Nguồn Dữ Liệu Gốc)**: Quản lý nhân sự toàn diện của Khoa MTCN (hồ sơ nhân sự, phân công giảng dạy, chức vụ, bộ môn/ngành, phân loại giảng viên, trạng thái công tác).
- **IFA-RH = CONSUMER MIRROR (Bản Sao Đọc Phục Vụ NCKH)**: Tiêu thụ danh bạ để phục vụ phân quyền đăng nhập, quản lý tiến độ NCKH, hồ sơ công trình công bố và thống kê học thuật.

---

## 1. Nguyên Tắc Cốt Lõi

1. **Khóa Chung Ổn Định**: `emailNormalized`
   - Chuẩn hóa: `email.trim().toLowerCase()`.
   - Bắt buộc thuộc tên miền `@tdtu.edu.vn`.
   - **Không dùng Firebase Auth UID**: Vì 2 Firebase project độc lập (`ifa-work` và `ifa-rh`) có UID khác nhau nên email chính thức của trường được dùng làm khóa liên kết ổn định.
2. **Chính Sách Giảng Viên Ngừng Hoạt Động (Inactive Policy)**:
   - Khi giảng viên nghỉ việc hoặc ngừng công tác tại Khoa, trạng thái `active` chuyển thành `false` (kèm mốc `inactiveAt`).
   - Khi đồng bộ vào IFA-RH, tài khoản bị khóa quyền đăng nhập vào hệ thống.
   - **Bảo lưu tuyệt đối**: Toàn bộ lịch sử nghiên cứu khoa học, bài báo, hội thảo, đề tài và số liệu KPI trong quá khứ của giảng viên **không bao giờ bị xóa**.
3. **Quy Tắc An Toàn (Safety Rule)**:
   - Nếu một giảng viên hiện có trong IFA-RH nhưng vắng mặt trong tệp JSON đồng bộ, IFA-RH **giữ nguyên bản ghi** thay vì tự ý chuyển thành inactive.
4. **Độc Lập Phân Quyền (Role Independence)**:
   - Quyền hạn hệ thống trong IFA-RH (`owner`, `admin`, `lecturer`) được quản lý độc lập tại IFA-RH. Việc đồng bộ danh bạ từ IFA-WORK chỉ cập nhật metadata nhân sự (họ tên, đơn vị, học vị, loại hình GV, trạng thái hoạt động), **không làm thay đổi hoặc ghi đè quyền Owner/Admin trong IFA-RH**.

---

## 2. Hai Kênh Đồng Bộ Dữ Liệu

### Kênh A: Tự Động Định Kỳ Qua GitHub Actions (Hàng tuần)
- **Lịch chạy**: Mỗi **thứ Hai hàng tuần lúc 03:00 AM giờ Việt Nam (UTC+7)** = **20:00 UTC Chủ Nhật**.
- **Cron**: `0 20 * * 0`.
- **Kích hoạt thủ công**: Hỗ trợ `workflow_dispatch` với tùy chọn `--dry-run`.
- **Cơ chế**: Script `scripts/sync-personnel.mjs` sử dụng Firebase Admin SDK (thông qua Secrets `IFA_WORK_SA_KEY` và `IFA_RH_SA_KEY`) kết nối trực tiếp Firestore hai bên và cập nhật bản sao.

### Kênh B: Nạp Tệp JSON Thủ Công Có Đối Soát (Diff Preview)
- Dành cho Quản trị viên khi cần cập nhật danh bạ ngay lập tức:
  1. Người quản lý mở IFA-WORK (`https://ifa-work.web.app/personnel`) và bấm **"Xuất danh bạ dùng chung"** &rarr; tải tệp `IFA-PERSONNEL.json`.
  2. Mở IFA-RH &rarr; Quản lý Giảng viên (`/adm/lecturers`) &rarr; bấm **"Cập nhật từ IFA-WORK (JSON)"**.
  3. IFA-RH đọc và hiển thị bảng Đối Soát (Diff Preview):
     - Số lượng tạo mới (+Create)
     - Số lượng cập nhật (~Update)
     - Số lượng ngừng công tác (-Deactivate)
     - Số lượng tái kích hoạt (+Reactivate)
     - Số lượng không thay đổi (=Unchanged)
  4. Quản trị viên xem trước danh sách chi tiết các trường thay đổi và bấm **"Xác nhận đồng bộ"**.

---

## 3. Cấu Trúc Bản Ghi (`SharedPersonnelRecord`)

```typescript
export interface SharedPersonnelRecord {
  emailNormalized: string;       // Khóa chính (doc ID), lowercase @tdtu.edu.vn
  displayName: string;           // Họ và tên đầy đủ
  departmentId: string;          // Mã bộ môn/ngành (vd: "do-hoa", "noi-that")
  departmentName: string;        // Tên hiển thị tiếng Việt (vd: "Thiết kế Đồ họa")
  lecturerType: string;          // "visiting" | "teaching_officer" | "lecturer" | "core_2" | ...
  academicDegree: string;        // "ThS", "TS", "PGS", v.v.
  employeeId?: string;           // Mã số nhân viên (nếu có)
  active: boolean;               // true: đang công tác, false: đã nghỉ
  inactiveAt?: string | null;    // ISO-8601 timestamp nếu active = false
  sourceUpdatedAt: string;       // Mốc cập nhật tại IFA-WORK
  sharedUpdatedAt: string;       // Mốc cập nhật tại IFA-RH
}
```

---

## 4. Nhật Ký Đồng Bộ (`personnelSyncLogs`)

Mỗi đợt đồng bộ (dù tự động hay thủ công) đều ghi lại một tài liệu nhật ký bất biến vào collection `personnelSyncLogs`:
```typescript
export interface PersonnelSyncLog {
  id: string;
  timestamp: string;
  method: 'manual_json' | 'github_action';
  triggeredBy: string;
  sourceFile?: string;
  schemaVersion: number;
  totalRecords: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  deactivatedCount: number;
  reactivatedCount: number;
  durationMs?: number;
}
```

Trang Quản trị Giảng viên (`/adm/lecturers`) hiển thị huy hiệu trạng thái đồng bộ lần gần nhất cùng thời gian và số liệu tương ứng.
