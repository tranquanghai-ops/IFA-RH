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

## 3. Cấu trúc từng bản ghi Hội thảo (`conferences[i]`) — Đầy đủ 28 trường nghiệp vụ thực tế của Spark

Spark xuất bản 28 trường nghiệp vụ. IFA-RH ánh xạ đầy đủ và tương thích ngược với schema nội bộ:

### Bảng ánh xạ 28 trường dữ liệu Spark ↔ IFA-RH

| STT | Trường JSON của Spark | Trường IFA-RH ánh xạ | Kiểu dữ liệu | Mô tả & Quy tắc xử lý |
| :---: | :--- | :--- | :---: | :--- |
| 1 | `code` | `conferenceCode` / `code` | `string` | Mã định danh bất biến (`TNxxxx` hoặc `QTxxxx`). |
| 2 | `category` | `category` | `"TN" \| "QT"` | Phân loại: TN (Trong nước) hoặc QT (Quốc tế tổ chức ở nước ngoài). |
| 3 | `title` | `title` | `string` | Tiêu đề chính thức của hội thảo. |
| 4 | `organizer` | `organizer` | `string` | Đơn vị chủ trì / đồng tổ chức. |
| 5 | `country` | `country` | `string` | Quốc gia tổ chức (Việt Nam, Ý, Đức, Nam Phi / Việt Nam...). |
| 6 | `year` | `year` | `number` | Năm tổ chức (2026, 2027). |
| 7 | `type` | `type` | `string` | Loại hình ("Hội thảo", "Hội nghị", "Call for Papers"...). |
| 8 | `level` | `level` | `string` | Cấp độ ("Quốc tế", "Quốc gia"). |
| 9 | `topic` | `topic` | `string` | Chủ đề học thuật chính. |
| 10 | `field` | `field` | `string` | Ngành đào tạo phù hợp tại Khoa MTCN. |
| 11 | `relevance` | `suitability` | `string` | Mức độ phù hợp ("Rất phù hợp", "Phù hợp", "Tham khảo"). |
| 12 | `abstractDeadline` | `abstractDeadline` | `string` | Hạn nộp tóm tắt (chuẩn hóa `DD/MM/YYYY`). |
| 13 | `submissionDeadline` | `fullPaperDeadline`, `deadline` | `string` | Hạn nộp bài toàn văn (chuẩn hóa `DD/MM/YYYY`). |
| 14 | `registrationDeadline` | `registrationDeadline` | `string` | Hạn đăng ký tham dự (chuẩn hóa `DD/MM/YYYY`). |
| 15 | `conferenceDate` | `eventDate` | `string` | Ngày diễn ra hội thảo (chuẩn hóa `DD/MM/YYYY` hoặc dải ngày). |
| 16 | `location` | `location` | `string` | Địa điểm tổ chức hoặc hình thức (Trực tiếp, Hybrid, Online). |
| 17 | `fee` | `fee`, `feeStatus` | `string` | Lệ phí ("Miễn phí" -> FREE; "Chưa xác minh" -> UNKNOWN; có phí -> SPECIFIED). |
| 18 | `publication` | `publicationFormat` | `string` | Hình thức xuất bản ("Kỷ yếu ISBN", "Sách Springer LNNS", "Tạp chí liên kết"). |
| 19 | `indexing` | `indexing` | `string` | Chỉ mục học thuật ("Scopus", "Springer LNCS", "ISBN"...). |
| 20 | `sourceUrl` | `sourceUrl` | `string` | Link thông báo chính thức của hội thảo. |
| 21 | `submissionUrl` | `submissionUrl` | `string` | Link cổng nộp bài hoặc đăng ký trực tuyến. |
| 22 | `content` | `content` | `string` | Tóm tắt mục tiêu, quy mô và ý nghĩa hội thảo. |
| 23 | `suggestedTopics` | `directions`, `topicsDetailed` | `string \| string[]` | Gợi ý hướng nghiên cứu và viết bài cho Giảng viên MTCN. |
| 24 | `status` | `statusText` | `string` | Trạng thái ("CÒN HẠN", "SẮP HẾT HẠN", "ĐÃ HẾT HẠN"...). |
| 25 | `notes` | `notes` | `string` | Ghi chú từ Spark (IFA-RH tự động lọc bỏ cụm countdown khi tính diff). |
| 26 | `keywords` | `tags` | `string \| string[]` | Từ khóa tìm kiếm và gắn nhãn phân loại. |
| 27 | `detectedAt` | `discoveredAt` | `string` | Thời điểm Spark phát hiện hội thảo lần đầu. |
| 28 | `lastUpdated` | `updatedAt` | `string` | Thời điểm Spark cập nhật bản ghi gần nhất. |

```typescript
export interface JsonConferenceItem {
  // Định danh & Phân loại
  code: string;                 // "TN0001", "QT0001"
  category: "TN" | "QT";        // "TN" hoặc "QT"
  title: string;                // Tên hội thảo
  organizer: string;            // Đơn vị tổ chức
  country: string;              // Quốc gia
  year: number;                 // 2026, 2027
  type: string;                 // "Hội thảo", "Hội nghị"
  level: string;                // "Quốc tế", "Quốc gia"
  topic: string;                // Lĩnh vực học thuật
  field: string;                // Ngành MTCN
  relevance: string;            // Ánh xạ suitability ("Rất phù hợp", "Phù hợp")

  // Mốc thời gian
  abstractDeadline?: string;    // Hạn tóm tắt
  submissionDeadline?: string;  // Ánh xạ fullPaperDeadline & deadline
  registrationDeadline?: string;// Hạn đăng ký
  conferenceDate?: string;      // Ánh xạ eventDate
  location?: string;            // Địa điểm

  // Lệ phí & Xuất bản
  fee?: string;                 // Lệ phí
  publication?: string;         // Ánh xạ publicationFormat
  indexing?: string;            // Chỉ mục (Scopus, ISBN...)

  // Nội dung & Hướng nghiên cứu
  content: string;              // Tóm tắt nội dung
  suggestedTopics?: string[] | string; // Ánh xạ directions & topicsDetailed

  // Đường dẫn
  sourceUrl?: string;           // Link chính thức
  submissionUrl?: string;       // Link nộp bài

  // Quản trị & Tìm kiếm
  status?: string;              // Trạng thái hạn
  notes?: string;               // Ghi chú
  keywords?: string[] | string; // Ánh xạ tags
  detectedAt?: string;          // Ánh xạ discoveredAt
  lastUpdated?: string;         // Ánh xạ updatedAt
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
