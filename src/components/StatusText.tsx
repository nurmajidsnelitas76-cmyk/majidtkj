import { CheckCircle2, Clock, FileText, HeartPulse, XCircle } from 'lucide-react';
import type { EmployeeAttendanceStatus, StudentAttendanceStatus } from '../types';

type AnyStatus = EmployeeAttendanceStatus | StudentAttendanceStatus;

export function StatusText({ status }: { status: AnyStatus }) {
  switch (status) {
    case 'Hadir':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Hadir</span>
        </span>
      );
    case 'Terlambat':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 whitespace-nowrap">
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Terlambat</span>
        </span>
      );
    case 'Izin':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 whitespace-nowrap">
          <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Izin</span>
        </span>
      );
    case 'Sakit':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-700 whitespace-nowrap">
          <HeartPulse className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Sakit</span>
        </span>
      );
    case 'Alpa':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700 whitespace-nowrap">
          <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Alpa</span>
        </span>
      );
  }
}
