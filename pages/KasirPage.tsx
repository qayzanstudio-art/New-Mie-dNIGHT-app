import React, { useMemo, useCallback } from 'react';
import type { AppData, Order, MenuItem, Topping, Drink, OrderItem } from '../types';
import { Utils } from '../App';

// Fix: Add `setData` to component props to enable state updates.
interface KasirPageProps {
    data: AppData;
    setData: React.Dispatch<React.SetStateAction<AppData>>;
    currentOrder: Order;
    setCurrentOrder: React.Dispatch<React.SetStateAction<Order>>;
    helpers: {
        getStockItemById: (id: string) => any;
        showToast: (message: string) => void;
    }
}

const getNewOrder = (): Order => ({
    id: null, items: [], customerName: '', payment: { status: 'Belum Bayar', method: 'Cash' }, delivered: false, createdAt: null, total: 0
});

const KasirPage: React.FC<KasirPageProps> = ({ data, setData, currentOrder, setCurrentOrder, helpers }) => {
    const { getStockItemById, showToast } = helpers;

    const calculateTotal = useCallback((items: OrderItem[]) => items.reduce((sum, item) => sum + (item.price * item.quantity), 0), []);

    const handleAddItem = useCallback((itemToAdd: MenuItem | Topping | Drink) => {
        const stockItem = getStockItemById(itemToAdd.stockId);
        
        setCurrentOrder(prevOrder => {
            const itemInCart = prevOrder.items.find(item => item.id === itemToAdd.id);
            const quantityInCart = itemInCart ? itemInCart.quantity : 0;
            const stockNeeded = (quantityInCart + 1) * (itemToAdd.qty || 1);

            if (stockItem && stockItem.quantity < stockNeeded) {
                showToast(`Stok ${stockItem.name} tidak cukup!`);
                return prevOrder;
            }

            let orderToUpdate = { ...prevOrder };
            if (!orderToUpdate.id && orderToUpdate.items.length === 0) {
                orderToUpdate.createdAt = new Date().toISOString();
                orderToUpdate.id = `TRX-${Date.now()}`;
            }

            const existingItemIndex = orderToUpdate.items.findIndex(item => item.id === itemToAdd.id);
            let newItems;
            if (existingItemIndex > -1) {
                newItems = [...orderToUpdate.items];
                newItems[existingItemIndex] = { ...newItems[existingItemIndex], quantity: newItems[existingItemIndex].quantity + 1 };
            } else {
                newItems = [...orderToUpdate.items, { ...itemToAdd, quantity: 1 }];
            }

            return {
                ...orderToUpdate,
                items: newItems,
                total: calculateTotal(newItems),
            };
        });
    }, [getStockItemById, setCurrentOrder, showToast, calculateTotal]);

    const handleIncrementItem = useCallback((itemId: string) => {
        setCurrentOrder(prevOrder => {
            const itemToIncrement = prevOrder.items.find(item => item.id === itemId);
            if (!itemToIncrement) return prevOrder;

            const stockItem = getStockItemById(itemToIncrement.stockId);
            const stockNeeded = (itemToIncrement.quantity + 1) * (itemToIncrement.qty || 1);

            if (stockItem && stockItem.quantity < stockNeeded) {
                showToast(`Stok ${stockItem.name} tidak cukup!`);
                return prevOrder;
            }

            const newItems = prevOrder.items.map(item => 
                item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item
            );

            return { ...prevOrder, items: newItems, total: calculateTotal(newItems) };
        });
    }, [getStockItemById, setCurrentOrder, showToast, calculateTotal]);

    const handleDecrementItem = useCallback((itemId: string) => {
        setCurrentOrder(prevOrder => {
            const newItems = prevOrder.items
                .map(item => {
                    if (item.id === itemId) {
                        if (item.quantity > 1) {
                            return { ...item, quantity: item.quantity - 1 };
                        }
                        return null; // Mark for removal
                    }
                    return item;
                })
                .filter((item): item is OrderItem => item !== null); // Filter out nulls

            return { ...prevOrder, items: newItems, total: calculateTotal(newItems) };
        });
    }, [setCurrentOrder, calculateTotal]);
    
    const handleOrderChange = (field: keyof Order, value: any) => {
        setCurrentOrder(prev => ({ ...prev, [field]: value }));
    };

    const handlePaymentChange = (field: 'status' | 'method', value: string) => {
        setCurrentOrder(prev => ({
            ...prev,
            payment: { ...prev.payment, [field]: value }
        }));
    };

    const processOrder = () => {
      // Logic for processing order is in PesananPage as it modifies global state
      // For simplicity in this structure, we'll keep it there.
      // This is a placeholder for the logic that would be moved to the App component.
    };

    const isEditMode = useMemo(() => currentOrder.id && data.transactions.some(t => t.id === currentOrder.id), [currentOrder.id, data.transactions]);

    const renderMenuSelection = () => {
        const renderItems = (items: (MenuItem | Topping | Drink)[], type: 'menu' | 'toppings' | 'drinks') => items.map(item => (
            <button key={item.id} onClick={() => handleAddItem(item)} className={`p-3 rounded-lg text-center shadow transition ${type === 'menu' ? 'btn-primary hover:btn-primary-dark' : 'bg-secondary-dark text-on-secondary hover:bg-white'}`}>
                <span className="font-semibold">{type === 'toppings' ? '+ ' : ''}{item.name}</span><br /><span className="text-sm">{Utils.formatCurrency(item.price)}</span>
            </button>
        ));

        return (
            <div className="bg-white p-4 rounded-lg card-shadow text-on-secondary">
                <h2 className="text-xl font-bold mb-4 border-b pb-2">Pilih Menu</h2>
                <div className="mb-4"><h3 className="font-semibold text-lg mb-2">Menu Utama</h3><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{renderItems(data.menu, 'menu')}</div></div>
                <div className="mb-4"><h3 className="font-semibold text-lg mb-2">Topping</h3><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{renderItems(data.toppings, 'toppings')}</div></div>
                <div><h3 className="font-semibold text-lg mb-2">Minuman</h3><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{renderItems(data.drinks, 'drinks')}</div></div>
            </div>
        );
    };

    // Fix: This sub-component now uses `setData` from its closure scope, removing the need for a faulty Context implementation.
    const PesananPageActions = () => {
        const handleProcessOrder = () => {
             if (!currentOrder.items.some(item => data.menu.some(m => m.id === item.id))) {
                showToast('Pesanan harus memiliki menu utama!');
                return;
            }

            setData(prevData => {
                const newTransactions = [...prevData.transactions];
                let newInventory = [...prevData.inventory];
                const existingIndex = newTransactions.findIndex(t => t.id === currentOrder.id);
                const isUpdating = existingIndex !== -1;
                const orderToSave = JSON.parse(JSON.stringify(currentOrder));

                // Stock reduction logic
                const shouldReduceStock = !isUpdating || (isUpdating && orderToSave.payment.status === 'Sudah Bayar' && newTransactions[existingIndex].payment.status !== 'Sudah Bayar');

                if (shouldReduceStock) {
                    const stockAdjustments: { [key: string]: number } = {};
                    let stockSufficient = true;
                    orderToSave.items.forEach((item: OrderItem) => { if (item.stockId) stockAdjustments[item.stockId] = (stockAdjustments[item.stockId] || 0) + (item.qty || 1) * item.quantity; });

                    for (const stockId in stockAdjustments) {
                        const stockItemIndex = newInventory.findIndex(i => i.id === stockId);
                        if (stockItemIndex === -1 || newInventory[stockItemIndex].quantity < stockAdjustments[stockId]) {
                            showToast(`Stok ${newInventory[stockItemIndex]?.name || 'item'} tidak cukup!`);
                            stockSufficient = false;
                            break;
                        }
                    }

                    if (!stockSufficient) return prevData; // Abort update

                    for (const stockId in stockAdjustments) {
                        const stockItemIndex = newInventory.findIndex(i => i.id === stockId);
                        if (stockItemIndex > -1) {
                            newInventory[stockItemIndex] = { ...newInventory[stockItemIndex], quantity: newInventory[stockItemIndex].quantity - stockAdjustments[stockId] };
                        }
                    }
                }

                if (isUpdating) {
                    newTransactions[existingIndex] = orderToSave;
                } else {
                    newTransactions.unshift(orderToSave);
                }
                
                showToast(isUpdating ? 'Pesanan diperbarui!' : 'Pesanan diproses!');
                setCurrentOrder(getNewOrder());

                return { ...prevData, transactions: newTransactions, inventory: newInventory };
            });
        };

        const handleClearOrder = () => {
            setCurrentOrder(getNewOrder());
        };

        return (
            <>
                <button onClick={handleProcessOrder} disabled={currentOrder.items.length === 0} className="w-full btn-primary font-bold py-3 rounded-lg shadow hover:btn-primary-dark transition disabled:bg-gray-400">
                    {isEditMode ? 'Simpan Perubahan' : 'Proses Pesanan'}
                </button>
                <button onClick={handleClearOrder} className="w-full bg-gray-200 text-gray-700 font-bold py-2 rounded-lg shadow hover:bg-gray-300 transition mt-2">
                    {isEditMode ? 'Batal Edit / Pesanan Baru' : 'Reset'}
                </button>
            </>
        );
    };

    const renderOrderSummary = () => (
        <div className="bg-white p-4 rounded-lg card-shadow self-start sticky top-24 text-on-secondary">
            {isEditMode && <div className="p-2 mb-3 bg-yellow-200 text-yellow-800 text-center font-bold rounded-md text-sm">MODE EDIT</div>}
            <h2 className="text-xl font-bold mb-4 border-b pb-2">Pesanan Saat Ini</h2>
            <div className="mb-3"><label htmlFor="customerName" className="block text-sm font-medium">Nama/Nomor Meja</label><input type="text" id="customerName" value={currentOrder.customerName} onChange={(e) => handleOrderChange('customerName', e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-primary sm:text-sm text-white" /></div>
            <div className="mb-4 max-h-60 overflow-y-auto pr-2">
                {currentOrder.items.length > 0 ? currentOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-dashed">
                        <div className="flex-grow">
                            <span className="text-sm font-semibold">{item.name}</span>
                            <div className="text-xs text-gray-500">{Utils.formatCurrency(item.price)}</div>
                        </div>
                        <div className="flex items-center gap-2 mx-2">
                            <button onClick={() => handleDecrementItem(item.id)} className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-300 transition">-</button>
                            <span className="font-bold w-4 text-center">{item.quantity}</span>
                            <button onClick={() => handleIncrementItem(item.id)} className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-300 transition">+</button>
                        </div>
                        <div className="text-sm font-semibold w-20 text-right">{Utils.formatCurrency(item.price * item.quantity)}</div>
                    </div>
                )) : <p className="text-sm text-gray-500 text-center py-4">Belum ada item dipilih.</p>}
            </div>
            <div className="border-t pt-4">
                <div className="flex justify-between font-bold text-lg mb-4"><span>TOTAL</span><span>{Utils.formatCurrency(currentOrder.total)}</span></div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <div><label className="block text-sm font-medium">Status</label><select value={currentOrder.payment.status} onChange={(e) => handlePaymentChange('status', e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-primary sm:text-sm text-white"><option className="text-gray-900">Belum Bayar</option><option className="text-gray-900">Sudah Bayar</option></select></div>
                    <div><label className="block text-sm font-medium">Metode</label><select value={currentOrder.payment.method} onChange={(e) => handlePaymentChange('method', e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-primary sm:text-sm text-white"><option className="text-gray-900">Cash</option><option className="text-gray-900">QRIS</option></select></div>
                </div>
                <div className="flex items-center mb-4">
                    <input type="checkbox" id="deliveredStatus" checked={currentOrder.delivered} onChange={(e) => handleOrderChange('delivered', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <label htmlFor="deliveredStatus" className="ml-2 block text-sm font-medium">Sudah Diantar</label>
                </div>
                <PesananPageActions />
            </div>
        </div>
    );
    
    // Fix: Removed incorrect PageContext implementation.
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">{renderMenuSelection()}</div>
            <div>{renderOrderSummary()}</div>
        </div>
    );
};

export default KasirPage;