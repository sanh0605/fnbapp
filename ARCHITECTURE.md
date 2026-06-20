# Auto-Generated Architecture Map
*Last updated: 2026-06-17T10:40:09.671Z*

## Core Libraries (`lib/`)
* **`lib/crypto.ts`**
  * `hashPasswordSHA256` -> Consumed by: `changePasswordAction`
* **`lib/report-utils.ts`**
  * `computeLineRevenue` -> Consumed by: `getPnLData`, `default`, `default`
  * `LineRevenueResult`
  * `ComputeLineRevenueInput`
* **`lib/shared-actions.ts`**
  * `ok` -> Consumed by: `createEntity`, `updateEntity`, `deleteEntity`, `softDeleteEntity`, `saveProductionOrder`, `savePromotion`, `deletePromotionAction`, `saveSemiProduct`, `deleteSemiProductAction`, `addSupplier`, `editSupplier`, `addUser`, `deleteUserAction`, `updateUser`, `addBaseIngredient`, `updateBaseIngredient`, `deleteBaseIngredientAction`, `addConversion`, `updateConversion`, `deleteConversionAction`, `addPurchasedItem`, `updatePurchasedItem`, `deletePurchasedItemAction`, `savePurchaseOrder`, `addPurchaseSource`, `saveCategory`, `updateCategory`, `saveModifierAction`, `deleteModifierAction`
  * `fail` -> Consumed by: `createEntity`, `updateEntity`, `deleteEntity`, `softDeleteEntity`, `saveProductionOrder`, `savePromotion`, `deletePromotionAction`, `saveSemiProduct`, `deleteSemiProductAction`, `addSupplier`, `editSupplier`, `deleteSupplierAction`, `addUser`, `deleteUserAction`, `updateUser`, `addBaseIngredient`, `updateBaseIngredient`, `deleteBaseIngredientAction`, `addConversion`, `updateConversion`, `deleteConversionAction`, `addPurchasedItem`, `updatePurchasedItem`, `deletePurchasedItemAction`, `savePurchaseOrder`, `addPurchaseSource`, `saveCategory`, `updateCategory`, `deleteCategory`, `saveModifierAction`, `deleteModifierAction`
  * `createEntity` -> Consumes: `generateNewId`, `insert`, `ok`, `fail` -> Consumed by: `addBrand`
  * `updateEntity` -> Consumes: `update`, `ok`, `fail` -> Consumed by: `editBrand`
  * `deleteEntity` -> Consumes: `remove`, `ok`, `fail` -> Consumed by: `deleteBrand`, `deleteSupplierAction`
  * `softDeleteEntity` -> Consumes: `update`, `ok`, `fail` -> Consumed by: `deleteCategory`
  * `ActionResponse`
