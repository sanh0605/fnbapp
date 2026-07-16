"use client";

import { forwardRef, useState, useEffect } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { vi } from "date-fns/locale";

// Register Vietnamese locale
registerLocale("vi", vi);

interface CustomDatePickerProps {
  id?: string;
  name?: string;
  selected?: Date | null;
  onChange?: (date: Date | null) => void;
  placeholderText?: string;
  className?: string;
  dateFormat?: string;
  showTimeSelect?: boolean;
}

export const CustomDatePicker = forwardRef<any, CustomDatePickerProps>(
  ({ name, selected, onChange, placeholderText, className, ...props }, ref) => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
      const checkMobile = () => {
        setIsMobile(
          window.matchMedia("(max-width: 768px)").matches ||
          ("ontouchstart" in window) ||
          (navigator.maxTouchPoints > 0)
        );
      };
      checkMobile();
    }, []);

    return (
      <DatePicker
        name={name}
        selected={selected}
        onChange={(date: any) => onChange && onChange(date)}
        showTimeSelect={props.showTimeSelect !== undefined ? props.showTimeSelect : true}
        timeFormat="HH:mm"
        timeIntervals={15}
        timeCaption="Giờ"
        dateFormat={props.dateFormat || "dd/MM/yyyy HH:mm:ss"}
        locale="vi"
        placeholderText={placeholderText || "dd/mm/yyyy hh:mm:ss"}
        className={className || "w-full border border-border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-focus-ring"}
        wrapperClassName="w-full"
        isClearable
        withPortal={isMobile}
        {...props}
        {...({ inputMode: "none" } as any)}
      />
    );
  }
);

CustomDatePicker.displayName = "CustomDatePicker";
