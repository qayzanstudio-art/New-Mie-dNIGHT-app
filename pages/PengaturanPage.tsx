
import React, { useState } from 'react';
import type { AppData, Settings, MenuItem, Topping, Drink, InventoryItem } from '../types';

interface PengaturanPageProps {
    data: AppData;
    setData: React.Dispatch<React.SetStateAction<AppData>>;
    helpers: {
        showModal: (config: any) => void;
        showToast: (message: string) => void;
        generateMenuIdeas: (prompt: string) => Promise<string | null>;
    }
}

type EditableItem = MenuItem | Topping | Drink | InventoryItem;
type ItemType = 'menu' | 'toppings' | 'drinks' | 'inventory';

const PengaturanPage: React.FC<PengaturanPageProps> = ({ data, setData, helpers }) => {
    const [isGeminiLoading, setIsGeminiLoading] = useState(false);
    
    const handleSettingChange = (field: keyof Settings, value: string) => {
        setData(prev => ({
            ...prev,
            settings: { ...prev.settings, [field]: value }
        }));
    };
    
    const handleItemChange = (type: ItemType, id: string, field: string, value: string | number) => {
        setData(prev => {
            const items = [...prev[type]] as EditableItem[];
            const itemIndex = items.findIndex(item => item.id === id);
            if (itemIndex > -1) {
                (items[itemIndex] as any)[field] = value;
            }
            return { ...prev, [type]: items };
        });
    };
    
    const handleAddNewItem = (type: ItemType, isStock: boolean) => {
        const newItem = isStock ? 
            { id: `stock-${Date.now()}`, name: 'Item Baru', quantity: 0, minStock: 5 } : 
            { id: `${type.slice(0, 3)}-${Date.now()}`, name: 'Item Baru', price: 0, stockId: '' };
        
        setData(prev => ({ ...prev, [type]: [...prev[type], newItem] as any }));
        helpers.showToast('Item baru ditambahkan!');
    };

    const handleDeleteItem = (type: ItemType, id: string) => {
        helpers.showModal({
            title: 'Hapus Item',
            body: <p className="text-gray-800">Yakin ingin hapus item ini?</p>,
            confirmText: 'Ya, Hapus',
            onConfirm: () => {
                setData(prev => {
                    const newItems = (prev[type] as EditableItem[]).filter(item => item.id !== id);
                    return { ...prev, [type]: newItems };
                });
                helpers.showToast('Item dihapus.');
            }
        });
    };

    const handleGetMenuIdeas = async () => {
        setIsGeminiLoading(true);
        helpers.showModal({
            title: '✨ Gemini Bekerja...',
            body: `<p class="text-center text-gray-600">Mencari ide menu baru...</p><div class="flex justify-center items-center p-4"><div class="animate-spin rounded-full h-12 w-12 border-b-4" style="border-color: var(--color-primary);"></div></div>`,
            hideButtons: true
        });

        const existingMenu = data.menu.map(m => m.name).join(', ');
        const prompt = `Anda adalah seorang chef spesialis mie instan. Berikan 5 ide menu baru yang kreatif untuk warmindo di Indonesia, hindari menu yang sudah ada: ${existingMenu}. Untuk setiap ide, berikan: Nama Menu, Topping unik, dan Perkiraan harga jual (Rupiah). Format sebagai daftar bernomor. Contoh: 1. **Nama:** Mie Goreng Sambal Matah\\n**Topping:** Ayam suwir, sambal matah segar.\\n**Harga:** Rp 15.000`;
        const result = await helpers.generateMenuIdeas(prompt);
        setIsGeminiLoading(false);

        if (result) {
            helpers.showModal({
                title: '✨ Ide Menu Baru dari Gemini',
                body: <div className="text-left space-y-4 text-gray-800 max-h-96 overflow-y-auto" dangerouslySetInnerHTML={{ __html: result.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />,
                confirmText: 'Mantap!'
            });
        } else {
             helpers.showModal({ title: 'Terjadi Kesalahan', body: <p className="text-gray-800">Tidak dapat menghubungi Gemini API.</p>, confirmText: 'Tutup' });
        }
    };
    
    const renderCard = (title: string, type: ItemType, items: EditableItem[], isStock = false) => (
        <div className="bg-white p-4 rounded-lg card-shadow text-on-secondary">
            <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold border-b pb-2 flex-grow">{title}</h2>{type === 'menu' && <button onClick={handleGetMenuIdeas} disabled={isGeminiLoading} className="gemini-idea-btn ml-4 bg-gradient-to-r from-green-400 to-blue-500 text-white font-bold py-1 px-3 rounded-lg shadow-md hover:from-green-500 hover:to-blue-600 transition text-sm">Cari Ide Baru ✨</button>}</div>
            <div className="space-y-2 mb-4">
                {items.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded bg-gray-50 text-gray-800">
                        <input onChange={e => handleItemChange(type, item.id, 'name', e.target.value)} className="setting-input font-semibold bg-transparent w-2/5" value={item.name} />
                        {isStock ? (
                           <div><span className="text-sm">Min: </span><input type="number" onChange={e => handleItemChange(type, item.id, 'minStock', parseInt(e.target.value))} className="setting-input bg-transparent w-16" value={(item as InventoryItem).minStock} /></div>
                        ) : (
                           <input type="number" onChange={e => handleItemChange(type, item.id, 'price', parseInt(e.target.value))} className="setting-input text-right bg-transparent w-24" value={(item as MenuItem).price} />
                        )}
                        <button onClick={() => handleDeleteItem(type, item.id)} className="delete-item-btn text-red-500 hover:text-red-700 text-lg">&times;</button>
                    </div>
                ))}
            </div>
            <button onClick={() => handleAddNewItem(type, isStock)} className="add-new-item-btn w-full btn-primary font-semibold py-2 rounded-lg hover:btn-primary-dark transition">Tambah Baru</button>
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-4 rounded-lg card-shadow text-on-secondary md:col-span-2 lg:col-span-3">
                <h2 className="text-xl font-bold mb-4 border-b pb-2">Kustomisasi Tampilan</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="space-y-4">
                        <div><label className="block text-sm font-medium">Warna Utama (Header, Tombol)</label><input type="color" onChange={e => handleSettingChange('primaryColor', e.target.value)} className="mt-1 h-10 w-full" value={data.settings.primaryColor} /></div>
                        <div><label className="block text-sm font-medium">Warna Background</label><input type="color" onChange={e => handleSettingChange('secondaryColor', e.target.value)} className="mt-1 h-10 w-full" value={data.settings.secondaryColor} /></div>
                    </div>
                    <div><label className="block text-sm font-medium">URL Gambar Background (Opsional)</label><input type="text" onChange={e => handleSettingChange('backgroundImage', e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md text-gray-800" placeholder="Contoh: https://.../gambar.jpg" value={data.settings.backgroundImage} /><p className="text-xs text-gray-500 mt-1">Kosongkan jika tidak ingin pakai gambar background.</p></div>
                </div>
            </div>
            {renderCard('Menu Utama', 'menu', data.menu)}
            {renderCard('Topping', 'toppings', data.toppings)}
            {renderCard('Minuman', 'drinks', data.drinks)}
            {renderCard('Item Stok', 'inventory', data.inventory, true)}
        </div>
    );
};

export default PengaturanPage;
