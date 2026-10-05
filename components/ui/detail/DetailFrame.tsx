import React from "react";

export interface DetailFrameProps {
  children: React.ReactNode;
}

export function DetailFrame({ children }: DetailFrameProps): JSX.Element {
  return (
    <div className="max-w-screen-xl mx-auto w-full space-y-6 pb-20">
      {children}
    </div>
  );
}
