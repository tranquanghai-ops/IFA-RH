# IFA-RH — TÀI LIỆU QUY CHUẨN SCHEMA JSON ĐỒNG BỘ HỘI THẢO (SPARK ↔ IFA-RH)

> **Phiên bản Schema:** `1`  
> **Tên file chính thức trên Google Drive:** `IFA_RH_CONFERENCES.json`  
> **Thư mục lưu trữ chính thức:** `IFA_RH_DATA` (Thư mục con lưu bản cũ: `Archive`)  
> **Tác tử xuất bản:** Spark  
> **Tác tử tiếp nhận & kiểm duyệt:** IFA-RH (Firestore `opportunityCandidates` → Admin duyệt → `opportunities`)

---

## 1. Nguyên tắc cốt lõi và Cơ chế xuất bản

1. **Một nguồn chân lý duy nhất (Single Source of Truth):**
   - Chỉ có đúng **MỘT** file hiện hành có tên `IFA_RH_CONFERENCES.json` nằm tại thư mục gốc `IFA_RH_DATA`.
   - Khi Spark phát hiện thay đổi hoặc bổ sung dữ liệu mới, Spark tạo file mới và di chuyển file cũ vào thư mục `Archive/`.
2. **Không phụ thuộc Google Drive File ID cố định:**
   - IFA-RH tìm file theo **Folder ID** và **Tên file** (`IFA_RH_CONFERENCES.json`).
   - Nếu trong thư mục có nhiều file cùng tên trong thời điểm chuyển giao, IFA-RH tự động chọn file có `revision` nguyên dương cao nhất và cấu trúc hợp lệ.
3. **Mã hội thảo cố định (`code`):**
   - Không dùng số thứ tự (STT), Run ID, thứ tự mảng hay tên file làm định danh.
   - Định dạng mã:
     - `TN0001`, `TN0002`... : Hội thảo tổ chức tại Việt Nam (kể cả hội thảo quốc tế nhưng địa điểm tổ chức tại Việt Nam).
     - `QT0001`, `QT0002`... : Hội thảo tổ chức ở nước ngoài.
   - Mã đã cấp là **bất biến** và duy nhất trong toàn hệ thống.
4. **Tiêu chuẩn ngày tháng:**
   - Trong JSON: Định dạng chuẩn ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ` hoặc `YYYY-MM-DD`).
   - Hiển thị người dùng trên giao diện IFA-RH: Tự động format `dd/mm/yyyy`.

---

## 2. Cấu trúc Root Schema (`IFA_RH_CONFERENCES.json`)

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :---: | :---: | :--- |
| `schemaVersion` | `integer` | Có | Luôn là `1`. |
| `revision` | `integer` | Có | Số hiệu phiên bản nguyên dương tăng dần (1, 2, 3...). Mỗi lần Spark xuất bản file mới, `revision` phải lớn hơn phiên bản trước. |
| `runId` | `string` | Có | Định danh phiên cào/phân tích của Spark (ví dụ: `"20261015-01"`). |
| `generatedAt` | `string (ISO 8601)` | Có | Thời điểm Spark kết xuất file (ví dụ: `"2026-10-15T11:00:00+07:00"`). |
| `nextCodes` | `object` | Có | Chứa mã kế tiếp sẽ cấp cho từng nhóm: `{"TN": "TN0008", "QT": "QT0004"}`. |
| `conferences` | `array` | Có | Mảng chứa danh sách tất cả các hội thảo (TN và QT). |

---

## 3. Cấu trúc từng bản ghi Hội thảo (`conferences[i]`) — Đầy đủ 27 trường nghiệp vụ

Mỗi phần tử trong mảng `conferences` phải có đầy đủ các trường sau:

```typescript
export interface JsonConferenceItem {
  // --- Định danh & Phân loại ---
  code: string;                 // Mã cố định: Regex ^(TN|QT)\d{4}$ (ví dụ: "TN0001", "QT0001")
  category: "TN" | "QT";        // "TN": Tổ chức tại VN; "QT": Tổ chức ở nước ngoài
  title: string;                // Tên đầy đủ của hội thảo (kèm tên viết tắt nếu có)
  organizer: string;            // Đơn vị chủ trì / phối hợp tổ chức
  country: string;              // Quốc gia tổ chức (ví dụ: "Việt Nam", "Ý", "Đức", "Nam Phi")
  year: number;                 // Năm tổ chức (ví dụ: 2026, 2027)
  type: string;                 // "Hội thảo" | "Hội nghị" | "Call for Papers" | ...
  level: string;                // "Quốc tế" | "Quốc gia" | "Cấp Trường" | "Cấp Khoa"
  topic: string;                // Chủ đề / Lĩnh vực học thuật tổng quát
  field: string;                // Phù hợp ngành nào (MTCN, Đồ họa, Thời trang, CN, ...)
  suitability?: string;         // Mức độ phù hợp: "Phù hợp", "Tham khảo", "Ưu tiên"

