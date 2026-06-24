"use client";

import { useState, useRef, useEffect } from "react";

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
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);

  // Close dropdown when clicking outside
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

  return (
    <div className="relative min-w-0" ref={wrapperRef}>
      {/* Hidden input to support native form submission and 'required' attribute */}
      <input type="hidden" name={name} value={value} required={required} />
      
      <div
        className={`w-full min-w-0 border border-blue-200 rounded-lg px-3 py-2 bg-white cursor-pointer flex justify-between items-center gap-2 ${className || ''}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setSearchTerm(""); // Reset search when opening
        }}
      >
        <span className={`${selectedOption ? "text-gray-900" : "text-gray-500"} min-w-0 truncate`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>

      {isOpen && (
        <div className="absolute z-[80] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-72 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Gõ để tìm kiếm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 font-medium"
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
              <ul className="py-1">
                {filteredOptions.map((opt) => (
                  <li
                    key={opt.id}
                    className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 truncate ${opt.id === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                    onClick={() => {
                      onChange(opt.id);
                      setIsOpen(false);
                    }}
                  >
                    {opt.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
