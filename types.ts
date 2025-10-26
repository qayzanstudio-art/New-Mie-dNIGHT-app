import React from 'react';

export type Tab = 'kasir' | 'pesanan' | 'laporan' | 'stok' | 'pengaturan' | 'qayzan';

export interface BaseMenuItem {
    id: string;
    name: string;
    price: number;
    stockId: string;
    qty?: number;
}

export type MenuItem = BaseMenuItem;
export type Topping = BaseMenuItem;
export type Drink = BaseMenuItem;

export interface InventoryItem {
    id: string;
    name: string;
    quantity: number;
    minStock: number;
}

export interface Payment {
    status: 'Belum Bayar' | 'Sudah Bayar';
    method: 'Cash' | 'QRIS';
}

export interface OrderItem extends BaseMenuItem {
    quantity: number;
}

export interface Order {
    id: string | null;
    items: OrderItem[];
    customerName: string;
    payment: Payment;
    delivered: boolean;
    createdAt: string | null;
    total: number;
}

export interface Transaction extends Order {
    id: string;
    createdAt: string;
}

export interface Expense {
    id: string;
    description: string;
    amount: number;
    date: string;
}

export interface Settings {
    primaryColor: string;
    secondaryColor: string;
    backgroundImage: string;
}

export interface DailyCash {
    date: string; // YYYY-MM-DD
    startingFloat: number;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  manualRevenue?: number; 
  manualExpenses?: number; 
  savingsDeposited: boolean;
  savingsAmount?: number;
  cashReconciled?: boolean;
  actualCashInHand?: number;
  cashDifference?: number;
}

export interface QayzanStudioDailyData {
    date: string; // YYYY-MM-DD
    cashOnHand: number;
    bankBalance: number;
    danaBalance: number;
    dailyTarget: number;
}

export interface QayzanStudioMonthlyData {
    yearMonth: string; // YYYY-MM
    monthlyTarget: number;
}

export interface AppData {
    menu: MenuItem[];
    toppings: Topping[];
    drinks: Drink[];
    inventory: InventoryItem[];
    transactions: Transaction[];
    expenses: Expense[];
    settings: Settings;
    dailyCash: DailyCash[];
    dailyLogs: DailyLog[];
    qayzanStudio: {
        daily: QayzanStudioDailyData[];
        monthly: QayzanStudioMonthlyData[];
    };
}

export interface ModalState {
    isOpen: boolean;
    title: string;
    body: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    hideButtons?: boolean;
}

export interface ToastState {
    isVisible: boolean;
    message: string;
}
