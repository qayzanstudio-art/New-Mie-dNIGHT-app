import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Tab, AppData, Order, Transaction, InventoryItem, MenuItem, Settings, ModalState, ToastState } from './types';
import { generateDailySummary, generateMenuIdeas } from './services/geminiService';
import KasirPage from './pages/KasirPage';
import PesananPage from './pages/PesananPage';
import LaporanPage from './pages/LaporanPage';
import StokPage from './pages/StokPage';
import PengaturanPage from './pages/PengaturanPage';
import QayzanStudioPage from './pages/QayzanStudioPage';
import { Header } from './components/Header';
import { Modal } from './components/Modal';
import { Toast } from './components/Toast';

// --- UTILS ---
export const Utils = {
    formatCurrency: (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount),
    formatDate: (iso: string | null) => { if (!iso) return '-'; return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }); },
    formatTime: (iso: string | null) => { if (!iso) return '-'; return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.',':'); },
    getTodayDateString: () => new Date().toISOString().slice(0, 10),
    /**
     * Determines the business date string (YYYY-MM-DD) for a given date.
     * Considers times before 6 AM to belong to the previous calendar day.
     * @param date The date object to check. Defaults to now.
     * @returns The ISO date string (YYYY-MM-DD) of the business day.
     */
    getBusinessDateString: (date: Date = new Date()): string => {
        const checkDate = new Date(date);
        // If it's before 6 AM, it belongs to the previous day's business
        if (checkDate.getHours() < 6) {
            checkDate.setDate(checkDate.getDate() - 1);
        }
        return checkDate.toISOString().slice(0, 10);
    },
    getContrastYIQ: (hex: string) => {
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return ((r*299)+(g*587)+(b*114))/1000 >= 128 ? '#1A202C' : '#FFFFFF';
    },
    adjustColor: (color: string, percent: number) => {
        let f=parseInt(color.slice(1),16),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
        return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
    },
};

const getDefaultData = (): AppData => ({
    menu: [
        { id: 'menu-1', name: 'Mie Goreng', price: 10000, stockId: 'stock-1' },
        { id: 'menu-2', name: 'Mie Kuah', price: 10000, stockId: 'stock-1' },
        { id: 'menu-3', name: 'Mie Double', price: 16000, stockId: 'stock-1', qty: 2 },
        { id: 'menu-4', name: 'Mie Bangladesh', price: 16000, stockId: 'stock-1' },
        { id: 'menu-5', name: 'Nasi Ayam Panggang Besar', price: 27000, stockId: 'stock-8' },
        { id: 'menu-6', name: 'Nasi Ayam Panggang Kecil', price: 20000, stockId: 'stock-8' },
    ],
    toppings: [
        { id: 'top-1', name: 'Sosis', price: 3000, stockId: 'stock-2' },
        { id: 'top-2', name: 'Pangsit', price: 1000, stockId: 'stock-3' },
        { id: 'top-3', name: 'Bakso 3 pcs', price: 6000, stockId: 'stock-4', qty: 3 },
        { id: 'top-4', name: 'Tahu', price: 2000, stockId: 'stock-5' },
        { id: 'top-5', name: 'Telur Mata Sapi', price: 3000, stockId: 'stock-7' },
        { id: 'top-6', name: 'Telur Dadar', price: 3000, stockId: 'stock-7' },
    ],
    drinks: [ { id: 'drink-1', name: 'Air Mineral', price: 5000, stockId: 'stock-6' } ],
    inventory: [
        { id: 'stock-1', name: 'Indomie (bks)', quantity: 40, minStock: 10 },
        { id: 'stock-2', name: 'Sosis (pcs)', quantity: 50, minStock: 10 },
        { id: 'stock-3', name: 'Pangsit (pcs)', quantity: 50, minStock: 10 },
        { id: 'stock-4', name: 'Bakso (biji)', quantity: 30, minStock: 9 },
        { id: 'stock-5', name: 'Tahu (pcs)', quantity: 20, minStock: 5 },
        { id: 'stock-6', name: 'Air Mineral (btl)', quantity: 24, minStock: 5 },
        { id: 'stock-7', name: 'Telur (butir)', quantity: 30, minStock: 10 },
        { id: 'stock-8', name: 'Nasi Ayam Panggang (porsi)', quantity: 20, minStock: 5 },
    ],
    transactions: [], 
    expenses: [],
    settings: { primaryColor: '#146b61', secondaryColor: '#FDFBF6', backgroundImage: '' },
    dailyCash: [],
    dailyLogs: [],
    qayzanStudio: { daily: [], monthly: [] }
});


