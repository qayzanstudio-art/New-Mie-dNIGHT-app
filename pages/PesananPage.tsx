import React, { useState, useMemo } from 'react';
import type { AppData, Transaction, Order, Tab, OrderItem } from '../types';
import { Utils } from '../App';

interface PesananPageProps {
    data: AppData;
    setData: React.Dispatch<React.SetStateAction<AppData>>;
    setCurrentOrder: React.Dispatch<React.SetStateAction<Order>>;
    setActiveTab: (tab: Tab) => void;
    helpers: {
        showModal: (config: any) => void;
        showToast: (message: string) => void;
    };
    isTodayClosed: boolean;
    handleCloseDay: () => void;
    businessDate: string;
}

const PesananPage: React.FC<PesananPageProps> = ({ data, setData, setCurrentOrder, setActiveTab, helpers, isTodayClosed, handleCloseDay, businessDate }) => {
    const [filters, setFilters] = useState({ date: businessDate, status: 'Semua', method: 'Semua', name: '', delivered: 'Semua' });

    const filteredTransactions = useMemo(() => {
        let transactions = data.transactions;
        if (filters.date) transactions = transactions.filter(t => t.createdAt && t.createdAt.startsWith(filters.date));
        if (filters.status !== 'Semua') transactions = transactions.filter(t => t.payment.status === filters.status);
        if (filters.method !== 'Semua') transactions = transactions.filter(t => t.payment.method === filters.method);
        if (filters.name) transactions = transactions.filter(t => t.customerName.toLowerCase().includes(filters.name.toLowerCase()));
        if (filters.delivered !== 'Semua') {
            const deliveredStatus = filters.delivered === 'Sudah Diantar';
            transactions = transactions.filter(t => t.delivered === deliveredStatus);
        }
        return transactions;
    }, [data.transactions, filters]);
    
    const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const handleEdit = (transaction: Transaction) => {
        // The check for isTodayClosed is handled on the Kasir page
        // to allow editing but prevent creation of new orders.
        // This allows users to enter monitoring mode and still correct past data.
        setCurrentOrder(JSON.parse(JSON.stringify(transaction)));
        setActiveTab('kasir');
    };
    
    const handleToggleDelivered = (transactionId: string) => {
        setData(prevData => {
            const newTransactions = prevData.transactions.map(t => {
                if (t.id === transactionId) {
                    return { ...t, delivered: !t.delivered };
                }
                return t;
            });
            return { ...prevData, transactions: newTransactions };
        });
        helpers.showToast('Status antar diperbarui!');
    };

    const handleCancel = (transactionId: string) => {
        helpers.showModal({
            title: 'Konfirmasi Pembatalan',
            body: <p className="text-gray-800">Yakin membatalkan pesanan ini? Stok akan dikembalikan jika sudah terbayar.</p>,
            confirmText: 'Ya, Batalkan',
            onConfirm: () => {
                setData(prevData => {
                    const index = prevData.transactions.findIndex(t => t.id === transactionId);
                    if (index === -1) return prevData;
                    
                    const trx = prevData.transactions[index];
                    let newInventory = [...prevData.inventory];

                    if (trx.payment.status === 'Sudah Bayar') {
                        trx.items.forEach((item: OrderItem) => {
                            if (item.stockId) {
                                const stockIndex = newInventory.findIndex(s => s.id === item.stockId);
                                if (stockIndex > -1) {
                                    newInventory[stockIndex].quantity += (item.qty || 1) * item.quantity;
                                }
                            }
                        });
                    }

                    const newTransactions = prevData.transactions.filter(t => t.id !== transactionId);
                    helpers.showToast('Pesanan dibatalkan.');
                    return { ...prevData, transactions: newTransactions, inventory: newInventory };
                });
            }
        });
    };
    
    const confirmCloseDay = () => {
        helpers.showModal({
            title: 'Konfirmasi Tutup Hari Ini',
            body: (
                <div className="text-gray-800">
                    <p className="mb-2">Anda yakin ingin menutup penjualan untuk hari ini?</p>
                    <p className="text-sm font-semibold">Tindakan ini akan memfinalisasi laporan penjualan hari ini dan tidak dapat dibatalkan.</p>
                </div>
            ),
            confirmText: 'Ya, Tutup Hari Ini',
            onConfirm: handleCloseDay,
        });
    };

    return (
        <div className="bg-white p-4 rounded-lg card-shadow text-on-secondary">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h2 className="text-xl font-bold">Daftar Pesanan</h2>
                <button
                    onClick={confirmCloseDay}
                    disabled={isTodayClosed}
                    className="bg-orange-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isTodayClosed ? 'Hari Ini Sudah Ditutup' : 'Tutup Hari Ini (Close Order)'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 p-4 bg-gray-50 rounded-lg text-gray-800">
                <div><label className="text-sm font-medium">Tanggal</label><input type="date" value={filters.date} onChange={e => handleFilterChange('date', e.target.value)} className="mt-1 w-full border-gray-300 rounded-md" /></div>
                <div><label className="text-sm font-medium">Status Bayar</label><select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="mt-1 w-full border-gray-300 rounded-md"><option>Semua</option><option>Sudah Bayar</option><option>Belum Bayar</option></select></div>
                <div><label className="text-sm font-medium">Status Antar</label><select value={filters.delivered} onChange={e => handleFilterChange('delivered', e.target.value)} className="mt-1 w-full border-gray-300 rounded-md"><option>Semua</option><option>Sudah Diantar</option><option>Belum Diantar</option></select></div>
                <div><label className="text-sm font-medium">Metode</label><select value={filters.method} onChange={e => handleFilterChange('method', e.target.value)} className="mt-1 w-full border-gray-300 rounded-md"><option>Semua</option><option>Cash</option><option>QRIS</option></select></div>
                <div><label className="text-sm font-medium">Nama/Meja</label><input type="text" value={filters.name} onChange={e => handleFilterChange('name', e.target.value)} placeholder="Cari nama..." className="mt-1 w-full border-gray-300 rounded-md" /></div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-secondary-dark"><tr><th className="p-3">Waktu</th><th className="p-3">Nama/Meja</th><th className="p-3">Detail</th><th className="p-3">Total</th><th className="p-3">Status Bayar</th><th className="p-3">Status Antar</th><th className="p-3">Aksi</th></tr></thead>
                    <tbody>
                        {filteredTransactions.length > 0 ? filteredTransactions.map(t => (
                            <tr key={t.id} className="border-b hover:bg-secondary-dark/50">
                                <td className="p-3" dangerouslySetInnerHTML={{ __html: Utils.formatDate(t.createdAt).replace(',', '<br>') }}></td>
                                <td className="p-3 font-semibold">{t.customerName || '-'}</td>
                                <td className="p-3">
                                    <ul className="list-disc list-inside text-xs">
                                        {t.items.map(item => (
                                            <li key={item.id}>{`${item.name} (x${item.quantity})`}</li>
                                        ))}
                                    </ul>
                                </td>
                                <td className="p-3 font-semibold">{Utils.formatCurrency(t.total)}</td>
                                <td className="p-3"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${t.payment.status === 'Sudah Bayar' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{t.payment.status} ({t.payment.method})</span></td>
                                <td className="p-3">
                                    <div className="flex items-center">
                                        <input type="checkbox" id={`delivered-${t.id}`} checked={t.delivered} onChange={() => handleToggleDelivered(t.id)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" />
                                        <label htmlFor={`delivered-${t.id}`} className="ml-2 text-xs">{t.delivered ? 'Diantar' : 'Belum'}</label>
                                    </div>
                                </td>
                                <td className="p-3"><button onClick={() => handleEdit(t)} className="edit-btn text-blue-600 hover:underline mr-2 text-sm">Edit</button><button onClick={() => handleCancel(t.id)} className="cancel-btn text-red-600 hover:underline text-sm">Batal</button></td>
                            </tr>
                        )) : <tr><td colSpan={7} className="text-center p-6 text-gray-500">Tidak ada data pesanan.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PesananPage;