* **`lib/sheets_db.ts`**
  * `getAuth` -> Consumed by: `getSheetsClient`
  * `findById` -> Consumes: `findAll` -> Consumed by: `default`
  * `generateNewId` -> Consumes: `findAllNoCache` -> Consumed by: `createEntity`, `addItemCategory`, `addBaseIngredient`, `addPurchasedItem`, `updatePurchasedItem`, `addConversion`, `addUnit`, `saveModifier`, `saveProductionOrder`, `saveProductCategory`, `saveProduct`, `savePromotion`, `savePurchaseOrder`, `addPurchaseSource`, `saveSemiProduct`, `submitStockAdjustment`, `approveStockAdjustment`, `addSupplier`, `addUser`, `saveProductionOrder`, `savePromotion`, `saveSemiProduct`, `addSupplier`, `addUser`, `addBaseIngredient`, `addConversion`, `addPurchasedItem`, `updatePurchasedItem`, `savePurchaseOrder`, `addPurchaseSource`, `saveCategory`, `saveModifierAction`
  * `insert` -> Consumes: `getSheetsClient`, `getHeaders` -> Consumed by: `createEntity`, `addItemCategory`, `addBaseIngredient`, `addPurchasedItem`, `updatePurchasedItem`, `addConversion`, `addUnit`, `saveModifier`, `submitOrder`, `saveProductionOrder`, `saveProductCategory`, `saveProduct`, `savePromotion`, `savePurchaseOrder`, `addPurchaseSource`, `saveSemiProduct`, `submitStockAdjustment`, `approveStockAdjustment`, `addSupplier`, `addUser`, `saveProductionOrder`, `savePromotion`, `saveSemiProduct`, `addSupplier`, `addUser`, `POST`, `addBaseIngredient`, `addConversion`, `addPurchasedItem`, `updatePurchasedItem`, `savePurchaseOrder`, `addPurchaseSource`, `saveCategory`, `saveModifierAction`
  * `insertMany` -> Consumes: `getSheetsClient`, `getHeaders` -> Consumed by: `editOrder`, `submitOrder`, `POST`
  * `update` -> Consumes: `getSheetsClient` -> Consumed by: `updateEntity`, `softDeleteEntity`, `updateItemCategory`, `updateBaseIngredient`, `updatePurchasedItem`, `updateConversion`, `updateUnit`, `saveModifier`, `deleteModifier`, `editOrder`, `updateProductCategory`, `deleteProductCategory`, `saveProduct`, `deleteProduct`, `savePromotion`, `savePurchaseOrder`, `saveSemiProduct`, `deleteSemiProduct`, `approveStockAdjustment`, `addSupplier`, `updateUser`, `savePromotion`, `saveSemiProduct`, `deleteSemiProductAction`, `editSupplier`, `updateUser`, `updateBaseIngredient`, `updateConversion`, `updatePurchasedItem`, `savePurchaseOrder`, `updateCategory`, `saveModifierAction`, `deleteModifierAction`
  * `remove` -> Consumes: `getSheetsClient` -> Consumed by: `deleteEntity`, `deleteItemCategory`, `deleteBaseIngredient`, `updatePurchasedItem`, `deletePurchasedItem`, `deleteConversion`, `deleteOrder`, `submitOrder`, `deletePromotion`, `savePurchaseOrder`, `deleteSupplier`, `deleteUser`, `deletePromotionAction`, `deleteUserAction`, `DELETE`, `deleteBaseIngredientAction`, `deleteConversionAction`, `updatePurchasedItem`, `deletePurchasedItemAction`, `savePurchaseOrder`
  * `removeMany` -> Consumes: `getSheetsClient` -> Consumed by: `editOrder`, `deleteOrder`, `submitOrder`, `POST`
  * `getSheetsClient` -> Consumes: `getAuth` -> Consumed by: `insert`, `insertMany`, `update`, `remove`, `removeMany`, `findAll`, `findAllNoCache`, `getHeaders`, `GET`, `GET`, `GET`
  * `findAll` -> Consumes: `getSheetsClient` -> Consumed by: `findById`, `updatePurchasedItem`, `updateConversion`, `saveModifier`, `editOrder`, `getOrders`, `deleteOrder`, `submitOrder`, `saveProductionOrder`, `saveProduct`, `deleteProduct`, `getPromotionsData`, `savePurchaseOrder`, `saveSemiProduct`, `getPnLData`, `getRealtimeStock`, `approveStockAdjustment`, `addSupplier`, `addUser`, `default`, `default`, `getBrands`, `default`, `getProductionData`, `saveProductionOrder`, `default`, `getPromotionsData`, `getSemiProductsData`, `saveSemiProduct`, `getSuppliers`, `addSupplier`, `editSupplier`, `getUsers`, `getUserById`, `addUser`, `getBaseIngredientsData`, `default`, `getConversionsData`, `updateConversion`, `getItemsData`, `updatePurchasedItem`, `getPurchaseOrdersData`, `savePurchaseOrder`, `default`, `getCategoriesWithCounts`, `getModifiersData`, `saveModifierAction`, `deleteModifierAction`, `default`, `default`, `default`, `default`, `default`, `POST`, `GET`
  * `findAllNoCache` -> Consumes: `getSheetsClient` -> Consumed by: `generateNewId`, `editOrder`, `DELETE`, `POST`, `GET`, `GET`, `POST`, `GET`
  * `getHeaders` -> Consumes: `getSheetsClient` -> Consumed by: `insert`, `insertMany`, `GET`
* **`lib/sheets.ts`**
  * `getSheetData` -> Consumed by: `getProducts`, `getRawMaterials`, `getOrders`
  * `appendRow` -> Consumed by: `createOrder`
  * `batchUpdateData`

