import React, { useState, useMemo, useEffect } from 'react';
import type { AppData, Expense, DailyLog } from '../types';
import { Utils } from '../App';

declare global {
    interface Window {
        html2canvas: (element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>;
    }
}

interface LaporanPageProps {
    data: AppData;
    setData: React.Dispatch<React.SetStateAction<AppData>>;
    helpers: {
        showToast: (message: string) => void;
    }
}

const LaporanPage: React.FC<LaporanPageProps> = ({ data, setData, helpers }) => {
    const todayStr = useMemo(() => Utils.getBusinessDateString(), []);
    
    // State for daily dashboard
    const [startingFloatInput, setStartingFloatInput] = useState<string>('');
    const [expenseDescription, setExpenseDescription] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [actualCashInput, setActualCashInput] = useState<string>('');
    const [isDownloading, setIsDownloading] = useState(false);
    
    // State for historical ledger
    const [manualInputs, setManualInputs] = useState<{ [key: string]: { revenue: string; expenses: string; savings: string } }>({});

    // State for monthly report
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const dailyReportData = useMemo(() => {
        const dailyTrx = data.transactions.filter(t => t.createdAt && Utils.getBusinessDateString(new Date(t.createdAt)) === todayStr && t.payment.status === 'Sudah Bayar');
        const dailyExpenses = data.expenses.filter(e => e.date === todayStr);
        
        const totalOmzet = dailyTrx.reduce((s, t) => s + t.total, 0);
        const cashSales = dailyTrx.filter(t => t.payment.method === 'Cash').reduce((s, t) => s + t.total, 0);
        const qrisSales = dailyTrx.filter(t => t.payment.method === 'QRIS').reduce((s, t) => s + t.total, 0);
        const totalExpenses = dailyExpenses.reduce((s, e) => s + e.amount, 0);
        
        const startingFloat = data.dailyCash.find(dc => dc.date === todayStr)?.startingFloat || 0;
        const expectedCash = startingFloat + cashSales - totalExpenses;

        const todayLog = data.dailyLogs.find(log => log.date === todayStr);

        return { dailyTrx, dailyExpenses, totalOmzet, cashSales, qrisSales, totalExpenses, startingFloat, expectedCash, todayLog };
    }, [data.transactions, data.expenses, data.dailyCash, data.dailyLogs, todayStr]);

    const historicalDates = useMemo(() => {
        const dates = [];
        // Use a non-edge time like noon to prevent timezone-related date shifts
        const currentBusinessDate = new Date(todayStr + 'T12:00:00Z'); 

        for (let i = 0; i < 7; i++) {
            const date = new Date(currentBusinessDate);
            date.setDate(date.getDate() - i);
            dates.push(date.toISOString().slice(0, 10));
        }
        // Reverse to have the oldest date first, ensuring today appears at the bottom
        return dates.reverse();
    }, [todayStr]);

    useEffect(() => {
        const initialInputs: { [key: string]: { revenue: string; expenses: string; savings: string } } = {};
        historicalDates.forEach(date => {
            const log = data.dailyLogs.find(l => l.date === date);
            initialInputs[date] = {
                revenue: log?.manualRevenue?.toString() || '',
                expenses: log?.manualExpenses?.toString() || '',
                savings: log?.savingsAmount?.toString() || ''
            };
        });
        setManualInputs(initialInputs);
    }, [data.dailyLogs, historicalDates]);

    const ledgerSummary = useMemo(() => {
        let totalRevenue = 0, totalExpenses = 0, totalSavings = 0;
        
        historicalDates.forEach(date => {
            const isToday = date === todayStr;
            const log = data.dailyLogs.find(l => l.date === date);
            
            if (isToday) {
                totalRevenue += dailyReportData.totalOmzet;
                totalExpenses += dailyReportData.totalExpenses;
            } else {
                totalRevenue += log?.manualRevenue || 0;
                totalExpenses += log?.manualExpenses || 0;
            }

            if (log?.savingsDeposited) {
                totalSavings += log.savingsAmount || 0;
            }
        });
        
        return { totalRevenue, totalExpenses, totalSavings };
    }, [historicalDates, data.dailyLogs, dailyReportData, todayStr]);


    const monthlyReportData = useMemo(() => {
        let totalRevenue = 0, totalExpenses = 0, totalSavings = 0;

        // --- Calculate Revenue and Expenses ---
        // Iterate through each day of the selected month to avoid timezone issues.
        const dateIterator = new Date(selectedYear, selectedMonth, 1);
        while (dateIterator.getMonth() === selectedMonth) {
            // Manually format date as 'YYYY-MM-DD' to respect local timezone.
            const year = dateIterator.getFullYear();
            const month = (dateIterator.getMonth() + 1).toString().padStart(2, '0');
            const day = dateIterator.getDate().toString().padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            if (dateStr === todayStr) {
                // For today, use live data from the daily report.
                totalRevenue += dailyReportData.totalOmzet;
                totalExpenses += dailyReportData.totalExpenses;
            } else {
                // For past days, use the manually entered data from daily logs.
                const log = data.dailyLogs.find(l => l.date === dateStr);
                if (log) {
                    totalRevenue += log.manualRevenue || 0;
                    totalExpenses += log.manualExpenses || 0;
                }
            }
            // Move to the next day.
            dateIterator.setDate(dateIterator.getDate() + 1);
        }

        // --- Calculate Savings ---
        // Make date parsing robust to timezones.
        data.dailyLogs.forEach(log => {
            // By parsing the date string and checking its parts, we avoid timezone shifts.
            const logDate = new Date(log.date + 'T12:00:00Z'); 
            if (log.savingsDeposited && logDate.getFullYear() === selectedYear && logDate.getMonth() === selectedMonth) {
                totalSavings += log.savingsAmount || 0;
            }
        });
        
        return { totalRevenue, totalExpenses, totalSavings };
    }, [selectedMonth, selectedYear, data.dailyLogs, dailyReportData, todayStr]);


    const handleSaveFloat = () => {
        const floatAmount = parseFloat(startingFloatInput);
        if (isNaN(floatAmount) || floatAmount < 0) {
            helpers.showToast('Masukkan jumlah modal yang valid.');
            return;
        }
        setData(prev => {
            const existing = prev.dailyCash.find(dc => dc.date === todayStr);
            if (existing) {
                return { ...prev, dailyCash: prev.dailyCash.map(dc => dc.date === todayStr ? { ...dc, startingFloat: floatAmount } : dc) };
            }
            return { ...prev, dailyCash: [...prev.dailyCash, { date: todayStr, startingFloat: floatAmount }] };
        });
        helpers.showToast('Modal awal berhasil disimpan!');
        setStartingFloatInput('');
    };

    const handleAddExpense = () => {
        const amount = parseFloat(expenseAmount);
        if (!expenseDescription || isNaN(amount) || amount <= 0) {
            helpers.showToast('Keterangan dan jumlah pengeluaran harus valid.');
            return;
        }
        setData(prev => ({...prev, expenses: [...prev.expenses, { id: `exp-${Date.now()}`, description: expenseDescription, amount, date: todayStr }]}));
        setExpenseDescription('');
        setExpenseAmount('');
    };
    
    const handleDeleteExpense = (id: string) => {
        setData(prev => ({...prev, expenses: prev.expenses.filter(e => e.id !== id)}));
        helpers.showToast('Pengeluaran dihapus.');
    };

    const handleManualInputChange = (date: string, field: 'revenue' | 'expenses' | 'savings', value: string) => {
        setManualInputs(prev => ({ ...prev, [date]: { ...prev[date], [field]: value } }));
    };

    const handleSaveDailyLog = (date: string) => {
        const revenue = parseFloat(manualInputs[date]?.revenue || '0');
        const expenses = parseFloat(manualInputs[date]?.expenses || '0');
        const savings = parseFloat(manualInputs[date]?.savings || '0');

        if (isNaN(revenue) || isNaN(expenses) || isNaN(savings) || revenue < 0 || expenses < 0 || savings < 0) {
            helpers.showToast('Masukkan angka yang valid untuk semua input.');
            return;
        }

        setData(prev => {
            const logIndex = prev.dailyLogs.findIndex(l => l.date === date);
            let newLogs = [...prev.dailyLogs];
            if (logIndex > -1) {
                newLogs[logIndex] = { ...newLogs[logIndex], manualRevenue: revenue, manualExpenses: expenses, savingsAmount: savings };
            } else {
                newLogs.push({ date, manualRevenue: revenue, manualExpenses: expenses, savingsAmount: savings, savingsDeposited: false });
            }
            return { ...prev, dailyLogs: newLogs };
        });
        helpers.showToast(`Data untuk tanggal ${date} disimpan!`);
    };

    const handleToggleSavings = (date: string) => {
         setData(prev => {
            const logIndex = prev.dailyLogs.findIndex(l => l.date === date);
            let newLogs = [...prev.dailyLogs];
            const savingsAmount = parseFloat(manualInputs[date]?.savings || '0');

            if (isNaN(savingsAmount) || savingsAmount < 0) {
                helpers.showToast('Masukkan jumlah celengan yang valid sebelum mencentang.');
                return prev;
            }

            if (logIndex > -1) {
                newLogs[logIndex] = { ...newLogs[logIndex], savingsDeposited: !newLogs[logIndex].savingsDeposited, savingsAmount };
            } else {
                newLogs.push({ date, savingsDeposited: true, savingsAmount });
            }
            return { ...prev, dailyLogs: newLogs };
        });
    };
    
    const handleReconcileCash = () => {
        const actualAmount = parseFloat(actualCashInput);
        if (isNaN(actualAmount) || actualAmount < 0) {
            helpers.showToast('Masukkan jumlah uang tunai yang valid.');
            return;
        }

        const difference = actualAmount - dailyReportData.expectedCash;

        setData(prev => {
            const logIndex = prev.dailyLogs.findIndex(l => l.date === todayStr);
            let newLogs = [...prev.dailyLogs];

            const logUpdate = {
                cashReconciled: true,
                actualCashInHand: actualAmount,
                cashDifference: difference
            };

            if (logIndex > -1) {
                newLogs[logIndex] = { ...newLogs[logIndex], ...logUpdate };
            } else {
                newLogs.push({ date: todayStr, savingsDeposited: false, ...logUpdate });
            }
            return { ...prev, dailyLogs: newLogs };
        });

        helpers.showToast(difference === 0 ? 'Kas cocok! Kerja bagus!' : `Ada selisih ${Utils.formatCurrency(difference)}. Mohon periksa kembali.`);
        setActualCashInput('');
    };

    const handleResetReconciliation = () => {
        if (dailyReportData.todayLog?.actualCashInHand) {
            setActualCashInput(dailyReportData.todayLog.actualCashInHand.toString());
        }

        setData(prev => {
            const newLogs = prev.dailyLogs.map(log => {
                if (log.date === todayStr) {
                    return { ...log, cashReconciled: false };
                }
                return log;
            });
            return { ...prev, dailyLogs: newLogs };
        });
        helpers.showToast('Silakan masukkan ulang jumlah kas.');
    };

    const handleDownloadReport = async () => {
        const captureElement = document.getElementById('daily-summary-capture-area');
        if (!captureElement) {
            helpers.showToast('Area laporan tidak ditemukan.');
            return;
        }

        const trxList = document.getElementById('daily-transactions-list');
        const expList = document.getElementById('daily-expenses-list');
        
        if (!trxList || !expList) {
            helpers.showToast('Elemen daftar laporan tidak ditemukan.');
            return;
        }

        setIsDownloading(true);
        helpers.showToast('Mempersiapkan laporan...');
        
        // Temporarily remove height restrictions to capture full content
        const originalTrxStyle = { maxHeight: trxList.style.maxHeight, overflowY: trxList.style.overflowY };
        const originalExpStyle = { maxHeight: expList.style.maxHeight, overflowY: expList.style.overflowY };

        trxList.style.maxHeight = 'none';
        trxList.style.overflowY = 'visible';
        expList.style.maxHeight = 'none';
        expList.style.overflowY = 'visible';

        try {
            await new Promise(resolve => setTimeout(resolve, 100)); // Allow DOM to update

            const canvas = await window.html2canvas(captureElement, {
                useCORS: true,
                scale: 2,
                backgroundColor: '#F9FAFB'
            });

            const image = canvas.toDataURL('image/png', 1.0);
            const link = document.createElement('a');
            link.download = `laporan-harian-${todayStr}.png`;
            link.href = image;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Gagal mengunduh laporan:', err);
            helpers.showToast('Gagal mengunduh laporan.');
        } finally {
            // Restore original styles
            trxList.style.maxHeight = originalTrxStyle.maxHeight;
            trxList.style.overflowY = originalTrxStyle.overflowY;
            expList.style.maxHeight = originalExpStyle.maxHeight;
            expList.style.overflowY = originalExpStyle.overflowY;
            setIsDownloading(false);
        }
    };


    const renderDailyLedger = () => (
        <div className="bg-white p-6 rounded-lg card-shadow text-on-secondary">
            <h2 className="text-2xl font-bold mb-4">Buku Besar Harian (7 Hari Terakhir)</h2>
            <div className="space-y-1">
                {/* Header */}
                <div className="grid grid-cols-11 gap-4 items-center p-3 rounded-lg bg-secondary-dark font-bold text-sm">
                    <div className="col-span-11 md:col-span-2">Tanggal</div>
                    <div className="col-span-5 md:col-span-3">Pendapatan</div>
                    <div className="col-span-6 md:col-span-3">Pengeluaran</div>
                    <div className="col-span-11 md:col-span-3">Celengan</div>
                </div>

                {historicalDates.length > 0 ? historicalDates.map(date => {
                    const isToday = date === todayStr;
                    const logData = data.dailyLogs.find(l => l.date === date);
                    const dailyRevenue = isToday ? dailyReportData.totalOmzet : logData?.manualRevenue;
                    const dailyExpenses = isToday ? dailyReportData.totalExpenses : logData?.manualExpenses;

                    return (
                        <div key={date} className="grid grid-cols-11 gap-4 items-center p-3 rounded-lg bg-gray-50 border-b">
                            <div className="col-span-11 md:col-span-2">
                                <p className="font-bold text-base">{new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long' })}</p>
                                <p className="text-sm text-gray-600">{new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</p>
                            </div>
                            <div className="col-span-5 md:col-span-3">
                                {isToday ? <p className="font-semibold text-lg p-2">{Utils.formatCurrency(dailyRevenue || 0)}</p> : 
                                 <input type="number" value={manualInputs[date]?.revenue || ''} onChange={e => handleManualInputChange(date, 'revenue', e.target.value)} onBlur={() => handleSaveDailyLog(date)} className="w-full border-gray-600 bg-gray-700 text-white rounded-md placeholder:text-gray-400" placeholder="0" />}
                            </div>
                            <div className="col-span-6 md:col-span-3">
                                {isToday ? <p className="font-semibold text-lg text-red-600 p-2">{Utils.formatCurrency(dailyExpenses || 0)}</p> :
                                 <input type="number" value={manualInputs[date]?.expenses || ''} onChange={e => handleManualInputChange(date, 'expenses', e.target.value)} onBlur={() => handleSaveDailyLog(date)} className="w-full border-gray-600 bg-gray-700 text-white rounded-md placeholder:text-gray-400" placeholder="0" />}
                            </div>
                            <div className="col-span-11 md:col-span-3 flex items-center gap-2">
                                <input type="checkbox" id={`savings-${date}`} checked={logData?.savingsDeposited || false} onChange={() => handleToggleSavings(date)} className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary" />
                                <input type="number" value={manualInputs[date]?.savings || ''} onChange={e => handleManualInputChange(date, 'savings', e.target.value)} onBlur={() => handleSaveDailyLog(date)} placeholder="Jumlah (Rp)" className="w-full text-sm border-gray-600 bg-gray-700 text-white rounded-md placeholder:text-gray-400 p-2"/>
                            </div>
                        </div>
                    );
                }) : <p className="text-center text-gray-500 py-4">Tidak ada data untuk ditampilkan.</p>}
                 {/* Summary Row */}
                <div className="grid grid-cols-11 gap-4 items-center p-3 rounded-lg bg-secondary-dark font-bold mt-2">
                    <div className="col-span-11 md:col-span-2">TOTAL</div>
                    <div className="col-span-5 md:col-span-3 text-lg">{Utils.formatCurrency(ledgerSummary.totalRevenue)}</div>
                    <div className="col-span-6 md:col-span-3 text-lg text-red-600">{Utils.formatCurrency(ledgerSummary.totalExpenses)}</div>
                    <div className="col-span-11 md:col-span-3 text-lg text-green-600">{Utils.formatCurrency(ledgerSummary.totalSavings)}</div>
                </div>
            </div>
        </div>
    );

    const renderMonthlyReport = () => (
        <div className="bg-white p-6 rounded-lg card-shadow text-on-secondary">
             <h2 className="text-2xl font-bold mb-4">Laporan Bulanan</h2>
             <div className="flex gap-4 mb-4 items-center">
                <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="border-gray-600 bg-gray-700 text-white rounded-md">
                    {Array.from({length: 12}, (_, i) => <option key={i} value={i}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>)}
                </select>
                <input type="number" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="w-24 border-gray-600 bg-gray-700 text-white rounded-md" />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium">Total Pemasukan</p>
                    <p className="text-2xl font-bold" style={{color: 'var(--color-primary)'}}>{Utils.formatCurrency(monthlyReportData.totalRevenue)}</p>
                </div>
                 <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium">Total Pengeluaran</p>
                    <p className="text-2xl font-bold text-red-600">{Utils.formatCurrency(monthlyReportData.totalExpenses)}</p>
                </div>
                 <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium">Total Uang di Celengan</p>
                    <p className="text-2xl font-bold text-green-600">{Utils.formatCurrency(monthlyReportData.totalSavings)}</p>
                </div>
             </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg card-shadow text-on-secondary">
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Dasbor Keuangan Hari Ini ({new Date(todayStr + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })})</h2>
                    <button onClick={handleDownloadReport} disabled={isDownloading} className="btn-primary font-bold py-2 px-4 rounded-lg hover:btn-primary-dark transition whitespace-nowrap text-sm flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        {isDownloading ? 'Memproses...' : 'Download Laporan'}
                    </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-1">Modal Awal / Uang Kembalian</label>
                            <div className="flex items-center gap-2"><input type="number" value={startingFloatInput} onChange={e => setStartingFloatInput(e.target.value)} placeholder={Utils.formatCurrency(dailyReportData.startingFloat)} className="w-full border-gray-600 bg-gray-700 text-white rounded-md placeholder:text-gray-400" /><button onClick={handleSaveFloat} className="btn-primary font-bold py-2 px-4 rounded-lg hover:btn-primary-dark transition whitespace-nowrap">Simpan</button></div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <label className="block text-sm font-medium mb-2">Tambah Pengeluaran/Belanja Hari Ini</label>
                            <div className="flex items-center gap-2 mb-2"><input type="text" value={expenseDescription} onChange={e => setExpenseDescription(e.target.value)} placeholder="Keterangan (e.g. Beli Telur)" className="w-full border-gray-600 bg-gray-700 text-white rounded-md placeholder:text-gray-400"/><input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="Jumlah (Rp)" className="w-48 border-gray-600 bg-gray-700 text-white rounded-md placeholder:text-gray-400"/></div>
                            <button onClick={handleAddExpense} className="w-full bg-blue-500 text-white font-semibold py-2 rounded-lg hover:bg-blue-600 transition">Tambah Pengeluaran</button>
                        </div>
                        <div className="p-4 bg-secondary-dark rounded-lg">
                            <h3 className="text-lg font-bold mb-3">Rekonsiliasi Kas Harian</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span>Modal Awal</span><span className="font-semibold">{Utils.formatCurrency(dailyReportData.startingFloat)}</span></div>
                                <div className="flex justify-between"><span>(+) Pemasukan Tunai (Cash)</span><span className="font-semibold">{Utils.formatCurrency(dailyReportData.cashSales)}</span></div>
                                <div className="flex justify-between"><span>(+) Pemasukan QRIS</span><span className="font-semibold">{Utils.formatCurrency(dailyReportData.qrisSales)}</span></div>
                                <div className="flex justify-between"><span>(-) Total Pengeluaran</span><span className="font-semibold text-red-600">{Utils.formatCurrency(dailyReportData.totalExpenses)}</span></div>
                                <hr className="border-dashed my-1"/><div className="flex justify-between text-base font-bold"><span>Total Uang Tunai di Tangan</span><span className="text-green-600">{Utils.formatCurrency(dailyReportData.expectedCash)}</span></div>
                            </div>
                             <div className="mt-4 pt-4 border-t border-dashed">
                                {dailyReportData.todayLog?.cashReconciled ? (
                                    <div className="space-y-2">
                                        <div className="flex justify-between"><span>Uang Tunai Sebenarnya</span><span className="font-semibold">{Utils.formatCurrency(dailyReportData.todayLog.actualCashInHand || 0)}</span></div>
                                        <div className="flex justify-between items-center"><span className="font-bold">Selisih</span><span className={`font-bold text-lg px-2 py-1 rounded ${dailyReportData.todayLog.cashDifference === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{Utils.formatCurrency(dailyReportData.todayLog.cashDifference || 0)}</span></div>
                                        <p className="text-xs text-center text-gray-500 mt-2">Kas sudah dicocokkan.</p>
                                        <button onClick={handleResetReconciliation} className="w-full text-sm bg-gray-200 text-gray-700 font-bold py-2 rounded-lg shadow hover:bg-gray-300 transition mt-2">Ubah / Cocokkan Ulang</button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label htmlFor="actualCash" className="block text-sm font-medium">Uang Tunai Sebenarnya</label>
                                        <div className="flex items-center gap-2"><input id="actualCash" type="number" value={actualCashInput} onChange={e => setActualCashInput(e.target.value)} placeholder="Masukkan jumlah di laci" className="w-full border-gray-600 bg-gray-700 text-white rounded-md placeholder:text-gray-400" /></div>
                                        <button onClick={handleReconcileCash} className="w-full bg-green-500 text-white font-semibold py-2 rounded-lg hover:bg-green-600 transition mt-2">Cocokkan Kas</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div id="daily-summary-capture-area" className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <h3 className="text-lg font-semibold mb-2">Ringkasan Penjualan Hari Ini</h3>
                             <p className="text-sm font-medium text-gray-600 mb-2">{new Date(todayStr + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <div className="space-y-2">
                                <div className="flex justify-between items-baseline"><span>Total Omzet</span><strong className="text-xl" style={{color: 'var(--color-primary)'}}>{Utils.formatCurrency(dailyReportData.totalOmzet)}</strong></div>
                                <div className="flex justify-between items-baseline"><span>Tunai (Cash)</span><strong>{Utils.formatCurrency(dailyReportData.cashSales)}</strong></div>
                                <div className="flex justify-between items-baseline"><span>Non-Tunai (QRIS)</span><strong>{Utils.formatCurrency(dailyReportData.qrisSales)}</strong></div>
                            </div>
                            <h4 className="text-md font-semibold mt-4 mb-2 border-t pt-2">Daftar Transaksi Terbayar ({dailyReportData.dailyTrx.length} pesanan)</h4>
                            {dailyReportData.dailyTrx.length > 0 ? (
                                <ul id="daily-transactions-list" className="space-y-2 text-sm max-h-60 overflow-y-auto pr-2">{dailyReportData.dailyTrx.map(trx => (
                                    <li key={trx.id} className="bg-white p-3 rounded shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-grow">
                                                <p className="font-bold text-on-secondary">{trx.customerName || `Pesanan #${trx.id.slice(-4)}`}</p>
                                                <p className="text-xs text-gray-500 mt-1 italic">
                                                    {trx.items.map(item => `${item.name} x${item.quantity}`).join(', ')}
                                                </p>
                                            </div>
                                            <div className="text-right flex-shrink-0 ml-4">
                                                <p className="font-bold text-base">{Utils.formatCurrency(trx.total)}</p>
                                                <p className="text-xs text-gray-600">{trx.payment.method}</p>
                                            </div>
                                        </div>
                                    </li>
                                ))}</ul>
                            ) : <p className="text-sm text-center text-gray-500 py-4">Belum ada pesanan terbayar hari ini.</p>}
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                             <h3 className="text-lg font-semibold mb-2">Daftar Pengeluaran Hari Ini</h3>
                             {dailyReportData.dailyExpenses.length > 0 ? (
                                <ul id="daily-expenses-list" className="space-y-1 text-sm max-h-40 overflow-y-auto pr-2">{dailyReportData.dailyExpenses.map(e => (<li key={e.id} className="flex justify-between items-center bg-white p-2 rounded"><span>{e.description}</span><div className="flex items-center gap-2"><span className="font-semibold text-red-600">{Utils.formatCurrency(e.amount)}</span><button onClick={() => handleDeleteExpense(e.id)} className="text-red-500 hover:text-red-700 text-lg leading-none">&times;</button></div></li>))}</ul>
                             ) : <p className="text-sm text-gray-500">Belum ada pengeluaran.</p>}
                        </div>
                    </div>
                </div>
            </div>
            {renderDailyLedger()}
            {renderMonthlyReport()}
        </div>
    );
};

export default LaporanPage;