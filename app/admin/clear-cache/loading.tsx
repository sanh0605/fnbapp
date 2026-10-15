import { PageHeader } from "@/components/ui/PageHeader";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Xoá bộ nhớ đệm"
        subtitle="Bấm nút dưới đây nếu món, giá hoặc biến thể vừa sửa chưa hiện đúng."
      />
      <div className="h-11 w-full md:w-44 bg-surface-secondary rounded-button animate-pulse" />
    </div>
  );
}
