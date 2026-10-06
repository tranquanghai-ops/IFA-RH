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
- [x] Giới hạn đăng nhập tổ chức `@tdtu.edu.vn` và chỉ cho phép tài khoản đã được provision
- [x] Hệ thống đúng 3 vai trò: Owner, Admin, Giảng viên
- [x] Giao diện Public Cơ hội NCKH (Hội thảo, Hội nghị, Call for Papers, Special Issue, Book Chapter) với bộ lọc, tìm kiếm và Modal chi tiết
- [x] Hàng chờ AI Spark (Spark Candidate Queue) với chế độ xem Bảng/Lưới, kiểm duyệt, duyệt công bố, từ chối và phát hiện trùng lặp tự động
- [x] Quản lý cơ hội học thuật dành cho Admin
- [x] Quản lý danh sách giảng viên (thêm từng người, import hàng loạt từ Excel, kích hoạt / vô hiệu hóa)
- [x] Quản lý tiến độ NCKH giảng viên (máy trạng thái 9 bước, append-only timeline)
- [x] Chuyển đổi công trình hoàn thành / xuất bản sang Hồ sơ nghiên cứu (không duplicate, lưu liên kết `sourceResearchId`)
- [x] Hồ sơ nghiên cứu cá nhân (công trình trong quá khứ và hiện tại)
- [x] Dashboard cá nhân giảng viên với biểu đồ phân bố theo năm
- [x] Dashboard toàn khoa dành cho Admin với các chỉ số KPI, lọc theo năm và cảnh báo giảng viên chưa cập nhật trên 60 ngày
- [x] Trang Thống kê NCKH theo năm với xuất báo cáo Excel (.xlsx) và CSV
- [x] Trình nhập dữ liệu thông minh Wizard 8 bước (xác thực từng dòng, ghép giảng viên, khử trùng lặp)
- [x] Khu vực dành riêng cho Owner (`/own`) quản lý phân quyền Admin và tra cứu Audit Logs
- [x] Kiểm thử tự động (Vitest): 17/17 PASS trên 5 file test
- [x] Đóng gói bản dựng (Build) Vite thành công
- [x] Triển khai thành công lên Firebase Hosting: `https://ifa-rh.web.app/`
- [x] Thiết lập GitHub Actions CI workflow cho PR và main branch

---

## 2. Kết quả kiểm thử (Test Results)
- **Unit & Logic Tests**: 17 passed / 17 tests (100% PASS)
  - `src/tests/auth.test.ts`: 4/4 PASS
  - `src/tests/rules_logic.test.ts`: 4/4 PASS
  - `src/tests/opportunity.test.ts`: 5/5 PASS
  - `src/tests/research.test.ts`: 2/2 PASS
  - `src/tests/import.test.ts`: 2/2 PASS
- **Firestore Rules Compilation**: PASS (0 warnings, 0 errors)
- **Vite Production Build**: PASS (1632 modules transformed, 0 errors)
- **Hosting Deployment**: PASS (Version finalized & released to `ifa-rh.web.app`)

---

## 3. Giới hạn đã biết trong Giai đoạn 1 (Known Limitations)
- Tính năng đồng bộ trực tiếp tự động theo thời gian thực hai chiều với Google Sheet của Spark được thiết kế qua cổng import Excel/CSV trước khi mở rộng API webhook ở phase sau.
- Tự động trích xuất chỉ số từ Google Scholar / ORCID API sẽ được bổ sung ở phase 2 theo kế hoạch.
