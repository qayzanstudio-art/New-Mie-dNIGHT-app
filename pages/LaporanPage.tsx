
import React, { useState, useMemo, useEffect } from 'react';
import type { AppData, Expense, OrderItem } from '../types';
import { Utils } from '../App';

interface LaporanPageProps {
    data: AppData;
    setData: React.Dispatch<React.SetStateAction<AppData>>;
    helpers: {
        showModal: (config: any) => void;
        generateDailySummary: (prompt: string) => Promise<string | null>;
        showToast: (message: string) => void;
    }
}

const LaporanPage: React.FC<LaporanPageProps> = ({ data, setData, helpers }) => {
    const [reportDate, setReportDate] = useState(Utils.getTodayDateString());
    const [isGeminiLoading, setIsGeminiLoading] = useState(false);

    const financialSummary = useMemo(() => {
        const totalRevenue = data.transactions.filter(t => t.payment.status === 'Sudah Bayar').reduce((s, t) => s + t.total, 0);
        const totalExpenses = data.expenses.reduce((s, e) => s + e.amount, 0);
        return { totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses };
    }, [data.transactions, data.expenses]);

    const dailyReportData = useMemo(() => {
        const dailyTrx = data.transactions.filter(t => t.createdAt.startsWith(reportDate) && t.payment.status === 'Sudah Bayar');
        const totalOmzet = dailyTrx.reduce((s, t) => s + t.total, 0);
        return { dailyTrx, totalOmzet };
    }, [data.transactions, reportDate]);

    useEffect(() => {
        if(isGeminiLoading) {
            helpers.showModal({
                title: '✨ Gemini Bekerja...',
                body: `<p class="text-center text-gray-600">Harap tunggu sebentar, sedang memproses permintaan Anda...</p><p class="text-center text-xs text-gray-400 mt-2">(Membutuhkan koneksi internet)</p><div class="flex justify-center items-center p-4"><div class="animate-spin rounded-full h-12 w-12 border-b-4" style="border-color: var(--color-primary);"></div></div>`,
                hideButtons: true
            });
        }
    }, [isGeminiLoading, helpers]);

    const handleGenerateSummary = async () => {
        if (dailyReportData.dailyTrx.length === 0) {
            helpers.showToast('Tidak ada data untuk diringkas.');
            return;
        }
        setIsGeminiLoading(true);

        const itemCounts: {[key: string]: number} = {};
        dailyReportData.dailyTrx.forEach(t => t.items.forEach((i: OrderItem) => {
            if (data.menu.some(m => m.id === i.id)) itemCounts[i.name] = (itemCounts[i.name] || 0) + i.quantity;
        }));
        const topItems = Object.entries(itemCounts).sort(([,a],[,b]) => b-a).slice(0,3).map(item => `${item[0]} (${item[1]} porsi)`).join(', ');
        
        const prompt = `Anda adalah asisten manajer warmindo. Buat ringkasan penjualan harian yang singkat, informatif, dan memberi semangat untuk pemilik. Gunakan bahasa Indonesia santai. Data penjualan untuk ${new Date(reportDate+'T00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'})}: Total Omzet: ${Utils.formatCurrency(dailyReportData.totalOmzet)}, Jumlah Transaksi: ${dailyReportData.dailyTrx.length}, Menu Terlaris: ${topItems||'Tidak ada'}. Format sebagai: 1. **Analisis Singkat:** ulasan performa. 2. **Saran Praktis:** satu saran untuk besok. 3. **Kata Semangat:** kalimat motivasi.`;
        
        const result = await helpers.generateDailySummary(prompt);
        setIsGeminiLoading(false);
        
        if (result) {
            helpers.showModal({
                title: `✨ Ringkasan Analisis Penjualan`,
                body: <div className="text-left space-y-3 text-gray-800" dangerouslySetInnerHTML={{ __html: result.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />,
                confirmText: 'Keren!'
            });
        } else {
             helpers.showModal({ title: 'Terjadi Kesalahan', body: <p className="text-gray-800">Tidak dapat menghubungi Gemini API.</p>, confirmText: 'Tutup' });
        }
    };

    const handleAddExpense = (description: string, amount: number) => {
        if (description && amount > 0) {
            const newExpense: Expense = { id: `EXP-${Date.now()}`, description, amount, date: new Date().toISOString() };
            setData(prev => ({ ...prev, expenses: [newExpense, ...prev.expenses] }));
            helpers.showToast('Pengeluaran dicatat!');
        } else {
            helpers.showToast('Deskripsi dan jumlah harus diisi.');
        }
    };

    const AddExpenseForm: React.FC<{onConfirm: (desc: string, amount: number) => void}> = ({onConfirm}) => {
        const [desc, setDesc] = useState('');
        const [amount, setAmount] = useState('');
        return (
            <div className="space-y-4 text-gray-800">
                <div><label className="block text-sm font-medium">Deskripsi</label><input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g., Beli 1 dus Indomie" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"/></div>
                <div><label className="block text-sm font-medium">Jumlah (Rp)</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g., 105000" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"/></div>
            </div>
        );
    };

    const openAddExpenseModal = () => {
        let description = '', amount = 0;
        helpers.showModal({
            title: 'Catat Pengeluaran Baru',
            body: <AddExpenseForm onConfirm={(d, a) => { description = d; amount = a; }} />,
            onConfirm: () => handleAddExpense(description, amount)
        });
    };

    const exportCSV = (type: 'transactions' | 'expenses') => {
        let rows: string[];
        let headers: string[];
        let filename: string;
    
        if (type === 'transactions') {
            const { transactions } = data;
            headers = ['ID', 'Waktu', 'Nama', 'Item', 'Total', 'Status', 'Metode'];
            filename = 'transaksi.csv';
            rows = transactions.map(t => [t.id, t.createdAt, t.customerName, `"${t.items.map(i => `${i.name} x${i.quantity}`).join(', ')}"`, t.total, t.payment.status, t.payment.method].join(','));
        } else {
            const { expenses } = data;
            headers = ['ID', 'Tanggal', 'Deskripsi', 'Jumlah'];
            filename = 'pengeluaran.csv';
            rows = expenses.map(e => [e.id, e.date, `"${e.description}"`, e.amount].join(','));
        }
        
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(',')].concat(rows).join('\n');
        const a = document.createElement("a");
        a.href = encodeURI(csvContent);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };


    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg card-shadow text-on-secondary">
                <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold">Laporan Penjualan Harian</h2><button onClick={handleGenerateSummary} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg hover:from-purple-600 hover:to-indigo-700 transition">Buat Ringkasan Analisis ✨</button></div>
                <div className="flex items-end gap-4 mb-4 bg-gray-50 p-3 rounded-md text-gray-800"><div><label htmlFor="daily-report-date" className="block text-sm font-medium">Pilih Tanggal</label><input type="date" id="daily-report-date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-primary sm:text-sm" /></div></div>
                <div>
                    {dailyReportData.dailyTrx.length === 0 ? <p className="text-center text-gray-500 py-4">Tidak ada penjualan pada tanggal ini.</p> : (
                        <><div className="mb-4 p-4 bg-secondary-dark rounded-lg"><h4 className="text-lg font-bold">Ringkasan untuk {new Date(reportDate+'T00:00').toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</h4><div className="flex justify-between mt-2"><span>Total Omzet: <strong className="text-xl text-primary">{Utils.formatCurrency(dailyReportData.totalOmzet)}</strong></span><span>Jumlah Transaksi: <strong className="text-xl text-primary">{dailyReportData.dailyTrx.length}</strong></span></div></div><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-secondary-dark"><tr><th className="p-3">Jam Order</th><th className="p-3">Nama/Meja</th><th className="p-3">Detail Pesanan</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{dailyReportData.dailyTrx.map(t => <tr key={t.id}><td className="p-3 font-semibold">{Utils.formatTime(t.createdAt)}</td><td className="p-3">{t.customerName||'-'}</td><td className="p-3">{t.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}</td><td className="p-3 text-right font-semibold">{Utils.formatCurrency(t.total)}</td></tr>)}</tbody></table></div></>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg card-shadow text-on-secondary"><h3 className="text-xl font-bold mb-4">Ringkasan Keuangan (Total)</h3><div className="space-y-3"><div className="flex justify-between"><span>Total Pendapatan</span><span className="font-semibold text-green-600">{Utils.formatCurrency(financialSummary.totalRevenue)}</span></div><div className="flex justify-between"><span>Total Pengeluaran</span><span className="font-semibold text-red-600">{Utils.formatCurrency(financialSummary.totalExpenses)}</span></div><hr /><div className="flex justify-between text-lg"><strong>Keuntungan Bersih</strong><strong className="font-bold text-primary">{Utils.formatCurrency(financialSummary.netProfit)}</strong></div></div><button onClick={openAddExpenseModal} className="mt-4 w-full bg-red-500 text-white font-bold py-2 rounded-lg hover:bg-red-600 transition">Catat Pengeluaran</button></div>
                <div className="bg-white p-6 rounded-lg card-shadow text-on-secondary"><h3 className="text-xl font-bold mb-4">Ringkasan Stok</h3><div className="max-h-60 overflow-y-auto">{data.inventory.map(i => <div key={i.id} className={`flex justify-between py-1 ${i.quantity <= i.minStock ? 'text-red-600 font-bold' : ''}`}><span>{i.name} {i.quantity <= i.minStock ? ' (Stok Rendah!)' : ''}</span><span>{i.quantity}</span></div>)}</div></div>
            </div>
             <div className="bg-white p-6 rounded-lg card-shadow text-on-secondary">
                <h3 className="text-xl font-bold mb-4">Export Data</h3>
                <div className="flex gap-4">
                    <button onClick={() => exportCSV('transactions')} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition">Export Transaksi (CSV)</button>
                    <button onClick={() => exportCSV('expenses')} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition">Export Pengeluaran (CSV)</button>
                </div>
            </div>
        </div>
    );
};

export default LaporanPage;