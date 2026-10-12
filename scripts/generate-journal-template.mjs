import ExcelJS from "exceljs";
import path from "node:path";
import fs from "node:fs";

async function generateTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "IFA-RH System (Anti)";
  workbook.lastModifiedBy = "IFA-RH System (Anti)";
  workbook.created = new Date();
  workbook.modified = new Date();

  // Colors
  const headerFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" }, // Deep Navy Blue
  };
  const headerFont = {
    name: "Segoe UI",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  const borderStyle = {
    top: { style: "thin", color: { argb: "FFD1D5DB" } },
    left: { style: "thin", color: { argb: "FFD1D5DB" } },
    bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    right: { style: "thin", color: { argb: "FFD1D5DB" } },
  };

  const applyHeaderStyle = (sheet, colCount) => {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    const row = sheet.getRow(1);
    row.height = 28;
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = borderStyle;
    }
  };

  const applyDataStyle = (sheet) => {
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.height = 22;
        row.eachCell((cell) => {
          cell.font = { name: "Segoe UI", size: 10 };
          cell.border = borderStyle;
          cell.alignment = { vertical: "middle" };
        });
      }
    });
  };

  // -------------------------------------------------------------
  // Sheet 0: SCHEMA_METADATA
  // -------------------------------------------------------------
  const metaSheet = workbook.addWorksheet("SCHEMA_METADATA");
  metaSheet.columns = [
    { header: "attribute", key: "attribute", width: 25 },
    { header: "value", key: "value", width: 45 },
    { header: "description", key: "description", width: 55 },
  ];
  metaSheet.addRows([
    { attribute: "schema_version", value: "1", description: "Phiên bản cấu trúc chuẩn hợp đồng dữ liệu với Spark" },
    { attribute: "source_document", value: "Quyết định 26/QĐ-HĐGSNN ngày 11/7/2025", description: "Văn bản pháp lý danh mục tạp chí được tính điểm" },
    { attribute: "primary_key", value: "journal_id", description: "Khóa chính liên kết giữa các bảng" },
    { attribute: "created_by", value: "Anti (IFA-RH Dev Agent)", description: "Hệ thống Nghiên cứu Khoa học IFA-RH" },
    { attribute: "target_investigator", value: "Spark Agent", description: "Đơn vị điều tra, rà soát và thu thập dữ liệu" },
    { attribute: "created_date", value: "2026-10-12", description: "Ngày ban hành template chuẩn" },
  ]);
  applyHeaderStyle(metaSheet, 3);
  applyDataStyle(metaSheet);

  // -------------------------------------------------------------
  // Sheet 1: TAP_CHI
  // -------------------------------------------------------------
  const tapChiSheet = workbook.addWorksheet("TAP_CHI");
  tapChiSheet.columns = [
    { header: "journal_id", key: "journal_id", width: 16 },
    { header: "journal_name", key: "journal_name", width: 36 },
    { header: "english_name", key: "english_name", width: 34 },
    { header: "abbreviation", key: "abbreviation", width: 14 },
    { header: "publisher", key: "publisher", width: 36 },
    { header: "issn_print", key: "issn_print", width: 14 },
    { header: "issn_online", key: "issn_online", width: 14 },
    { header: "isbn", key: "isbn", width: 18 },
    { header: "category", key: "category", width: 15 },
    { header: "primary_field", key: "primary_field", width: 28 },
    { header: "website", key: "website", width: 38 },
    { header: "status", key: "status", width: 12 },
  ];
  tapChiSheet.addRows([
    {
      journal_id: "TC-VHNT-001",
      journal_name: "Tạp chí Văn hóa Nghệ thuật",
      english_name: "Journal of Culture and Arts",
      abbreviation: "JCA",
      publisher: "Bộ Văn hóa, Thể thao và Du lịch",
      issn_print: "0866-8639",
      issn_online: "2615-9589",
      isbn: "",
      category: "Trong nước",
      primary_field: "Văn hóa - Nghệ thuật",
      website: "http://vanhoanghethuat.vn",
      status: "active",
    },
    {
      journal_id: "TC-KT-002",
      journal_name: "Tạp chí Kiến trúc",
      english_name: "Architecture Magazine",
      abbreviation: "TAPCHIKIENTRUC",
      publisher: "Hội Kiến trúc sư Việt Nam",
      issn_print: "0866-8612",
      issn_online: "",
      isbn: "",
      category: "Trong nước",
      primary_field: "Kiến trúc - Quy hoạch",
      website: "https://www.tapchikientruc.com.vn",
      status: "active",
    },
    {
      journal_id: "TC-NCMT-003",
      journal_name: "Tạp chí Nghiên cứu Mỹ thuật",
      english_name: "Journal of Fine Arts Research",
      abbreviation: "JFAR",
      publisher: "Viện Mỹ thuật - Trường Đại học Mỹ thuật Việt Nam",
      issn_print: "1859-3283",
      issn_online: "",
      isbn: "",
      category: "Trong nước",
      primary_field: "Mỹ thuật ứng dụng",
      website: "", // Chưa có trang chủ được xác minh
      status: "active",
    },
    {
      journal_id: "TC-KHCN-004",
      journal_name: "Tạp chí Phát triển Khoa học & Công nghệ",
      english_name: "Science & Technology Development Journal",
      abbreviation: "STDJ",
      publisher: "Đại học Quốc gia TP.HCM",
      issn_print: "1859-0128",
      issn_online: "2615-9171",
      isbn: "",
      category: "Trong nước",
      primary_field: "Khoa học Xã hội & Nhân văn",
      website: "https://stdj.scienceandtechnology.com.vn",
      status: "active",
    },
    {
      journal_id: "TC-TKST-005",
      journal_name: "Tạp chí Thiết kế & Đổi mới Sáng tạo",
      english_name: "Design & Innovation Review",
      abbreviation: "DIR",
      publisher: "Viện Nghiên cứu Thiết kế Ứng dụng",
      issn_print: "2734-9981",
      issn_online: "",
      isbn: "",
      category: "Trong nước",
      primary_field: "Thiết kế Đồ họa & Nội thất",
      website: "", // Không có website chính thức
      status: "active",
    },
  ]);
  applyHeaderStyle(tapChiSheet, 12);
  applyDataStyle(tapChiSheet);

  // -------------------------------------------------------------
  // Sheet 2: DIEM_HDGSNN
  // -------------------------------------------------------------
  const diemSheet = workbook.addWorksheet("DIEM_HDGSNN");
  diemSheet.columns = [
    { header: "id", key: "id", width: 14 },
    { header: "journal_id", key: "journal_id", width: 16 },
    { header: "council_code", key: "council_code", width: 18 },
    { header: "council_name", key: "council_name", width: 38 },
    { header: "year", key: "year", width: 10 },
    { header: "max_score", key: "max_score", width: 12 },
    { header: "min_score", key: "min_score", width: 12 },
    { header: "decision_number", key: "decision_number", width: 20 },
    { header: "decision_date", key: "decision_date", width: 15 },
    { header: "notes", key: "notes", width: 40 },
  ];
  diemSheet.addRows([
    // Tạp chí Văn hóa Nghệ thuật (2 hội đồng, 2 năm)
    {
      id: "PTS-001",
      journal_id: "TC-VHNT-001",
      council_code: "HDGS_VHNT",
      council_name: "HĐGS Liên ngành Văn hóa - Nghệ thuật - TDTT",
      year: 2025,
      max_score: 1.0,
      min_score: 0,
      decision_number: "26/QĐ-HĐGSNN",
      decision_date: "2025-07-11",
      notes: "Tính điểm tất cả các bài nghiên cứu mỹ thuật, văn hóa",
    },
    {
      id: "PTS-002",
      journal_id: "TC-VHNT-001",
      council_code: "HDGS_TRIETHOC",
      council_name: "HĐGS Ngành Triết học - Xã hội học - Xã hội",
      year: 2025,
      max_score: 0.75,
      min_score: 0,
      decision_number: "26/QĐ-HĐGSNN",
      decision_date: "2025-07-11",
      notes: "Tính điểm cho chuyên mục nghiên cứu lý luận văn hóa xã hội",
    },
    {
      id: "PTS-003",
      journal_id: "TC-VHNT-001",
      council_code: "HDGS_VHNT",
      council_name: "HĐGS Liên ngành Văn hóa - Nghệ thuật - TDTT",
      year: 2024,
      max_score: 0.75,
      min_score: 0,
      decision_number: "22/QĐ-HĐGSNN",
      decision_date: "2024-07-05",
      notes: "Mức điểm theo danh mục năm 2024",
    },

    // Tạp chí Kiến trúc (2 hội đồng)
    {
      id: "PTS-004",
      journal_id: "TC-KT-002",
      council_code: "HDGS_KIENTRUC",
      council_name: "HĐGS Ngành Kiến trúc",
      year: 2025,
      max_score: 1.0,
      min_score: 0,
      decision_number: "26/QĐ-HĐGSNN",
      decision_date: "2025-07-11",
      notes: "Bài nghiên cứu chuyên ngành kiến trúc công trình, quy hoạch",
    },
    {
      id: "PTS-005",
      journal_id: "TC-KT-002",
      council_code: "HDGS_XAYDUNG",
      council_name: "HĐGS Ngành Xây dựng",
      year: 2025,
      max_score: 0.5,
      min_score: 0,
      decision_number: "26/QĐ-HĐGSNN",
      decision_date: "2025-07-11",
      notes: "Tính điểm cho chuyên mục công nghệ xây dựng gắn với kiến trúc",
    },

    // Tạp chí Nghiên cứu Mỹ thuật
    {
      id: "PTS-006",
      journal_id: "TC-NCMT-003",
      council_code: "HDGS_VHNT",
      council_name: "HĐGS Liên ngành Văn hóa - Nghệ thuật - TDTT",
      year: 2025,
      max_score: 0.75,
      min_score: 0,
      decision_number: "26/QĐ-HĐGSNN",
      decision_date: "2025-07-11",
      notes: "Tính điểm cho bài nghiên cứu lý luận và lịch sử mỹ thuật",
    },

    // Tạp chí Phát triển KH&CN
    {
      id: "PTS-007",
      journal_id: "TC-KHCN-004",
      council_code: "HDGS_KHXH",
      council_name: "HĐGS Ngành Khoa học Xã hội",
      year: 2025,
      max_score: 0.75,
      min_score: 0,
      decision_number: "26/QĐ-HĐGSNN",
      decision_date: "2025-07-11",
      notes: "Chuyên san Khoa học Xã hội và Nhân văn",
    },

    // Tạp chí Thiết kế & Sáng tạo
    {
      id: "PTS-008",
      journal_id: "TC-TKST-005",
      council_code: "HDGS_VHNT",
      council_name: "HĐGS Liên ngành Văn hóa - Nghệ thuật - TDTT",
      year: 2025,
      max_score: 0.5,
      min_score: 0,
      decision_number: "26/QĐ-HĐGSNN",
      decision_date: "2025-07-11",
      notes: "Chuyên mục thiết kế ứng dụng và sáng tạo số",
    },
  ]);
  applyHeaderStyle(diemSheet, 10);
  applyDataStyle(diemSheet);

  // -------------------------------------------------------------
  // Sheet 3: HUONG_DAN_DANG_BAI
  // -------------------------------------------------------------
  const huongDanSheet = workbook.addWorksheet("HUONG_DAN_DANG_BAI");
  huongDanSheet.columns = [
    { header: "journal_id", key: "journal_id", width: 16 },
    { header: "has_guidelines", key: "has_guidelines", width: 16 },
    { header: "guidelines_summary", key: "guidelines_summary", width: 45 },
    { header: "manuscript_format", key: "manuscript_format", width: 22 },
    { header: "word_limit_min", key: "word_limit_min", width: 15 },
    { header: "word_limit_max", key: "word_limit_max", width: 15 },
    { header: "page_limit", key: "page_limit", width: 15 },
    { header: "template_url", key: "template_url", width: 38 },
    { header: "citation_style", key: "citation_style", width: 18 },
    { header: "publication_language", key: "publication_language", width: 24 },
    { header: "review_fee", key: "review_fee", width: 18 },
    { header: "publication_fee", key: "publication_fee", width: 22 },
    { header: "publication_frequency", key: "publication_frequency", width: 22 },
    { header: "review_time_weeks", key: "review_time_weeks", width: 22 },
    { header: "submission_url", key: "submission_url", width: 38 },
    { header: "editorial_email", key: "editorial_email", width: 28 },
    { header: "contact_phone", key: "contact_phone", width: 18 },
    { header: "office_address", key: "office_address", width: 35 },
  ];
  huongDanSheet.addRows([
    {
      journal_id: "TC-VHNT-001",
      has_guidelines: true,
      guidelines_summary: "Bài nghiên cứu gốc, cấu trúc chuẩn gồm Đặt vấn đề, Phương pháp nghiên cứu, Kết quả, Thảo luận và Kết luận. Có tóm tắt tiếng Anh 150-250 từ.",
      manuscript_format: "Microsoft Word (.docx)",
      word_limit_min: 4000,
      word_limit_max: 7000,
      page_limit: "8 - 14 trang",
      template_url: "http://vanhoanghethuat.vn/templates/mau-bai-bao-vhnt.docx",
      citation_style: "APA 7th",
      publication_language: "Tiếng Việt, Tiếng Anh",
      review_fee: "Miễn phí",
      publication_fee: "Theo quy định tòa soạn",
      publication_frequency: "12 kỳ/năm (Hằng tháng)",
      review_time_weeks: "4 - 6 tuần",
      submission_url: "http://vanhoanghethuat.vn/gui-bai-truc-tuyen",
      editorial_email: "toasoan@vanhoanghethuat.vn",
      contact_phone: "024.38221844",
      office_address: "Số 32 Hào Nam, Đống Đa, Hà Nội",
    },
    {
      journal_id: "TC-KT-002",
      has_guidelines: true,
      guidelines_summary: "Bài viết chuyên sâu về kiến trúc, nội thất, bảo tồn di sản hoặc công trình xanh. Yêu cầu hình ảnh, bản vẽ chất lượng cao tối thiểu 300 DPI.",
      manuscript_format: "Microsoft Word (.docx) kèm ảnh rời",
      word_limit_min: 2500,
      word_limit_max: 5000,
      page_limit: "4 - 8 trang",
      template_url: "https://www.tapchikientruc.com.vn/bieu-mau/mau-bai.docx",
      citation_style: "Chicago / TCVN",
      publication_language: "Tiếng Việt",
      review_fee: "Miễn phí",
      publication_fee: "Miễn phí",
      publication_frequency: "12 kỳ/năm",
      review_time_weeks: "3 - 5 tuần",
      submission_url: "https://www.tapchikientruc.com.vn/gui-bai",
      editorial_email: "tapchikientruc@kientrucvn.org.vn",
      contact_phone: "024.38246361",
      office_address: "40 Tăng Bạt Hổ, Hai Bà Trưng, Hà Nội",
    },
    {
      journal_id: "TC-NCMT-003",
      has_guidelines: false,
      guidelines_summary: "Liên hệ trực tiếp tòa soạn Viện Mỹ thuật để nhận bản thể lệ chi tiết.",
      manuscript_format: "Microsoft Word (.docx)",
      word_limit_min: null,
      word_limit_max: null,
      page_limit: "Chưa công bố",
      template_url: "",
      citation_style: "TCVN",
      publication_language: "Tiếng Việt",
      review_fee: "Chưa công bố",
      publication_fee: "Chưa công bố",
      publication_frequency: "4 kỳ/năm",
      review_time_weeks: "6 - 8 tuần",
      submission_url: "",
      editorial_email: "vienmythuat@mythuatvietnam.edu.vn",
      contact_phone: "024.38263008",
      office_address: "42 Yết Kiêu, Hoàn Kiếm, Hà Nội",
    },
    {
      journal_id: "TC-KHCN-004",
      has_guidelines: true,
      guidelines_summary: "Bản thảo tuân theo quy chuẩn Open Journal Systems (OJS), phản biện kín 2 chiều (double-blind peer review).",
      manuscript_format: "Microsoft Word (.docx) hoặc LaTeX",
      word_limit_min: 5000,
      word_limit_max: 9000,
      page_limit: "10 - 18 trang",
      template_url: "https://stdj.scienceandtechnology.com.vn/template.docx",
      citation_style: "IEEE",
      publication_language: "Tiếng Anh, Tiếng Việt",
      review_fee: "Miễn phí",
      publication_fee: "1.500.000 VNĐ / bài (Open Access)",
      publication_frequency: "6 kỳ/năm",
      review_time_weeks: "4 - 8 tuần",
      submission_url: "https://stdj.scienceandtechnology.com.vn/about/submissions",
      editorial_email: "stdj@vnuhcm.edu.vn",
      contact_phone: "028.37242160",
      office_address: "Khu phố 6, Linh Trung, TP. Thủ Đức, TP.HCM",
    },
    {
      journal_id: "TC-TKST-005",
      has_guidelines: false,
      guidelines_summary: "",
      manuscript_format: "",
      word_limit_min: null,
      word_limit_max: null,
      page_limit: "",
      template_url: "",
      citation_style: "",
      publication_language: "Tiếng Việt",
      review_fee: "",
      publication_fee: "",
      publication_frequency: "",
      review_time_weeks: "",
      submission_url: "",
      editorial_email: "contact@thietkesangtao.vn",
      contact_phone: "",
      office_address: "",
    },
  ]);
  applyHeaderStyle(huongDanSheet, 18);
  applyDataStyle(huongDanSheet);

  // -------------------------------------------------------------
  // Sheet 4: LIEN_KET
  // -------------------------------------------------------------
  const lienKetSheet = workbook.addWorksheet("LIEN_KET");
  lienKetSheet.columns = [
    { header: "id", key: "id", width: 14 },
    { header: "journal_id", key: "journal_id", width: 16 },
    { header: "link_type", key: "link_type", width: 16 },
    { header: "label", key: "label", width: 32 },
    { header: "url", key: "url", width: 45 },
    { header: "is_verified", key: "is_verified", width: 14 },
    { header: "verified_at", key: "verified_at", width: 15 },
    { header: "notes", key: "notes", width: 35 },
  ];
  lienKetSheet.addRows([
    {
      id: "LINK-001",
      journal_id: "TC-VHNT-001",
      link_type: "Trang chủ",
      label: "Website Tạp chí Văn hóa Nghệ thuật",
      url: "http://vanhoanghethuat.vn",
      is_verified: true,
      verified_at: "2025-07-15",
      notes: "Website chính thức có đăng tải các số xuất bản",
    },
    {
      id: "LINK-002",
      journal_id: "TC-VHNT-001",
      link_type: "Nộp bài",
      label: "Cổng gửi bài trực tuyến",
      url: "http://vanhoanghethuat.vn/gui-bai-truc-tuyen",
      is_verified: true,
      verified_at: "2025-07-15",
      notes: "Hệ thống nộp bài trực tiếp của tòa soạn",
    },
    {
      id: "LINK-003",
      journal_id: "TC-KT-002",
      link_type: "Trang chủ",
      label: "Trang chủ Tạp chí Kiến trúc",
      url: "https://www.tapchikientruc.com.vn",
      is_verified: true,
      verified_at: "2025-07-15",
      notes: "Cổng thông tin chính thức Hội KTS Việt Nam",
    },
    {
      id: "LINK-004",
      journal_id: "TC-KHCN-004",
      link_type: "Trang chủ",
      label: "Trang chủ STDJ ĐHQG TP.HCM",
      url: "https://stdj.scienceandtechnology.com.vn",
      is_verified: true,
      verified_at: "2025-07-15",
      notes: "Cổng Open Journal Systems ĐHQG",
    },
  ]);
  applyHeaderStyle(lienKetSheet, 8);
  applyDataStyle(lienKetSheet);

  // -------------------------------------------------------------
  // Sheet 5: KIEM_CHUNG
  // -------------------------------------------------------------
  const kiemChungSheet = workbook.addWorksheet("KIEM_CHUNG");
  kiemChungSheet.columns = [
    { header: "journal_id", key: "journal_id", width: 16 },
    { header: "verification_status", key: "verification_status", width: 22 },
    { header: "verified_by", key: "verified_by", width: 20 },
    { header: "verified_date", key: "verified_date", width: 15 },
    { header: "source_reference", key: "source_reference", width: 38 },
    { header: "verification_notes", key: "verification_notes", width: 45 },
    { header: "schema_version", key: "schema_version", width: 16 },
  ];
  kiemChungSheet.addRows([
    {
      journal_id: "TC-VHNT-001",
      verification_status: "verified",
      verified_by: "Spark Agent",
      verified_date: "2025-07-15",
      source_reference: "Quyết định 26/QĐ-HĐGSNN, Phụ lục ngành VHNT-TDTT",
      verification_notes: "Đã đối chiếu website chính thức và danh mục phê duyệt",
      schema_version: 1,
    },
    {
      journal_id: "TC-KT-002",
      verification_status: "verified",
      verified_by: "Spark Agent",
      verified_date: "2025-07-15",
      source_reference: "Quyết định 26/QĐ-HĐGSNN, Phụ lục ngành Kiến trúc",
      verification_notes: "Đã xác minh website và thông tin liên hệ Hội KTS",
      schema_version: 1,
    },
    {
      journal_id: "TC-NCMT-003",
      verification_status: "unverified",
      verified_by: "Spark Agent",
      verified_date: "2025-07-15",
      source_reference: "Quyết định 26/QĐ-HĐGSNN",
      verification_notes: "Chưa xác minh website tòa soạn; thông tin từ quyết định HĐGS",
      schema_version: 1,
    },
    {
      journal_id: "TC-KHCN-004",
      verification_status: "verified",
      verified_by: "Spark Agent",
      verified_date: "2025-07-15",
      source_reference: "Quyết định 26/QĐ-HĐGSNN, Hệ thống OJS ĐHQG",
      verification_notes: "Website hoạt động bình thường, thông tin APC công khai",
      schema_version: 1,
    },
    {
      journal_id: "TC-TKST-005",
      verification_status: "needs_update",
      verified_by: "Anti Auto-check",
      verified_date: "2025-07-15",
      source_reference: "Hồ sơ dự thảo",
      verification_notes: "Cần bổ sung trang chủ chính thức và thể lệ gửi bài",
      schema_version: 1,
    },
  ]);
  applyHeaderStyle(kiemChungSheet, 7);
  applyDataStyle(kiemChungSheet);

  // Ensure directories exist
  const publicTemplatesDir = path.resolve("public", "templates");
  const docsDir = path.resolve("docs");
  if (!fs.existsSync(publicTemplatesDir)) {
    fs.mkdirSync(publicTemplatesDir, { recursive: true });
  }

  const outPublic = path.join(publicTemplatesDir, "IFA_RH_Journal_Directory_Template_v1.xlsx");
  const outDocs = path.join(docsDir, "IFA_RH_Journal_Directory_Template_v1.xlsx");

  await workbook.xlsx.writeFile(outPublic);
  await workbook.xlsx.writeFile(outDocs);

  console.log("Template generated successfully at:");
  console.log("- " + outPublic);
  console.log("- " + outDocs);
}

generateTemplate().catch((err) => {
  console.error(err);
  process.exit(1);
});