const getNewOrder = (): Order => ({
    id: null, items: [], customerName: '', payment: { status: 'Belum Bayar', method: 'Cash' }, delivered: false, createdAt: null, total: 0
});

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('kasir');
    const [isQayzanStudioUnlocked, setIsQayzanStudioUnlocked] = useState(false);
    
    const [data, setData] = useState<AppData>(() => {
        try {
            const savedData = localStorage.getItem('warmindoAppData');
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                const defaults = getDefaultData();
                // Ensure new fields exist on old data
                const mergedData = {
                    ...defaults,
                    ...parsedData,
                    settings: { ...defaults.settings, ...parsedData.settings },
                    dailyLogs: parsedData.dailyLogs || [],
                    qayzanStudio: parsedData.qayzanStudio || { daily: [], monthly: [] },
                };
                // Clean up obsolete fields
                delete (mergedData as any).historicalData;
                delete (mergedData as any).previousTotalRevenue;
                return mergedData;
            }
        } catch (error) {
            console.error("Failed to load data from localStorage", error);
        }
        return getDefaultData();
    });
    
    const [currentOrder, setCurrentOrder] = useState<Order>(getNewOrder());
    const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', body: null });
    const [toastState, setToastState] = useState<ToastState>({ isVisible: false, message: '' });

    // --- Local Storage and Theme Sync ---
    useEffect(() => {
        try {
            localStorage.setItem('warmindoAppData', JSON.stringify(data));
        } catch (error) {
            console.error("Failed to save data to localStorage", error);
        }
    }, [data]);
    
    useEffect(() => {
        const { settings } = data;
        const root = document.documentElement;
        const darkPrimary = Utils.adjustColor(settings.primaryColor, -20);
        const darkSecondary = Utils.adjustColor(settings.secondaryColor, -5);
        
        root.style.setProperty('--color-primary', settings.primaryColor);
        root.style.setProperty('--color-primary-dark', darkPrimary);
        root.style.setProperty('--color-secondary', settings.secondaryColor);
        root.style.setProperty('--color-secondary-dark', darkSecondary);
        root.style.setProperty('--color-text-on-primary', Utils.getContrastYIQ(settings.primaryColor));
        root.style.setProperty('--color-text-on-secondary', Utils.getContrastYIQ(settings.secondaryColor));
        root.style.setProperty('--background-image', settings.backgroundImage ? `url('${settings.backgroundImage}')` : 'none');
    }, [data.settings]);

    // --- Security: Re-lock Qayzan Studio on tab change ---
    useEffect(() => {
        if (activeTab !== 'qayzan') {
            setIsQayzanStudioUnlocked(false);
        }
    }, [activeTab]);


    // --- UI Handlers ---
    const showToast = useCallback((message: string) => {
        setToastState({ message, isVisible: true });
        setTimeout(() => setToastState({ message: '', isVisible: false }), 3000);
    }, []);

    const showModal = useCallback((modalConfig: Omit<ModalState, 'isOpen'>) => {
        setModalState({ ...modalConfig, isOpen: true });
    }, []);

    const hideModal = useCallback(() => {
        setModalState(prev => ({...prev, isOpen: false}));
    }, []);

    // --- Data Access Helpers ---
    const getItemById = useCallback(<T extends { id: string }>(type: keyof AppData, id: string): T | undefined => {
        const items = data[type] as unknown as T[];
        return items?.find(item => item.id === id);
    }, [data]);
    
    const getStockItemById = useCallback((id: string): InventoryItem | undefined => {
        return data.inventory.find(item => item.id === id);
    }, [data.inventory]);

    const helpers = useMemo(() => ({
        getItemById,
        getStockItemById,
        showToast,
        showModal,
        hideModal,
        generateDailySummary,
        generateMenuIdeas
    }), [getItemById, getStockItemById, showToast, showModal, hideModal]);
    
    // --- Page Rendering ---
    const renderPage = () => {
        const pageProps = { data, setData, currentOrder, setCurrentOrder, helpers };
        switch (activeTab) {
            case 'kasir': return <KasirPage {...pageProps} />;
            case 'pesanan': return <PesananPage {...pageProps} setActiveTab={setActiveTab} />;
            case 'laporan': return <LaporanPage {...pageProps} />;
            case 'stok': return <StokPage {...pageProps} />;
            case 'pengaturan': return <PengaturanPage {...pageProps} />;
            case 'qayzan': return <QayzanStudioPage {...pageProps} isUnlocked={isQayzanStudioUnlocked} setIsUnlocked={setIsQayzanStudioUnlocked} />;
            default: return <KasirPage {...pageProps} />;
        }
    };
    
    return (
        <div className="min-h-screen flex flex-col bg-secondary/80 backdrop-blur-sm">
            <style>
            {`
                :root {
                    --color-primary: #2D3748;
                    --color-primary-dark: #1A202C;
                    --color-secondary: #FDFBF6;
                    --color-secondary-dark: #F3EFEA;
                    --color-text-on-primary: #FFFFFF;
                    --color-text-on-secondary: #1A202C;
                }
                .tab-btn.active {
                    border-bottom-width: 4px;
                    color: var(--color-text-on-primary);
                    border-color: var(--color-text-on-primary);
                }
                .tab-btn { transition: all 0.3s ease; }
                .tab-btn:hover { border-color: var(--color-text-on-primary); }
                .bg-primary { background-color: var(--color-primary); }
                .hover\\:bg-primary-dark:hover { background-color: var(--color-primary-dark) !important; }
                .text-on-primary { color: var(--color-text-on-primary); }
                .bg-secondary { background-color: var(--color-secondary); }
                .bg-secondary-dark { background-color: var(--color-secondary-dark); }
                .text-on-secondary { color: var(--color-text-on-secondary); }
                .focus\\:ring-primary:focus { box-shadow: 0 0 0 2px var(--color-primary); border-color: var(--color-primary); }
                .card-shadow { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); }
                .btn-primary { background-color: var(--color-primary); color: var(--color-text-on-primary); }
                .hover\\:btn-primary-dark:hover { background-color: var(--color-primary-dark); }
            `}
            </style>
            <Header activeTab={activeTab} setActiveTab={setActiveTab} />
            <main className="container mx-auto p-4 flex-grow">
                {renderPage()}
            </main>
            <Modal {...modalState} onClose={hideModal} />
            <Toast {...toastState} />
        </div>
    );
};

export default App;