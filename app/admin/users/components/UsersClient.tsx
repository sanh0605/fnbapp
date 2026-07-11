"use client";

import { useState, useMemo } from "react";
import StickyFilterBar from "@/components/StickyFilterBar";
import { UserForm, DeleteUserButton } from "./UserForm";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DBUser } from "@/types/db";

interface UsersClientProps {
  users: DBUser[];
}

export default function UsersClient({ users }: UsersClientProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = u.username.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === "ALL" || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, search, roleFilter]);

  const rightContent = <UserForm />;

  return (
    <div className="space-y-6">
      <StickyFilterBar 
        title="Quản lý Nhân Sự" 
        subtitle="Quản lý tài khoản đăng nhập và phân quyền hệ thống."
        rightContent={rightContent}
      >
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tìm kiếm</label>
          <input
            type="text"
            placeholder="Tên đăng nhập..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-48 border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Quyền hạn</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full md:w-40 border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          >
            <option value="ALL">Tất cả quyền</option>
            <option value="ADMIN">ADMIN</option>
            <option value="MANAGER">MANAGER</option>
            <option value="STAFF">STAFF</option>
          </select>
        </div>
      </StickyFilterBar>

      {/* Mobile Card Layout (< md) */}
      <div className="md:hidden flex flex-col gap-3">
        {filteredUsers.length === 0 ? (
          <EmptyState title="Không tìm thấy nhân sự" description="Vui lòng thử tìm kiếm với từ khóa khác." />
        ) : (
          filteredUsers.map(user => (
            <div key={user.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-gray-900">{user.username}</div>
                  <div className="text-[10px] font-mono text-gray-400 mt-0.5">ID: {user.id}</div>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                  user.role === 'ADMIN' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                  user.role === 'MANAGER' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  'bg-blue-50 text-blue-700 border-blue-100'
                }`}>
                  {user.role}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Ngày tạo: {user.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : "---"}
              </div>
              <div className="flex justify-end items-center gap-3 pt-3 border-t border-gray-50">
                <Link
                  href={`/admin/users/edit/${user.id}`}
                  className="px-3 py-1.5 min-h-[44px] bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium text-xs rounded-lg flex items-center justify-center transition-colors"
                >
                  Sửa
                </Link>
                {user.username !== 'admin' && (
                  <DeleteUserButton id={user.id} username={user.username} />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table (>= md) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-bold w-32">Mã NV</th>
                <th className="px-6 py-4 font-bold">Tên Đăng Nhập</th>
                <th className="px-6 py-4 font-bold">Quyền Hạn</th>
                <th className="px-6 py-4 font-bold">Ngày Tạo</th>
                <th className="px-6 py-4 font-bold text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState title="Không tìm thấy nhân sự" description="Vui lòng thử tìm kiếm với từ khóa khác." />
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-[11px] text-gray-400 font-bold">{user.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{user.username}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                        user.role === 'ADMIN' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                        user.role === 'MANAGER' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : "---"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-3">
                        <Link
                          href={`/admin/users/edit/${user.id}`}
                          className="px-3 py-1.5 min-h-[44px] bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium text-xs rounded-lg flex items-center justify-center transition-colors"
                        >
                          Sửa
                        </Link>
                        {user.username !== 'admin' && (
                          <DeleteUserButton id={user.id} username={user.username} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
