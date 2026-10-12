# ĐẶC TẢ HỢP ĐỒNG DỮ LIỆU DANH MỤC TẠP CHÍ KHOA HỌC (IFA-RH)
## Phiên bản: `schema_version = 1`
**Áp dụng cho**: Điều tra danh mục tạp chí theo Quyết định 26/QĐ-HĐGSNN ngày 11/7/2025  
**Đơn vị phối hợp**: Anti (IFA-RH System) & Spark (Investigation Agent)

---

## 1. NGUYÊN TẮC CỐT LÕI
1. **Khóa chính ổn định (`journal_id`)**: Mỗi tạp chí có một mã định danh duy nhất (ví dụ: `TC-VHNT-001`, `TC-KT-002`). Khóa này được sử dụng xuyên suốt qua các sheet để liên kết dữ liệu quan hệ 1-N.
2. **Một tạp chí - Nhiều nhóm ngành / Nhiều mức điểm**: Một tạp chí có thể được công nhận ở nhiều Hội đồng ngành/liên ngành khác nhau và có lịch sử điểm theo nhiều năm. Sheet `DIEM_HDGSNN` lưu trữ từng dòng độc lập (append/multi-row), không gộp chuỗi, không ghi đè lịch sử điểm.
3. **Phòng ngừa trùng lặp đa tầng**: Nhận diện bản ghi trùng dựa trên:
   - `journal_id` (chính xác)
   - `issn_print` (chuẩn hóa `XXXX-XXXX`)
   - `issn_online` (chuẩn hóa `XXXX-XXXX`)
   - Tên tạp chí chuẩn hóa (bỏ dấu, chữ thường, loại bỏ khoảng trắng thừa).
4. **Trung thực về dữ liệu - Không tự suy đoán**: Nếu trường thông tin chưa tìm thấy hoặc chưa xác minh, để trống hoặc ghi rõ trạng thái kiểm chứng (`FALSE` / `unverified`). Tuyệt đối không tạo URL giả, không bịa đặt ISSN/E-ISSN hoặc email.
5. **Độc lập dữ liệu**: Module này hoạt động độc lập với Cơ hội NCKH (Hội thảo / CFPs) và không ảnh hưởng luồng đồng bộ Google Sheets của các cơ hội NCKH.

---

## 2. CẤU TRÚC CHI TIẾT CÁC SHEET

### Sheet 1: `TAP_CHI` (Thông tin định danh và xuất bản)
| Tên cột | Tên hiển thị / Diễn giải | Kiểu dữ liệu | Bắt buộc | Quy chuẩn / Giá trị cho phép | Ví dụ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `journal_id` | Mã tạp chí (Khóa chính) | Text | **Có** | Định dạng `TC-[VIET_TAT]-[STT]`, chữ hoa không dấu | `TC-VHNT-001` |
| `journal_name` | Tên tạp chí (Tiếng Việt) | Text | **Có** | Tên chuẩn hóa theo Quyết định 26/HĐGSNN | Tạp chí Văn hóa Nghệ thuật |
| `english_name` | Tên tiếng Anh | Text | Không | Tên giao dịch quốc tế chính thức | Journal of Culture and Arts |
| `abbreviation` | Tên viết tắt | Text | Không | Ký hiệu viết tắt nếu có | JCA |
| `publisher` | Cơ quan xuất bản / Chủ quản | Text | **Có** | Bộ, Viện, Trường ĐH hoặc Hội nghề nghiệp | Bộ Văn hóa, Thể thao và Du lịch |
| `issn_print` | ISSN (Bản in) | Text | Không | Định dạng `\d{4}-\d{3}[\dX]` | `0866-8639` |
| `issn_online` | E-ISSN (Bản điện tử) | Text | Không | Định dạng `\d{4}-\d{3}[\dX]` | `2615-9589` |
| `isbn` | ISBN (Ấn phẩm chuyên đề) | Text | Không | Nếu ấn bản xuất bản dưới dạng sách/chuyên đề | `978-604-0-12345-6` |
| `category` | Phân loại địa lý | Text | **Có** | `Trong nước` hoặc `Quốc tế` | `Trong nước` |
| `primary_field` | Lĩnh vực chuyên môn chính | Text | **Có** | Ngành/lĩnh vực trọng tâm (vd: Nghệ thuật, Kiến trúc...) | Văn hóa - Nghệ thuật |
| `website` | Trang chủ chính thức | URL | Không | URL hợp lệ (bắt đầu bằng `http://` hoặc `https://`) | `https://vanhoanghethuat.vn` |
| `status` | Trạng thái hoạt động | Text | **Có** | `active` (Hoạt động) hoặc `hidden` (Tạm ẩn) | `active` |

---