## Actions (`app/actions/`)
* **`app/admin/brands/actions.ts`**
  * `getBrands` -> Consumes: `findAll` -> Consumed by: `default`
  * `addBrand` -> Consumes: `createEntity`
  * `editBrand` -> Consumes: `updateEntity`
  * `deleteBrand` -> Consumes: `deleteEntity` -> Consumed by: `DeleteBrandButton`
* **`app/admin/production/actions.ts`**
  * `getProductionData` -> Consumes: `findAll` -> Consumed by: `default`
  * `saveProductionOrder` -> Consumes: `fail`, `findAll`, `generateNewId`, `insert`, `ok` -> Consumed by: `ProductionForm`
* **`app/admin/promotions/actions.ts`**
  * `getPromotionsData` -> Consumes: `findAll` -> Consumed by: `default`
  * `savePromotion` -> Consumes: `update`, `ok`, `generateNewId`, `insert`, `fail` -> Consumed by: `PromotionForm`
  * `deletePromotionAction` -> Consumes: `remove`, `ok`, `fail` -> Consumed by: `default`
* **`app/admin/semi-products/actions.ts`**
  * `getSemiProductsData` -> Consumes: `findAll` -> Consumed by: `default`
  * `saveSemiProduct` -> Consumes: `fail`, `update`, `generateNewId`, `insert`, `findAll`, `ok` -> Consumed by: `SemiProductForm`
  * `deleteSemiProductAction` -> Consumes: `update`, `ok`, `fail`
* **`app/admin/suppliers/actions.ts`**
  * `getSuppliers` -> Consumes: `findAll` -> Consumed by: `default`
  * `addSupplier` -> Consumes: `fail`, `findAll`, `generateNewId`, `insert`, `ok`
  * `editSupplier` -> Consumes: `fail`, `findAll`, `update`, `ok`
  * `deleteSupplierAction` -> Consumes: `fail`, `deleteEntity` -> Consumed by: `DeleteSupplierButton`
* **`app/admin/users/actions.ts`**
  * `getUsers` -> Consumes: `findAll` -> Consumed by: `default`
  * `getUserById` -> Consumes: `findAll` -> Consumed by: `default`
  * `addUser` -> Consumes: `fail`, `findAll`, `generateNewId`, `insert`, `ok` -> Consumed by: `UserForm`
  * `deleteUserAction` -> Consumes: `fail`, `remove`, `ok` -> Consumed by: `DeleteUserButton`
  * `updateUser` -> Consumes: `fail`, `update`, `ok` -> Consumed by: `default`
* **`app/admin/inventory/base-ingredients/actions.ts`**
  * `getBaseIngredientsData` -> Consumes: `findAll` -> Consumed by: `default`
  * `addBaseIngredient` -> Consumes: `generateNewId`, `insert`, `ok`, `fail` -> Consumed by: `BaseIngredientForm`
  * `updateBaseIngredient` -> Consumes: `fail`, `update`, `ok` -> Consumed by: `BaseIngredientForm`
  * `deleteBaseIngredientAction` -> Consumes: `fail`, `remove`, `ok`
* **`app/admin/inventory/conversions/actions.ts`**
  * `getConversionsData` -> Consumes: `findAll` -> Consumed by: `default`
  * `addConversion` -> Consumes: `fail`, `generateNewId`, `insert`, `ok` -> Consumed by: `ConversionForm`
  * `updateConversion` -> Consumes: `fail`, `findAll`, `update`, `ok` -> Consumed by: `ConversionForm`
  * `deleteConversionAction` -> Consumes: `fail`, `remove`, `ok`
* **`app/admin/inventory/items/actions.ts`**
  * `getItemsData` -> Consumes: `findAll` -> Consumed by: `default`
  * `addPurchasedItem` -> Consumes: `fail`, `generateNewId`, `insert`, `ok` -> Consumed by: `PurchasedItemForm`
  * `updatePurchasedItem` -> Consumes: `update`, `findAll`, `generateNewId`, `insert`, `remove`, `ok`, `fail` -> Consumed by: `PurchasedItemForm`
  * `deletePurchasedItemAction` -> Consumes: `remove`, `ok`, `fail`
