# Thiết kế Cơ sở Dữ liệu Cloud Firestore — IFA-RH

Vị trí cơ sở dữ liệu: `asia-southeast1` (Singapore)

---

## 1. Danh sách Collections

### `users`
Lưu trữ hồ sơ người dùng và phân quyền hệ thống.
- **ID tài liệu**: Firebase Auth `uid` hoặc `prov_{email}` khi được thêm trước.
- **Các trường chính**:
  - `id`: string
  - `uid`: string
  - `email`: string (duy nhất, chuẩn hóa chữ thường)
  - `name`: string
  - `role`: `'owner'` | `'admin'` | `'lecturer'`
  - `department`: string (Bộ môn / Ngành)
  - `academicDegree`: string (TS, ThS, PGS, v.v.)
  - `orcid`: string (mã ORCID)
  - `googleScholar`: string (đường dẫn hồ sơ)
  - `researchGate`: string (đường dẫn hồ sơ)
  - `website`: string
  - `active`: boolean (cho phép hoặc vô hiệu hóa truy cập)
  - `photoURL`: string
  - `createdAt`: string
  - `updatedAt`: string
  - `linkedAt`: string

### `opportunities`
Các hội thảo, hội nghị, ấn phẩm học thuật đã được duyệt và công bố công khai.
- **ID tài liệu**: Tự động sinh (Auto-generated).
- **Các trường chính**:
  - `title`: string
  - `organizer`: string
  - `country`: string
  - `type`: string (`Hội thảo`, `Hội nghị`, `Call for Papers`, `Special Issue`, `Book Chapter`, `Seminar`, `Hợp tác nghiên cứu`, `Đổi mới sáng tạo`, `Khác`)
  - `level`: string (`Quốc tế`, `Quốc gia`, `Cấp Trường`, `Cấp Khoa`, `Khác`)
  - `topic`: string
  - `field`: string (Ngành MTCN phù hợp)
  - `tags`: array of string
  - `deadline`: string (yyyy-mm-dd)
  - `abstractDeadline`: string
  - `fullPaperDeadline`: string
  - `registrationDeadline`: string
  - `eventDate`: string
  - `location`: string
  - `fee`: string
  - `publicationFormat`: string
  - `indexing`: string (Scopus, WoS, ISBN, ISSN, v.v.)
  - `content`: string
  - `submissionUrl`: string
  - `sourceUrl`: string
  - `directions`: string (Gợi ý hướng bài cho giảng viên MTCN)
  - `sourceType`: `'SPARK'` | `'ADMIN'`
  - `status`: `'published'` | `'archived'`
  - `candidateId`: string (ID gốc nếu chuyển từ Spark)
  - `createdAt`: string
  - `updatedAt`: string
  - `createdBy`: string
  - `updatedBy`: string

### `opportunityCandidates`
Hàng chờ các cơ hội do AI Spark tìm kiếm, chờ Admin duyệt.
- **Các trường chính**:
  - Tương tự `opportunities`
  - `sourceType`: `'SPARK'`
  - `status`: `'pending'` | `'approved'` | `'rejected'`
  - `rejectionReason`: string
  - `reviewedBy`: string
  - `reviewedAt`: string
  - `normalizedTitle`: string (phục vụ đối soát trùng lặp)

### `researchWorks`
Các công trình nghiên cứu đang thực hiện của giảng viên.
- **Các trường chính**:
  - `userId`: string (UID của giảng viên sở hữu)
  - `userEmail`: string
  - `userName`: string
  - `title`: string
  - `category`: string (`Bài báo`, `Hội thảo`, `Đề tài NCKH`, `Sách`, `Chương sách`, `Sản phẩm sáng tạo / nghệ thuật`, `Khác`)
  - `topic`: string
  - `venue`: string (Hội thảo / Tạp chí dự kiến)
  - `deadline`: string
  - `plannedSubmissionDate`: string
  - `actualSubmissionDate`: string
  - `eventDate`: string
  - `plannedPublishDate`: string
  - `role`: string (`Tác giả chính`, `Đồng tác giả`, `Chủ nhiệm đề tài`, v.v.)
  - `coAuthors`: string
  - `status`: string (9 bước workflow)
  - `notes`: string
  - `reminderMilestone`: string
  - `isCompleted`: boolean
  - `convertedToPublicationId`: string
  - `createdAt`: string
  - `updatedAt`: string

### `researchProgress`
Lịch sử tiến độ append-only, ghi nhận các mốc sự kiện thời gian.
- **Các trường chính**:
  - `researchId`: string
  - `userId`: string
  - `userEmail`: string
  - `status`: string
  - `date`: string (dd/mm/yyyy)
  - `notes`: string
  - `createdAt`: string

### `publications`
Hồ sơ nghiên cứu cá nhân: Các công trình đã công bố trong quá khứ hoặc hoàn thành từ tiến độ.
- **Các trường chính**:
  - `userId`: string
  - `userEmail`: string
  - `userName`: string
  - `year`: number
  - `title`: string
  - `type`: string
  - `role`: string
  - `coAuthors`: string
  - `publisher`: string
  - `journalOrConference`: string
  - `volume`: string
  - `issue`: string
  - `pages`: string
  - `isbn`: string
  - `issn`: string
  - `doi`: string
  - `indexing`: string
  - `link`: string
  - `notes`: string
  - `sourceResearchId`: string (ID liên kết nếu chuyển từ `researchWorks`)
  - `createdAt`: string
  - `updatedAt`: string

### `auditLogs`
Nhật ký kiểm toán an toàn (Append-only).
- **Các trường chính**:
  - `timestamp`: string
  - `actorUid`: string
  - `actorEmail`: string
  - `actorRole`: string
  - `action`: string
  - `entityType`: string
  - `entityId`: string
  - `summary`: string

### `imports`
Lịch sử các đợt nhập bảng tính Excel/CSV.
- **Các trường chính**:
  - `timestamp`: string
  - `importedBy`: string
  - `fileName`: string
  - `type`: string
  - `totalRows`: number
  - `successCount`: number
  - `errorCount`: number
