"use client";

import { forwardRef, useState, useEffect, useRef, type ReactElement } from "react";
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
  customInput?: ReactElement;
  isClearable?: boolean;
  timeIntervals?: number;
}

export const CustomDatePicker = forwardRef<any, CustomDatePickerProps>(
  ({ name, selected, onChange, placeholderText, className, ...props }, ref) => {
    const rootRef = useRef<HTMLDivElement>(null);
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
      <div ref={rootRef} className="w-full">
        <DatePicker
          name={name}
          selected={selected}
          onChange={(date: any) => {
            onChange && onChange(date);
            rootRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
          }}
          showTimeSelect={props.showTimeSelect !== undefined ? props.showTimeSelect : true}
          timeFormat="HH:mm"
          timeIntervals={props.timeIntervals ?? 15}
          timeCaption="Giờ"
          dateFormat={props.dateFormat || "dd/MM/yyyy HH:mm:ss"}
          locale="vi"
          placeholderText={placeholderText || "dd/mm/yyyy hh:mm:ss"}
          className={className || "w-full min-h-[48px] md:min-h-[40px] rounded-button bg-surface-card border border-border px-3 pr-12 md:pr-10 text-base md:text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring/30 disabled:opacity-50"}
          wrapperClassName="w-full"
          isClearable={props.isClearable ?? true}
          clearButtonClassName="w-[48px] md:w-[40px] min-h-[48px] md:min-h-[40px] !flex !items-center !justify-center !p-0 after:!content-['×'] after:!bg-transparent after:!text-text-secondary hover:after:!text-text-primary after:!text-lg after:!leading-none after:!h-auto after:!w-auto after:!p-0"
          withPortal={isMobile}
          portalId={!isMobile ? "datepicker-portal" : undefined}
          popperPlacement="bottom-start"
          popperClassName="z-[110]"
          {...props}
          {...({ inputMode: "none" } as any)}
        />
      </div>
    );
  }
);

CustomDatePicker.displayName = "CustomDatePicker";