* **`app/admin/inventory/purchase-orders/actions.ts`**
  * `getPurchaseOrdersData` -> Consumes: `findAll` -> Consumed by: `default`
  * `savePurchaseOrder` -> Consumes: `fail`, `update`, `findAll`, `remove`, `generateNewId`, `insert`, `ok` -> Consumed by: `default`
  * `addPurchaseSource` -> Consumes: `fail`, `generateNewId`, `insert`, `ok` -> Consumed by: `default`
* **`app/admin/products/categories/actions.ts`**
  * `getCategoriesWithCounts` -> Consumes: `findAll` -> Consumed by: `default`
  * `saveCategory` -> Consumes: `fail`, `generateNewId`, `insert`, `ok`
  * `updateCategory` -> Consumes: `fail`, `update`, `ok`
  * `deleteCategory` -> Consumes: `fail`, `softDeleteEntity` -> Consumed by: `ProductCategoryForm`
* **`app/admin/products/modifiers/actions.ts`**
  * `getModifiersData` -> Consumes: `findAll` -> Consumed by: `default`
  * `saveModifierAction` -> Consumes: `fail`, `update`, `generateNewId`, `insert`, `findAll`, `ok` -> Consumed by: `ModifierForm`
  * `deleteModifierAction` -> Consumes: `fail`, `update`, `findAll`, `ok`

## Shared Components (`components/`)
* **`components/CategoryPieChart.tsx`**
  * `default`
* **`components/EditUserForm.tsx`**
  * `default` -> Consumes: `updateUser`
* **`components/HistoryModal.tsx`**
  * `default`
* **`components/InventoryForms.tsx`**
  * `ItemCategoryForm` -> Consumes: `updateItemCategory`, `addItemCategory`
  * `BaseIngredientForm` -> Consumes: `updateBaseIngredient`, `addBaseIngredient`
  * `PurchasedItemForm` -> Consumes: `updatePurchasedItem`, `addPurchasedItem`
  * `ConversionForm` -> Consumes: `updateConversion`, `addConversion`
  * `ActionGroup`
  * `DeleteBtn`
* **`components/ModifierForm.tsx`**
  * `default` -> Consumes: `saveModifier`, `deleteModifier`
* **`components/POSScreen.tsx`**
  * `default` -> Consumes: `submitOrder`
* **`components/ProductCategoryForm.tsx`**
  * `default` -> Consumes: `updateProductCategory`, `saveProductCategory`, `deleteProductCategory`
* **`components/ProductForm.tsx`**
  * `default` -> Consumes: `saveProduct`, `deleteProduct`
* **`components/ProductionForm.tsx`**
  * `default` -> Consumes: `saveProductionOrder`
* **`components/PromotionForm.tsx`**
  * `default` -> Consumes: `savePromotion`
* **`components/PurchaseOrderForm.tsx`**
  * `default` -> Consumes: `savePurchaseOrder`, `addPurchaseSource`
* **`components/SalesCharts.tsx`**
  * `default`
* **`components/SalesFilter.tsx`**
  * `default`
* **`components/SearchableSelect.tsx`**
  * `SearchableSelect`
* **`components/SemiProductForm.tsx`**
  * `default` -> Consumes: `saveSemiProduct`
* **`components/SessionProvider.tsx`**
  * `default`
* **`components/StickyFilterBar.tsx`**
  * `default`
* **`components/StockTable.tsx`**
  * `default` -> Consumes: `submitStockAdjustment`, `approveStockAdjustment`
* **`components/SupplierForm.tsx`**
  * `SupplierForm` -> Consumes: `addSupplier`
  * `SupplierModal` -> Consumes: `addSupplier`
  * `DeleteSupplierButton` -> Consumes: `deleteSupplier`
* **`components/UserForm.tsx`**
  * `UserForm` -> Consumes: `addUser`
  * `DeleteUserButton` -> Consumes: `deleteUser`
* **`components/ui/DeleteConfirmModal.tsx`**
  * `DeleteConfirmModal`
* **`components/ui/FormModal.tsx`**
  * `FormModal`
* **`components/ui/LoadingButton.tsx`**
  * `LoadingButton`

