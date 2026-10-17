"use client";

import React, { useState, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { DateRangeButton } from "@/components/ui/DateRangeButton";
import { writeRangeParams, type RangeValue } from "@/lib/shared/date-range-params";
import { staffPickerLabels } from "@/lib/auth/staff-names";

interface Brand {
  id: string;
  name: string;
  status?: string;
}

interface User {
  id: string;
  name?: string;
  username: string;
  status?: string;
}

interface Category {
  id: string;
  name: string;
  status?: string;
}

export interface SalesFilterProps {
  brands: Brand[];
  users: User[];
  categories: Category[];
  range: RangeValue;
  today: string;
  title?: string;
  subtitle?: string;
}

export default function SalesFilter(props: SalesFilterProps) {
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
  range,
  today,
  title,
  subtitle,
}: SalesFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlBrand = searchParams?.get("brandId") || "";
  const urlStaff = searchParams?.get("staffName") || "";
  const urlCat = searchParams?.get("categoryId") || "";

  const [brandId, setBrandId] = useState(urlBrand);
  const [staffName, setStaffName] = useState(urlStaff);
  const [categoryId, setCategoryId] = useState(urlCat);
  const [isPending, startTransition] = useTransition();

  React.useEffect(() => {
    setBrandId(urlBrand);
  }, [urlBrand]);

  React.useEffect(() => {
    setStaffName(urlStaff);
  }, [urlStaff]);

  React.useEffect(() => {
    setCategoryId(urlCat);
  }, [urlCat]);

  const handleRangeChange = (next: RangeValue) => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    writeRangeParams(params, next);
    params.delete("start");
    params.delete("end");
    const appliedBrandId = searchParams?.get("brandId");
    const appliedStaffName = searchParams?.get("staffName");
    const appliedCategoryId = searchParams?.get("categoryId");

    if (appliedBrandId) {
      params.set("brandId", appliedBrandId);
    } else {
      params.delete("brandId");
    }
    if (appliedStaffName) {
      params.set("staffName", appliedStaffName);
    } else {
      params.delete("staffName");
    }
    if (appliedCategoryId) {
      params.set("categoryId", appliedCategoryId);
    } else {
      params.delete("categoryId");
    }
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const handleFilter = () => {
    const params = new URLSearchParams();
    const currentRange = searchParams?.get("range");
    const currentFrom = searchParams?.get("from");
    const currentTo = searchParams?.get("to");
    if (currentRange) {
      params.set("range", currentRange);
      if (currentFrom) params.set("from", currentFrom);
      if (currentTo) params.set("to", currentTo);
    } else if (range) {
      writeRangeParams(params, range);
    }

    if (brandId) params.set("brandId", brandId);
    if (staffName) params.set("staffName", staffName);
    if (categoryId) params.set("categoryId", categoryId);

    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const activeBrands = useMemo(() => brands.filter(b => b.status === "ACTIVE"), [brands]);
  const activeUsers = useMemo(() => users.filter(u => u.status === "ACTIVE"), [users]);
  const staffLabels = useMemo(() => staffPickerLabels(activeUsers), [activeUsers]);
  const activeCategories = useMemo(() => categories.filter(c => c.status === "ACTIVE"), [categories]);

  return (
    <>
      <PageHeader 
        title={title || ""}
        subtitle={subtitle}
      />
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="w-full md:w-auto">
          <DateRangeButton
            value={range}
            today={today}
            onChange={handleRangeChange}
          />
        </div>
        <div className="w-full md:w-40">
          <Field label="Thương hiệu" htmlFor="sales-brand">
            <Select 
              id="sales-brand"
              value={brandId} 
              onChange={(e) => setBrandId(e.target.value)}
            >
              <option value="">Tất cả</option>
              {activeBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="w-full md:w-40">
          <Field label="Nhân viên" htmlFor="sales-staff">
            <Select 
              id="sales-staff"
              value={staffName} 
              onChange={(e) => setStaffName(e.target.value)}
            >
              <option value="">Tất cả</option>
              {activeUsers.map(u => <option key={u.id} value={u.username}>{staffLabels.get(u.username)}</option>)}
            </Select>
          </Field>
        </div>
        <div className="w-full md:w-40">
          <Field label="Nhóm SP" htmlFor="sales-category">
            <Select 
              id="sales-category"
              value={categoryId} 
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Tất cả</option>
              {activeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="w-full md:w-auto">
          <Button
            variant="primary"
            onClick={handleFilter}
            loading={isPending}
            className="w-full md:w-auto whitespace-nowrap"
          >
            Lọc
          </Button>
        </div>
      </div>
    </>
  );
}
