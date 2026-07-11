import { formatNumber } from "@/lib/format";

export default function CategoryPieChart({ data }: { data: { label: string, amount: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);
  
  // Mảng màu sắc cho biểu đồ tròn
  const colors = [
    "#3b82f6", // blue-500
    "#10b981", // emerald-500
    "#f59e0b", // amber-500
    "#ef4444", // red-500
    "#8b5cf6", // violet-500
    "#ec4899", // pink-500
    "#06b6d4", // cyan-500
    "#f97316", // orange-500
    "#64748b", // slate-500
    "#84cc16", // lime-500
  ];

  let currentAngle = 0;
  const sortedData = [...data].sort((a, b) => b.amount - a.amount).filter(d => d.amount > 0);
  
  const conicGradient = sortedData.map((d, i) => {
    const percentage = (d.amount / total) * 360;
    const color = colors[i % colors.length];
    const segment = `${color} ${currentAngle}deg ${currentAngle + percentage}deg`;
    currentAngle += percentage;
    return segment;
  }).join(", ");

  return (
    <div className="bg-surface-card rounded-card p-6 shadow-sm border border-border flex flex-col min-h-[400px]">
      <h3 className="font-bold text-text-primary mb-6">Tỉ trọng Doanh thu theo Nhóm</h3>
      
      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-muted">Không có dữ liệu</div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-8">
          <div 
            className="w-48 h-48 rounded-full shadow-inner relative"
            style={{ background: `conic-gradient(${conicGradient})` }}
          >
            {/* Lỗ ở giữa để tạo hiệu ứng Donut Chart (Tuỳ chọn) */}
            <div className="absolute inset-0 m-auto w-24 h-24 bg-surface-card rounded-full flex items-center justify-center shadow-inner">
              <span className="font-bold text-text-muted text-xs text-center leading-tight">Tổng<br/>{(total / 1000000).toFixed(1)}M</span>
            </div>
          </div>
          
          <div className="w-full space-y-3 max-h-40 overflow-y-auto pr-2">
            {sortedData.map((d, i) => {
              const percent = ((d.amount / total) * 100).toFixed(1);
              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }}></span>
                    <span className="text-text-secondary truncate max-w-[120px]" title={d.label}>{d.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-text-primary mr-2">{formatNumber(d.amount)}</span>
                    <span className="text-text-muted text-xs w-8 inline-block">{percent}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  );
}
