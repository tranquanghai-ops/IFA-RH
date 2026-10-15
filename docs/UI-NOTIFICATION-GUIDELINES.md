# Quy chuẩn Thông báo Người dùng & Hộp thoại Tương tác (UI Notification Guidelines)
### Hệ thống Nghiên cứu Khoa học IFA-RH — Khoa Mỹ thuật Công nghiệp, Trường ĐH Tôn Đức Thắng

---

Tài liệu này định nghĩa 10 quy chuẩn kỹ thuật bắt buộc khi xây dựng và phát triển giao diện người dùng trên hệ thống **IFA-RH**, nhằm loại bỏ triệt để trải nghiệm gián đoạn của các hộp thoại mặc định từ trình duyệt và thiết lập phong cách học thuật hiện đại, chuẩn mực.

---

## 10 Quy chuẩn Bắt buộc

### Quy chuẩn 1: Tuyệt đối không sử dụng Browser Dialogs
- **Cấm:** Không sử dụng `window.alert`, `window.confirm`, `window.prompt` hoặc các hàm toàn cục không chỉ định đối tượng `alert()`, `confirm()`, `prompt()` trong toàn bộ mã nguồn `src/`.
- **Lý do:** Hộp thoại trình duyệt chặn luồng thực thi JavaScript (blocking), gây gián đoạn luồng người dùng, phá vỡ trải nghiệm thẩm mỹ và không responsive trên thiết bị di động.

### Quy chuẩn 2: Thông báo Thành công (Success Toasts)
- Sử dụng Custom Toast từ hook `useToast().showSuccess(message)`.
- Thời gian hiển thị: Tự động đóng sau **3.5 giây**.
- Giao diện: Icon tích xanh lá (`CheckCircle2`), viền xanh, nền nhẹ nhàng, chữ sắc nét.
- Nội dung: Tiếng Việt thân thiện, mô tả chính xác kết quả hành động (ví dụ: *"Đã duyệt và cập nhật hồ sơ hội thảo thành công."*).

### Quy chuẩn 3: Thông báo Lỗi (Error Toasts & Logging)
- Sử dụng Custom Toast từ hook `useToast().showError(message, error)`.
- Thời gian hiển thị: Tối thiểu **8 giây** hoặc hiển thị nút đóng `X` để người dùng chủ động tắt.
- Giao diện: Icon cảnh báo đỏ/cam (`AlertCircle`), nền viền nổi bật.
- Nội dung: Thông điệp dễ hiểu kèm giải pháp hoặc hướng dẫn hành động cho người dùng.
- Kỹ thuật: Bắt buộc ghi log chi tiết lỗi (`console.error(err)`) bao gồm error code, stack trace để kỹ thuật viên tra cứu qua DevTools.

### Quy chuẩn 4: Hộp thoại Xác nhận Hành động Nguy hiểm (`<ConfirmDialog />`)
- Mọi thao tác làm thay đổi trạng thái quan trọng, xóa vĩnh viễn hoặc tác động lớn (Xóa công trình, Thu hồi hội thảo, Gỡ quyền Admin, Cập nhật vai trò, Ép buộc đồng bộ khi đang lock) bắt buộc sử dụng component `<ConfirmDialog />`.
- Cấu trúc: Tiêu đề rõ ràng, lời giải thích súc tích 1–2 câu về hậu quả hành động, nút Hủy bỏ trung tính và nút Xác nhận mang màu ngữ nghĩa (`danger`, `warning`, `primary`).
- Hiển thị spinner trạng thái xử lý khi `isLoading=true` và vô hiệu hóa nút bấm để ngăn bấm lặp.

### Quy chuẩn 5: Cấm Xác nhận 2 lần (Zero Double Confirmations)
- Tuyệt đối không hỏi xác nhận 2 lần cho cùng một hành động.
- Nếu người dùng đã mở một Modal nghiệp vụ chuyên biệt (như `CandidateReviewModal`) và bấm nút hành động dứt khoát hoặc đã hoàn thành quy trình xác nhận inline trong modal đó, hệ thống lập tức thực thi hành động, không bung thêm bất kỳ confirm dialog nào nữa.