### Sheet 2: `DIEM_HDGSNN` (Lịch sử điểm Hội đồng Giáo sư Nhà nước)
| Tên cột | Tên hiển thị / Diễn giải | Kiểu dữ liệu | Bắt buộc | Quy chuẩn / Giá trị cho phép | Ví dụ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | Mã dòng điểm | Text | **Có** | Duy nhất từng dòng, vd `SCORE-001` | `SCORE-001` |
| `journal_id` | Mã tạp chí (Khóa ngoại) | Text | **Có** | Khớp với `TAP_CHI.journal_id` | `TC-VHNT-001` |
| `council_code` | Mã Hội đồng ngành | Text | **Có** | Mã chuẩn hóa, vd `HDGS_VHNT`, `HDGS_KT` | `HDGS_VHNT` |
| `council_name` | Tên Hội đồng ngành / Liên ngành | Text | **Có** | Tên đầy đủ theo QĐ HĐGSNN | HĐGS liên ngành Văn hóa - Nghệ thuật - TDTT |
| `year` | Năm công nhận | Số (Integer) | **Có** | 2020 - 2030 | `2025` |
| `max_score` | Điểm tối đa | Số (Thập phân) | **Có** | `0.25`, `0.5`, `0.75`, `1.0`, `1.25`, `1.5`... | `1.0` |
| `min_score` | Điểm tối thiểu | Số (Thập phân) | Không | Nếu HĐ quy định khoảng điểm (vd: 0 đến 1.0) | `0` |
| `decision_number` | Số văn bản phê duyệt | Text | **Có** | Số Quyết định HĐGSNN ban hành danh mục | `26/QĐ-HĐGSNN` |
| `decision_date` | Ngày ban hành quyết định | Text | Không | Định dạng `yyyy-mm-dd` | `2025-07-11` |
| `notes` | Ghi chú chuyên ngành | Text | Không | Chỉ tính cho chuyên mục hoặc điều kiện cụ thể | Tính điểm cho bài nghiên cứu mỹ thuật ứng dụng |

---

### Sheet 3: `HUONG_DAN_DANG_BAI` (Thể lệ và quy cách công bố)
| Tên cột | Tên hiển thị / Diễn giải | Kiểu dữ liệu | Bắt buộc | Quy chuẩn / Giá trị cho phép | Ví dụ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `journal_id` | Mã tạp chí (Khóa ngoại) | Text | **Có** | Khớp với `TAP_CHI.journal_id` | `TC-VHNT-001` |
| `has_guidelines` | Có thông tin thể lệ bài viết | Boolean | **Có** | `TRUE` hoặc `FALSE` | `TRUE` |
| `guidelines_summary` | Tóm tắt thể lệ bài viết | Text | Không | Tóm tắt yêu cầu học thuật và bố cục bài viết | Bài nghiên cứu từ 4000-6000 từ, có tóm tắt tiếng Anh |
| `manuscript_format` | Định dạng bản thảo | Text | Không | `Microsoft Word (.docx)`, `LaTeX`, `PDF` | `Microsoft Word (.docx)` |
| `word_limit_min` | Số từ tối thiểu | Số | Không | Số nguyên dương | `3500` |
| `word_limit_max` | Số từ tối đa | Số | Không | Số nguyên dương | `7000` |
| `page_limit` | Giới hạn số trang | Text | Không | Số trang quy định | `8 - 15 trang` |
| `template_url` | Đường dẫn file mẫu bài viết | URL | Không | Link tải file .doc/.docx/.tex chính thức | `https://vanhoanghethuat.vn/templates/mau-bai.docx` |
| `citation_style` | Chuẩn trích dẫn & TLTK | Text | Không | `APA 7th`, `IEEE`, `Chicago`, `Harvard`, `TCVN`... | `APA 7th` |
| `publication_language` | Ngôn ngữ công bố | Text | Không | `Tiếng Việt`, `Tiếng Anh`, `Song ngữ Việt - Anh`... | `Tiếng Việt và Tiếng Anh` |
| `review_fee` | Phí gửi bài / phản biện | Text | Không | Ghi rõ số tiền hoặc "Miễn phí" nếu công khai | `Miễn phí` |
| `publication_fee` | Phí đăng bài / APC | Text | Không | Ghi rõ số tiền hoặc "Miễn phí" nếu công khai | `1.000.000 VNĐ / bài` |
| `publication_frequency` | Tần suất xuất bản | Text | Không | Vd: `12 kỳ/năm`, `6 kỳ/năm`, `Hằng tháng` | `12 kỳ/năm (1 số/tháng)` |
| `review_time_weeks` | Thời gian phản biện ước tính | Text | Không | Số tuần hoặc mô tả thời gian quy trình | `4 - 6 tuần` |
| `submission_url` | Cổng gửi bài trực tuyến | URL | Không | Link nộp bài qua OJS/hệ thống trực tuyến | `https://vanhoanghethuat.vn/submit` |
| `editorial_email` | Email tòa soạn | Email | Không | Email chính thức nhận bài hoặc giải đáp | `toasoan@vanhoanghethuat.vn` |
| `contact_phone` | Điện thoại tòa soạn | Text | Không | Số điện thoại bàn hoặc hotline | `024.3822xxxx` |
| `office_address` | Địa chỉ tòa soạn | Text | Không | Địa chỉ trụ sở tòa soạn | 32 Hào Nam, Đống Đa, Hà Nội |

