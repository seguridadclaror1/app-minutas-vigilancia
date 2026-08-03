import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import './PremiumSelect.css';

interface Option {
  value: string;
  label: string;
}

interface PremiumSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  direction?: 'down' | 'up';
}

export default function PremiumSelect({ 
  value, 
  onChange, 
  options, 
  placeholder = 'Seleccione...', 
  disabled = false,
  searchable = false,
  direction = 'down'
}: PremiumSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm) return options;
    const lowerSearch = searchTerm.toLowerCase();
    return options.filter(opt => opt.label.toLowerCase().includes(lowerSearch));
  }, [options, searchable, searchTerm]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`premium-select-container ${disabled ? 'disabled' : ''}`} ref={containerRef}>
      <button 
        type="button"
        className={`premium-select-trigger ${isOpen ? 'open' : ''} ${!value ? 'placeholder' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={20} className={`premium-select-icon ${isOpen ? 'rotated' : ''}`} />
      </button>

      {isOpen && (
        <div className={`premium-select-dropdown ${direction === 'up' ? 'direction-up' : ''}`}>
          {searchable && (
            <div className="premium-select-search">
              <Search size={16} className="premium-select-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <ul className="premium-select-list">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <li 
                  key={option.value}
                  className={`premium-select-item ${option.value === value ? 'selected' : ''}`}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </li>
              ))
            ) : (
              <li className="premium-select-empty">No se encontraron resultados</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
