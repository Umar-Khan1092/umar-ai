import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import './SearchableSelect.css';

interface SearchableSelectProps {
  label: string;
  name: string;
  value: string;
  options: string[];
  onChange: (name: string, value: string) => void;
  required?: boolean;
  placeholder?: string;
  emptyMessage?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  name,
  value,
  options,
  onChange,
  required = false,
  placeholder = "Select an option...",
  emptyMessage = "No items found. Please add them in Settings."
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: string) => {
    onChange(name, option);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="input-group" ref={dropdownRef}>
      <label className="input-label">
        {label} {required && <span className="required-indicator">*</span>}
      </label>
      
      <div className="searchable-select-container">
        <div 
          className="input-field searchable-select-display"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={value ? 'value-selected' : 'value-placeholder'}>
            {value || placeholder}
          </span>
          <ChevronDown size={16} className="dropdown-icon" />
        </div>

        {isOpen && (
          <div className="searchable-select-dropdown card">
            {options.length > 0 ? (
              <>
                <div className="searchable-select-search">
                  <Search size={14} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <ul className="searchable-select-list">
                  {filteredOptions.length > 0 ? (
                    filteredOptions.map(opt => (
                      <li 
                        key={opt} 
                        className={`searchable-select-item ${value === opt ? 'selected' : ''}`}
                        onClick={() => handleSelect(opt)}
                      >
                        {opt}
                      </li>
                    ))
                  ) : (
                    <li className="searchable-select-empty">No matches found</li>
                  )}
                </ul>
              </>
            ) : (
              <div className="searchable-select-empty" style={{ padding: '16px' }}>
                {emptyMessage}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Hidden native input for required validation if needed, though react state usually handles this */}
      <input type="hidden" name={name} value={value} required={required} />
    </div>
  );
};
