"use client";

import { useState, useMemo } from "react";
import StickyFilterBar from "@/components/StickyFilterBar";
import { formatDateTime } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";

interface OrderEvent {
  id: string;
  order_id: string;
  order_no: string;
  event_type: "CREATED" | "EDITED" | "VOIDED" | "REOPENED" | "MIGRATED";
  event_at: string;
  actor_id: string;
  actor_name: string;
  from_version?: number | string;
  to_version?: number | string;
  reason?: string;
  delta_json?: string;
}

interface ActivityLogClientProps {
  initialEvents: OrderEvent[];
  actors: string[];
}

export default function ActivityLogClient({ initialEvents, actors }: ActivityLogClientProps) {
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState<string>("ALL");
  const [actorFilter, setActorFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const filteredEvents = useMemo(() => {
    return initialEvents.filter((evt) => {
      // Event type filter
      const matchType = eventType === "ALL" || evt.event_type === eventType;
      
      // Actor filter
      const matchActor = actorFilter === "ALL" || evt.actor_name === actorFilter;
      
      // Date range filter
      let matchDate = true;
      if (startDate) {
        matchDate = matchDate && new Date(evt.event_at) >= new Date(startDate);
      }
      if (endDate) {
        // Extend end date to include the whole day (23:59:59)
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        matchDate = matchDate && new Date(evt.event_at) <= endDateTime;
      }

      // Text search
      const matchSearch =
        evt.order_no.toLowerCase().includes(search.toLowerCase()) ||
        evt.id.toLowerCase().includes(search.toLowerCase()) ||
        (evt.reason || "").toLowerCase().includes(search.toLowerCase()) ||
        evt.actor_name.toLowerCase().includes(search.toLowerCase());

      return matchType && matchActor && matchDate && matchSearch;
    });
  }, [initialEvents, eventType, actorFilter, startDate, endDate, search]);

  const renderDelta = (deltaJson?: string) => {
    if (!deltaJson) return null;
    try {
      const delta = JSON.parse(deltaJson);
      if (typeof delta !== "object" || delta === null) return null;

      const items = Object.entries(delta).map(([key, val]) => {
        let label = key;
        let formattedVal = String(val);

        if (key === "gross_total") {
          label = "Doanh thu gốc";
          formattedVal = formatNumber(Number(val));
        } else if (key === "net_total") {
          label = "Doanh thu thuần";
          formattedVal = formatNumber(Number(val));
        } else if (key === "line_count") {
          label = "Số món";
        } else if (key === "payment_method") {
          label = "PT Thanh toán";
          formattedVal = val === "BANK_TRANSFER" ? "Chuyển khoản" : "Tiền mặt";
        }

        return (
          <span
            key={key}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200"
          >
            <span className="text-[10px] uppercase font-bold text-gray-400">{label}:</span>
            <span>{formattedVal}</span>
          </span>
        );
      });

      return <div className="flex flex-wrap gap-2 mt-2">{items}</div>;
    } catch (e) {
      return (
        <pre className="text-[10px] text-gray-400 font-mono bg-gray-50 p-2 rounded-lg border border-gray-100 mt-2 overflow-x-auto">
          {deltaJson}
        </pre>
      );
    }
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case "CREATED":
        return {
          label: "Tạo mới",
          classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
          dotColor: "bg-emerald-500 ring-emerald-100",
        };
      case "EDITED":
        return {
          label: "Chỉnh sửa",
          classes: "bg-blue-50 text-blue-700 border-blue-200",
          dotColor: "bg-blue-500 ring-blue-100",
        };
      case "VOIDED":
        return {
          label: "Hủy đơn",
          classes: "bg-rose-50 text-rose-700 border-rose-200",
          dotColor: "bg-rose-500 ring-rose-100",
        };
      case "REOPENED":
        return {
          label: "Mở lại",
          classes: "bg-amber-50 text-amber-700 border-amber-200",
          dotColor: "bg-amber-500 ring-amber-100",
        };
      case "MIGRATED":
        return {
          label: "Di trú",
          classes: "bg-gray-50 text-gray-700 border-gray-200",
          dotColor: "bg-gray-400 ring-gray-100",
        };
      default:
        return {
          label: type,
          classes: "bg-zinc-50 text-zinc-700 border-zinc-200",
          dotColor: "bg-zinc-400 ring-zinc-100",
        };
    }
  };

  return (
    <div className="space-y-6">
      <StickyFilterBar
        title="Nhật ký Hoạt động"
        subtitle="Theo dõi lịch sử chỉnh sửa đơn hàng, hủy đơn, và các sự kiện trong hệ thống."
      >
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Tìm kiếm
          </label>
          <input
            type="text"
            placeholder="Tìm mã đơn, người tạo, lý do..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Loại Sự Kiện
          </label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          >
            <option value="ALL">Tất cả</option>
            <option value="CREATED">Tạo mới (CREATED)</option>
            <option value="EDITED">Chỉnh sửa (EDITED)</option>
            <option value="VOIDED">Hủy đơn (VOIDED)</option>
            <option value="REOPENED">Mở lại (REOPENED)</option>
            <option value="MIGRATED">Di trú (MIGRATED)</option>
          </select>
        </div>
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Tài Khoản
          </label>
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          >
            <option value="ALL">Tất cả tài khoản</option>
            {actors.map((actor) => (
              <option key={actor} value={actor}>
                {actor}
              </option>
            ))}
          </select>
        </div>
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Từ ngày
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Đến ngày
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>
      </StickyFilterBar>

      <div className="relative pl-6 md:pl-10">
        {/* Vertical Timeline Line */}
        <div className="absolute top-4 bottom-4 left-[34px] md:left-[50px] w-0.5 bg-gray-200" />

        <div className="space-y-6">
          {filteredEvents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500 italic shadow-sm">
              Không tìm thấy sự kiện nào phù hợp.
            </div>
          ) : (
            filteredEvents.map((evt) => {
              const badge = getEventBadge(evt.event_type);
              return (
                <div key={evt.id} className="relative group">
                  {/* Timeline Dot Indicator */}
                  <div
                    className={`absolute -left-[27px] md:-left-[43px] top-4 w-4 h-4 rounded-full border-4 border-white ${badge.dotColor} ring-4 transition-transform duration-200 group-hover:scale-125 z-10`}
                  />

                  {/* Card Container */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${badge.classes}`}
                        >
                          {badge.label}
                        </span>
                        <span className="font-extrabold text-sm text-gray-900">
                          Đơn hàng {evt.order_no}
                        </span>
                        <span className="text-[11px] text-gray-400 font-medium">
                          ({evt.id})
                        </span>
                      </div>

                      <div className="text-xs text-gray-600 space-y-1">
                        <p className="flex items-center gap-1.5">
                          <span className="text-gray-400">Thời gian:</span>
                          <span className="font-medium text-gray-700">
                            {formatDateTime(evt.event_at)}
                          </span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <span className="text-gray-400">Thực hiện:</span>
                          <span className="font-bold text-gray-800">
                            {evt.actor_name}
                          </span>
                        </p>
                        {evt.from_version !== undefined && evt.to_version !== undefined && (
                          <p className="flex items-center gap-1.5">
                            <span className="text-gray-400">Phiên bản:</span>
                            <span className="font-mono bg-gray-50 border border-gray-100 rounded px-1 text-[10px]">
                              v{evt.from_version || 0} ➔ v{evt.to_version}
                            </span>
                          </p>
                        )}
                        {evt.reason && (
                          <p className="mt-1 pt-1 border-t border-gray-50/50">
                            <span className="text-gray-400">Lý do:</span>{" "}
                            <span className="font-medium text-gray-800 italic">
                              "{evt.reason}"
                            </span>
                          </p>
                        )}
                      </div>

                      {renderDelta(evt.delta_json)}
                    </div>

                    <div className="shrink-0 flex items-center md:self-stretch justify-end">
                      <span className="text-[11px] text-gray-400 font-medium bg-gray-50 border border-gray-100 rounded px-2.5 py-1">
                        Mã đơn: {evt.order_id}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