  // --- Mốc thời gian (Chuẩn ISO 8601) ---
  abstractDeadline?: string;    // Hạn tóm tắt (ISO 8601 hoặc "")
  fullPaperDeadline?: string;   // Hạn toàn văn (ISO 8601 hoặc "")
  registrationDeadline?: string;// Hạn đăng ký tham dự (ISO 8601 hoặc "")
  deadline?: string;            // Mốc hạn nộp chính dùng tính countdown (ISO 8601)
  eventDate?: string;           // Thời gian diễn ra (dải ngày hoặc mô tả cụ thể)
  location?: string;            // Địa điểm tổ chức cụ thể / Hình thức (Trực tiếp, Hybrid, Trực tuyến)

  // --- Lệ phí & Minh bạch tài chính ---
  fee?: string;                 // Tóm tắt lệ phí (ví dụ: "Miễn phí", "250 USD", "Có phí")
  publicationFee?: string;      // Phí đăng bài / phản biện / xuất bản kỷ yếu
  registrationFee?: string;     // Phí tham dự / đăng ký đại biểu
  feeStatus?: "SPECIFIED" | "UNKNOWN" | "FREE"; // Trạng thái xác minh phí
  feeSourceUrl?: string;        // Link trực tiếp đến bảng phí trên trang web BTC

  // --- Định dạng xuất bản & Chỉ mục ---
  publicationFormat?: string;   // Kỷ yếu ISBN, Book Chapter, Tạp chí liên kết
  indexing?: string;            // Scopus, Web of Science, ISBN, Không có

  // --- Nội dung học thuật & Định hướng nghiên cứu cho Giảng viên ---
  content: string;              // Tóm tắt ngắn gọn mục tiêu, chủ đề chính
  detailedContent?: string;     // Phân tích chi tiết bối cảnh, cơ hội học thuật
  topicsDetailed?: string[];    // Danh sách các phân ban (tracks) / chủ đề chi tiết
  directions?: string;          // Gợi ý hướng nghiên cứu cụ thể cho ngành Thiết kế / Mỹ thuật

  // --- Đường dẫn & Nguồn thông tin ---
  sourceUrl?: string;           // Trang thông tin chính thức của hội thảo
  submissionUrl?: string;       // Trang nộp bài trực tuyến (EasyChair, EDAS, Google Form, Portal...)

