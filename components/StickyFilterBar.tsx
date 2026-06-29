"use client";

import React from "react";

interface StickyFilterBarProps {
  children: React.ReactNode;
  rightContent?: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function StickyFilterBar({ 
  children, 
  rightContent,
  title,
  subtitle
}: StickyFilterBarProps) {
  return (
    <div className="sticky -top-4 md:-top-8 z-40 -mx-4 px-4 md:-mx-8 md:px-8 -mt-4 pt-4 md:-mt-8 md:pt-8 mb-6 pb-4 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto w-full flex flex-col gap-4">
        {/* Header Row */}
        {(title || subtitle) && (
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
            <div>
              {title && <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{title}</h1>}
              {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
            </div>
            {!title && rightContent && (
              <div className="hidden md:flex items-center gap-2">
                {rightContent}
              </div>
            )}
          </div>
        )}

        {/* Main Filter Row (Responsive grid layout) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:items-end gap-3 pb-1">
          {children}
          
          {rightContent && (
            <div className={`col-span-2 sm:col-span-3 flex items-center gap-2 mt-2 md:mt-0 ${title ? '' : 'md:hidden'}`}>
              {rightContent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