### Quy chuẩn 6: Tính Nhất quán Ngôn ngữ & Thuật ngữ
- 100% thông báo, nhãn, nút bấm trên giao diện sử dụng tiếng Việt chuẩn mực.
- Tôn trọng và thống nhất thuật ngữ học thuật của Khoa MTCN - ĐH Tôn Đức Thắng:
  - *Hội thảo quốc tế*, *Hội nghị trong nước*, *Đề xuất cập nhật*, *Ứng viên hội thảo*, *Hồ sơ công bố*.
  - Không để sót các từ ngữ lập trình thô như: `PENDING_UPDATE`, `APPROVED_UPDATE`, `syncInProgress`.

### Quy chuẩn 7: Ánh xạ Lỗi Kỹ thuật Firestore sang Tiếng Việt
- Không bao giờ hiển thị trực tiếp chuỗi lỗi kỹ thuật thô của Firebase/Firestore (như `Missing or insufficient permissions`, `PERMISSION_DENIED`, `INTERNAL ASSERTION FAILED`) cho người dùng cuối.
- Phải chuyển đổi sang thông báo có ý nghĩa nghiệp vụ:
  - *"Bạn không có quyền thực hiện thao tác này. Vui lòng kiểm tra lại quyền Admin hoặc liên hệ Chủ sở hữu hệ thống."*

### Quy chuẩn 8: Thiết kế Responsive Đa Thiết bị
- Toàn bộ Toast và Confirm Dialog phải tương thích hoàn hảo từ màn hình di động 375px (iPhone SE, Android tiêu chuẩn) đến màn hình Retina / 4K.
- Tránh tràn màn hình ngang (overflow-x), nút bấm có kích thước tối thiểu 44px x 44px theo chuẩn Touch Target.

### Quy chuẩn 9: Phân tách Kiến trúc Mã nguồn Rõ ràng
- Quản lý trạng thái thông báo tập trung qua `ToastContext` (`src/context/ToastContext.tsx`).
- Tách rời giao diện hộp thoại xác nhận thành component dùng chung `src/components/ConfirmDialog.tsx`.
- Các trang và component chỉ cần gọi hook `useToast()` và quản lý state mở/đóng dialog cục bộ.

### Quy chuẩn 10: Kiểm thử Tĩnh Tự động (Static CI Verification)
- Toàn bộ quy chuẩn về cấm Browser Dialogs được kiểm soát tự động bởi bộ test Vitest: `src/tests/no_browser_dialogs.test.ts`.
- CI GitHub Actions sẽ chặn đứng (fail build) bất kỳ commit nào tái đưa `window.alert`, `window.confirm`, `window.prompt` hoặc các hàm không đủ điều kiện vào thư mục `src/`.

---

## Hướng dẫn Sử dụng Mẫu trong Code

### 1. Sử dụng Toast
```tsx
import { useToast } from "../context/ToastContext";

export const MyComponent: React.FC = () => {
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  const handleAction = async () => {
    try {
      await performAction();
      showSuccess("Đã lưu thay đổi thành công!");
    } catch (err: any) {
      console.error(err);
      showError("Không thể lưu thay đổi. Vui lòng thử lại.", err);
    }
  };

  return <button onClick={handleAction}>Lưu</button>;
};
```

### 2. Sử dụng ConfirmDialog
```tsx
import { ConfirmDialog } from "../components/ConfirmDialog";

export const MyComponent: React.FC = () => {
  const [targetItem, setTargetItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleExecuteDelete = async () => {
    if (!targetItem) return;
    setLoading(true);
    try {
      await deleteItem(targetItem.id);
      showSuccess(`Đã xóa "${targetItem.title}" thành công.`);
      setTargetItem(null);
    } catch (err: any) {
      console.error(err);
      showError("Lỗi khi xóa mục.", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => setTargetItem(item)}>Xóa</button>

      <ConfirmDialog
        isOpen={!!targetItem}
        title="Xác nhận xóa"
        message={`Bạn có chắc chắn muốn xóa "${targetItem?.title}"? Thao tác này không thể hoàn tác.`}
        confirmText="Xóa mục"
        variant="danger"
        isLoading={loading}
        onConfirm={handleExecuteDelete}
        onCancel={() => setTargetItem(null)}
      />
    </>
  );
};
```