  // --- Trạng thái & Ghi chú quản trị ---
  status?: string;              // "MỚI", "CÒN HẠN", "HẾT HẠN", "CẬP NHẬT"
  notes?: string;               // Ghi chú quan trọng từ Spark (countdown, lưu ý BTC, kỷ yếu)
  tags?: string[] | string;     // Từ khóa tìm kiếm
  discoveredAt?: string;        // Thời điểm Spark phát hiện (ISO 8601)
}
```

---

## 4. Dữ liệu mẫu hoàn chỉnh (`IFA_RH_CONFERENCES.json`)

```json
{
  "schemaVersion": 1,
  "revision": 3,
  "runId": "20261015-01",
  "generatedAt": "2026-10-15T11:00:00+07:00",
  "nextCodes": {
    "TN": "TN0008",
    "QT": "QT0004"
  },
  "conferences": [
    {
      "code": "TN0001",
      "category": "TN",
      "title": "Hội thảo khoa học quốc tế lần thứ 5 về Giáo dục Kỹ thuật, Công nghệ, Kinh doanh và Sức khỏe (IETBHEC'27)",
      "organizer": "Trường Đại học Sư phạm - Đại học Đà Nẵng",
      "country": "Việt Nam",
      "year": 2027,
      "type": "Hội thảo",
      "level": "Quốc tế",
      "topic": "Giáo dục Kỹ thuật, Công nghệ, Kinh doanh và Sức khỏe",
      "field": "Chung Khoa MTCN, Thiết kế đồ họa",
      "suitability": "Phù hợp",
      "fullPaperDeadline": "2026-10-15T00:00:00.000Z",
      "deadline": "2026-10-15T00:00:00.000Z",
      "eventDate": "25/02/2027 - 27/02/2027",
      "location": "Đà Nẵng, Việt Nam / Trực tiếp",
      "fee": "Theo quy định BTC",
      "feeStatus": "SPECIFIED",
      "publicationFormat": "Kỷ yếu ISBN",
      "indexing": "ISBN",
      "sourceUrl": "https://khoahoc.neu.edu.vn/vi/tin-nckh-khac/thu-moi-viet-bai-va-tham-du-hoi-thao-quoc-te-ietbhec-27-lan-thu-5",
      "submissionUrl": "https://ietbhec2027.example.edu.vn/submit",
      "content": "Hội thảo quốc tế đa ngành quy tụ các nghiên cứu ứng dụng công nghệ, thiết kế và đổi mới sáng tạo trong giáo dục và kinh doanh.",
      "tags": ["IETBHEC 2027", "Technology", "Education"],
      "status": "CÒN HẠN"
    },
    {
      "code": "QT0001",
      "category": "QT",
      "title": "Hội thảo khoa học quốc tế lần thứ 3 về Tương tác Người – AI (HAXD 2027)",
      "organizer": "Đại học Federico II & Hiệp hội Tương tác Máy tính Quốc tế",
      "country": "Ý",
      "year": 2027,
      "type": "Hội thảo",
      "level": "Quốc tế",
      "topic": "Human-AI Interaction, User Experience & Creative Design",
      "field": "Thiết kế đồ họa, Thiết kế công nghiệp, MTCN",
      "suitability": "Ưu tiên",
      "fullPaperDeadline": "2026-12-20T00:00:00.000Z",
      "deadline": "2026-12-20T00:00:00.000Z",
      "eventDate": "15/04/2027 - 17/04/2027",
      "location": "Naples, Ý / Hybrid",
      "fee": "350 EUR",
      "feeStatus": "SPECIFIED",
      "publicationFormat": "ACM International Conference Proceedings Series",
      "indexing": "Scopus, ACM Digital Library",
      "sourceUrl": "https://haxd2027.org",
      "submissionUrl": "https://easychair.org/conferences/?conf=haxd2027",
      "content": "Hội thảo hàng đầu thế giới về thiết kế tương tác giữa người dùng và trí tuệ nhân tạo, tối ưu trải nghiệm người dùng (UX) và nghệ thuật số.",
      "tags": ["HAXD 2027", "AI", "Interaction Design", "Scopus"],
      "status": "MỚI"
    }
  ]
}
```

---

## 5. Quy tắc Kiểm định & Phòng chống Lỗi của IFA-RH

Khi đọc file từ Google Drive, IFA-RH tự động kiểm định:

1. **Từ chối nếu vi phạm tính duy nhất của mã:** Nếu phát hiện 2 bản ghi có cùng `code`, phiên bản JSON sẽ bị hủy và báo lỗi.
2. **Từ chối nếu sai nhóm quốc gia:** Nếu `category == "TN"` nhưng quốc gia không phải "Việt Nam", hoặc `category == "QT"` nhưng tổ chức tại Việt Nam, hệ thống cảnh báo kiểm tra thủ công.
3. **Từ chối nếu thiếu trường bắt buộc:** Bắt buộc phải có `code`, `category`, `title`, `organizer`, `country`, `deadline`, `type`, `level`.
4. **Bảo toàn dữ liệu khi có sự cố:** Nếu file mới trên Drive không parse được JSON hoặc vi phạm schema, IFA-RH tự động:
   - Giữ nguyên dữ liệu hợp lệ trước đó.
   - Hiển thị cảnh báo trực quan cho Admin.
   - **Tuyệt đối không ghi đè dữ liệu rác/hỏng lên Cloud Firestore**.
