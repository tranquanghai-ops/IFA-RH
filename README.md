# IFA-RH — IFA Research Hub
### Hệ thống Nghiên cứu Khoa học Giảng viên
**Khoa Mỹ thuật Công nghiệp — Trường Đại học Tôn Đức Thắng (TDTU)**

[![CI](https://github.com/tranquanghai-ops/IFA-RH/actions/workflows/ci.yml/badge.svg)](https://github.com/tranquanghai-ops/IFA-RH/actions/workflows/ci.yml)
[![Production URL](https://img.shields.io/badge/Production-ifa--rh.web.app-blue)](https://ifa-rh.web.app/)

---

## 1. Giới thiệu & Mục tiêu
**IFA-RH (IFA Research Hub)** là nền tảng quản lý, phát triển và thúc đẩy hoạt động Nghiên cứu Khoa học dành riêng cho đội ngũ giảng viên Khoa Mỹ thuật Công nghiệp, Trường Đại học Tôn Đức Thắng.

Hệ thống giải quyết 4 bài toán trọng tâm:
1. **Khám phá Cơ hội Học thuật (Public Hub)**: Tổng hợp các hội thảo quốc tế, hội nghị trong nước, Call for Papers, Special Issues, Book Chapters và các giải thưởng sáng tạo phù hợp chuyên môn Mỹ thuật ứng dụng, Đồ họa, Nội thất, Công nghiệp, Thời trang.
2. **Hàng chờ AI / Spark**: Tiếp nhận các cơ hội nghiên cứu do AI Spark thu thập tự động từ Google Sheet/Web, cho phép Admin rà soát, kiểm duyệt, phát hiện trùng lặp và công bố.
3. **Quản lý Tiến độ NCKH (Workflow cá nhân)**: Giúp giảng viên theo dõi vòng đời nghiên cứu theo từng mốc thời gian (Ý tưởng → Đang viết → Đã gửi → Phản biện → Accepted → Đã xuất bản), tự động lưu lịch sử tiến độ append-only và chuyển thành công trình chính thức chỉ với 1 click.
4. **Hồ sơ NCKH & Thống kê Khoa**: Quản lý toàn bộ danh mục bài báo, hội thảo, sách, sản phẩm nghệ thuật qua các năm; hỗ trợ xuất báo cáo định dạng Excel / CSV và công cụ import dữ liệu lịch sử thông minh.

---

## 2. Công nghệ sử dụng
- **Giao diện & Ứng dụng**: React 19, TypeScript, Vite 6, Lucide Icons
- **Kiểu dáng & Thẩm mỹ**: Thiết kế bespoke theo ngôn ngữ học thuật IFA-SSR, bảng màu xanh dương thương hiệu TDTU, modal chống tràn viewport (Viewport-Safe System), 100% responsive đa thiết bị (1920px, 1440px, 1366px, 768px, 375px)
- **Xử lý Bảng tính**: `exceljs` cho xử lý nhập/xuất tệp Excel (.xlsx) và CSV trực tiếp trên trình duyệt
- **Backend & Cloud**: Google Firebase (Spark Free Plan):
  - **Firebase Hosting**: Phục vụ SPA với cấu hình bảo mật tiêu chuẩn, HTTP cache và Content Security Policy
  - **Firebase Authentication**: Xác thực Google Workspace một chạm với bộ lọc tên miền tổ chức `@tdtu.edu.vn`
  - **Cloud Firestore** (`asia-southeast1`): Cơ sở dữ liệu NoSQL với bộ quy tắc bảo mật `firestore.rules` kiểm soát truy cập nghiêm ngặt theo 3 vai trò
- **Kiểm thử tự động**: Vitest (17/17 tests passing), GitHub Actions CI

---

## 3. URL Production
- **Trang chính thức**: [https://ifa-rh.web.app](https://ifa-rh.web.app)
- **Khu vực Quản trị Hệ thống**: [https://ifa-rh.web.app/own](https://ifa-rh.web.app/own)
- **GitHub Repository**: [https://github.com/tranquanghai-ops/IFA-RH](https://github.com/tranquanghai-ops/IFA-RH)

---

## 4. Ba vai trò người dùng (Roles)
Hệ thống được thiết kế tinh gọn với đúng 3 vai trò quyền hạn:

1. **Owner (Chủ sở hữu hệ thống)**:
   - Toàn quyền tối cao trên toàn hệ thống.
   - Cấp / gỡ quyền Admin, quản lý toàn bộ giảng viên, cấu hình tham số hệ thống.
   - Xem nhật ký an toàn (Audit Logs), tình trạng sức khỏe hạ tầng Firebase.
   - Sở hữu cơ chế Bootstrap an toàn ban đầu với email định danh được đề cử.
2. **Admin (Quản trị viên Khoa)**:
   - Xem toàn bộ danh sách giảng viên và tiến độ NCKH toàn khoa.
   - Quản lý cơ hội học thuật: đăng cơ hội mới, duyệt/từ chối các cơ hội từ hàng chờ AI Spark.
   - Nhập/xuất dữ liệu NCKH cũ và danh sách nhân sự từ Excel.
   - Cập nhật hỗ trợ tiến độ nghiên cứu cho giảng viên khi cần thiết.
   - Không thể tự phong Owner hoặc thay đổi quyền của Owner.
3. **Giảng viên (Lecturer)**:
   - Xem danh mục cơ hội NCKH công khai và nhận gợi ý phù hợp chuyên môn.
   - Quản lý hồ sơ nghiên cứu cá nhân (ORCID, Google Scholar, ResearchGate, Portfolio).
   - Tạo mới và cập nhật tiến độ công trình nghiên cứu đang thực hiện.
   - Nhập danh mục công trình đã thực hiện trong quá khứ.
   - Chuyển công trình hoàn thành vào Hồ sơ nghiên cứu cá nhân mà không phải nhập lại dữ liệu.
   - Giảng viên chỉ có quyền chỉnh sửa dữ liệu do chính mình tạo ra.

---

## 5. Hướng dẫn chạy môi trường cục bộ (Local Development)

### Yêu cầu
- Node.js >= 20.x
- npm >= 10.x

### Cài đặt và Khởi chạy
```bash
# 1. Clone repository
git clone https://github.com/tranquanghai-ops/IFA-RH.git
cd IFA-RH

# 2. Cài đặt các gói phụ thuộc
npm install

# 3. Chạy môi trường phát triển local
npm run dev

# 4. Chạy kiểm thử tự động
npm test

# 5. Đóng gói bản phát hành
npm run build
```

Mở trình duyệt tại địa chỉ: `http://127.0.0.1:5173/`
