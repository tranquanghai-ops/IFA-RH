# Kiến trúc Kỹ thuật IFA-RH (IFA Research Hub)

## 1. Tổng quan Kiến trúc
IFA-RH được phát triển theo mô hình Single-Page Application (SPA) hiện đại, tích hợp trực tiếp với nền tảng máy chủ Serverless của Google Firebase (Spark Plan) đảm bảo chi phí vận hành 0đ trong giai đoạn đầu mà vẫn đáp ứng hiệu năng cao, bảo mật chặt chẽ và khả năng mở rộng lâu dài.

```
[ Trình duyệt Giảng viên / Quản trị viên ]
             │
             ├──► Firebase Hosting (CDN Caching + HTTPS + CSP)
             ├──► Firebase Authentication (Google OAuth + @tdtu.edu.vn verification)
             └──► Cloud Firestore (NoSQL Document Store + Security Rules RBAC)
```

---

## 2. Các phân hệ chính
1. **Public Hub (`/`)**:
   - Truy vấn trực tiếp bộ sưu tập `opportunities` với điều kiện lọc `status == 'published'`.
   - Bộ lọc đa tiêu chí phía client: tìm kiếm văn bản, phân loại tags, lĩnh vực chuyên môn MTCN, hạn nộp hồ sơ.
   - Hộp thoại chi tiết (Modal) với các siêu liên kết ngoài an toàn (`rel="noopener noreferrer"`).

2. **Hàng chờ AI Spark (`/admin/candidates`)**:
   - Nhận dữ liệu từ quy trình tự động hóa của AI Spark (hoặc nhập từ Sheet/Excel).
   - Module so khớp khử trùng lặp (Deduplication Engine) dựa trên URL chuẩn hóa, tiêu đề đã loại bỏ dấu tiếng Việt và đơn vị tổ chức.
   - Thao tác phê duyệt 1 chạm: Sao chép dữ liệu từ candidate sang opportunity công khai và đánh dấu đã duyệt.

3. **Quản lý Tiến độ NCKH (`/research-progress`)**:
   - Mô hình máy trạng thái 9 bước (Ý tưởng → Nghiệm thu).
   - Bộ lưu vết tiến độ append-only trong collection `researchProgress`: mỗi lần cập nhật ghi nhận một bản ghi thời gian bất biến (timestamp, trạng thái, ghi chú).
   - Khi hoàn thành hoặc xuất bản, kích hoạt luồng chuyển giao dữ liệu sang `publications` với trường liên kết `sourceResearchId`.

4. **Trình nhập dữ liệu thông minh (`/admin/import`)**:
   - Quy trình Wizard 8 bước: Upload → Đọc bảng tính → Tự động nhận diện và ghép cột → Xác thực hợp lệ từng dòng → Ghép danh tính giảng viên → Phát hiện trùng lặp → Xác nhận ghi → Báo cáo kết quả.

5. **Khu vực Chủ sở hữu (`/own`)**:
   - Phân quyền động cho Admin.
   - Trình duyệt và tìm kiếm nhật ký kiểm toán (Audit Logs).
   - Giám sát tình trạng hạ tầng kết nối Firestore.

---

## 3. Cơ chế Khởi tạo Chủ sở hữu An toàn (Owner Bootstrap)
Nhằm ngăn chặn việc người dùng có email `@tdtu.edu.vn` tùy tiện chiếm quyền hệ thống:
1. Mọi tài khoản mới đăng nhập đều bị từ chối nếu chưa được Admin/Owner thêm trước vào danh sách nhân sự (Pre-provisioned profile).
2. Khi hệ thống vừa khởi tạo và chưa có bất kỳ tài khoản nào mang vai trò `owner` trong Firestore:
   - Hệ thống cho phép duy nhất địa chỉ email quản trị được chỉ định (`tranquanghai@tdtu.edu.vn`) tự động xác lập vai trò `owner` ngay trong phiên đăng nhập đầu tiên.
   - Sau khi bản ghi Owner đầu tiên được tạo, mọi lần đăng nhập tiếp theo đều bắt buộc phải đối chiếu vai trò đã có trong Firestore.
