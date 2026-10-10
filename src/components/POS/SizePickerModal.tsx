import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import type { MenuItem, MenuItemSize } from '../../lib/mockData';

interface SizePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: MenuItem | null;
  sizes: MenuItemSize[];
  initialSizeId?: string | null;
  onSelectSize: (size: MenuItemSize) => void;
}

export default function SizePickerModal({
  isOpen,
  onClose,
  menuItem,
  sizes,
  initialSizeId,
  onSelectSize,
}: SizePickerModalProps) {
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    if (isOpen && sizes.length > 0) {
      if (initialSizeId && sizes.some((s) => s.id === initialSizeId)) {
        setSelectedId(initialSizeId);
      } else {
        const defaultSize = sizes.find((s) => s.is_default) || sizes[0];
        setSelectedId(defaultSize.id);
      }
    }
  }, [isOpen, sizes, initialSizeId]);

  if (!isOpen || !menuItem) return null;

  function handleConfirm() {
    const chosen = sizes.find((s) => s.id === selectedId) || sizes[0];
    if (chosen) {
      onSelectSize(chosen);
      onClose();
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal size-picker-modal"
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          style={{ maxWidth: 420, width: '100%' }}
        >
          <div className="modal-header">
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Select Size</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {menuItem.name} · {menuItem.category}
              </span>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <div className="modal-body" style={{ padding: '16px 20px' }}>
            <div className="size-options-list">
              {sizes.map((s) => {
                const isSelected = selectedId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`size-option-card ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <div className="size-option-info">
                      <span className="size-option-name">{s.name}</span>
                      {s.ingredient_multiplier !== 1 && (
                        <span className="size-option-multiplier">
                          {s.ingredient_multiplier}x ingredients
                        </span>
                      )}
                    </div>
                    <div className="size-option-right">
                      <span className="size-option-price">₱{s.price.toFixed(2)}</span>
                      <div className={`size-radio-indicator ${isSelected ? 'checked' : ''}`}>
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirm}
              style={{ minWidth: 120 }}
            >
              Confirm Size
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
