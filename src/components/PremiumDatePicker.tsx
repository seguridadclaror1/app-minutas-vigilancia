import { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import './PremiumDatePicker.css';

interface PremiumDatePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  placeholder?: string;
  abiertoPorDefecto?: boolean;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function PremiumDatePicker({
  startDate,
  endDate,
  onChange,
  placeholder = 'Seleccionar rango…',
  abiertoPorDefecto = false
}: PremiumDatePickerProps) {
  const [isOpen, setIsOpen] = useState(abiertoPorDefecto);
  
  const initialDate = startDate ? new Date(startDate + 'T12:00:00') : new Date();
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (startDate && !isOpen) {
      const d = new Date(startDate + 'T12:00:00');
      setCurrentMonth(d.getMonth());
      setCurrentYear(d.getFullYear());
    }
  }, [startDate, isOpen]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handleSelectDate = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const selectedDateStr = `${yyyy}-${mm}-${dd}`;

    if (!startDate || (startDate && endDate)) {
      onChange(selectedDateStr, '');
    } else {
      const start = new Date(startDate + 'T12:00:00');
      const current = new Date(selectedDateStr + 'T12:00:00');
      
      if (current < start) {
        onChange(selectedDateStr, '');
      } else {
        onChange(startDate, selectedDateStr);
      }
    }
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const emptyDaysStart = firstDay === 0 ? 6 : firstDay - 1; 

  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < emptyDaysStart; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  }, [currentYear, currentMonth, emptyDaysStart, daysInMonth]);

  const formatDisplay = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;
  };

  const isStart = (day: number) => {
    if (!startDate) return false;
    const date = new Date(startDate + 'T12:00:00');
    return date.getDate() === day && date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  };

  const isEnd = (day: number) => {
    if (!endDate) return false;
    const date = new Date(endDate + 'T12:00:00');
    return date.getDate() === day && date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  };

  const isInRange = (day: number) => {
    if (!startDate || !endDate) return false;
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    const current = new Date(currentYear, currentMonth, day, 12, 0, 0);
    return current > start && current < end;
  };

  const isFuture = (day: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const current = new Date(currentYear, currentMonth, day);
    return current > today;
  };

  const displayValue = useMemo(() => {
    if (startDate && endDate) {
      return `${formatDisplay(startDate)} - ${formatDisplay(endDate)}`;
    }
    if (startDate) {
      return formatDisplay(startDate);
    }
    return '';
  }, [startDate, endDate]);

  return (
    <div className="premium-datepicker" ref={containerRef}>
      <div 
        className={`pdp-trigger ${isOpen ? 'active' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <Calendar size={16} className="pdp-icon" />
        <span className={`pdp-display ${!displayValue ? 'placeholder' : ''}`}>
          {displayValue || placeholder}
        </span>
        {displayValue && (
          <button
            className="pdp-clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange('', '');
            }}
            title="Quitar rango"
            type="button"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="pdp-dropdown">
          <div className="pdp-header">
            <button className="pdp-nav-btn" onClick={handlePrevMonth} type="button">
              <ChevronLeft size={18} />
            </button>
            <div className="pdp-month-year">
              {MESES[currentMonth]} {currentYear}
            </div>
            <button className="pdp-nav-btn" onClick={handleNextMonth} type="button">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="pdp-grid-header">
            {DIAS.map(d => (
              <div key={d} className="pdp-grid-day-name">{d}</div>
            ))}
          </div>

          <div className="pdp-grid">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="pdp-day empty" />;
              }
              const disabled = isFuture(day);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  className={`pdp-day ${isToday(day) ? 'today' : ''} ${isStart(day) ? 'start' : ''} ${isEnd(day) ? 'end' : ''} ${isInRange(day) ? 'in-range' : ''} ${isStart(day) && endDate ? 'has-range' : ''}`}
                  onClick={() => handleSelectDate(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="pdp-footer">
            <button className="pdp-btn-apply" onClick={() => setIsOpen(false)} type="button">
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
