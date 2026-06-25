"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import StickyFilterBar from "@/components/StickyFilterBar";

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
    <React.Suspense fallback={<div className="h-20 bg-gray-50 animate-pulse rounded-xl mb-6 border border-gray-100"></div>}>
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
      ? new Date(searchParams.get("start")!) 
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  
  const [endDate, setEndDate] = useState<Date | null>(
    searchParams.get("end") ? new Date(searchParams.get("end")!) : new Date(new Date().setHours(23,59,59,999))
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
        params.set("start", startDate.toISOString());
        params.set("end", endDate.toISOString());
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
      <button onClick={() => setPreset(0)} className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 min-h-[36px]">Hôm nay</button>
      <button onClick={() => setPreset(7)} className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 min-h-[36px]">7 ngày</button>
      <button onClick={() => setPreset(30)} className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 min-h-[36px]">30 ngày</button>
    </div>
  );

  return (
    <StickyFilterBar 
      rightContent={rightContent}
      title={title}
      subtitle={subtitle}
    >
      <div className="shrink-0">
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Từ ngày</label>
        <CustomDatePicker
          selected={startDate}
          onChange={(date: Date | null) => setStartDate(date)}
          className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        />
      </div>
      <div className="shrink-0">
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Đến ngày</label>
        <CustomDatePicker
          selected={endDate}
          onChange={(date: Date | null) => setEndDate(date)}
          className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        />
      </div>
      <div className="shrink-0">
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Thương hiệu</label>
        <select 
          value={brandId} 
          onChange={(e) => setBrandId(e.target.value)}
          className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
          <option value="">Tất cả</option>
          {activeBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div className="shrink-0">
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nhân viên</label>
        <select 
          value={staffName} 
          onChange={(e) => setStaffName(e.target.value)}
          className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
          <option value="">Tất cả</option>
          {activeUsers.map(u => <option key={u.id} value={u.name || u.username}>{u.name || u.username}</option>)}
        </select>
      </div>
      <div className="shrink-0">
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nhóm SP</label>
        <select 
          value={categoryId} 
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
          <option value="">Tất cả</option>
          {activeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
    </StickyFilterBar>
  );
}
