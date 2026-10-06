import React, { useState, useEffect } from "react";
import { useAuth } from "../firebase/auth";
import {
  fetchAllUsers,
  fetchPublications,
  createPublication,
  createOpportunity,
  fetchAllOpportunities,
  recordImportBatch,
} from "../firebase/firestore";
import type { UserProfile, Publication, Opportunity } from "../types";
import { parseSpreadsheetFile } from "../utils/excel";
import { isDuplicateOpportunity } from "../utils/dedupe";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Users,
  Check,
  RefreshCw,
} from "lucide-react";

type ImportTarget = "opportunities" | "publications";

export const AdminImportPage: React.FC = () => {
  const { profile } = useAuth();
  const [targetType, setTargetType] = useState<ImportTarget>("publications");

  // Step state (1: Upload, 2: Preview & Map, 3: Validate & Match, 4: Confirm, 5: Report)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);

  // Users for matching lecturer
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [existingPubs, setExistingPubs] = useState<Publication[]>([]);
  const [existingOpps, setExistingOpps] = useState<Opportunity[]>([]);

  // Column mapping (field -> sheet header)
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Lecturer mapping for unmapped names: Record<unmappedName, userEmail>
  const [lecturerMapping, setLecturerMapping] = useState<Record<string, string>>({});

  // Validation report
  const [validationRows, setValidationRows] = useState<
    Array<{
      rowIndex: number;
      data: any;
      isValid: boolean;
      errors: string[];
      isDuplicate: boolean;
      matchedLecturer?: UserProfile;
    }>
  >([]);

  // Import outcome
  const [importReport, setImportReport] = useState<{
    total: number;
    success: number;
    failed: number;
    errors: { row: number; reason: string }[];
  } | null>(null);

  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const init = async () => {
      const [u, p, o] = await Promise.all([
        fetchAllUsers(),
        fetchPublications(),
        fetchAllOpportunities(),
      ]);
      setUsers(u);
      setExistingPubs(p);
      setExistingOpps(o);
    };
    init();
  }, []);

  if (!profile) return null;

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setFileName(file.name);
      const parsed = await parseSpreadsheetFile(file);
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);

      // Auto-guess column mapping
      const mapping: Record<string, string> = {};
      if (targetType === "publications") {
        parsed.headers.forEach((h) => {
          const lh = h.toLowerCase();
          if (lh.includes("tên") || lh.includes("title") || lh.includes("công trình") || lh.includes("đề tài")) mapping["title"] = h;
          if (lh.includes("năm") || lh.includes("year")) mapping["year"] = h;
          if (lh.includes("loại") || lh.includes("type")) mapping["type"] = h;
          if (lh.includes("giảng viên") || lh.includes("tác giả") || lh.includes("author") || lh.includes("họ tên")) mapping["lecturer"] = h;
          if (lh.includes("email")) mapping["email"] = h;
          if (lh.includes("tạp chí") || lh.includes("hội thảo") || lh.includes("journal")) mapping["journalOrConference"] = h;
          if (lh.includes("nxb") || lh.includes("nhà xuất bản") || lh.includes("tổ chức")) mapping["publisher"] = h;
          if (lh.includes("vai trò") || lh.includes("role")) mapping["role"] = h;
          if (lh.includes("indexing") || lh.includes("chỉ mục") || lh.includes("scopus")) mapping["indexing"] = h;
          if (lh.includes("doi")) mapping["doi"] = h;
          if (lh.includes("isbn") || lh.includes("issn")) mapping["isbn"] = h;
        });
      } else {
        parsed.headers.forEach((h) => {
          const lh = h.toLowerCase();
          if (lh.includes("tiêu đề") || lh.includes("tên") || lh.includes("hội thảo")) mapping["title"] = h;
          if (lh.includes("đơn vị") || lh.includes("tổ chức") || lh.includes("organizer")) mapping["organizer"] = h;
          if (lh.includes("hạn") || lh.includes("deadline")) mapping["deadline"] = h;
          if (lh.includes("loại") || lh.includes("type")) mapping["type"] = h;
          if (lh.includes("cấp") || lh.includes("level")) mapping["level"] = h;
          if (lh.includes("ngành") || lh.includes("field")) mapping["field"] = h;
          if (lh.includes("chủ đề") || lh.includes("topic")) mapping["topic"] = h;
          if (lh.includes("link") || lh.includes("nguồn") || lh.includes("url")) mapping["sourceUrl"] = h;
          if (lh.includes("nội dung") || lh.includes("mô tả")) mapping["content"] = h;
        });
      }
      setColumnMapping(mapping);
      setStep(2);
    } catch (err: any) {
      alert("Lỗi đọc file: " + err.message);
    }
  };

  // Run Validation & Matching
  const runValidationAndMatching = () => {
    const validated = rawRows.map((row) => {
      const errors: string[] = [];
      let isDuplicate = false;
      let matchedLecturer: UserProfile | undefined = undefined;

      if (targetType === "publications") {
        const title = row[columnMapping["title"]] || "";
        const yearVal = row[columnMapping["year"]];
        const lecturerVal = row[columnMapping["lecturer"]] || "";
        const emailVal = row[columnMapping["email"]] || "";

        if (!title.trim()) errors.push("Thiếu tên công trình");
        if (!yearVal || isNaN(Number(yearVal))) errors.push("Năm không hợp lệ");

        // Match lecturer by email first, then lecturerMapping, then exact name match
        const normEmail = (emailVal || "").trim().toLowerCase();
        if (normEmail) {
          matchedLecturer = users.find((u) => u.email.toLowerCase() === normEmail);
        }
        if (!matchedLecturer && lecturerMapping[lecturerVal]) {
          matchedLecturer = users.find((u) => u.email === lecturerMapping[lecturerVal]);
        }
        if (!matchedLecturer && lecturerVal) {
          const nameMatches = users.filter((u) => u.name.trim().toLowerCase() === String(lecturerVal).trim().toLowerCase());
          if (nameMatches.length === 1) {
            matchedLecturer = nameMatches[0];
          } else if (nameMatches.length > 1) {
            errors.push(`Trùng lặp nhiều GV có tên "${lecturerVal}", cần map thủ công.`);
          }
        }

        if (!matchedLecturer && !errors.includes(`Trùng lặp nhiều GV có tên "${lecturerVal}", cần map thủ công.`)) {
          errors.push(`Chưa tìm thấy tài khoản GV cho: "${lecturerVal || emailVal || 'không xác định'}"`);
        }

        // Duplicate check against existing publications
        const isDup = existingPubs.some(
          (ep) =>
            ep.title.trim().toLowerCase() === title.trim().toLowerCase() &&
            ep.year === Number(yearVal)
        );
        if (isDup) isDuplicate = true;

        return {
          rowIndex: row._rowIndex,
          data: {
            title,
            year: Number(yearVal) || new Date().getFullYear(),
            type: row[columnMapping["type"]] || "Bài báo",
            role: row[columnMapping["role"]] || "Tác giả chính",
            journalOrConference: row[columnMapping["journalOrConference"]] || "",
            publisher: row[columnMapping["publisher"]] || "",
            indexing: row[columnMapping["indexing"]] || "",
            doi: row[columnMapping["doi"]] || "",
            isbn: row[columnMapping["isbn"]] || "",
            rawLecturer: lecturerVal,
          },
          isValid: errors.length === 0,
          errors,
          isDuplicate,
          matchedLecturer,
        };
      } else {
        // Opportunities validation
        const title = row[columnMapping["title"]] || "";
        const deadline = row[columnMapping["deadline"]] || "";

        if (!title.trim()) errors.push("Thiếu tiêu đề hội thảo");
        if (!deadline) errors.push("Thiếu hạn nộp bài (deadline)");

        const dedupe = isDuplicateOpportunity(
          {
            title,
            organizer: row[columnMapping["organizer"]],
            sourceUrl: row[columnMapping["sourceUrl"]],
            deadline,
          },
          existingOpps
        );
        if (dedupe.isDuplicate) isDuplicate = true;

        return {
          rowIndex: row._rowIndex,
          data: {
            title,
            organizer: row[columnMapping["organizer"]] || "Chưa rõ",
            country: "Việt Nam",
            type: row[columnMapping["type"]] || "Hội thảo",
            level: row[columnMapping["level"]] || "Quốc tế",
            field: row[columnMapping["field"]] || "Mỹ thuật Công nghiệp",
            topic: row[columnMapping["topic"]] || "",
            tags: ["Rất phù hợp MTCN"],
            deadline: String(deadline).trim(),
            content: row[columnMapping["content"]] || title,
            sourceUrl: row[columnMapping["sourceUrl"]] || "",
            status: "published",
            sourceType: "ADMIN",
          },
          isValid: errors.length === 0,
          errors,
          isDuplicate,
        };
      }
    });

    setValidationRows(validated);
    setStep(3);
  };

  // Perform Final Import
  const handleExecuteImport = async () => {
    setImporting(true);
    let success = 0;
    let failed = 0;
    const errors: { row: number; reason: string }[] = [];

    const rowsToImport = validationRows.filter((r) => r.isValid && !r.isDuplicate);

    for (const r of rowsToImport) {
      try {
        if (targetType === "publications") {
          const lec = r.matchedLecturer!;
          await createPublication(
            {
              userId: lec.uid,
              userEmail: lec.email,
              userName: lec.name,
              year: r.data.year,
              title: r.data.title,
              type: r.data.type,
              role: r.data.role,
              journalOrConference: r.data.journalOrConference,
              publisher: r.data.publisher,
              indexing: r.data.indexing,
              doi: r.data.doi,
              isbn: r.data.isbn,
              notes: `Import từ file: ${fileName}`,
            },
            { uid: profile.uid, email: profile.email, role: profile.role }
          );
        } else {
          await createOpportunity(
            r.data,
            { uid: profile.uid, email: profile.email, role: profile.role }
          );
        }
        success++;
      } catch (err: any) {
        failed++;
        errors.push({ row: r.rowIndex, reason: err.message });
      }
    }

    // Record audit / batch
    await recordImportBatch({
      id: `imp_${Date.now()}`,
      timestamp: new Date().toISOString(),
      importedBy: profile.email,
      fileName,
      type: targetType === "publications" ? "publications" : "opportunities",
      totalRows: rawRows.length,
      successCount: success,
      errorCount: failed + validationRows.filter((r) => !r.isValid || r.isDuplicate).length,
      errors,
    });

    setImportReport({
      total: rawRows.length,
      success,
      failed: rawRows.length - success,
      errors,
    });
    setImporting(false);
    setStep(5);
  };

  // List of distinct unmapped lecturer names
  const unmappedLecturerNames = Array.from(
    new Set(
      validationRows
        .filter((r) => targetType === "publications" && !r.matchedLecturer && r.data.rawLecturer)
        .map((r) => r.data.rawLecturer)
    )
  );

  return (
    <div className="app-container">
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.6rem", color: "var(--primary)" }}>Import Dữ liệu từ Excel / CSV</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 4 }}>
          Quy trình 8 bước nhập hồ sơ công trình NCKH cũ hoặc danh sách cơ hội mới: Upload → Map cột → Xác thực → Ghép giảng viên → Khử trùng lặp → Hoàn tất
        </p>
      </div>

      {/* Target Selector */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <button
          type="button"
          className={`btn ${targetType === "publications" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => {
            setTargetType("publications");
            setStep(1);
          }}
        >
          Nhập Công trình NCKH đã thực hiện (Publications)
        </button>
        <button
          type="button"
          className={`btn ${targetType === "opportunities" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => {
            setTargetType("opportunities");
            setStep(1);
          }}
        >
          Nhập Cơ hội / Hội thảo NCKH (Opportunities)
        </button>
      </div>

      {/* STEP 1: UPLOAD */}
      {step === 1 && (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <FileSpreadsheet size={48} color="var(--primary)" style={{ margin: "0 auto 16px" }} />
          <h3 style={{ marginBottom: 8, color: "var(--primary)" }}>
            Tải lên tệp Excel (.xlsx) hoặc CSV
          </h3>
          <p style={{ fontSize: "0.9rem", color: "var(--muted)", maxWidth: 500, margin: "0 auto 24px" }}>
            Hỗ trợ định dạng bảng tính theo dõi NCKH cũ của Khoa hoặc danh sách thu thập từ các nguồn học thuật.
          </p>

          <label className="btn btn-primary" style={{ cursor: "pointer", display: "inline-flex" }}>
            <Upload size={18} /> Chọn tệp từ máy tính
            <input
              type="file"
              accept=".xlsx,.csv"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
          </label>
        </div>
      )}

      {/* STEP 2: PREVIEW & MAP COLUMNS */}
      {step === 2 && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ color: "var(--primary)" }}>Khớp nối các cột dữ liệu (File: {fileName})</h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setStep(1)}
            >
              <ArrowLeft size={14} /> Chọn file khác
            </button>
          </div>

          <p style={{ fontSize: "0.875rem", color: "var(--text-sub)", marginBottom: 20 }}>
            Kiểm tra và ánh xạ các cột trong file Excel tương ứng với trường dữ liệu của IFA-RH:
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
            {targetType === "publications" ? (
              <>
                <div className="form-group">
                  <label className="form-label">Tên công trình (*)</label>
                  <select
                    className="form-control"
                    value={columnMapping["title"] || ""}
                    onChange={(e) => setColumnMapping({ ...columnMapping, title: e.target.value })}
                  >
                    <option value="">-- Chọn cột --</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Năm xuất bản (*)</label>
                  <select
                    className="form-control"
                    value={columnMapping["year"] || ""}
                    onChange={(e) => setColumnMapping({ ...columnMapping, year: e.target.value })}
                  >
                    <option value="">-- Chọn cột --</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Giảng viên / Tác giả (*)</label>
                  <select
                    className="form-control"
                    value={columnMapping["lecturer"] || ""}
                    onChange={(e) => setColumnMapping({ ...columnMapping, lecturer: e.target.value })}
                  >
                    <option value="">-- Chọn cột --</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Email TDTU (nếu có trong file)</label>
                  <select
                    className="form-control"
                    value={columnMapping["email"] || ""}
                    onChange={(e) => setColumnMapping({ ...columnMapping, email: e.target.value })}
                  >
                    <option value="">-- Không có / Bỏ qua --</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Loại công trình</label>
                  <select
                    className="form-control"
                    value={columnMapping["type"] || ""}
                    onChange={(e) => setColumnMapping({ ...columnMapping, type: e.target.value })}
                  >
                    <option value="">-- Mặc định "Bài báo" --</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Tên Tạp chí / Hội thảo</label>
                  <select
                    className="form-control"
                    value={columnMapping["journalOrConference"] || ""}
                    onChange={(e) => setColumnMapping({ ...columnMapping, journalOrConference: e.target.value })}
                  >
                    <option value="">-- Chọn cột --</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Tiêu đề hội thảo (*)</label>
                  <select
                    className="form-control"
                    value={columnMapping["title"] || ""}
                    onChange={(e) => setColumnMapping({ ...columnMapping, title: e.target.value })}
                  >
                    <option value="">-- Chọn cột --</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Hạn nộp Deadline (*)</label>
                  <select
                    className="form-control"
                    value={columnMapping["deadline"] || ""}
                    onChange={(e) => setColumnMapping({ ...columnMapping, deadline: e.target.value })}
                  >
                    <option value="">-- Chọn cột --</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Đơn vị tổ chức</label>
                  <select
                    className="form-control"
                    value={columnMapping["organizer"] || ""}
                    onChange={(e) => setColumnMapping({ ...columnMapping, organizer: e.target.value })}
                  >
                    <option value="">-- Chọn cột --</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Link nguồn</label>
                  <select
                    className="form-control"
                    value={columnMapping["sourceUrl"] || ""}
                    onChange={(e) => setColumnMapping({ ...columnMapping, sourceUrl: e.target.value })}
                  >
                    <option value="">-- Chọn cột --</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={runValidationAndMatching}
            >
              Tiến hành kiểm tra & Xác thực dữ liệu
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: VALIDATION, DEDUPE & LECTURER MAPPING */}
      {step === 3 && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ color: "var(--primary)", marginBottom: 12 }}>
            Kết quả Xác thực & Khử trùng lặp ({validationRows.length} dòng)
          </h3>

          {/* Unmapped lecturers alert & manual assignment */}
          {unmappedLecturerNames.length > 0 && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: 16, borderRadius: 8, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>
                <AlertTriangle size={18} />
                Phát hiện {unmappedLecturerNames.length} tên giảng viên chưa có tài khoản tương ứng:
              </div>
              <p style={{ fontSize: "0.85rem", color: "#78350f", marginBottom: 12 }}>
                Vui lòng chỉ định tài khoản giảng viên trong hệ thống cho từng tên xuất hiện trong file:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
                {unmappedLecturerNames.map((name) => (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, background: "#ffffff", padding: 8, borderRadius: 6, border: "1px solid #fcd34d" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem", flex: 1 }}>{name}:</span>
                    <select
                      className="form-control"
                      style={{ fontSize: "0.8rem", padding: "4px 8px" }}
                      value={lecturerMapping[name] || ""}
                      onChange={(e) => {
                        setLecturerMapping({ ...lecturerMapping, [name]: e.target.value });
                      }}
                    >
                      <option value="">-- Chọn tài khoản --</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.email}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 12 }}
                onClick={runValidationAndMatching}
              >
                <RefreshCw size={14} /> Áp dụng ghép người và kiểm tra lại
              </button>
            </div>
          )}

          {/* Table summary of rows */}
          <div className="table-container" style={{ maxHeight: 400, overflowY: "auto", marginBottom: 24 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Dòng</th>
                  <th>Tiêu đề</th>
                  {targetType === "publications" && <th>Giảng viên ghép</th>}
                  <th>Trùng lặp?</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú lỗi</th>
                </tr>
              </thead>
              <tbody>
                {validationRows.map((r) => (
                  <tr key={r.rowIndex}>
                    <td>#{r.rowIndex}</td>
                    <td style={{ fontWeight: 600 }}>{r.data.title}</td>
                    {targetType === "publications" && (
                      <td>
                        {r.matchedLecturer ? (
                          <span style={{ color: "var(--success)", fontWeight: 600 }}>
                            {r.matchedLecturer.name}
                          </span>
                        ) : (
                          <span style={{ color: "var(--danger)" }}>
                            Chưa ghép ({r.data.rawLecturer})
                          </span>
                        )}
                      </td>
                    )}
                    <td>
                      {r.isDuplicate ? (
                        <span className="badge badge-warning">Trùng lặp</span>
                      ) : (
                        <span className="badge badge-success">Mới</span>
                      )}
                    </td>
                    <td>
                      {r.isValid && !r.isDuplicate ? (
                        <span className="badge badge-success">Hợp lệ</span>
                      ) : (
                        <span className="badge badge-warning">Bỏ qua / Lỗi</span>
                      )}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--danger)" }}>
                      {r.errors.join("; ") || (r.isDuplicate ? "Đã tồn tại trong hệ thống" : "Sẵn sàng")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
              Sẵn sàng nhập:{" "}
              <strong style={{ color: "var(--success)" }}>
                {validationRows.filter((r) => r.isValid && !r.isDuplicate).length}
              </strong>{" "}
              / {validationRows.length} dòng
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                <ArrowLeft size={16} /> Quay lại
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecuteImport}
                disabled={importing || validationRows.filter((r) => r.isValid && !r.isDuplicate).length === 0}
              >
                {importing ? "Đang tiến hành import..." : "Xác nhận Import vào hệ thống"}
                <Check size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: FINAL REPORT */}
      {step === 5 && importReport && (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <CheckCircle size={48} color="var(--success)" style={{ margin: "0 auto 16px" }} />
          <h2 style={{ color: "var(--primary)", marginBottom: 8 }}>Import Hoàn Tất!</h2>
          <p style={{ fontSize: "1rem", color: "var(--text-sub)", marginBottom: 24 }}>
            Đã lưu dữ liệu thành công vào cơ sở dữ liệu Cloud Firestore.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
              maxWidth: 500,
              margin: "0 auto 24px",
            }}
          >
            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{importReport.total}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Tổng số dòng</div>
            </div>
            <div style={{ background: "#dcfce7", color: "#166534", padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{importReport.success}</div>
              <div style={{ fontSize: "0.75rem" }}>Thành công</div>
            </div>
            <div style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{importReport.failed}</div>
              <div style={{ fontSize: "0.75rem" }}>Bỏ qua / Lỗi</div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setStep(1);
              setImportReport(null);
            }}
          >
            Thực hiện lượt Import khác
          </button>
        </div>
      )}
    </div>
  );
};
