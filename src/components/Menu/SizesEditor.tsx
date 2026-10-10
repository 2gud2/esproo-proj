import React from 'react';
import { Plus, Trash2, HelpCircle } from 'lucide-react';

export interface SizeRow {
  id?: string;
  name: string;
  price: string | number;
  ingredient_multiplier: string | number;
  sort_order: number;
  is_default: boolean;
  is_active?: boolean;
}

interface SizesEditorProps {
  hasSizes: boolean;
  onToggleHasSizes: (hasSizes: boolean) => void;
  sizes: SizeRow[];
  onChangeSizes: (sizes: SizeRow[]) => void;
}

const QUICK_SIZE_CHIPS = ['Small', 'Medium', 'Large', '12oz', '16oz', 'Regular'];

export default function SizesEditor({
  hasSizes,
  onToggleHasSizes,
  sizes,
  onChangeSizes,
}: SizesEditorProps) {
  function handleToggle(enabled: boolean) {
    onToggleHasSizes(enabled);
    if (enabled && sizes.length === 0) {
      onChangeSizes([
        {
          id: crypto.randomUUID(),
          name: 'Regular',
          price: '',
          ingredient_multiplier: '1.0',
          sort_order: 0,
          is_default: true,
        },
        {
          id: crypto.randomUUID(),
          name: 'Large',
          price: '',
          ingredient_multiplier: '1.5',
          sort_order: 1,
          is_default: false,
        },
      ]);
    }
  }

  function addSize() {
    if (sizes.length >= 6) return;
    const newSortOrder = sizes.length;
    onChangeSizes([
      ...sizes,
      {
        id: crypto.randomUUID(),
        name: `Size ${sizes.length + 1}`,
        price: '',
        ingredient_multiplier: '1.0',
        sort_order: newSortOrder,
        is_default: sizes.length === 0,
      },
    ]);
  }

  function updateSize(index: number, field: keyof SizeRow, value: any) {
    const next = sizes.map((s, i) => {
      if (i !== index) {
        if (field === 'is_default' && value === true) {
          return { ...s, is_default: false };
        }
        return s;
      }
      return { ...s, [field]: value };
    });
    onChangeSizes(next);
  }

  function removeSize(index: number) {
    if (sizes.length <= 1) return;
    const next = sizes.filter((_, i) => i !== index);
    // If we removed the default size, make first one default
    if (!next.some(s => s.is_default) && next.length > 0) {
      next[0].is_default = true;
    }
    onChangeSizes(next);
  }

  return (
    <div className="sizes-editor-section">
      <div className="sizes-toggle-header">
        <label className="sizes-toggle-label">
          <input
            type="checkbox"
            checked={hasSizes}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sizes-toggle-checkbox"
          />
          <span className="sizes-toggle-text">This item has multiple sizes</span>
        </label>
        {hasSizes && (
          <span className="sizes-count-badge">
            {sizes.length} / 6 sizes
          </span>
        )}
      </div>

      {hasSizes && (
        <div className="sizes-content-box">
          <div className="sizes-quick-chips">
            <span className="quick-chips-label">Quick Names:</span>
            {QUICK_SIZE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                className="quick-chip-btn"
                onClick={() => {
                  // If empty size row exists, rename it; else add new size
                  const emptyIdx = sizes.findIndex((s) => !s.name.trim());
                  if (emptyIdx >= 0) {
                    updateSize(emptyIdx, 'name', chip);
                  } else if (sizes.length < 6) {
                    onChangeSizes([
                      ...sizes,
                      {
                        id: crypto.randomUUID(),
                        name: chip,
                        price: '',
                        ingredient_multiplier: chip.toLowerCase().includes('large') ? '1.5' : '1.0',
                        sort_order: sizes.length,
                        is_default: sizes.length === 0,
                      },
                    ]);
                  }
                }}
              >
                + {chip}
              </button>
            ))}
          </div>

          <div className="sizes-table-container">
            <table className="sizes-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }} title="Default size for POS and menu display">Default</th>
                  <th>Size Name</th>
                  <th style={{ width: '120px' }}>Price (₱)</th>
                  <th style={{ width: '140px' }}>
                    <div className="multiplier-th">
                      <span>Multiplier</span>
                      <span className="multiplier-hint" title="Multiplier applied to raw ingredient quantities. 1.5 = 50% more ingredients. Supplies are not scaled.">
                        <HelpCircle size={13} />
                      </span>
                    </div>
                  </th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {sizes.map((s, idx) => (
                  <tr key={s.id || idx}>
                    <td className="text-center">
                      <input
                        type="radio"
                        name="default_size_radio"
                        checked={Boolean(s.is_default)}
                        onChange={() => updateSize(idx, 'is_default', true)}
                        className="size-default-radio"
                        title="Set as default size"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="e.g. 16oz or Large"
                        value={s.name}
                        onChange={(e) => updateSize(idx, 'name', e.target.value)}
                        className="size-input name-input"
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="0.00"
                        value={s.price}
                        onChange={(e) => updateSize(idx, 'price', e.target.value)}
                        className="size-input price-input"
                        required
                      />
                    </td>
                    <td>
                      <div className="multiplier-input-wrapper">
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          placeholder="1.0"
                          value={s.ingredient_multiplier}
                          onChange={(e) => updateSize(idx, 'ingredient_multiplier', e.target.value)}
                          className="size-input multiplier-input"
                        />
                        <span className="multiplier-suffix">x</span>
                      </div>
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => removeSize(idx)}
                        disabled={sizes.length <= 1}
                        className="size-remove-btn"
                        title={sizes.length <= 1 ? 'At least one size required' : 'Remove size'}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sizes.length < 6 && (
            <button
              type="button"
              onClick={addSize}
              className="add-size-btn"
            >
              <Plus size={15} /> Add Another Size
            </button>
          )}
        </div>
      )}
    </div>
  );
}