---

### Sheet 4: `LIEN_KET` (Danh bạ liên kết hữu ích)
| Tên cột | Tên hiển thị / Diễn giải | Kiểu dữ liệu | Bắt buộc | Quy chuẩn / Giá trị cho phép | Ví dụ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | Mã dòng liên kết | Text | **Có** | Duy nhất từng dòng, vd `LINK-001` | `LINK-001` |
| `journal_id` | Mã tạp chí (Khóa ngoại) | Text | **Có** | Khớp với `TAP_CHI.journal_id` | `TC-VHNT-001` |
| `link_type` | Loại liên kết | Text | **Có** | `Trang chủ`, `Nộp bài`, `Mẫu bài`, `Thể lệ`, `Tra cứu`, `Khác` | `Trang chủ` |
| `label` | Nhãn hiển thị | Text | **Có** | Văn bản hiển thị trên nút/link | Website Tòa soạn Văn hóa Nghệ thuật |
| `url` | Đường dẫn URL | URL | **Có** | Bắt đầu bằng `http://` hoặc `https://` | `https://vanhoanghethuat.vn` |
| `is_verified` | Đã xác minh URL | Boolean | **Có** | `TRUE` hoặc `FALSE` | `TRUE` |
| `verified_at` | Ngày kiểm tra link | Text | Không | `yyyy-mm-dd` | `2025-07-15` |
| `notes` | Ghi chú liên kết | Text | Không | Ghi chú thêm (vd: Cần tạo tài khoản) | Link truy cập trực tiếp bài viết toàn văn |

---

### Sheet 5: `KIEM_CHUNG` (Nhật ký xác minh & Kiểm chứng dữ liệu)
| Tên cột | Tên hiển thị / Diễn giải | Kiểu dữ liệu | Bắt buộc | Quy chuẩn / Giá trị cho phép | Ví dụ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `journal_id` | Mã tạp chí (Khóa ngoại) | Text | **Có** | Khớp với `TAP_CHI.journal_id` | `TC-VHNT-001` |
| `verification_status` | Trạng thái kiểm chứng | Text | **Có** | `verified` (Đã kiểm chứng), `unverified` (Chưa kiểm chứng), `needs_update` (Cần bổ sung) | `verified` |
| `verified_by` | Người / Hệ thống kiểm chứng | Text | **Có** | Danh xưng người rà soát (vd: `Spark Agent`, `Admin IFA`) | `Spark Agent` |
| `verified_date` | Ngày kiểm chứng | Text | **Có** | Định dạng `yyyy-mm-dd` | `2025-07-15` |
| `source_reference` | Văn bản nguồn xác minh | Text | **Có** | Nguồn đối chiếu chính thức | Quyết định 26/QĐ-HĐGSNN, Phụ lục ngành VHNT |
| `verification_notes` | Ghi chú kiểm chứng | Text | Không | Diễn giải chi tiết các điểm đã xác thực | Đã kiểm tra đối chiếu QĐ 26 và website chính thức |
| `schema_version` | Phiên bản lược đồ | Số | **Có** | Phải là `1` | `1` |

---

## 3. QUY TẮC NHẬP EXCEL VÀ XỬ LÝ XUNG ĐỘT TRÊN HỆ THỐNG
1. **Kiểm tra Schema**: Hệ thống tự động kiểm tra sự hiện diện của đủ 5 sheets và `schema_version = 1`. Nếu sai cấu trúc, file sẽ bị từ chối với thông báo lỗi rõ ràng.
2. **Khớp bản ghi (Matching Rules)**:
   - Ưu tiên 1: `journal_id` khớp chính xác.
   - Ưu tiên 2: `issn_print` hoặc `issn_online` hợp lệ trùng khớp.
   - Ưu tiên 3: Tên tạp chí chuẩn hóa trùng khớp (phát hiện nghi vấn trùng lặp).
3. **Bảo toàn dữ liệu đã chỉnh sửa thủ công (`isManualEdited`)**:
   - Nếu bản ghi trên web đã được Admin chỉnh sửa bằng tay, hệ thống mặc định **GIỮ NGUYÊN** các trường đã sửa khi import Excel cập nhật.
   - Chỉ khi Admin chủ động tick chọn "Ghi đè bản sửa thủ công", dữ liệu Excel mới thế chỗ.
4. **Không mất mát lịch sử điểm**:
   - Mỗi đợt import đối chiếu danh sách điểm theo bộ ba `(council_code, year, decision_number)`. Bản ghi điểm mới được bổ sung thêm vào mảng `scores`, không xóa bỏ các năm trước đó.
