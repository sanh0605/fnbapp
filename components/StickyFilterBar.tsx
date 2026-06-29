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
  const [isMobileExpanded, setIsMobileExpanded] = React.useState(false);
  const childrenArray = React.Children.toArray(children);
  const hasMultipleChildren = childrenArray.length > 1;

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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap md:items-end gap-3 pb-1">
          {childrenArray.map((child, index) => {
            if (index === 0) {
              return (
                <div key={index} className="col-span-2 sm:col-span-3 md:col-auto flex gap-2 items-end w-full md:w-auto">
                  <div className="flex-1 md:flex-none w-full md:w-auto">{child}</div>
                  {hasMultipleChildren && (
                    <button 
                      onClick={() => setIsMobileExpanded(!isMobileExpanded)}
                      className="md:hidden px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 border border-gray-200 shadow-sm whitespace-nowrap h-[38px] flex items-center gap-1 shrink-0"
                    >
                      <svg className={`w-4 h-4 transition-transform ${isMobileExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      {isMobileExpanded ? 'Thu gọn' : 'Lọc thêm'}
                    </button>
                  )}
                </div>
              );
            }
            return (
              <div key={index} className={`w-full md:w-auto ${!isMobileExpanded ? 'hidden md:block' : ''}`}>
                {child}
              </div>
            );
          })}
          
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
