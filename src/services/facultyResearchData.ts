import type { OpportunityCandidate, OpportunityType, OpportunityLevel } from "../types";
import { normalizeText } from "../utils/dedupe";
import { formatDateVN } from "../utils/date";

export interface RawFacultyResearchRow {
  stt?: number;
  discoveredAt?: string;
  runId?: string;
  title: string;
  sourceUrl?: string;
  submissionUrl?: string;
  organizer: string;
  country: string;
  level: string;
  type: string;
  topic: string;
  suitability?: string;
  field: string;
  abstractDeadline?: string;
  fullPaperDeadline?: string;
  registrationDeadline?: string;
  eventDate?: string;
  location?: string;
  fee?: string;
  publicationFormat?: string;
  indexing?: string;
  content: string;
  directions?: string;
  tags?: string;
  statusText?: string;
  updatedAt?: string;
  notes?: string;
}

/**
 * Verified dataset from "IFA Faculty Research Opportunities.xlsx" (Sheet "Cơ hội NCKH")
 * Synthesized by Spark AI for MTCN faculty research portal.
 */
export const OFFICIAL_FACULTY_RESEARCH_RECORDS: RawFacultyResearchRow[] = [
  {
    stt: 1,
    discoveredAt: "2026-10-06T00:00:00.000Z",
    runId: "20261006-01",
    title: "Hội thảo khoa học quốc tế lần thứ 9: Các vấn đề đương đại trong Kinh tế, Quản trị và Kinh doanh (9th CIEMB 2026)",
    sourceUrl: "https://khoahoc.neu.edu.vn/vi/thu-moi-viet-bai-hoi-thao/thu-moi-viet-bai-hoi-thao-quoc-te-lan-thu-9-cac-van-de-duong-dai-trong-kinh-te-quan-tri-va-kinh-doanh-9th-ciemb-2026",
    submissionUrl: "https://ciemb.neu.edu.vn/",
    organizer: "Đại học Kinh tế Quốc dân (NEU) & Đại học Quốc gia Úc (ANU)",
    country: "Việt Nam",
    level: "Quốc tế",
    type: "Hội thảo",
    topic: "Contemporary Issues in Economics, Management and Business (Kinh tế số, Quản trị đổi mới sáng tạo, ESG & Phát triển bền vững)",
    suitability: "Phù hợp",
    field: "Chung Khoa MTCN, Thiết kế đồ họa, Thiết kế công nghiệp, Thiết kế thời trang",
    abstractDeadline: "",
    fullPaperDeadline: "2026-10-30T00:00:00.000Z",
    registrationDeadline: "2026-11-14T00:00:00.000Z",
    eventDate: "03/12/2026 - 04/12/2026",
    location: "Đại học Kinh tế Quốc dân, Hà Nội / Trực tiếp kết hợp trực tuyến (Hybrid)",
    fee: "Theo quy định BTC (có phí cho tác giả)",
    publicationFormat: "Kỷ yếu hội thảo quốc tế & Tạp chí liên kết",
    indexing: "ISBN (Kỷ yếu), một số bài xuất sắc chọn đăng tạp chí liên kết Scopus",
    content: "Diễn đàn học thuật quốc tế thường niên uy tín bàn về kinh tế số, quản trị đổi mới sáng tạo, chuyển đổi xanh, tiếp thị và chuỗi giá trị trong kỷ nguyên công nghệ.",
    directions: "1. Quản trị thương hiệu thị giác (Visual Branding) và thiết kế trải nghiệm khách hàng (CX Design) trong thương mại số; 2. Mô hình kinh doanh thời trang tuần hoàn (Circular Fashion) và chiến lược thiết kế giảm rác thải dệt may; 3. Tác động của thiết kế bao bì xanh (Eco-packaging) đến quyết định mua hàng và giá trị thương hiệu.",
    tags: "CIEMB 2026, Visual Branding, Circular Fashion, Eco-packaging, Design Management",
    statusText: "MỚI",
    updatedAt: "2026-10-06T00:00:00.000Z",
    notes: "Hội thảo quốc tế uy tín cao; bài xuất sắc có cơ hội đăng tạp chí Scopus; hạn nộp còn 24 ngày."
  },
  {
    stt: 2,
    discoveredAt: "2026-10-06T00:00:00.000Z",
    runId: "20261006-01",
    title: "Hội thảo khoa học quốc tế thường niên: Law, Economics, Trade and Justice 2027 (LETJ 2027)",
    sourceUrl: "https://neu.edu.vn/ban-tin-khcn-neu-quy-iii-nam-2026/",
    submissionUrl: "mailto:pqlkh@neu.edu.vn",
    organizer: "Đại học Kinh tế Quốc dân phối hợp các viện đối tác quốc tế",
    country: "Việt Nam",
    level: "Quốc tế",
    type: "Hội thảo",
    topic: "Pháp luật, Kinh tế, Thương mại, Sở hữu trí tuệ và Công lý trong kỷ nguyên số",
    suitability: "Tham khảo",
    field: "Chung Khoa MTCN, Thiết kế đồ họa",
    abstractDeadline: "",
    fullPaperDeadline: "2026-11-15T00:00:00.000Z",
    registrationDeadline: "",
    eventDate: "15/01/2027",
    location: "Đại học Kinh tế Quốc dân, Hà Nội / Trực tiếp kết hợp trực tuyến",
    fee: "",
    publicationFormat: "Kỷ yếu hội thảo quốc tế",
    indexing: "ISBN",
    content: "Nghiên cứu các vấn đề pháp lý, thể chế kinh tế, sở hữu trí tuệ và công lý trước sự bùng nổ của AI và công nghệ số.",
    directions: "1. Quyền sở hữu trí tuệ và bảo hộ tác quyền đối với tác phẩm thiết kế đồ họa tạo bởi Generative AI; 2. Khung pháp lý và đạo đức trong việc sử dụng dữ liệu phong cách nghệ sĩ để huấn luyện AI tạo ảnh; 3. Tranh chấp bản quyền kiểu dáng công nghiệp trong thương mại điện tử xuyên biên giới.",
    tags: "Bản quyền AI, Sở hữu trí tuệ, AI Ethics, Thiết kế đồ họa, Kiểu dáng công nghiệp",
    statusText: "MỚI",
    updatedAt: "2026-10-06T00:00:00.000Z",
    notes: "Hướng nghiên cứu liên ngành pháp lý - thiết kế số, hạn nộp còn 40 ngày."
  },
  {
    stt: 3,
    discoveredAt: "2026-10-06T00:00:00.000Z",
    runId: "20261006-01",
    title: "Hội thảo khoa học quốc tế lần thứ 7: Các hệ thống thông minh và Mạng 2027 (ICISN 2027)",
    sourceUrl: "https://icisn.com/",
    submissionUrl: "https://www.icisn.com/for-attendees",
    organizer: "Trường Đại học Hải Dương & Sở KH&CN TP. Hải Phòng",
    country: "Việt Nam",
    level: "Quốc tế",
    type: "Hội thảo",
    topic: "Intelligent Systems, Networks, AI Applications, Human-Computer Interaction, Multimedia Computing",
    suitability: "Rất phù hợp",
    field: "Nghệ thuật số, Thiết kế đồ họa, Thiết kế công nghiệp",
    abstractDeadline: "",
    fullPaperDeadline: "2026-11-20T00:00:00.000Z",
    registrationDeadline: "2027-02-15T00:00:00.000Z",
    eventDate: "20/03/2027 - 21/03/2027",
    location: "Hải Dương & Hải Phòng, Việt Nam / Trực tiếp kết hợp trực tuyến",
    fee: "$250 (khoảng 6.375.000 VNĐ cho giảng viên)",
    publicationFormat: "Sách hội thảo quốc tế (Springer LNNS)",
    indexing: "Scopus, EI Compendex, INSPEC, SCImago",
    content: "Hội thảo quốc tế chuyên sâu về hệ thống thông minh, tương tác người - máy, trí tuệ nhân tạo tạo sinh, xử lý đồ họa máy tính và đa phương tiện. Toàn bộ bài báo được xuất bản trong bộ sách Springer Lecture Notes in Networks and Systems.",
    directions: "1. Giao diện người dùng thích ứng (Adaptive UI) và trải nghiệm người dùng (UX) trên các hệ thống thông minh AI; 2. Ứng dụng Generative AI trong hỗ trợ quy trình sáng tác nghệ thuật số và đồ họa chuyển động (Motion Graphics); 3. Thiết kế môi trường thực tế ảo (VR/XR) trong mô phỏng sản phẩm công nghiệp và kiến trúc nội thất thông minh.",
    tags: "ICISN 2027, Scopus, Springer LNNS, UX/UI, Generative AI, Nghệ thuật số, XR",
    statusText: "MỚI",
    updatedAt: "2026-10-06T00:00:00.000Z",
    notes: "Xuất bản Springer Nature được chỉ mục Scopus; hạn nộp 20/11/2026 (còn 45 ngày)."
  },
  {
    stt: 4,
    discoveredAt: "2026-10-06T00:00:00.000Z",
    runId: "20261006-01",
    title: "Hội thảo khoa học quốc gia: “Các vấn đề đương đại trong phát triển”",
    sourceUrl: "https://khoahoc.neu.edu.vn/vi/thu-moi-viet-bai-hoi-thao/thu-moi-viet-bai-hoi-thao-khoa-hoc-quoc-gia-chu-de-cac-van-de-duong-dai-trong-phat-trien",
    submissionUrl: "mailto:pqlkh@neu.edu.vn",
    organizer: "Đại học Kinh tế Quốc dân phối hợp Ủy ban Kinh tế và Tài chính của Quốc hội",
    country: "Việt Nam",
    level: "Quốc gia",
    type: "Hội thảo",
    topic: "Các vấn đề đương đại trong phát triển kinh tế, chuyển đổi số, chuyển đổi xanh và phát triển bền vững",
    suitability: "Phù hợp",
    field: "Chung Khoa MTCN, Thiết kế công nghiệp, Thiết kế đồ họa",
    abstractDeadline: "",
    fullPaperDeadline: "2026-10-09T00:00:00.000Z",
    registrationDeadline: "",
    eventDate: "27/10/2026",
    location: "Đại học Kinh tế Quốc dân, Hà Nội / Trực tiếp",
    fee: "Miễn phí",
    publicationFormat: "Kỷ yếu hội thảo quốc gia",
    indexing: "ISBN",
    content: "Diễn đàn trao đổi về các vấn đề cấp bách trong phát triển kinh tế - xã hội Việt Nam đương đại, cơ cấu lại nền kinh tế, thúc đẩy các động lực tăng trưởng mới gắn với bền vững và công nghệ.",
    directions: "1. Vai trò của ngành thiết kế sáng tạo (Creative Design) trong chiến lược phát triển kinh tế ban đêm và du lịch đô thị; 2. Thiết kế sản phẩm và bao bì thân thiện môi trường hướng đến mục tiêu Net Zero 2050; 3. Chuyển đổi số trong bảo tồn và khai thác giá trị di sản mỹ thuật truyền thống phục vụ công nghiệp văn hóa.",
    tags: "Kinh tế sáng tạo, Thiết kế bền vững, Chuyển đổi xanh, Net Zero, Di sản mỹ thuật",
    statusText: "SẮP HẾT HẠN",
    updatedAt: "2026-10-06T00:00:00.000Z",
    notes: "HẠN NỘP GẤP: Còn 3 ngày (tính từ 06/10/2026). Kỷ yếu có ISBN."
  },
  {
    stt: 5,
    discoveredAt: "2026-10-06T00:00:00.000Z",
    runId: "20261006-01",
    title: "Hội thảo khoa học quốc tế lần thứ 5 về Giáo dục Kỹ thuật, Công nghệ, Kinh doanh và Sức khỏe (IETBHEC'27)",
    sourceUrl: "https://khoahoc.neu.edu.vn/vi/tin-nckh-khac/thu-moi-viet-bai-va-tham-du-hoi-thao-quoc-te-ietbhec-27-lan-thu-5",
    submissionUrl: "mailto:ietbhec2027@ued.udn.vn",
    organizer: "Trường Đại học Sư phạm - Đại học Đà Nẵng",
    country: "Việt Nam",
    level: "Quốc tế",
    type: "Hội thảo",
    topic: "Kiến tạo tương lai thông qua hợp tác và trao quyền kỹ năng: Từ học tập đến dẫn đầu",
    suitability: "Rất phù hợp",
    field: "Chung Khoa MTCN, Thiết kế đồ họa, Nghệ thuật số",
    abstractDeadline: "2026-10-15T00:00:00.000Z",
    fullPaperDeadline: "2026-10-15T00:00:00.000Z",
    registrationDeadline: "",
    eventDate: "25/02/2027 - 27/02/2027",
    location: "Trường Đại học Sư phạm - Đại học Đà Nẵng / Trực tiếp kết hợp trực tuyến",
    fee: "Theo quy định ĐHĐN",
    publicationFormat: "Kỷ yếu hội thảo khoa học quốc tế",
    indexing: "ISBN",
    content: "Hội thảo khoa học quốc tế về đổi mới giáo dục, phương pháp giảng dạy công nghệ và kỹ năng số, tích hợp tư duy sáng tạo và ứng dụng công nghệ trong giảng dạy đại học.",
    directions: "1. Đổi mới phương pháp giảng dạy đồ án thiết kế mỹ thuật công nghiệp với sự trợ giúp của AI; 2. Nâng cao năng lực số và tư duy trực quan cho sinh viên thiết kế đồ họa trong môi trường học tập số; 3. Ứng dụng công nghệ thực tế ảo (VR) trong giảng dạy lịch sử nghệ thuật và thiết kế nội thất.",
    tags: "Giáo dục thiết kế, Năng lực số, Đổi mới giảng dạy, AI trong giáo dục, Design Thinking",
    statusText: "SẮP HẾT HẠN",
    updatedAt: "2026-10-06T00:00:00.000Z",
    notes: "SẮP HẾT HẠN: Còn 9 ngày (tính từ 06/10/2026). Rất phù hợp chủ đề Giáo dục MTCN."
  },
  {
    stt: 6,
    discoveredAt: "2026-10-06T00:00:00.000Z",
    runId: "20261006-01",
    title: "Hội thảo khoa học quốc tế: “Shaping the Future of the Global South: Innovation, Digital Transformation and Sustainable Development”",
    sourceUrl: "https://neu.edu.vn/ban-tin-khcn-neu-quy-iii-nam-2026/",
    submissionUrl: "mailto:pqlkh@neu.edu.vn",
    organizer: "Đại học Kinh tế Quốc dân (NEU), IEASA và Đại học SMU (Nam Phi)",
    country: "Nam Phi / Việt Nam",
    level: "Quốc tế",
    type: "Hội thảo",
    topic: "Đổi mới sáng tạo, Chuyển đổi số và Phát triển bền vững tại các quốc gia Nam bán cầu",
    suitability: "Phù hợp",
    field: "Chung Khoa MTCN, Thiết kế công nghiệp, Thiết kế nội thất, Thiết kế đồ họa",
    abstractDeadline: "",
    fullPaperDeadline: "2026-10-16T00:00:00.000Z",
    registrationDeadline: "",
    eventDate: "23/11/2026",
    location: "Pretoria, Nam Phi / Kết hợp trực tuyến",
    fee: "",
    publicationFormat: "Kỷ yếu hội thảo quốc tế",
    indexing: "ISBN",
    content: "Hội thảo quốc tế thảo luận các sáng kiến chuyển đổi số, đổi mới công nghệ và phát triển xanh thích ứng với bối cảnh đặc thù của các quốc gia đang phát triển.",
    directions: "1. Ứng dụng vật liệu địa phương tái sinh trong thiết kế nội thất và sản phẩm sinh thái tại các nước đang phát triển; 2. Thiết kế truyền thông số cộng đồng nâng cao nhận thức bảo vệ môi trường và ứng phó biến đổi khí hậu; 3. Bảo tồn họa tiết thổ cẩm truyền thống qua sản phẩm mỹ thuật ứng dụng hiện đại.",
    tags: "Global South, Thiết kế sinh thái, Vật liệu bền vững, Mỹ thuật truyền thống, Chuyển đổi số",
    statusText: "SẮP HẾT HẠN",
    updatedAt: "2026-10-06T00:00:00.000Z",
    notes: "SẮP HẾT HẠN: Còn 10 ngày (tính từ 06/10/2026). Kỷ yếu quốc tế ISBN."
  },
  {
    stt: 7,
    discoveredAt: "2026-10-06T00:00:00.000Z",
    runId: "20261006-01",
    title: "Hội thảo Khoa học Quốc gia: \"Đồng kiến tạo chính sách trong kỷ nguyên số: Cách tiếp cận liên ngành - liên vùng\" (CELG 2026)",
    sourceUrl: "https://www.ueh.edu.vn/khoa-hoc/ueh-celg-thu-moi-viet-bai-hoi-thao-khoa-hoc-quoc-gia-dong-kien-tao-chinh-sach-trong-ky-nguyen-so-cach-tiep-can-lien-nganh-lien-vung-78862",
    submissionUrl: "https://go.ueh.edu.vn/htqg-celg-2026",
    organizer: "Trường Kinh tế, Luật và Quản lý nhà nước (UEH-CELG), Đại học Kinh tế TP.HCM",
    country: "Việt Nam",
    level: "Quốc gia",
    type: "Hội thảo",
    topic: "Phân tích, thiết kế và đồng kiến tạo chính sách trong kỷ nguyên số, tiếp cận liên ngành và liên vùng",
    suitability: "Phù hợp",
    field: "Chung Khoa MTCN, Thiết kế đồ họa, Thiết kế nội thất",
    abstractDeadline: "",
    fullPaperDeadline: "2026-10-20T00:00:00.000Z",
    registrationDeadline: "2026-10-30T00:00:00.000Z",
    eventDate: "12/11/2026",
    location: "Cơ sở B UEH, 279 Nguyễn Tri Phương, Q.10, TP.HCM / Trực tiếp kết hợp trực tuyến",
    fee: "Miễn phí",
    publicationFormat: "Kỷ yếu hội thảo quốc gia có ISBN (online 31/12/2026)",
    indexing: "ISBN",
    content: "Diễn đàn học thuật liên ngành nghiên cứu các cơ chế đồng kiến tạo chính sách, quản trị công trong bối cảnh AI, biến đổi khí hậu và chuyển đổi số mạnh mẽ.",
    directions: "1. Khung chính sách bảo hộ bản quyền tác phẩm mỹ thuật số trước tác động của trí tuệ nhân tạo tạo sinh; 2. Thiết kế định hướng hành vi (Behavioral Design) và thiết kế dịch vụ công (Service Design) trong chuyển đổi số cơ quan nhà nước; 3. Thiết kế cảnh quan và không gian công cộng đô thị thông minh theo định hướng bền vững.",
    tags: "CELG 2026, Đồng kiến tạo chính sách, Trí tuệ nhân tạo, Thiết kế dịch vụ công, Bản quyền AI",
    statusText: "SẮP HẾT HẠN",
    updatedAt: "2026-10-06T00:00:00.000Z",
    notes: "SẮP HẾT HẠN: Còn 14 ngày (tính từ 06/10/2026). Lưu ý tác giả cần khai báo mức độ sử dụng AI trong bài viết."
  },
  {
    stt: 8,
    discoveredAt: "2026-10-06T00:00:00.000Z",
    runId: "20261006-01",
    title: "Hội thảo khoa học quốc tế “Resilience by Technology and Design” lần thứ 3 (RTD 2026) – Chủ đề “FutureScape”",
    sourceUrl: "https://khoahoc.neu.edu.vn/vi/tin-nckh-khac/rtd-2026-thu-moi-tham-du-hoi-thao-khoa-hoc-quoc-te-resilience-by-technology-and-design-lan-thu-3-voi-chu-de-futurescape",
    submissionUrl: "mailto:rtd@ueh.edu.vn",
    organizer: "Đại học Kinh tế TP. Hồ Chí Minh (UEH) phối hợp các đối tác",
    country: "Việt Nam",
    level: "Quốc tế",
    type: "Hội thảo",
    topic: "Technology & Design for Sustainable Development, FutureScape, Smart Cities, Net Zero",
    suitability: "Rất phù hợp",
    field: "Chung Khoa MTCN, Thiết kế công nghiệp, Thiết kế nội thất",
    abstractDeadline: "2026-05-15T00:00:00.000Z",
    fullPaperDeadline: "2026-06-15T00:00:00.000Z",
    registrationDeadline: "2026-07-15T00:00:00.000Z",
    eventDate: "15/07/2026 - 20/07/2026",
    location: "TP. Hồ Chí Minh, Vĩnh Long, Nha Trang",
    fee: "",
    publicationFormat: "Kỷ yếu hội thảo quốc tế & Chuyên khảo",
    indexing: "ISBN",
    content: "Diễn đàn học thuật quốc tế kết nối công nghệ và thiết kế vì sự phát triển bền vững, đô thị thông minh và giải pháp hướng đến Net Zero.",
    directions: "1. Tư duy thiết kế thích ứng (Resilient Design Thinking) trong quy hoạch không gian nội thất; 2. Thiết kế sản phẩm Net Zero (Net Zero Product Design) sử dụng vật liệu tái chế.",
    tags: "RTD 2026, FutureScape, Sustainable Design, Thiết kế công nghiệp, Net Zero",
    statusText: "HẾT HẠN",
    updatedAt: "2026-10-06T00:00:00.000Z",
    notes: "Sự kiện đã diễn ra từ 15-20/07/2026. Lưu trong hệ thống để tự động theo dõi và cập nhật khi có CFP cho RTD lần thứ 4 (2027/2028)."
  }
];

