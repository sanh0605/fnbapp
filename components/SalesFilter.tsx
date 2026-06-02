"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CustomDatePicker } from "@/components/CustomDatePicker";

export default function SalesFilter({
  brands,
  users,
  categories
}: {
  brands: any[];
  users: any[];
  categories: any[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [startDate, setStartDate] = useState<Date | null>(
    searchParams.get("start") ? new Date(searchParams.get("start")!) : new Date(new Date().setHours(0,0,0,0))
  );
  
  const [endDate, setEndDate] = useState<Date | null>(
    searchParams.get("end") ? new Date(searchParams.get("end")!) : new Date(new Date().setHours(23,59,59,999))
  );

  const [brandId, setBrandId] = useState(searchParams.get("brandId") || "");
  const [staffName, setStaffName] = useState(searchParams.get("staffName") || "");
  const [categoryId, setCategoryId] = useState(searchParams.get("categoryId") || "");

  const handleFilter = () => {
    if (startDate && endDate) {
      let url = `?start=${startDate.toISOString()}&end=${endDate.toISOString()}`;
      if (brandId) url += `&brandId=${brandId}`;
      if (staffName) url += `&staffName=${staffName}`;
      if (categoryId) url += `&categoryId=${categoryId}`;
      router.push(url);
    }
  };

  const setPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0,0,0,0);
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-end gap-4 mb-6">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Từ ngày</label>
        <CustomDatePicker
          selected={startDate}
          onChange={(date) => setStartDate(date)}
          className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Đến ngày</label>
        <CustomDatePicker
          selected={endDate}
          onChange={(date) => setEndDate(date)}
          className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Thương hiệu</label>
        <select 
          value={brandId} 
          onChange={(e) => setBrandId(e.target.value)}
          className="w-40 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Tất cả</option>
          {brands.filter(b => b.status !== "DELETED" && b.status !== "INACTIVE").map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Nhân viên</label>
        <select 
          value={staffName} 
          onChange={(e) => setStaffName(e.target.value)}
          className="w-40 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Tất cả</option>
          {users.filter(u => u.status !== "DELETED" && u.status !== "INACTIVE").map(u => <option key={u.id} value={u.name || u.username}>{u.name || u.username}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Nhóm sản phẩm</label>
        <select 
          value={categoryId} 
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-40 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Tất cả</option>
          {categories.filter(c => c.status !== "DELETED" && c.status !== "INACTIVE").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <button 
        onClick={handleFilter}
        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition"
      >
        Lọc báo cáo
      </button>
      
      <div className="flex gap-2 ml-auto">
        <button onClick={() => setPreset(0)} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Hôm nay</button>
        <button onClick={() => setPreset(7)} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">7 ngày</button>
        <button onClick={() => setPreset(30)} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">30 ngày</button>
      </div>
    </div>
  );
}
