import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { Ingredient } from '../../lib/mockData';
import './ItemCombobox.css';

export interface ItemComboboxProps {
  items: Ingredient[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function ItemCombobox({
  items,
  value,
  onChange,
  placeholder = 'Select or search item...',
  disabled = false,
  className = '',
}: ItemComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Find currently selected item
  const selectedItem = useMemo(() => items.find((i) => i.id === value), [items, value]);

  // Filter items by name or unit
  const filteredItems = useMemo(() => {
    if (!isTyping || !searchTerm.trim()) {
      return items;
    }
    const q = searchTerm.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.unit && item.unit.toLowerCase().includes(q))
    );
  }, [items, isTyping, searchTerm]);

  // Calculate position fixed for the dropdown portal
  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const dropdownMaxHeight = 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const showAbove = spaceBelow < dropdownMaxHeight && rect.top > dropdownMaxHeight;

    const width = Math.max(rect.width, 240);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }

    setDropdownStyle({
      top: showAbove ? Math.max(8, rect.top - dropdownMaxHeight - 4) : rect.bottom + 4,
      left,
      width,
      maxHeight: dropdownMaxHeight,
      zIndex: 9999,
    });
  }, []);

  // Sync position on scroll or window resize
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        listRef.current &&
        !listRef.current.contains(target)
      ) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const optionEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (optionEl && optionEl.scrollIntoView) {
        optionEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  function openDropdown() {
    if (disabled) return;
    setIsOpen(true);
    setIsTyping(false);
    setSearchTerm('');
    // Highlight currently selected item if in pool
    const selectedIdx = items.findIndex((i) => i.id === value);
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
    updatePosition();
  }

  function closeDropdown() {
    setIsOpen(false);
    setIsTyping(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  }

  function selectItem(item: Ingredient) {
    onChange(item.id);
    closeDropdown();
    inputRef.current?.blur();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchTerm(e.target.value);
    setIsTyping(true);
    setHighlightedIndex(0);
    if (!isOpen) {
      setIsOpen(true);
    }
  }

  function handleInputFocus() {
    if (!isOpen) {
      openDropdown();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredItems.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
          selectItem(filteredItems[highlightedIndex]);
        }
        break;
      case 'Escape':
      case 'Tab':
        closeDropdown();
        break;
      default:
        break;
    }
  }

  // Display value in input
  const displayValue = isTyping
    ? searchTerm
    : (selectedItem ? selectedItem.name : '');

  return (
    <div
      ref={containerRef}
      className={`item-combobox ${isOpen ? 'open' : ''} ${className}`}
    >
      <div className="item-combobox-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="item-combobox-input"
          placeholder={placeholder}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onClick={openDropdown}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          title={selectedItem ? selectedItem.name : placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="item-combobox-arrow">
          <ChevronDown size={14} />
        </div>
      </div>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={listRef}
            className="item-combobox-dropdown"
            style={dropdownStyle}
          >
            {filteredItems.length === 0 ? (
              <div className="item-combobox-empty">
                No matching items found
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const isSelected = item.id === value;
                const isHighlighted = idx === highlightedIndex;
                const costDisplay = (item.cost_per_unit ?? 0).toFixed(2);

                return (
                  <div
                    key={item.id}
                    className={`item-combobox-option ${
                      isSelected ? 'selected' : ''
                    } ${isHighlighted ? 'highlighted' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent input blur before selection
                      selectItem(item);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    <div className="item-combobox-option-name" title={item.name}>
                      {item.name}
                    </div>
                    <div className="item-combobox-option-meta">
                      {item.unit} · ₱{costDisplay}/{item.unit}
                    </div>
                  </div>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
