import React, { useState, useMemo, useEffect } from 'react';
import type { AppData } from '../types';
import { Utils } from '../App';

interface QayzanStudioPageProps {
    data: AppData;
    setData: React.Dispatch<React.SetStateAction<AppData>>;
    isUnlocked: boolean;
    setIsUnlocked: React.Dispatch<React.SetStateAction<boolean>>;
    helpers: {
        showToast: (message: string) => void;
    }
}

const InputField: React.FC<{ label: string, value: string | number, onChange: (val: string) => void, onBlur?: () => void, placeholder?: string }> = 
    ({ label, value, onChange, onBlur, placeholder }) => (
    <div>
        <label className="block text-sm font-medium mb-1">{label}</label>
        <input 
            type="number"
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder || '0'}
            className="w-full border-gray-600 bg-gray-700 text-white rounded-md p-2 placeholder:text-gray-400 font-semibold text-lg"
        />
    </div>
);


const QayzanStudioPage: React.FC<QayzanStudioPageProps> = ({ data, setData, isUnlocked, setIsUnlocked, helpers }) => {
    const [passwordInput, setPasswordInput] = useState('');

    const todayStr = useMemo(() => Utils.getBusinessDateString(), []);
    const currentYearMonth = useMemo(() => todayStr.slice(0, 7), [todayStr]);

    const [dailyInputs, setDailyInputs] = useState({ cashOnHand: '', bankBalance: '', danaBalance: '', dailyTarget: '' });
    const [monthlyTargetInput, setMonthlyTargetInput] = useState('');

    // Load data into local state when page is shown or date changes
    useEffect(() => {
        const todayData = data.qayzanStudio.daily.find(d => d.date === todayStr);
        const monthData = data.qayzanStudio.monthly.find(m => m.yearMonth === currentYearMonth);
        
        setDailyInputs({
            cashOnHand: todayData?.cashOnHand?.toString() || '',
            bankBalance: todayData?.bankBalance?.toString() || '',
            danaBalance: todayData?.danaBalance?.toString() || '',
            dailyTarget: todayData?.dailyTarget?.toString() || '',
        });
        setMonthlyTargetInput(monthData?.monthlyTarget?.toString() || '');
    }, [data.qayzanStudio, todayStr, currentYearMonth, isUnlocked]);

    // Memoized financial calculations
    const dailyRevenue = useMemo(() => {
        return data.transactions
            .filter(t => t.createdAt && Utils.getBusinessDateString(new Date(t.createdAt)) === todayStr && t.payment.status === 'Sudah Bayar')
            .reduce((sum, t) => sum + t.total, 0);
    }, [data.transactions, todayStr]);

    const monthlyRevenue = useMemo(() => {
        let total = 0;
        const [year, month] = currentYearMonth.split('-').map(Number);
        const dateIterator = new Date(year, month - 1, 1);

        while (dateIterator.getMonth() === month - 1) {
            const dateStr = dateIterator.toISOString().slice(0, 10);
            if (dateStr === todayStr) {
                total += dailyRevenue;
            } else {
                const log = data.dailyLogs.find(l => l.date === dateStr);
                total += log?.manualRevenue || 0;
            }
            dateIterator.setDate(dateIterator.getDate() + 1);
        }
        return total;
    }, [data.dailyLogs, dailyRevenue, todayStr, currentYearMonth]);
    
    const historicalData = useMemo(() => {
        const dates = [];
        const currentBusinessDate = new Date(todayStr + 'T12:00:00Z');
        for (let i = 0; i < 7; i++) {
            const date = new Date(currentBusinessDate);
            date.setDate(date.getDate() - i);
            dates.push(date.toISOString().slice(0, 10));
        }
        return dates.map(dateStr => data.qayzanStudio.daily.find(d => d.date === dateStr) || { date: dateStr, cashOnHand: 0, bankBalance: 0, danaBalance: 0, dailyTarget: 0 });
    }, [data.qayzanStudio.daily, todayStr]);


    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordInput === '132007') {
            setIsUnlocked(true);
            helpers.showToast('Akses diberikan!');
        } else {
            helpers.showToast('Password salah!');
        }
        setPasswordInput('');
    };

    const handleSaveData = () => {
        setData(prev => {
            // Update daily data
            const dailyData = {
                date: todayStr,
                cashOnHand: parseFloat(dailyInputs.cashOnHand) || 0,
                bankBalance: parseFloat(dailyInputs.bankBalance) || 0,
                danaBalance: parseFloat(dailyInputs.danaBalance) || 0,
                dailyTarget: parseFloat(dailyInputs.dailyTarget) || 0,
            };
            const dailyIndex = prev.qayzanStudio.daily.findIndex(d => d.date === todayStr);
            const newDaily = [...prev.qayzanStudio.daily];
            if (dailyIndex > -1) {
                newDaily[dailyIndex] = dailyData;
            } else {
                newDaily.push(dailyData);
            }

            // Update monthly data
            const monthlyData = {
                yearMonth: currentYearMonth,
                monthlyTarget: parseFloat(monthlyTargetInput) || 0,
            };
            const monthlyIndex = prev.qayzanStudio.monthly.findIndex(m => m.yearMonth === currentYearMonth);
            const newMonthly = [...prev.qayzanStudio.monthly];
            if (monthlyIndex > -1) {
                newMonthly[monthlyIndex] = monthlyData;
            } else {
                newMonthly.push(monthlyData);
            }

            return { ...prev, qayzanStudio: { daily: newDaily, monthly: newMonthly } };
        });
        helpers.showToast('Data Qayzan Studio disimpan!');
    };

    if (!isUnlocked) {
        return (
            <div className="flex justify-center items-center h-full pt-16">
                <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-xl text-on-secondary w-full max-w-sm text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-on-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    <h2 className="text-2xl font-bold mb-2">Akses Terbatas</h2>
                    <p className="text-gray-600 mb-6">Masukkan password untuk membuka Qayzan Studio.</p>
                    <input 
                        type="password"
                        value={passwordInput}
                        onChange={e => setPasswordInput(e.target.value)}
                        className="w-full text-center border-gray-300 rounded-md text-lg p-2 mb-4"
                        placeholder="******"
                        autoFocus
                    />
                    <button type="submit" className="w-full btn-primary font-bold py-3 rounded-lg hover:btn-primary-dark transition">Buka</button>
                </form>
            </div>
        );
    }
    
    const dailyTarget = parseFloat(dailyInputs.dailyTarget) || 0;
    let targetStatus = { text: 'Belum Tercapai', color: 'text-red-600', bg: 'bg-red-100' };
    if (dailyRevenue > 0 && dailyTarget > 0) {
        if (dailyRevenue >= dailyTarget) {
            targetStatus = { text: 'Tercapai', color: 'text-green-800', bg: 'bg-green-100' };
        }
        if (dailyRevenue > dailyTarget * 1.1) { // Example for "exceeded"
            targetStatus = { text: 'Melebihi Target!', color: 'text-blue-800', bg: 'bg-blue-100' };
        }
    }

    const monthlyTarget = parseFloat(monthlyTargetInput) || 0;
    const monthlyProgress = monthlyTarget > 0 ? (monthlyRevenue / monthlyTarget) * 100 : 0;
    
    const totalBalance = (parseFloat(dailyInputs.cashOnHand) || 0) + (parseFloat(dailyInputs.bankBalance) || 0) + (parseFloat(dailyInputs.danaBalance) || 0);

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg card-shadow text-on-secondary">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Dasbor Harian Qayzan Studio ({new Date(todayStr + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })})</h2>
                    <button onClick={handleSaveData} className="btn-primary font-bold py-2 px-4 rounded-lg hover:btn-primary-dark transition text-sm">Simpan Data</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Saldo Section */}
                    <div className="md:col-span-2 space-y-4 p-4 bg-gray-50 rounded-lg">
                        <h3 className="font-bold text-lg">Saldo Keuangan Hari Ini</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <InputField label="Uang di Tangan (Cash)" value={dailyInputs.cashOnHand} onChange={val => setDailyInputs(p => ({...p, cashOnHand: val}))} />
                            <InputField label="Saldo Rekening Bank" value={dailyInputs.bankBalance} onChange={val => setDailyInputs(p => ({...p, bankBalance: val}))} />
                            <InputField label="Saldo DANA" value={dailyInputs.danaBalance} onChange={val => setDailyInputs(p => ({...p, danaBalance: val}))} />
                        </div>
                        <div className="text-center pt-4 border-t mt-4">
                            <p className="text-sm font-medium">Total Saldo</p>
                            <p className="text-4xl font-bold" style={{color: 'var(--color-primary)'}}>{Utils.formatCurrency(totalBalance)}</p>
                        </div>
                    </div>

                    {/* Target Section */}
                    <div className="space-y-4 p-4 bg-secondary-dark rounded-lg">
                        <h3 className="font-bold text-lg">Target Penjualan Hari Ini</h3>
                         <InputField label="Target Hari Ini (Rp)" value={dailyInputs.dailyTarget} onChange={val => setDailyInputs(p => ({...p, dailyTarget: val}))} />
                         <div className="text-center space-y-2 pt-2">
                             <p className="text-sm font-medium">Omzet Hari Ini</p>
                             <p className="text-3xl font-bold text-green-600">{Utils.formatCurrency(dailyRevenue)}</p>
                             {dailyTarget > 0 && <p className={`text-sm font-bold px-3 py-1 rounded-full inline-block ${targetStatus.bg} ${targetStatus.color}`}>{targetStatus.text}</p>}
                         </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg card-shadow text-on-secondary md:col-span-2">
                    <h2 className="text-2xl font-bold mb-4">Mutasi Keuangan (7 Hari Terakhir)</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-secondary-dark">
                                <tr>
                                    <th className="p-3">Tanggal</th>
                                    <th className="p-3 text-right">Cash</th>
                                    <th className="p-3 text-right">Bank</th>
                                    <th className="p-3 text-right">DANA</th>
                                    <th className="p-3 text-right font-bold">Total Saldo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historicalData.map(item => (
                                    <tr key={item.date} className="border-b hover:bg-gray-50">
                                        <td className="p-3 font-semibold">{new Date(item.date + 'T12:00:00Z').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', weekday: 'short' })}</td>
                                        <td className="p-3 text-right">{Utils.formatCurrency(item.cashOnHand)}</td>
                                        <td className="p-3 text-right">{Utils.formatCurrency(item.bankBalance)}</td>
                                        <td className="p-3 text-right">{Utils.formatCurrency(item.danaBalance)}</td>
                                        <td className="p-3 text-right font-bold">{Utils.formatCurrency(item.cashOnHand + item.bankBalance + item.danaBalance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg card-shadow text-on-secondary">
                    <h2 className="text-2xl font-bold mb-4">Progres Bulanan</h2>
                    <InputField label="Target Bulan Ini (Rp)" value={monthlyTargetInput} onChange={setMonthlyTargetInput} onBlur={handleSaveData} />
                    {monthlyTarget > 0 && (
                        <div className="mt-4 space-y-2">
                            <div className="flex justify-between text-sm font-semibold">
                                <span>{Utils.formatCurrency(monthlyRevenue)}</span>
                                <span>{Utils.formatCurrency(monthlyTarget)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-4">
                                <div className="bg-primary h-4 rounded-full" style={{ width: `${Math.min(monthlyProgress, 100)}%` }}></div>
                            </div>
                             <p className="text-center font-bold text-lg mt-1" style={{color: 'var(--color-primary)'}}>{monthlyProgress.toFixed(1)}%</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QayzanStudioPage;
