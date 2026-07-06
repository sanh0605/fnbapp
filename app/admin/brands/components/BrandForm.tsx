"use client";

import { useState, useId } from "react";
import { addBrand, deleteBrand, editBrand } from "../actions";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { FormModal } from "@/components/ui/FormModal";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import type { DBBrand } from "@/types/db";

interface BrandFormProps {
  initialData?: DBBrand;
}

function formatDateToYYYYMMDD(date: Date): string {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
}

export function BrandForm({ initialData }: BrandFormProps) {
  const isEdit = !!initialData;
  const formId = useId();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    initialData?.start_date ? new Date(initialData.start_date) : null
  );

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    if (isEdit && initialData) {
      formData.append("id", initialData.id);
    }
    if (selectedDate) {
      formData.set("start_date", formatDateToYYYYMMDD(selectedDate));
    } else {
      formData.delete("start_date");
    }
    const fn = isEdit ? editBrand : addBrand;
    await fn(formData);
    setLoading(false);
    setIsOpen(false);
    if (!isEdit) setSelectedDate(null);
  }

  return (
    <>
      {isEdit ? (
        <button
          onClick={() => setIsOpen(true)}
          className="text-blue-600 hover:text-blue-800 font-medium text-sm mr-4"
        >
          Sửa
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
        >
          + Thêm Thương Hiệu
        </button>
      )}

      <FormModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          if (!isEdit) setSelectedDate(null);
        }}
        title={isEdit ? "Sửa Thương Hiệu" : "Thêm Thương Hiệu Mới"}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (!isEdit) setSelectedDate(null);
              }}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
            >
              Huỷ
            </button>
            <LoadingButton
              type="submit"
              form="brand-form"
              loading={loading}
              loadingText="Đang lưu…"
            >
              {isEdit ? "Cập nhật" : "Lưu Thương Hiệu"}
            </LoadingButton>
          </>
        }
      >
        <form id="brand-form" action={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-gray-700 mb-1">
              Tên Thương Hiệu
            </label>
            <input
              id={`${formId}-name`}
              type="text"
              name="name"
              required
              defaultValue={initialData?.name}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-gray-900"
              placeholder="VD: Phin Di"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-code`} className="block text-sm font-medium text-gray-700 mb-1">
              Mã Đơn Hàng (3 ký tự)
            </label>
            <input
              id={`${formId}-code`}
              type="text"
              name="code"
              maxLength={3}
              required
              defaultValue={initialData?.code}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 uppercase text-gray-900"
              placeholder="VD: PHD"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-start-date`} className="block text-sm font-medium text-gray-700 mb-1">
              Ngày bắt đầu hoạt động
            </label>
            <CustomDatePicker
              id={`${formId}-start-date`}
              selected={selectedDate}
              onChange={(date: Date | null) => setSelectedDate(date)}
              dateFormat="dd/MM/yyyy"
              showTimeSelect={false}
              placeholderText="DD/MM/YYYY"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-gray-900"
            />
          </div>
        </form>
      </FormModal>
    </>
  );
}

interface DeleteBrandButtonProps {
  id: string;
}

export function DeleteBrandButton({ id }: DeleteBrandButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const formData = new FormData();
    formData.append("id", id);
    await deleteBrand(formData);
    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={loading}
        className="text-red-600 hover:text-red-800 font-medium text-sm disabled:opacity-50"
      >
        {loading ? "…" : "Xoá"}
      </button>
      <DeleteConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        description="Bạn có chắc chắn muốn xoá thương hiệu này?"
      />
    </>
  );
}
