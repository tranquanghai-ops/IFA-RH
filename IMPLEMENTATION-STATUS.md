# Trạng thái Triển khai IFA-RH (Implementation Status)

- **Ngày cập nhật**: 06/10/2026
- **Production URL**: [https://ifa-rh.web.app/](https://ifa-rh.web.app/)
- **Firebase Project**: `ifa-rh`
- **Location Firestore**: `asia-southeast1`
- **GitHub Repository**: [https://github.com/tranquanghai-ops/IFA-RH](https://github.com/tranquanghai-ops/IFA-RH) (PUBLIC)

---

## 1. Các hạng mục đã hoàn thành (Completed)
- [x] Tạo dự án Firebase `ifa-rh` trên nền tảng Spark Plan (Miễn phí)
- [x] Khởi tạo cơ sở dữ liệu Cloud Firestore vị trí `asia-southeast1`
- [x] Cấu hình Firebase Web App và trích xuất SDK Config
- [x] Thiết lập bộ quy tắc bảo mật `firestore.rules` (726 dòng) với validation toàn diện, ngăn chặn nâng quyền, deploy thành công 0 warning 0 error
- [x] Cơ chế Bootstrap Owner an toàn cho tài khoản `tranquanghai@tdtu.edu.vn`
- [x] Bảo vệ tài khoản Owner sáng lập và ngăn chặn tự hạ quyền Owner
- [x] Giới hạn đăng nhập tổ chức `@tdtu.edu.vn` và chỉ cho phép tài khoản đã được provision
- [x] Hệ thống đúng 3 vai trò: Owner, Admin, Giảng viên (phân quyền dữ liệu chặt chẽ)
- [x] Giao diện Public Cơ hội NCKH (Hội thảo, Hội nghị, Call for Papers, Special Issue, Book Chapter) với bộ lọc, tìm kiếm và Modal chi tiết
- [x] Hàng chờ AI Spark (Spark Candidate Queue) với chế độ xem Bảng/Lưới, kiểm duyệt, duyệt công bố, từ chối và phát hiện trùng lặp tự động (Status `pending` cô lập an toàn)
- [x] Quản lý cơ hội học thuật dành cho Admin + Xuất Excel (.xlsx) / CSV UTF-8
- [x] Quản lý nhân sự giảng viên: thêm từng người, import file Excel/CSV qua wizard 5 bước (`Upload -> Preview -> Validate @tdtu.edu.vn -> Dedupe -> Confirm -> Report`), xuất Excel/CSV danh sách GV
- [x] Quản lý tiến độ NCKH giảng viên: bộ lọc theo GV / toàn khoa cho Admin/Owner, máy trạng thái 9 bước, append-only timeline, tính năng sửa hộ (On-behalf) kèm audit log, xuất Excel/CSV
- [x] Chuyển đổi công trình hoàn tất sang Hồ sơ nghiên cứu (không duplicate, lưu `sourceResearchId`, actor metadata `convertedBy`, `convertedAt`, ghi timeline & audit log)
- [x] Hồ sơ nghiên cứu: chế độ xem cá nhân cho GV vs Toàn khoa (chỉ đọc) cho đồng nghiệp, bộ lọc GV cho Admin/Owner, xuất Excel/CSV
- [x] Dashboard cá nhân giảng viên và Dashboard toàn khoa cho Admin/Owner
- [x] Trang Thống kê NCKH tổng hợp theo năm, nạp dữ liệu an toàn theo quyền hạn, xuất báo cáo Excel (.xlsx) và CSV
- [x] Trình nhập dữ liệu Import Wizard toàn diện 4 đối tượng:
  1. `publications`: Hồ sơ công trình quá khứ
  2. `research_works`: Tiến độ NCKH
  3. `candidates`: Hàng chờ Spark (đảm bảo status `pending`)
  4. `lecturers`: Nhân sự giảng viên (@tdtu.edu.vn)
- [x] Thuật toán ghép giảng viên 4 cấp: Email chính xác -> Mapping thủ công -> Tên đầy đủ -> Bắt buộc chọn tay nếu trùng
- [x] Khu vực dành riêng cho Owner (`/own`): quản lý phân quyền Admin/GV, theo dõi lịch sử các đợt Import (`importBatches`), tra cứu Audit Logs
- [x] Toàn bộ hệ thống Export: Prepend `\uFEFF` UTF-8 BOM chống vỡ tiếng Việt có dấu, hỗ trợ cả `.xlsx` và `.csv`
- [x] Kiểm thử tự động (Vitest): 36/36 PASS trên 7 test files
- [x] Đóng gói bản dựng (Build) Vite & TypeScript thành công
- [x] Triển khai Firebase Hosting: `https://ifa-rh.web.app/`

---

## 2. Kết quả kiểm thử (Test Results)
- **Unit & Logic Tests**: 36 passed / 36 tests (100% PASS)
  - `src/tests/auth.test.ts`: 5/5 PASS
  - `src/tests/core_business.test.ts`: 13/13 PASS
  - `src/tests/layout_navigation.test.ts`: 5/5 PASS
  - `src/tests/rules_logic.test.ts`: 4/4 PASS
  - `src/tests/opportunity.test.ts`: 5/5 PASS
  - `src/tests/research.test.ts`: 2/2 PASS
  - `src/tests/import.test.ts`: 2/2 PASS
- **Firestore Rules Compilation**: PASS (0 warnings, 0 errors)
- **Vite Production Build**: PASS (1636 modules transformed, 0 errors)
- **Hosting Deployment**: Ready for deployment to `ifa-rh.web.app`
