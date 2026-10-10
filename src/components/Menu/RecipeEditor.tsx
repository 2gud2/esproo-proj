import React from 'react';
import { Plus, Trash2, Package, Utensils, AlertCircle } from 'lucide-react';
import type { Ingredient } from '../../lib/mockData';
import type { SizeRow } from './SizesEditor';
import {
  calculateIngredientCost,
  getCompatibleUnits,
  areUnitsCompatible
} from '../../lib/unitConversion';

export interface RecipeEditorRow {
  id?: string;
  ingredient_id: string;
  quantity_used: string | number;
  unit: string;
  size_id?: string | null;
  usage_scope?: 'always' | 'takeout' | 'dine_in';
}

interface RecipeEditorProps {
  hasSizes: boolean;
  sizes: SizeRow[];
  ingredients: Ingredient[];
  recipeRows: RecipeEditorRow[];
  onChangeRecipeRows: (rows: RecipeEditorRow[]) => void;
}

export default function RecipeEditor({
  hasSizes,
  sizes,
  ingredients,
  recipeRows,
  onChangeRecipeRows,
}: RecipeEditorProps) {
  const rawIngredients = ingredients.filter((i) => i.item_type !== 'supply');
  const supplyIngredients = ingredients.filter((i) => i.item_type === 'supply');

  // Split rows into raw ingredients and packaging/supplies
  const rawRowIndices = recipeRows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => {
      const ing = ingredients.find((i) => i.id === row.ingredient_id);
      return !ing || ing.item_type !== 'supply';
    });

  const supplyRowIndices = recipeRows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => {
      const ing = ingredients.find((i) => i.id === row.ingredient_id);
      return ing && ing.item_type === 'supply';
    });

  function addRow(itemType: 'ingredient' | 'supply') {
    const list = itemType === 'supply' ? supplyIngredients : rawIngredients;
    if (list.length === 0) return;

    // Pick first available that isn't completely duplicated
    const first = list[0];
    const newRow: RecipeEditorRow = {
      ingredient_id: first.id,
      quantity_used: '1',
      unit: first.unit,
      size_id: null,
      usage_scope: 'always',
    };
    onChangeRecipeRows([...recipeRows, newRow]);
  }

  function updateRow(index: number, field: keyof RecipeEditorRow, value: any) {
    const next = recipeRows.map((r, i) => {
      if (i !== index) return r;
      const updated = { ...r, [field]: value };
      if (field === 'ingredient_id') {
        const ing = ingredients.find((ig) => ig.id === value);
        if (ing && !areUnitsCompatible(r.unit, ing.unit)) {
          updated.unit = ing.unit;
        }
      }
      return updated;
    });
    onChangeRecipeRows(next);
  }

  function removeRow(index: number) {
    onChangeRecipeRows(recipeRows.filter((_, i) => i !== index));
  }

  // Duplicate detector
  const duplicateIndices = new Set<number>();
  const seenKeys = new Map<string, number>();
  recipeRows.forEach((r, idx) => {
    const key = `${r.ingredient_id}__${r.size_id || 'all'}__${r.usage_scope || 'always'}`;
    if (seenKeys.has(key)) {
      duplicateIndices.add(idx);
      duplicateIndices.add(seenKeys.get(key)!);
    } else {
      seenKeys.set(key, idx);
    }
  });

  const renderRowTable = (
    rowIndices: Array<{ row: RecipeEditorRow; idx: number }>,
    itemPool: Ingredient[],
    title: string,
    icon: React.ReactNode,
    emptyMessage: string,
    addType: 'ingredient' | 'supply'
  ) => (
    <div className="recipe-group-container">
      <div className="recipe-group-header">
        <div className="recipe-group-title">
          {icon}
          <span>{title}</span>
          <span className="recipe-group-count">({rowIndices.length})</span>
        </div>
        <button
          type="button"
          onClick={() => addRow(addType)}
          className="recipe-add-row-btn"
          disabled={itemPool.length === 0}
        >
          <Plus size={14} /> Add {addType === 'supply' ? 'Supply' : 'Ingredient'}
        </button>
      </div>

      {itemPool.length === 0 ? (
        <div className="recipe-group-empty-notice">
          No {addType === 'supply' ? 'supplies' : 'raw ingredients'} found in Inventory. Add some first in the Inventory page.
        </div>
      ) : rowIndices.length === 0 ? (
        <div className="recipe-group-empty-state">
          {emptyMessage}
        </div>
      ) : (
        <div className="recipe-rows-table-wrapper">
          <table className="recipe-editor-table">
            <thead>
              <tr>
                <th>Item</th>
                <th style={{ width: '90px' }}>Quantity</th>
                <th style={{ width: '130px' }}>Unit</th>
                {hasSizes && <th style={{ width: '130px' }}>Applies To</th>}
                <th style={{ width: '120px' }}>When</th>
                <th style={{ width: '90px' }}>Est. Cost</th>
                <th style={{ width: '36px' }}></th>
              </tr>
            </thead>
            <tbody>
              {rowIndices.map(({ row, idx }) => {
                const ing = ingredients.find((i) => i.id === row.ingredient_id);
                const compatibleUnits = getCompatibleUnits(ing?.unit);
                const qtyNum = Number(row.quantity_used) || 0;
                const cost = calculateIngredientCost(qtyNum, row.unit, ing);
                const isDup = duplicateIndices.has(idx);

                return (
                  <tr key={row.id || idx} className={isDup ? 'duplicate-recipe-row' : ''}>
                    <td>
                      <select
                        value={row.ingredient_id}
                        onChange={(e) => updateRow(idx, 'ingredient_id', e.target.value)}
                        className="recipe-select item-select"
                        required
                      >
                        {itemPool.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.unit} — ₱{(item.cost_per_unit ?? 0).toFixed(2)}/{item.unit})
                          </option>
                        ))}
                      </select>
                      {isDup && (
                        <span className="duplicate-warning-text">
                          <AlertCircle size={11} /> Duplicate item/size/scope combination
                        </span>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        value={row.quantity_used}
                        onChange={(e) => updateRow(idx, 'quantity_used', e.target.value)}
                        className="recipe-input qty-input"
                        placeholder="Qty"
                        required
                      />
                    </td>
                    <td>
                      <select
                        value={row.unit}
                        onChange={(e) => updateRow(idx, 'unit', e.target.value)}
                        className="recipe-select unit-select"
                        required
                      >
                        {compatibleUnits.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    {hasSizes && (
                      <td>
                        <select
                          value={sizes.find(s => s.id === row.size_id || (s.name && (row.size_id || '').toLowerCase() === s.name.toLowerCase()))?.id || row.size_id || ''}
                          onChange={(e) => updateRow(idx, 'size_id', e.target.value ? e.target.value : null)}
                          className="recipe-select size-scope-select"
                        >
                          <option value="">All sizes</option>
                          {sizes.map((s) => (
                            <option key={s.id || s.name} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td>
                      <select
                        value={row.usage_scope || 'always'}
                        onChange={(e) => updateRow(idx, 'usage_scope', e.target.value as any)}
                        className="recipe-select usage-scope-select"
                      >
                        <option value="always">Always</option>
                        <option value="takeout">Takeout only</option>
                        <option value="dine_in">Dine-in only</option>
                      </select>
                    </td>
                    <td className="recipe-cost-cell">
                      ₱{cost.toFixed(2)}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="recipe-row-remove-btn"
                        title="Remove ingredient"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="recipe-editor-wrapper">
      {renderRowTable(
        rawRowIndices,
        rawIngredients,
        'Ingredients (Recipe)',
        <Utensils size={15} />,
        'No ingredients configured for this item. Click "+ Add Ingredient" above.',
        'ingredient'
      )}

      {renderRowTable(
        supplyRowIndices,
        supplyIngredients,
        'Packaging & Supplies',
        <Package size={15} />,
        'No packaging or supplies configured for this item. Click "+ Add Supply" above.',
        'supply'
      )}
    </div>
  );
}
