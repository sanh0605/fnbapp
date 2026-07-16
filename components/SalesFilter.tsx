"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import StickyFilterBar from "@/components/StickyFilterBar";

// Claude code — UI-3: encode URL date as YYYY-MM-DD (friendly + shareable).
// Backward compat: accept both ISO datetime and date-only when reading.
function toDateOnlyForUrl(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateParam(value: string): Date {
  // ISO datetime (legacy) → use as-is.
  if (value.includes("T")) return new Date(value);
  // Date only YYYY-MM-DD → treat as local midnight (browser TZ = Saigon for vn users).
  return new Date(`${value}T00:00:00`);
}

interface Brand {
  id: string;
  name: string;
  status?: string;
}

interface User {
  id: string;
  name?: string;
  username?: string;
  status?: string;
}

interface Category {
  id: string;
  name: string;
  status?: string;
}

export default function SalesFilter(props: {
  brands: Brand[];
  users: User[];
  categories: Category[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <React.Suspense fallback={<div className="h-20 bg-page animate-pulse rounded-xl mb-6 border border-border"></div>}>
      <SalesFilterInner {...props} />
    </React.Suspense>
  );
}

function SalesFilterInner({
  brands,
  users,
  categories,
  title,
  subtitle
}: {
  brands: Brand[];
  users: User[];
  categories: Category[];
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [startDate, setStartDate] = useState<Date | null>(
    searchParams.get("start")
      ? parseDateParam(searchParams.get("start")!)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const [endDate, setEndDate] = useState<Date | null>(
    searchParams.get("end") ? parseDateParam(searchParams.get("end")!) : new Date(new Date().setHours(23,59,59,999))
  );

  const [brandId, setBrandId] = useState(searchParams.get("brandId") || "");
  const [staffName, setStaffName] = useState(searchParams.get("staffName") || "");
  const [categoryId, setCategoryId] = useState(searchParams.get("categoryId") || "");

  // Use a ref to prevent auto-submitting on initial render
  const isMounted = useRef(false);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    
    // Auto submit whenever state changes
    if (startDate && endDate) {
      const timeoutId = setTimeout(() => {
        const params = new URLSearchParams();
        // Claude code — UI-3: YYYY-MM-DD friendly URL; server toSaigonUtcRange handles date-only.
        params.set("start", toDateOnlyForUrl(startDate));
        params.set("end", toDateOnlyForUrl(endDate));
        if (brandId) params.set("brandId", brandId);
        if (staffName) params.set("staffName", staffName);
        if (categoryId) params.set("categoryId", categoryId);
        
        router.push(`?${params.toString()}`);
      }, 400); // 400ms debounce
      return () => clearTimeout(timeoutId);
    }
  }, [startDate, endDate, brandId, staffName, categoryId, router]);

  const setPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0,0,0,0);
    setStartDate(start);
    setEndDate(end);
  };

  const activeBrands = useMemo(() => brands.filter(b => b.status !== "DELETED" && b.status !== "INACTIVE"), [brands]);
  const activeUsers = useMemo(() => users.filter(u => u.status !== "DELETED" && u.status !== "INACTIVE"), [users]);
  const activeCategories = useMemo(() => categories.filter(c => c.status !== "DELETED" && c.status !== "INACTIVE"), [categories]);

  const rightContent = (
    <div className="flex gap-2">
      <button onClick={() => setPreset(0)} className="px-3 py-2 text-xs font-medium text-text-secondary bg-surface-secondary rounded-lg hover:bg-border min-h-[44px]">Hôm nay</button>
      <button onClick={() => setPreset(7)} className="px-3 py-2 text-xs font-medium text-text-secondary bg-surface-secondary rounded-lg hover:bg-border min-h-[44px]">7 ngày</button>
      <button onClick={() => setPreset(30)} className="px-3 py-2 text-xs font-medium text-text-secondary bg-surface-secondary rounded-lg hover:bg-border min-h-[44px]">30 ngày</button>
    </div>
  );

  return (
    <StickyFilterBar 
      rightContent={rightContent}
      title={title}
      subtitle={subtitle}
    >
      <div className="w-full md:w-auto">
        <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Từ ngày</label>
        <CustomDatePicker
          selected={startDate}
          onChange={(date: Date | null) => setStartDate(date)}
          className="w-full md:w-40 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 bg-surface-card shadow-sm"
        />
      </div>
      <div className="w-full md:w-auto">
        <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Đến ngày</label>
        <CustomDatePicker
          selected={endDate}
          onChange={(date: Date | null) => setEndDate(date)}
          className="w-full md:w-40 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 bg-surface-card shadow-sm"
        />
      </div>
      <div className="w-full md:w-auto">
        <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Thương hiệu</label>
        <select 
          value={brandId} 
          onChange={(e) => setBrandId(e.target.value)}
          className="w-full md:w-40 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 bg-surface-card shadow-sm"
        >
          <option value="">Tất cả</option>
          {activeBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div className="w-full md:w-auto">
        <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Nhân viên</label>
        <select 
          value={staffName} 
          onChange={(e) => setStaffName(e.target.value)}
          className="w-full md:w-40 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 bg-surface-card shadow-sm"
        >
          <option value="">Tất cả</option>
          {activeUsers.map(u => <option key={u.id} value={u.name || u.username}>{u.name || u.username}</option>)}
        </select>
      </div>
      <div className="w-full md:w-auto">
        <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Nhóm SP</label>
        <select 
          value={categoryId} 
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full md:w-40 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 bg-surface-card shadow-sm"
        >
          <option value="">Tất cả</option>
          {activeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
    </StickyFilterBar>
  );
}
