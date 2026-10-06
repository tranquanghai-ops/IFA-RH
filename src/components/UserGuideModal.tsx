import React from "react";
import { Modal } from "./Modal";
import {
  BookOpen,
  UserCheck,
  Shield,
  Layers,
  Sparkles,
  FileSpreadsheet,
  Lock,
  Compass,
} from "lucide-react";

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hướng dẫn sử dụng Hệ thống IFA-RH"
      maxWidth="large"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24, fontSize: "0.9rem", color: "var(--text-main)" }}>
        {/* Intro */}
        <div style={{ background: "var(--primary-light)", padding: 16, borderRadius: 8, borderLeft: "4px solid var(--primary)" }}>
          <div style={{ fontWeight: 700, color: "var(--primary)", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
            <BookOpen size={18} />
            Giới thiệu Hệ thống IFA-RH (IFA Research Hub)
          </div>
          <p style={{ margin: 0, color: "var(--text-sub)", lineHeight: 1.5 }}>
            IFA-RH là nền tảng quản lý và thúc đẩy hoạt động Nghiên cứu Khoa học của Khoa Mỹ thuật Công nghiệp — Đại học Tôn Đức Thắng.
            Hệ thống hỗ trợ cập nhật cơ hội học thuật, quản lý toàn diện vòng đời công trình nghiên cứu và lưu trữ hồ sơ công bố khoa học.
          </p>
        </div>

        {/* Section 1: Dành cho Giảng viên */}
        <section className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: "1.05rem", color: "var(--primary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <UserCheck size={18} />
            1. Dành cho Giảng viên Khoa MTCN
          </h3>
          <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10, lineHeight: 1.55 }}>
            <li>
              <strong>Hồ sơ cá nhân:</strong> Cập nhật học vị, bộ môn và các định danh học thuật quốc tế (ORCID, Google Scholar, ResearchGate) để đồng bộ hóa trích dẫn khoa học.
            </li>
            <li>
              <strong>Cơ hội NCKH:</strong> Khám phá danh mục Hội thảo, Call for Papers, Special Issue, Book Chapter phù hợp với các chuyên ngành Mỹ thuật Công nghiệp kèm hạn chót và gợi ý hướng viết bài.
            </li>
            <li>
              <strong>Tiến độ NCKH (9 giai đoạn):</strong> Khởi tạo công trình mới và cập nhật trạng thái xuyên suốt từ <em>Ý tưởng</em> ➔ <em>Đề cương</em> ➔ <em>Bản thảo</em> ➔ <em>Bình duyệt</em> ➔ <em>Chấp nhận</em> ➔ <em>Hoàn thành</em>. Mỗi lần cập nhật sẽ tự động lưu vào lịch sử tiến độ bất biến.
            </li>
            <li>
              <strong>Chuyển đổi 1-click sang bài xuất bản:</strong> Khi công trình hoàn thành, sử dụng nút <em>“Chuyển thành bài xuất bản”</em> để tự động đưa vào Hồ sơ nghiên cứu mà không phải nhập lại từ đầu.
            </li>
            <li>
              <strong>Hồ sơ nghiên cứu (Quá khứ):</strong> Nhập và quản lý toàn bộ các bài báo tạp chí, kỷ yếu hội thảo, sách, giáo trình và tác phẩm nghệ thuật/sáng tạo đã thực hiện trước đây.
            </li>
          </ul>
        </section>

        {/* Section 2: Dành cho Admin */}
        <section className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: "1.05rem", color: "var(--primary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={18} />
            2. Dành cho Quản trị viên (Admin)
          </h3>
          <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10, lineHeight: 1.55 }}>
            <li>
              <strong>Hàng chờ cơ hội Spark AI:</strong> Kiểm duyệt các cơ hội học thuật do AI/Spark tự động thu thập từ các tạp chí và hội thảo quốc tế. Admin có thể chỉnh sửa nội dung, duyệt phát hành hoặc từ chối.
            </li>
            <li>
              <strong>Quản lý danh sách Giảng viên:</strong> Thêm mới hoặc điều chỉnh thông tin nhân sự trong danh sách cấp quyền truy cập hệ thống.
            </li>
            <li>
              <strong>Nhập liệu từ Excel/CSV:</strong> Hỗ trợ import hàng loạt cơ hội NCKH hoặc danh sách giảng viên qua file `.xlsx` / `.csv` với tính năng tự động phát hiện trùng lặp và kiểm tra lỗi từng dòng.
            </li>
            <li>
              <strong>Báo cáo & Thống kê Khoa:</strong> Theo dõi tổng thể năng suất NCKH toàn khoa theo từng năm và xuất báo cáo chuẩn Excel phục vụ đánh giá định kỳ.
            </li>
          </ul>
        </section>

        {/* Section 3: Dành cho Owner */}
        <section className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: "1.05rem", color: "#991b1b", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Shield size={18} />
            3. Dành cho Chủ sở hữu hệ thống (Owner)
          </h3>
          <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10, lineHeight: 1.55 }}>
            <li>
              <strong>Phân quyền Quản trị:</strong> Chỉ định hoặc thu hồi quyền Admin cho nhân sự trong Khoa một cách an toàn.
            </li>
            <li>
              <strong>Giám sát Audit Logs:</strong> Kiểm tra toàn bộ nhật ký thao tác quan trọng (thêm/sửa cơ hội, cập nhật tiến độ, phân quyền, import dữ liệu) được ghi nhận bất biến trong hệ thống.
            </li>
            <li>
              <strong>Cấu hình hệ thống:</strong> Thiết lập trạng thái hoạt động (Bình thường / Chế độ bảo trì) của nền tảng khi cần nâng cấp.
            </li>
          </ul>
        </section>

        {/* Section 4: Bảo mật */}
        <div style={{ background: "#f8fafc", padding: 16, borderRadius: 8, border: "1px solid var(--line)" }}>
          <div style={{ fontWeight: 700, color: "var(--text-main)", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <Lock size={16} />
            Lưu ý về Bảo mật & Tài khoản TDTU
          </div>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.6 }}>
            Hệ thống chỉ cho phép đăng nhập bằng tài khoản Google trường Đại học Tôn Đức Thắng (<code>@tdtu.edu.vn</code>) đã được Ban Chủ nhiệm hoặc Quản trị viên cấp phép trước. Mọi dữ liệu nghiên cứu cá nhân được bảo vệ nghiêm ngặt theo quy định về sở hữu trí tuệ và bảo mật thông tin.
          </p>
        </div>
      </div>
    </Modal>
  );
};
