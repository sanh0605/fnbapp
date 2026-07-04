"use client";

import { useState, useRef, useEffect, useId } from "react";

interface Option {
  id: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
  required?: boolean;
  onCreateNew?: (searchTerm: string) => void | Promise<void>;
  className?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder = "-- Chọn --", name, required, onCreateNew, className }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const listboxId = useId();

  const selectedOption = options.find((opt) => opt.id === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setActiveIndex(filteredOptions.length > 0 ? 0 : -1);
    } else {
      setActiveIndex(-1);
    }
  }, [isOpen, filteredOptions.length]);

  useEffect(() => {
    if (activeIndex >= 0) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const handleTriggerKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && isOpen) {
      e.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(true);
    }
  };

  const handleInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((prev) =>
        filteredOptions.length > 0
          ? (prev + 1) % filteredOptions.length
          : -1
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((prev) =>
        filteredOptions.length > 0
          ? (prev - 1 + filteredOptions.length) % filteredOptions.length
          : -1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
        const selectedOpt = filteredOptions[activeIndex];
        onChange(selectedOpt.id);
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
  };

  return (
    <div className="relative min-w-0" ref={wrapperRef}>
      <input type="hidden" name={name} value={value} required={required} />

      <div
        ref={triggerRef}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={
          isOpen && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
        }
        tabIndex={isOpen ? -1 : 0}
        onKeyDown={handleTriggerKey}
        aria-label={placeholder}
        className={`w-full min-w-0 border border-blue-200 rounded-lg px-3 py-2 bg-white cursor-pointer flex justify-between items-center gap-2 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${className || ''}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setSearchTerm("");
        }}
      >
        <span className={`${selectedOption ? "text-gray-900" : "text-gray-500"} min-w-0 truncate`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </div>

      {isOpen && (
        <div className="absolute z-[80] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-72 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Gõ để tìm kiếm…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleInputKey}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center flex flex-col items-center">
                <span className="mb-2">Không tìm thấy kết quả</span>
                {onCreateNew && searchTerm.trim() && (
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 font-medium focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                    onMouseDown={async (e) => {
                      e.preventDefault();
                      try {
                        await onCreateNew(searchTerm.trim());
                      } finally {
                        setIsOpen(false);
                      }
                    }}
                  >
                    + Thêm "{searchTerm.trim()}"
                  </button>
                )}
              </div>
            ) : (
              <ul id={listboxId} role="listbox" className="py-1">
                {filteredOptions.map((opt, idx) => {
                  const isSelected = opt.id === value;
                  return (
                    <li
                      key={opt.id}
                      id={`${listboxId}-opt-${idx}`}
                      ref={(el) => { optionRefs.current[idx] = el; }}
                      role="option"
                      aria-selected={isSelected}
                      className={`px-4 py-2 text-sm cursor-pointer truncate ${
                        isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      } ${idx === activeIndex ? 'ring-2 ring-inset ring-blue-300 bg-blue-50' : 'hover:bg-blue-50'}`}
                      onClick={() => {
                        onChange(opt.id);
                        setIsOpen(false);
                        triggerRef.current?.focus();
                      }}
                    >
                      {opt.label}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
