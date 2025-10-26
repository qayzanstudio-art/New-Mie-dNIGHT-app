// Fix: Import React to use React.ReactNode type.
import React from 'react';

export type Tab = 'kasir' | 'pesanan' | 'laporan' | 'stok' | 'pengaturan';

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

export interface AppData {
    menu: MenuItem[];
    toppings: Topping[];
    drinks: Drink[];
    inventory: InventoryItem[];
    transactions: Transaction[];
    expenses: Expense[];
    settings: Settings;
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