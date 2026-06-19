export type Category =
  | "Flight/Ticketing"
  | "Hotel/Accommodation"
  | "Food & Drinks"
  | "Local Transport"
  | "Cab/Taxi"
  | "Activities"
  | "Sightseeing"
  | "Shopping"
  | "Misc/Other";

export const CATEGORIES: Category[] = [
  "Flight/Ticketing",
  "Hotel/Accommodation",
  "Food & Drinks",
  "Local Transport",
  "Cab/Taxi",
  "Activities",
  "Sightseeing",
  "Shopping",
  "Misc/Other",
];

export interface User {
  id: string;
  name: string;
  phone: string; // normalized digits only
}

export interface TripMember {
  userId: string;
  name: string;
  phone: string;
}

export interface ExpenseShare {
  userId: string;
  amount: number; // in smallest currency unit (paise)
}

export interface Expense {
  id: string;
  description: string;
  amount: number; // total in paise
  category: Category;
  expenseDate: string; // ISO date
  paidByUserId: string;
  shares: ExpenseShare[];
  notes?: string;
  createdAt: string;
}

export interface Trip {
  id: string;
  name: string;
  currency: string; // e.g. "INR", "USD"
  currencySymbol: string; // "₹", "$"
  createdAt: string;
  members: TripMember[];
  expenses: Expense[];
}

export interface Balance {
  userId: string;
  name: string;
  totalPaid: number;
  totalShare: number;
  net: number; // positive = to receive, negative = owes
}

export interface Settlement {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
}

// Helper to normalize phone numbers
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

// Format currency
export function formatAmount(amount: number, symbol: string): string {
  const rupees = (amount / 100).toFixed(2);
  return `${symbol}${rupees}`;
}
