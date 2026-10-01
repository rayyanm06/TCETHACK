import React from 'react';
import { MapPin, FileCheck, CheckCircle2 } from 'lucide-react';

interface ReportParcelProps {
  role?: 'CITIZEN' | 'OPERATOR';
  className?: string;
  isLifting?: boolean;
}

export const ReportParcel: React.FC<ReportParcelProps> = ({
  role = 'CITIZEN',
  className = '',
  isLifting = false,
}) => {
  return (
    <div
      className={`relative rounded-md bg-[#FBF9F4] border-2 border-[#236B4F] shadow-lg p-2.5 flex items-center gap-2 select-none ${
        isLifting ? 'scale-90 rotate-6 shadow-2xl transition-all duration-500' : ''
      } ${className}`}
      style={{
        boxShadow: '0 8px 24px rgba(23, 33, 29, 0.16)',
      }}
    >
      {/* Visual Seal / Badge */}
      <div className="w-8 h-8 rounded bg-[#236B4F] flex items-center justify-center text-[#FFFFFF] shrink-0 shadow-inner">
        {role === 'OPERATOR' ? (
          <FileCheck className="w-4 h-4 text-[#DCE9E1]" />
        ) : (
          <MapPin className="w-4 h-4 text-[#D59A3A]" />
        )}
      </div>

      {/* Parcel Content */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold tracking-wider uppercase text-[#164635] truncate">
            {role === 'OPERATOR' ? 'DISPATCH ORDER' : 'CIVIC INTAKE RECORD'}
          </span>
          <CheckCircle2 className="w-3 h-3 text-[#236B4F] shrink-0" />
        </div>
        <p className="text-[9px] font-mono text-[#53615B] truncate">
          MUNICIPAL · MUMBAI · READY
        </p>
      </div>

      {/* Barcode/Survey Mark */}
      <div className="border-l border-[#D8D1C5] pl-1.5 flex flex-col items-end shrink-0">
        <div className="flex gap-0.5 h-3 items-center">
          <div className="w-0.5 h-3 bg-[#17211D]" />
          <div className="w-1 h-3 bg-[#17211D]" />
          <div className="w-0.5 h-2 bg-[#53615B]" />
          <div className="w-1 h-3 bg-[#17211D]" />
          <div className="w-0.5 h-3 bg-[#17211D]" />
        </div>
        <span className="text-[7px] font-mono text-[#53615B] leading-none mt-0.5">AUTH✓</span>
      </div>
    </div>
  );
};