/**
 * Maps a raw sheet row to a structured OpportunityCandidate object
 */
export function mapRowToCandidate(row: RawFacultyResearchRow, index: number): OpportunityCandidate {
  const normTitle = normalizeText(row.title);
  
  // Clean date strings
  const fullPaper = row.fullPaperDeadline && row.fullPaperDeadline !== "Chưa xác minh" ? row.fullPaperDeadline : "";
  const abstract = row.abstractDeadline && row.abstractDeadline !== "Chưa xác minh" ? row.abstractDeadline : "";
  const registration = row.registrationDeadline && row.registrationDeadline !== "Chưa xác minh" ? row.registrationDeadline : "";
  const event = row.eventDate && row.eventDate !== "Chưa xác minh" ? row.eventDate : "";

  // The main deadline to judge is full paper or abstract
  const mainDeadline = fullPaper || abstract || registration || "";

  // Split tags
  const tagsList = (row.tags || "")
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  // Normalize type & level
  let mappedType: OpportunityType = "Hội thảo";
  if (row.type?.includes("Hội nghị")) mappedType = "Hội nghị";
  else if (row.type?.includes("Call for Papers")) mappedType = "Call for Papers";
  else if (row.type?.includes("Special Issue")) mappedType = "Special Issue";
  else if (row.type?.includes("Book Chapter")) mappedType = "Book Chapter";
  else if (row.type?.includes("Seminar")) mappedType = "Seminar";

  let mappedLevel: OpportunityLevel = "Quốc tế";
  if (row.level?.includes("Quốc gia")) mappedLevel = "Quốc gia";
  else if (row.level?.includes("Trường")) mappedLevel = "Cấp Trường";
  else if (row.level?.includes("Khoa")) mappedLevel = "Cấp Khoa";

  const slug = `spark_opp_${row.runId || "sync"}_${row.stt || index + 1}`;

  return {
    id: slug,
    title: row.title,
    organizer: row.organizer || "Đang cập nhật",
    country: row.country || "Việt Nam",
    type: mappedType,
    level: mappedLevel,
    topic: row.topic || "",
    field: row.field || "Chung Khoa MTCN",
    tags: tagsList,
    deadline: mainDeadline,
    abstractDeadline: abstract || undefined,
    fullPaperDeadline: fullPaper || undefined,
    registrationDeadline: registration || undefined,
    eventDate: event || undefined,
    location: row.location || undefined,
    fee: row.fee || undefined,
    publicationFormat: row.publicationFormat || undefined,
    indexing: row.indexing || undefined,
    content: row.content || "",
    submissionUrl: row.submissionUrl || undefined,
    sourceUrl: row.sourceUrl || undefined,
    directions: row.directions || undefined,
    suitability: row.suitability || "Phù hợp",
    notes: row.notes || undefined,
    runId: row.runId || undefined,
    discoveredAt: row.discoveredAt || undefined,
    sheetStatus: row.statusText || undefined,
    sourceType: "SPARK",
    status: "pending",
    normalizedTitle: normTitle,
    createdAt: row.discoveredAt || new Date().toISOString(),
    updatedAt: row.updatedAt || new Date().toISOString(),
  };
}
