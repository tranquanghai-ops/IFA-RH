import type { OpportunityCandidate, OpportunityType, OpportunityLevel, OpportunityFeeStatus } from "../types";
import { normalizeText } from "../utils/dedupe";
import { formatFeeValue, UNKNOWN_FEE_TEXT, FREE_FEE_TEXT } from "../utils/fee";

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
  publicationFee?: string;
  registrationFee?: string;
  feeStatus?: OpportunityFeeStatus;
  feeSourceUrl?: string;
  publicationFormat?: string;
  indexing?: string;
  content: string;
  detailedContent?: string;
  topicsDetailed?: string[];
  directions?: string;
  tags?: string;
  statusText?: string;
  updatedAt?: string;
  notes?: string;
}

/**
 * Verified dataset from "IFA Faculty Research Opportunities.xlsx" (Sheet "Cơ hội NCKH")
 * Synthesized and deeply analyzed for MTCN faculty research portal.
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
    fee: "Theo quy định BTC (có phí cho tác giả nộp bài sau khi được duyệt)",
    publicationFee: "Theo quy định BTC (Tác giả hoàn tất phí sau khi nhận thông báo chấp nhận bài)",
    registrationFee: "Không rõ chi phí",
    feeStatus: "SPECIFIED",
    feeSourceUrl: "https://khoahoc.neu.edu.vn/vi/thu-moi-viet-bai-hoi-thao/thu-moi-viet-bai-hoi-thao-quoc-te-lan-thu-9-cac-van-de-duong-dai-trong-kinh-te-quan-tri-va-kinh-doanh-9th-ciemb-2026",
    publicationFormat: "Kỷ yếu hội thảo quốc tế & Tạp chí liên kết",
    indexing: "ISBN (Kỷ yếu), một số bài xuất sắc chọn đăng tạp chí liên kết Scopus",
    content: "Diễn đàn học thuật quốc tế thường niên uy tín bàn về kinh tế số, quản trị đổi mới sáng tạo, chuyển đổi xanh, tiếp thị và chuỗi giá trị trong kỷ nguyên công nghệ số.",
    detailedContent: "Hội thảo CIEMB lần thứ 9 do ĐH Kinh tế Quốc dân phối hợp cùng ĐH Quốc gia Úc (ANU) tổ chức thường niên, quy tụ các học giả và chuyên gia hàng đầu thảo luận các chủ đề mang tính thời sự: kinh tế số, quản trị đổi mới sáng tạo, chuyển đổi xanh (ESG), tiếp thị thị giác và chuỗi cung ứng bền vững. Các bài báo xuất sắc sẽ có cơ hội được bình duyệt để xuất bản trên các tạp chí quốc tế thuộc danh mục Scopus/WoS liên kết với hội thảo.",
    topicsDetailed: [
      "Track 1: Kinh tế số & Đổi mới sáng tạo trong mô hình kinh doanh hiện đại",
      "Track 2: Quản trị thương hiệu, Marketing thị giác & Trải nghiệm khách hàng (CX Design)",
      "Track 3: Chuyển đổi xanh, Phát triển bền vững (ESG) & Kinh tế tuần hoàn (Circular Economy)",
      "Track 4: Chuỗi cung ứng, Quản trị chuỗi giá trị & Đổi mới bao bì sinh thái (Eco-packaging)"
    ],
    directions: "1. Thiết kế đồ họa: Quản trị thương hiệu thị giác (Visual Identity Management), chiến lược nhận diện số và thiết kế bao bì sinh thái (Eco-packaging) gia tăng giá trị thương hiệu trong nền kinh tế số;\n2. Thiết kế thời trang: Mô hình kinh doanh thời trang tuần hoàn (Circular Fashion Design), giải pháp tái chế vật liệu dệt may và chiến lược thiết kế giảm rác thải trong chuỗi cung ứng thời trang;\n3. Thiết kế công nghiệp: Thiết kế sản phẩm bền vững theo tiêu chuẩn ESG, tích hợp vật liệu tái sinh và tối ưu hóa vòng đời sản phẩm (Life Cycle Assessment).",
    tags: "CIEMB 2026, Visual Branding, Circular Fashion, Eco-packaging, Design Management, ESG",
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
    submissionUrl: "https://neu.edu.vn/ban-tin-khcn-neu-quy-iii-nam-2026/",
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
    publicationFee: "Không rõ chi phí",
    registrationFee: "Không rõ chi phí",
    feeStatus: "UNKNOWN",
    feeSourceUrl: "https://neu.edu.vn/ban-tin-khcn-neu-quy-iii-nam-2026/",
    publicationFormat: "Kỷ yếu hội thảo quốc tế",
    indexing: "ISBN",
    content: "Nghiên cứu các vấn đề pháp lý, thể chế kinh tế, sở hữu trí tuệ và công lý trước sự bùng nổ của AI và công nghệ số.",
    detailedContent: "Hội thảo quốc tế LETJ 2027 là diễn đàn liên ngành nghiên cứu các vấn đề pháp lý, thể chế kinh tế, sở hữu trí tuệ và công lý trước sự phát triển vượt bậc của trí tuệ nhân tạo (AI) và công nghệ số. Trọng tâm dành cho giới thiết kế và mỹ thuật ứng dụng là khung pháp lý bảo hộ tác quyền đối với các tác phẩm tạo bởi Generative AI, đạo đức dữ liệu huấn luyện và quyền sở hữu kiểu dáng công nghiệp xuyên biên giới.",
    topicsDetailed: [
      "Track 1: Khung pháp lý & Quyền sở hữu trí tuệ đối với tác phẩm mỹ thuật số tạo bởi Generative AI",
      "Track 2: Đạo đức công nghệ, bản quyền phong cách nghệ sĩ và tính minh bạch của dữ liệu huấn luyện AI",
      "Track 3: Bảo hộ kiểu dáng công nghiệp và thương hiệu trong môi trường số & thương mại điện tử xuyên biên giới",
      "Track 4: Pháp luật thương mại và công lý số trong kỷ nguyên kinh tế nền tảng"
    ],
    directions: "1. Thiết kế đồ họa & Nghệ thuật số: Quyền sở hữu trí tuệ và bảo hộ tác quyền đối với tác phẩm thiết kế đồ họa tạo bởi Generative AI (Midjourney, Stable Diffusion, DALL-E);\n2. Toàn Khoa MTCN: Khung pháp lý và đạo đức trong việc sử dụng dữ liệu phong cách nghệ sĩ để huấn luyện AI tạo ảnh;\n3. Thiết kế công nghiệp: Tranh chấp bản quyền và giải pháp bảo vệ kiểu dáng công nghiệp trong thương mại điện tử xuyên biên giới.",
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
    publicationFee: "$250 USD / bài (khoảng 6.375.000 VNĐ cho tác giả trong nước xuất bản sách Springer LNNS)",
    registrationFee: "$150 USD (khoảng 3.825.000 VNĐ cho đại biểu tham dự không xuất bản bài)",
    feeStatus: "SPECIFIED",
    feeSourceUrl: "https://www.icisn.com/for-attendees",
    publicationFormat: "Sách hội thảo quốc tế (Springer LNNS)",
    indexing: "Scopus, EI Compendex, INSPEC, SCImago",
    content: "Hội thảo quốc tế chuyên sâu về hệ thống thông minh, tương tác người - máy, trí tuệ nhân tạo tạo sinh, xử lý đồ họa máy tính và đa phương tiện. Toàn bộ bài báo được xuất bản trong bộ sách Springer Lecture Notes in Networks and Systems.",
    detailedContent: "ICISN 2027 là hội thảo khoa học quốc tế thường niên uy tín, toàn bộ kỷ yếu được xuất bản trong ấn phẩm danh giá Springer Lecture Notes in Networks and Systems (LNNS), được chỉ mục toàn diện trên Scopus, EI Compendex, SCImago. Hội thảo đặc biệt khuyến khích các công trình liên ngành ứng dụng trí tuệ nhân tạo tạo sinh, tương tác người - máy (HCI), công nghệ thực tế ảo mở rộng (VR/AR/XR) và thiết kế trải nghiệm người dùng số hóa thích ứng.",
    topicsDetailed: [
      "Track 1: Human-Computer Interaction (HCI), UI/UX Design & Usability Engineering",
      "Track 2: Generative AI, Computer Vision & Intelligent Multimedia Computing",
      "Track 3: Virtual Reality (VR), Augmented Reality (AR) & Extended Reality (XR) Environments",
      "Track 4: Intelligent Systems, Digital Twins & Smart Interfaces for Industrial Design"
    ],
    directions: "1. Thiết kế đồ họa & UI/UX: Giao diện người dùng thích ứng (Adaptive UI) và trải nghiệm người dùng (UX) trên các hệ thống thông minh AI;\n2. Nghệ thuật số: Ứng dụng Generative AI trong hỗ trợ quy trình sáng tác nghệ thuật số, hoạt hình (Animation) và đồ họa chuyển động (Motion Graphics);\n3. Thiết kế công nghiệp & Nội thất: Thiết kế môi trường thực tế ảo (VR/XR) trong mô phỏng sản phẩm công nghiệp và kiến trúc nội thất thông minh thích ứng.",
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
    submissionUrl: "https://khoahoc.neu.edu.vn/vi/thu-moi-viet-bai-hoi-thao/thu-moi-viet-bai-hoi-thao-khoa-hoc-quoc-gia-chu-de-cac-van-de-duong-dai-trong-phat-trien",
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
    publicationFee: "Miễn phí",
    registrationFee: "Miễn phí",
    feeStatus: "FREE",
    feeSourceUrl: "https://khoahoc.neu.edu.vn/vi/thu-moi-viet-bai-hoi-thao/thu-moi-viet-bai-hoi-thao-khoa-hoc-quoc-gia-chu-de-cac-van-de-duong-dai-trong-phat-trien",
    publicationFormat: "Kỷ yếu hội thảo quốc gia",
    indexing: "ISBN",
    content: "Diễn đàn trao đổi về các vấn đề cấp bách trong phát triển kinh tế - xã hội Việt Nam đương đại, cơ cấu lại nền kinh tế, thúc đẩy các động lực tăng trưởng mới gắn với bền vững và công nghệ.",
    detailedContent: "Hội thảo Quốc gia do ĐH Kinh tế Quốc dân phối hợp với Ủy ban Kinh tế và Tài chính của Quốc hội tổ chức. Diễn đàn thảo luận về cơ cấu lại nền kinh tế, công nghiệp sáng tạo, thiết kế sản phẩm xanh thích ứng lộ trình Net Zero 2050 và chuyển đổi số trong việc bảo tồn các giá trị di sản mỹ thuật ứng dụng truyền thống.",
    topicsDetailed: [
      "Chủ đề 1: Đổi mới sáng tạo và phát triển kinh tế tuần hoàn hướng tới cam kết Net Zero 2050",
      "Chủ đề 2: Chuyển đổi số và công nghiệp văn hóa trong bối cảnh phát triển bền vững",
      "Chủ đề 3: Thiết kế sáng tạo (Creative Design), kinh tế ban đêm và phát triển du lịch đô thị",
      "Chủ đề 4: Bảo tồn và phát huy giá trị di sản mỹ thuật truyền thống trong nền kinh tế đương đại"
    ],
    directions: "1. Thiết kế công nghiệp: Thiết kế sản phẩm sinh thái (Eco-design), bao bì tái chế và giải pháp giảm phát thải rác thải nhựa hướng đến mục tiêu Net Zero 2050;\n2. Thiết kế nội thất: Vai trò của ngành thiết kế sáng tạo (Creative Design) trong chiến lược phát triển kinh tế ban đêm và không gian công cộng đô thị;\n3. Thiết kế đồ họa: Chuyển đổi số trong bảo tồn và khai thác giá trị di sản mỹ thuật truyền thống phục vụ công nghiệp văn hóa sáng tạo.",
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
    submissionUrl: "https://khoahoc.neu.edu.vn/vi/tin-nckh-khac/thu-moi-viet-bai-va-tham-du-hoi-thao-quoc-te-ietbhec-27-lan-thu-5",
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
    publicationFee: "Theo quy định ĐH Đà Nẵng (Thông báo trực tiếp cho tác giả có bài được duyệt)",
    registrationFee: "Không rõ chi phí",
    feeStatus: "SPECIFIED",
    feeSourceUrl: "https://khoahoc.neu.edu.vn/vi/tin-nckh-khac/thu-moi-viet-bai-va-tham-du-hoi-thao-quoc-te-ietbhec-27-lan-thu-5",
    publicationFormat: "Kỷ yếu hội thảo khoa học quốc tế",
    indexing: "ISBN",
    content: "Hội thảo khoa học quốc tế về đổi mới giáo dục, phương pháp giảng dạy công nghệ và kỹ năng số, tích hợp tư duy sáng tạo và ứng dụng công nghệ trong giảng dạy đại học.",
    detailedContent: "Hội thảo khoa học quốc tế IETBHEC'27 tập trung vào đổi mới giáo dục, phương pháp giảng dạy đại học ứng dụng công nghệ số và trí tuệ nhân tạo. Đây là cơ hội rất tốt để giảng viên Khoa Mỹ thuật Công nghiệp chia sẻ các sáng kiến sư phạm trong giảng dạy đồ án thiết kế mỹ thuật, rèn luyện tư duy thị giác và ứng dụng môi trường 3D/VR trong lớp học thiết kế.",
    topicsDetailed: [
      "Track 1: Đổi mới phương pháp sư phạm đại học trong kỷ nguyên số & AI",
      "Track 2: Tích hợp công nghệ giáo dục (EdTech), thực tế ảo và mô phỏng trực quan",
      "Track 3: Phát triển năng lực sáng tạo và tư duy thiết kế (Design Thinking) cho người học",
      "Track 4: Chuyển đổi số trong kiểm tra đánh giá đồ án nghệ thuật ứng dụng"
    ],
    directions: "1. Chung Khoa MTCN: Đổi mới phương pháp giảng dạy đồ án thiết kế mỹ thuật công nghiệp với sự trợ giúp của AI;\n2. Thiết kế đồ họa & Nghệ thuật số: Nâng cao năng lực số và tư duy trực quan cho sinh viên thiết kế đồ họa trong môi trường học tập số;\n3. Thiết kế nội thất: Ứng dụng công nghệ thực tế ảo (VR) và tương tác không gian 3D trong giảng dạy lịch sử nghệ thuật và thiết kế nội thất.",
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
    submissionUrl: "https://neu.edu.vn/ban-tin-khcn-neu-quy-iii-nam-2026/",
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
    publicationFee: "Không rõ chi phí",
    registrationFee: "Không rõ chi phí",
    feeStatus: "UNKNOWN",
    feeSourceUrl: "https://neu.edu.vn/ban-tin-khcn-neu-quy-iii-nam-2026/",
    publicationFormat: "Kỷ yếu hội thảo quốc tế",
    indexing: "ISBN",
    content: "Hội thảo quốc tế thảo luận các sáng kiến chuyển đổi số, đổi mới công nghệ và phát triển xanh thích ứng với bối cảnh đặc thù của các quốc gia đang phát triển.",
    detailedContent: "Hội thảo quốc tế quy mô đa quốc gia giữa Việt Nam và Nam Phi, bàn thảo về các sáng kiến chuyển đổi số, công nghệ thích ứng và thiết kế bền vững cho các nền kinh tế đang phát triển. Giảng viên MTCN có thể tiếp cận từ góc độ khai thác vật liệu bản địa, thiết kế thích ứng với khí hậu nhiệt đới và truyền thông thị giác cộng đồng.",
    topicsDetailed: [
      "Track 1: Sáng kiến đổi mới sáng tạo & công nghệ thích ứng cho các nước đang phát triển",
      "Track 2: Thiết kế sinh thái, khai thác vật liệu bản địa tái sinh trong nội thất và sản phẩm tiêu dùng",
      "Track 3: Truyền thông thị giác cộng đồng nâng cao nhận thức bảo vệ môi trường và ứng phó biến đổi khí hậu",
      "Track 4: Bảo tồn bản sắc và cách tân mỹ thuật truyền thống trong sản phẩm ứng dụng hiện đại"
    ],
    directions: "1. Thiết kế nội thất & Sản phẩm: Ứng dụng vật liệu địa phương tái sinh (mây tre đan, gốm, sợi tự nhiên) trong thiết kế nội thất và sản phẩm sinh thái tại các nước đang phát triển;\n2. Thiết kế đồ họa: Thiết kế truyền thông số cộng đồng nâng cao nhận thức bảo vệ môi trường và ứng phó biến đổi khí hậu;\n3. Thiết kế thời trang: Bảo tồn hoa văn, kỹ thuật dệt nhuộm thủ công truyền thống qua sản phẩm mỹ thuật ứng dụng hiện đại.",
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
    publicationFee: "Miễn phí",
    registrationFee: "Miễn phí",
    feeStatus: "FREE",
    feeSourceUrl: "https://www.ueh.edu.vn/khoa-hoc/ueh-celg-thu-moi-viet-bai-hoi-thao-khoa-hoc-quoc-gia-dong-kien-tao-chinh-sach-trong-ky-nguyen-so-cach-tiep-can-lien-nganh-lien-vung-78862",
    publicationFormat: "Kỷ yếu hội thảo quốc gia có ISBN (online 31/12/2026)",
    indexing: "ISBN",
    content: "Diễn đàn học thuật liên ngành nghiên cứu các cơ chế đồng kiến tạo chính sách, quản trị công trong bối cảnh AI, biến đổi khí hậu và chuyển đổi số mạnh mẽ.",
    detailedContent: "Hội thảo Quốc gia CELG 2026 do UEH tổ chức nhằm đồng kiến tạo chính sách trong kỷ nguyên số theo tiếp cận liên ngành. Rất phù hợp với nghiên cứu về thiết kế thông tin chính sách công (Public Information Design), thiết kế định hướng hành vi (Behavioral Design), và khung chính sách sở hữu trí tuệ đối với tác phẩm mỹ thuật số.",
    topicsDetailed: [
      "Chủ đề 1: Đồng kiến tạo chính sách trong kỷ nguyên số: Cách tiếp cận liên ngành - liên vùng",
      "Chủ đề 2: Khung chính sách bảo hộ bản quyền tác phẩm mỹ thuật số trước tác động của trí tuệ nhân tạo tạo sinh",
      "Chủ đề 3: Thiết kế dịch vụ công (Public Service Design) và thiết kế định hướng hành vi trong chuyển đổi số",
      "Chủ đề 4: Thiết kế cảnh quan và không gian công cộng đô thị thông minh theo định hướng bền vững"
    ],
    directions: "1. Chung Khoa MTCN: Khung chính sách bảo hộ bản quyền tác phẩm mỹ thuật số trước tác động của trí tuệ nhân tạo tạo sinh;\n2. Thiết kế đồ họa: Thiết kế định hướng hành vi (Behavioral Design) và thiết kế dịch vụ công (Service Design) trong chuyển đổi số cơ quan nhà nước;\n3. Thiết kế nội thất: Thiết kế cảnh quan và không gian công cộng đô thị thông minh theo định hướng bền vững.",
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
    submissionUrl: "https://khoahoc.neu.edu.vn/vi/tin-nckh-khac/rtd-2026-thu-moi-tham-du-hoi-thao-khoa-hoc-quoc-te-resilience-by-technology-and-design-lan-thu-3-voi-chu-de-futurescape",
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
    publicationFee: "Không rõ chi phí",
    registrationFee: "Không rõ chi phí",
    feeStatus: "UNKNOWN",
    feeSourceUrl: "https://khoahoc.neu.edu.vn/vi/tin-nckh-khac/rtd-2026-thu-moi-tham-du-hoi-thao-khoa-hoc-quoc-te-resilience-by-technology-and-design-lan-thu-3-voi-chu-de-futurescape",
    publicationFormat: "Kỷ yếu hội thảo quốc tế & Chuyên khảo",
    indexing: "ISBN",
    content: "Diễn đàn học thuật quốc tế kết nối công nghệ và thiết kế vì sự phát triển bền vững, đô thị thông minh và giải pháp hướng đến Net Zero.",
    detailedContent: "Hội thảo quốc tế RTD lần thứ 3 (FutureScape) kết nối sâu sắc giữa Công nghệ và Thiết kế vì sự phát triển bền vững. Diễn đàn tập trung vào tư duy thiết kế thích ứng (Resilient Design Thinking), thiết kế sản phẩm Net Zero, vật liệu tái chế sâu và không gian tương tác đa giác quan thông minh tại các đô thị tương lai.",
    topicsDetailed: [
      "Track 1: FutureScape & Resilient Design Thinking: Định hình tương lai đô thị qua công nghệ và thiết kế",
      "Track 2: Technology & Design for Net Zero, Smart Cities & Circular Economy",
      "Track 3: Digital Art, Interactive Spaces & Advanced Bio-materials",
      "Track 4: Quy hoạch không gian nội thất thông minh thích ứng biến đổi khí hậu"
    ],
    directions: "1. Thiết kế công nghiệp: Tư duy thiết kế thích ứng (Resilient Design Thinking) trong sản phẩm công nghiệp và thiết kế sản phẩm Net Zero sử dụng vật liệu tái chế;\n2. Thiết kế nội thất: Quy hoạch không gian nội thất và kiến trúc cảnh quan bền vững thích ứng biến đổi khí hậu;\n3. Nghệ thuật số: Sáng tạo nghệ thuật số tương tác trong không gian trải nghiệm đô thị tương lai.",
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

  // Fee resolution
  const feeStatus: OpportunityFeeStatus =
    row.feeStatus ||
    (row.fee?.includes("Miễn phí") || row.publicationFee?.includes("Miễn phí")
      ? "FREE"
      : row.publicationFee || row.registrationFee || row.fee
      ? "SPECIFIED"
      : "UNKNOWN");

  const publicationFee =
    row.publicationFee ||
    (feeStatus === "FREE" ? FREE_FEE_TEXT : row.fee ? formatFeeValue(row.fee) : UNKNOWN_FEE_TEXT);

  const registrationFee =
    row.registrationFee ||
    (feeStatus === "FREE" ? FREE_FEE_TEXT : UNKNOWN_FEE_TEXT);

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
    publicationFee,
    registrationFee,
    feeStatus,
    feeSourceUrl: row.feeSourceUrl || undefined,
    publicationFormat: row.publicationFormat || undefined,
    indexing: row.indexing || undefined,
    content: row.content || "",
    detailedContent: row.detailedContent || undefined,
    topicsDetailed: row.topicsDetailed || undefined,
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
