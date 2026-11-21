import { DEMO_MODE } from "@/lib/db";

/** Dải báo bản dùng thử (chỉ hiện khi DEMO_MODE – ví dụ khi chạy trên Vercel). */
export default function DemoBanner() {
  if (!DEMO_MODE) return null;
  return (
    <div className="demo-banner" role="note">
      <b>Bản dùng thử.</b> Dữ liệu có thể tự trở về dữ liệu mẫu bất cứ lúc nào – không dùng để lưu số liệu thật.
    </div>
  );
}
