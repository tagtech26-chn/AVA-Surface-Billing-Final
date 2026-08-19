import React from 'react';
import { Product, StockAdjustment, UserRole } from '../types';
import { InventoryCatalogView } from './InventoryCatalogView';

interface InventoryViewProps {
  products: Product[];
  onSaveProduct: (product: Product) => void;
  onStockAdjustment: (adjustment: StockAdjustment) => void;
  stockLogs: StockAdjustment[];
  userRole: UserRole;
  currencySymbol: string;
}

/**
 * Compatibility wrapper for App.tsx. The production inventory screen now
 * loads the MSSQL product master server-side with paging/search instead of
 * rendering the complete local product array.
 */
export const InventoryView: React.FC<InventoryViewProps> = ({
  onSaveProduct,
  onStockAdjustment,
  userRole,
  currencySymbol
}) => (
  <InventoryCatalogView
    onSaveProduct={onSaveProduct}
    onStockAdjustment={onStockAdjustment}
    userRole={userRole}
    currencySymbol={currencySymbol}
  />
);
