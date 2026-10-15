import React from 'react';
import {
  Plus,
  Trash2,
  Package,
  Utensils,
  AlertCircle,
  Copy,
  Layers,
  Sparkles,
  Tag,
} from 'lucide-react';
import ItemCombobox from '../Common/ItemCombobox';
import type { Ingredient } from '../../lib/mockData';
import type { SizeRow } from './SizesEditor';
import {
  calculateIngredientCost,
  getCompatibleUnits,
  areUnitsCompatible,
} from '../../lib/unitConversion';
import {
  findSupplySuggestions,
  evaluateSupplyMatch,
} from '../../lib/supplySuggestions';
import toast from 'react-hot-toast';

export interface RecipeEditorRow {
  id?: string;
  ingredient_id: string;
  quantity_used: string | number;
  unit: string;
  size_id?: string | null;
  usage_scope?: 'always' | 'takeout' | 'dine_in';
  item_type?: 'ingredient' | 'supply';
}

interface RecipeEditorProps {
  hasSizes: boolean;
  sizes: SizeRow[];
  ingredients: Ingredient[];
  recipeRows: RecipeEditorRow[];
  onChangeRecipeRows: (rows: RecipeEditorRow[]) => void;
  section?: 'all' | 'ingredients' | 'supplies';
}

export default function RecipeEditor({
  hasSizes,
  sizes,
  ingredients,
  recipeRows,
  onChangeRecipeRows,
  section = 'all',
}: RecipeEditorProps) {
  const rawIngredients = ingredients.filter((i) => i.item_type !== 'supply');
  const supplyIngredients = ingredients.filter((i) => i.item_type === 'supply');

  // Helper to reliably check if a row is a supply row
  const isSupplyRow = (row: RecipeEditorRow): boolean => {
    if (row.item_type === 'supply') return true;
    if (row.item_type === 'ingredient') return false;
    const ing = ingredients.find((i) => i.id === row.ingredient_id);
    return ing ? ing.item_type === 'supply' : false;
  };

  // Split rows into raw ingredients and packaging/supplies
  const rawRowIndices = recipeRows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => !isSupplyRow(row));

  const supplyRowIndices = recipeRows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => isSupplyRow(row));

  function addRow(itemType: 'ingredient' | 'supply', sizeId: string | null = null) {
    const list = itemType === 'supply' ? supplyIngredients : rawIngredients;
    if (list.length === 0) return;

    let initialIng: Ingredient | null = null;
    if (itemType === 'supply' && sizeId) {
      const sizeObj = sizes.find((s) => s.id === sizeId);
      if (sizeObj) {
        const { confidentMatch } = evaluateSupplyMatch(sizeObj.name, supplyIngredients);
        initialIng = confidentMatch;
      }
    }

    const first = initialIng || list[0];
    const newRow: RecipeEditorRow = {
      ingredient_id: initialIng ? initialIng.id : '',
      quantity_used: '1',
      unit: first?.unit || 'pcs',
      size_id: sizeId,
      usage_scope: 'always',
      item_type: itemType,
    };
    onChangeRecipeRows([...recipeRows, newRow]);
  }

  function updateRow(index: number, field: keyof RecipeEditorRow, value: any) {
    const next = recipeRows.map((r, i) => {
      if (i !== index) return r;
      const updated = { ...r, [field]: value };
      if (field === 'ingredient_id') {
        const ing = ingredients.find((ig) => ig.id === value);
        if (ing) {
          updated.item_type = ing.item_type === 'supply' ? 'supply' : 'ingredient';
          if (!areUnitsCompatible(r.unit, ing.unit)) {
            updated.unit = ing.unit;
          }
        }
      }
      return updated;
    });
    onChangeRecipeRows(next);
  }

  function removeRow(index: number) {
    onChangeRecipeRows(recipeRows.filter((_, i) => i !== index));
  }

  // Duplicate detector across full array
  const duplicateIndices = new Set<number>();
  const seenKeys = new Map<string, number>();
  recipeRows.forEach((r, idx) => {
    if (!r.ingredient_id) return; // Ignore blank placeholder rows
    const key = `${r.ingredient_id}__${r.size_id || 'all'}__${r.usage_scope || 'always'}`;
    if (seenKeys.has(key)) {
      duplicateIndices.add(idx);
      duplicateIndices.add(seenKeys.get(key)!);
    } else {
      seenKeys.set(key, idx);
    }
  });

  // Bulk Helper: Copy supplies from another size or shared
  function copySuppliesToSize(fromSource: string, targetSizeId: string) {
    const targetSize = sizes.find((s) => s.id === targetSizeId);
    if (!targetSize) return;

    const sourceRows =
      fromSource === 'shared'
        ? supplyRowIndices.filter(({ row }) => !row.size_id)
        : supplyRowIndices.filter(({ row }) => row.size_id === fromSource);

    if (sourceRows.length === 0) {
      toast.error('No supplies found to copy from selected source');
      return;
    }

    const existingKeys = new Set(
      recipeRows
        .filter((r) => r.size_id === targetSizeId && r.ingredient_id)
        .map((r) => `${r.ingredient_id}__${r.usage_scope || 'always'}`)
    );

    const newRows: RecipeEditorRow[] = [];
    let skipped = 0;

    for (const { row } of sourceRows) {
      if (!row.ingredient_id) continue;
      const key = `${row.ingredient_id}__${row.usage_scope || 'always'}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }
      existingKeys.add(key);
      newRows.push({
        ingredient_id: row.ingredient_id,
        quantity_used: row.quantity_used,
        unit: row.unit,
        size_id: targetSizeId,
        usage_scope: row.usage_scope || 'always',
        item_type: 'supply',
      });
    }

    if (newRows.length === 0) {
      toast('All items already exist in this size', { icon: 'ℹ️' });
      return;
    }

    // Remove empty unedited placeholder row in target size
    const filteredCurrent = recipeRows.filter(
      (r) => !(r.size_id === targetSizeId && !r.ingredient_id)
    );

    onChangeRecipeRows([...filteredCurrent, ...newRows]);
    toast.success(
      `Copied ${newRows.length} supply item${newRows.length > 1 ? 's' : ''} to ${targetSize.name}${
        skipped > 0 ? ` (${skipped} skipped duplicate)` : ''
      }`
    );
  }

  // Bulk Helper: Apply/Duplicate a row across all sizes
  function duplicateRowToAllSizes(rowIndex: number) {
    const row = recipeRows[rowIndex];
    if (!row || !row.ingredient_id) return;

    const currentSizeId = row.size_id;
    const newRows: RecipeEditorRow[] = [];

    for (const s of sizes) {
      if (s.id === currentSizeId) continue;
      const exists = recipeRows.some(
        (r) =>
          r.size_id === s.id &&
          r.ingredient_id === row.ingredient_id &&
          (r.usage_scope || 'always') === (row.usage_scope || 'always')
      );
      if (!exists) {
        newRows.push({
          ingredient_id: row.ingredient_id,
          quantity_used: row.quantity_used,
          unit: row.unit,
          size_id: s.id,
          usage_scope: row.usage_scope || 'always',
          item_type: 'supply',
        });
      }
    }

    if (newRows.length === 0) {
      toast('Item already exists across all sizes', { icon: 'ℹ️' });
      return;
    }

    onChangeRecipeRows([...recipeRows, ...newRows]);
    toast.success(`Duplicated to ${newRows.length} other size${newRows.length > 1 ? 's' : ''}`);
  }

  // Bulk Helper: Convert a row to shared (all sizes)
  function convertRowToShared(rowIndex: number) {
    const row = recipeRows[rowIndex];
    if (!row) return;

    const alreadyShared = recipeRows.some(
      (r, i) =>
        i !== rowIndex &&
        !r.size_id &&
        r.ingredient_id === row.ingredient_id &&
        (r.usage_scope || 'always') === (row.usage_scope || 'always')
    );

    if (alreadyShared) {
      onChangeRecipeRows(recipeRows.filter((_, i) => i !== rowIndex));
      toast.success('Removed duplicate: item is already in All sizes (shared)');
    } else {
      updateRow(rowIndex, 'size_id', null);
      toast.success('Moved to All sizes (shared)');
    }
  }

  // Smart suggestion chip click
  function applySuggestionToSize(sizeId: string, item: Ingredient) {
    // Fill empty placeholder row if exists
    const emptyRowIdx = recipeRows.findIndex(
      (r) => r.size_id === sizeId && !r.ingredient_id
    );
    if (emptyRowIdx >= 0) {
      const next = recipeRows.map((r, i) =>
        i === emptyRowIdx
          ? { ...r, ingredient_id: item.id, unit: item.unit, item_type: 'supply' as const }
          : r
      );
      onChangeRecipeRows(next);
      toast.success(`Selected "${item.name}"`);
      return;
    }

    // Check duplicate
    const exists = recipeRows.some(
      (r) => r.size_id === sizeId && r.ingredient_id === item.id
    );
    if (exists) {
      toast(`"${item.name}" is already in this size`, { icon: 'ℹ️' });
      return;
    }

    const newRow: RecipeEditorRow = {
      ingredient_id: item.id,
      quantity_used: '1',
      unit: item.unit,
      size_id: sizeId,
      usage_scope: 'always',
      item_type: 'supply',
    };
    onChangeRecipeRows([...recipeRows, newRow]);
    toast.success(`Added "${item.name}"`);
  }

  // Flat table renderer (used for ingredients, and for supplies when hasSizes is false)
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
        <div className="recipe-group-empty-state">{emptyMessage}</div>
      ) : (
        <div className="recipe-rows-table-wrapper">
          <table className="recipe-editor-table">
            <thead>
              <tr>
                <th style={{ minWidth: '220px' }}>Item</th>
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
                    <td style={{ minWidth: '220px' }}>
                      <ItemCombobox
                        items={itemPool}
                        value={row.ingredient_id}
                        onChange={(newId) => updateRow(idx, 'ingredient_id', newId)}
                        placeholder={`Select ${addType === 'supply' ? 'supply' : 'ingredient'}...`}
                      />
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
                          value={
                            sizes.find(
                              (s) =>
                                s.id === row.size_id ||
                                (s.name &&
                                  (row.size_id || '').toLowerCase() === s.name.toLowerCase())
                            )?.id ||
                            row.size_id ||
                            ''
                          }
                          onChange={(e) =>
                            updateRow(idx, 'size_id', e.target.value ? e.target.value : null)
                          }
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
                    <td className="recipe-cost-cell">₱{cost.toFixed(2)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="recipe-row-remove-btn"
                        title="Remove item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {rowIndices.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
                  <td colSpan={hasSizes ? 5 : 4} style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '8px 10px' }}>
                    {title} Subtotal:
                  </td>
                  <td className="recipe-cost-cell" style={{ fontWeight: 800, padding: '8px 10px' }}>
                    ₱{rowIndices.reduce((sum, { row }) => {
                      const ing = ingredients.find(i => i.id === row.ingredient_id);
                      return sum + calculateIngredientCost(Number(row.quantity_used) || 0, row.unit, ing);
                    }, 0).toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );

  // Per-size packaging renderer (used when hasSizes is true and section is supplies)
  const renderPerSizeSupplies = () => {
    const sharedRows = supplyRowIndices.filter(({ row }) => !row.size_id);
    const validSizeIds = new Set(sizes.map((s) => s.id));
    const unassignedRows = supplyRowIndices.filter(
      ({ row }) => row.size_id && !validSizeIds.has(row.size_id)
    );

    return (
      <div className="per-size-supplies-wrapper">
        <div className="per-size-supplies-intro">
          <div className="per-size-intro-title">
            <Package size={16} />
            <span>Packaging &amp; Supplies (Per-Size Configuration)</span>
          </div>
          <p className="per-size-intro-desc">
            Assign cups and size-specific packaging to each size, or define shared items (lids, straws, bags) that apply to all sizes.
          </p>
        </div>

        {/* 1. All Sizes (Shared) Group */}
        <div className="supply-size-group-card shared-supplies-card">
          <div className="supply-size-header">
            <div className="supply-size-title-area">
              <Layers size={16} className="supply-size-icon" />
              <div>
                <div className="supply-size-title">
                  All sizes (shared)
                  <span className="recipe-group-count">({sharedRows.length})</span>
                </div>
                <div className="supply-size-subtitle">
                  Supplies used across every size (e.g. straw, lid, napkins)
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => addRow('supply', null)}
              className="recipe-add-row-btn"
              disabled={supplyIngredients.length === 0}
            >
              <Plus size={14} /> Add Shared Supply
            </button>
          </div>

          {sharedRows.length === 0 ? (
            <div className="recipe-group-empty-state">
              No shared packaging configured. Click "+ Add Shared Supply" to add items used by every size.
            </div>
          ) : (
            <div className="recipe-rows-table-wrapper">
              <table className="recipe-editor-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '220px' }}>Item</th>
                    <th style={{ width: '90px' }}>Quantity</th>
                    <th style={{ width: '130px' }}>Unit</th>
                    <th style={{ width: '120px' }}>When</th>
                    <th style={{ width: '90px' }}>Est. Cost</th>
                    <th style={{ width: '70px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sharedRows.map(({ row, idx }) => {
                    const ing = ingredients.find((i) => i.id === row.ingredient_id);
                    const compatibleUnits = getCompatibleUnits(ing?.unit);
                    const qtyNum = Number(row.quantity_used) || 0;
                    const cost = calculateIngredientCost(qtyNum, row.unit, ing);
                    const isDup = duplicateIndices.has(idx);

                    return (
                      <tr key={row.id || idx} className={isDup ? 'duplicate-recipe-row' : ''}>
                        <td style={{ minWidth: '220px' }}>
                          <ItemCombobox
                            items={supplyIngredients}
                            value={row.ingredient_id}
                            onChange={(newId) => updateRow(idx, 'ingredient_id', newId)}
                            placeholder="Select shared supply..."
                          />
                          {isDup && (
                            <span className="duplicate-warning-text">
                              <AlertCircle size={11} /> Duplicate item/scope combination
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
                        <td className="recipe-cost-cell">₱{cost.toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="table-row-actions">
                            <button
                              type="button"
                              onClick={() => duplicateRowToAllSizes(idx)}
                              className="recipe-row-action-btn"
                              title="Duplicate to all individual sizes"
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRow(idx)}
                              className="recipe-row-remove-btn"
                              title="Remove shared item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 2. One Group per Defined Size */}
        {sizes.map((s) => {
          const sizeRows = supplyRowIndices.filter(({ row }) => row.size_id === s.id);
          const suggestions = findSupplySuggestions(s.name, supplyIngredients);

          return (
            <div key={s.id || s.name} className="supply-size-group-card">
              <div className="supply-size-header">
                <div className="supply-size-title-area">
                  <Tag size={16} className="supply-size-icon" />
                  <div>
                    <div className="supply-size-title">
                      <span>Size: <strong>{s.name}</strong></span>
                      <span className="size-price-tag-sm">₱{Number(s.price || 0).toFixed(2)}</span>
                      <span className="recipe-group-count">({sizeRows.length} supplies)</span>
                    </div>
                    <div className="supply-size-subtitle">
                      Packaging specific to {s.name} (e.g. cups, custom sleeves)
                    </div>
                  </div>
                </div>

                <div className="supply-size-actions">
                  <select
                    value=""
                    className="copy-supplies-select"
                    onChange={(e) => {
                      const from = e.target.value;
                      if (from && s.id) copySuppliesToSize(from, s.id);
                    }}
                    title="Copy packaging supplies from another size"
                  >
                    <option value="">Copy supplies from...</option>
                    {sharedRows.length > 0 && (
                      <option value="shared">All sizes (shared) ({sharedRows.length})</option>
                    )}
                    {sizes
                      .filter((other) => other.id !== s.id)
                      .map((other) => {
                        const count = recipeRows.filter(
                          (r) => r.size_id === other.id && supplyIngredients.some((i) => i.id === r.ingredient_id)
                        ).length;
                        return (
                          <option key={other.id} value={other.id} disabled={count === 0}>
                            {other.name} ({count} supplies)
                          </option>
                        );
                      })}
                  </select>

                  <button
                    type="button"
                    onClick={() => addRow('supply', s.id)}
                    className="recipe-add-row-btn"
                    disabled={supplyIngredients.length === 0}
                  >
                    <Plus size={14} /> Add Supply for {s.name}
                  </button>
                </div>
              </div>

              {/* Smart Suggestion Chips */}
              {suggestions.length > 0 && (
                <div className="supply-suggestions-bar">
                  <div className="suggestions-label">
                    <Sparkles size={13} />
                    <span>Suggested for {s.name}:</span>
                  </div>
                  <div className="suggestions-chips-container">
                    {suggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="supply-suggestion-chip"
                        onClick={() => s.id && applySuggestionToSize(s.id, item)}
                        title={`Add ${item.name} (${item.unit} · ₱${(item.cost_per_unit ?? 0).toFixed(2)})`}
                      >
                        + {item.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Size Supply Rows Table */}
              {sizeRows.length === 0 ? (
                <div className="recipe-group-empty-state">
                  No packaging set specifically for <strong>{s.name}</strong>. Click "+ Add Supply for {s.name}" or pick a suggested item above.
                </div>
              ) : (
                <div className="recipe-rows-table-wrapper">
                  <table className="recipe-editor-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: '220px' }}>Item</th>
                        <th style={{ width: '90px' }}>Quantity</th>
                        <th style={{ width: '130px' }}>Unit</th>
                        <th style={{ width: '120px' }}>When</th>
                        <th style={{ width: '90px' }}>Est. Cost</th>
                        <th style={{ width: '100px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sizeRows.map(({ row, idx }) => {
                        const ing = ingredients.find((i) => i.id === row.ingredient_id);
                        const compatibleUnits = getCompatibleUnits(ing?.unit);
                        const qtyNum = Number(row.quantity_used) || 0;
                        const cost = calculateIngredientCost(qtyNum, row.unit, ing);
                        const isDup = duplicateIndices.has(idx);

                        return (
                          <tr key={row.id || idx} className={isDup ? 'duplicate-recipe-row' : ''}>
                            <td style={{ minWidth: '220px' }}>
                              <ItemCombobox
                                items={supplyIngredients}
                                value={row.ingredient_id}
                                onChange={(newId) => updateRow(idx, 'ingredient_id', newId)}
                                placeholder={`Select cup or packaging for ${s.name}...`}
                              />
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
                            <td className="recipe-cost-cell">₱{cost.toFixed(2)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="table-row-actions">
                                <button
                                  type="button"
                                  onClick={() => convertRowToShared(idx)}
                                  className="recipe-row-action-btn"
                                  title="Make shared across all sizes"
                                >
                                  <Layers size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => duplicateRowToAllSizes(idx)}
                                  className="recipe-row-action-btn"
                                  title="Duplicate to all other sizes"
                                >
                                  <Copy size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeRow(idx)}
                                  className="recipe-row-remove-btn"
                                  title="Remove supply"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
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
        })}

        {/* 3. Handle any orphaned or unassigned size rows safely */}
        {unassignedRows.length > 0 && (
          <div className="supply-size-group-card unassigned-supplies-card">
            <div className="supply-size-header">
              <div className="supply-size-title-area">
                <AlertCircle size={16} className="text-warning" />
                <div>
                  <div className="supply-size-title">
                    Unassigned Packaging Items ({unassignedRows.length})
                  </div>
                  <div className="supply-size-subtitle">
                    Items assigned to previously removed sizes. Convert them to shared or remove them.
                  </div>
                </div>
              </div>
            </div>
            <div className="recipe-rows-table-wrapper">
              <table className="recipe-editor-table">
                <tbody>
                  {unassignedRows.map(({ row, idx }) => {
                    const ing = ingredients.find((i) => i.id === row.ingredient_id);
                    return (
                      <tr key={row.id || idx}>
                        <td style={{ minWidth: 220 }}>
                          <strong>{ing?.name || 'Unknown item'}</strong> ({row.quantity_used} {row.unit})
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => convertRowToShared(idx)}
                          >
                            Make Shared
                          </button>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            className="recipe-row-remove-btn"
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
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="recipe-editor-wrapper">
      {(section === 'all' || section === 'ingredients') &&
        renderRowTable(
          rawRowIndices,
          rawIngredients,
          'Ingredients (Recipe)',
          <Utensils size={15} />,
          'No ingredients configured for this item. Click "+ Add Ingredient" above.',
          'ingredient'
        )}

      {(section === 'all' || section === 'supplies') &&
        (hasSizes
          ? renderPerSizeSupplies()
          : renderRowTable(
              supplyRowIndices,
              supplyIngredients,
              'Packaging & Supplies',
              <Package size={15} />,
              'No packaging or supplies configured for this item. Click "+ Add Supply" above.',
              'supply'
            ))}
    </div>
  );
}

