import { PageHeader } from "@/components/ui/PageHeader";
import { ClearCacheButton } from "./components/ClearCacheButton";

export default function ClearCachePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Xoá bộ nhớ đệm"
        subtitle="Bấm nút dưới đây nếu món, giá hoặc biến thể vừa sửa chưa hiện đúng."
      />
      <ClearCacheButton />
    </div>
  );
}
