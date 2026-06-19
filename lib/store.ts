import {
  Trip,
  Expense,
  TripMember,
  ExpenseShare,
  normalizePhone,
  Category,
  Balance,
  Settlement,
} from "./types";
import { randomUUID } from "crypto";

// In-memory store. Data lives for the lifetime of the Node process.
// Perfect for a small group trip on a VPS. Export often as backup.
const trips = new Map<string, Trip>();

function generateShortId(): string {
  // Short human-friendly trip code
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function createTrip(name: string, currency = "INR", symbol = "₹"): Trip {
  const id = generateShortId();
  const trip: Trip = {
    id,
    name: name.trim() || "Untitled Trip",
    currency,
    currencySymbol: symbol,
    createdAt: new Date().toISOString(),
    members: [],
    expenses: [],
  };
  trips.set(id, trip);
  return trip;
}

export function getTrip(tripId: string): Trip | undefined {
  return trips.get(tripId);
}

export function getAllTrips(): Trip[] {
  return Array.from(trips.values());
}

export function addMember(
  tripId: string,
  name: string,
  phone: string
): TripMember | null {
  const trip = trips.get(tripId);
  if (!trip) return null;

  const normalized = normalizePhone(phone);
  const existing = trip.members.find((m) => m.phone === normalized);

  if (existing) {
    // Update name if changed
    existing.name = name.trim();
    return existing;
  }

  const member: TripMember = {
    userId: randomUUID(),
    name: name.trim(),
    phone: normalized,
  };
  trip.members.push(member);
  return member;
}

export function removeMember(tripId: string, userId: string): boolean {
  const trip = trips.get(tripId);
  if (!trip) return false;

  // Don't allow removing if they have expenses paid or shares (simplified for MVP)
  const hasExpenses = trip.expenses.some(
    (e) => e.paidByUserId === userId || e.shares.some((s) => s.userId === userId)
  );

  if (hasExpenses) {
    // Still allow removal but we will keep historical data
  }

  trip.members = trip.members.filter((m) => m.userId !== userId);
  return true;
}

export function addExpense(
  tripId: string,
  input: {
    description: string;
    amount: number; // rupees, will convert to paise
    category: Category;
    expenseDate: string;
    paidByUserId: string;
    splitUserIds: string[]; // people who share this expense
    customShares?: { userId: string; amount: number }[]; // optional absolute paise
    notes?: string;
  }
): Expense | null {
  const trip = trips.get(tripId);
  if (!trip) return null;

  const totalPaise = Math.round(input.amount * 100);

  if (totalPaise <= 0) return null;
  if (input.splitUserIds.length === 0) return null;

  let shares: ExpenseShare[];

  if (input.customShares && input.customShares.length > 0) {
    shares = input.customShares.map((cs) => ({
      userId: cs.userId,
      amount: cs.amount,
    }));
    // Verify sum matches total
    const sum = shares.reduce((a, b) => a + b.amount, 0);
    if (sum !== totalPaise) {
      // Adjust last share
      const diff = totalPaise - sum;
      shares[shares.length - 1].amount += diff;
    }
  } else {
    // Equal split
    const perPerson = Math.floor(totalPaise / input.splitUserIds.length);
    let remainder = totalPaise - perPerson * input.splitUserIds.length;

    shares = input.splitUserIds.map((uid, idx) => ({
      userId: uid,
      amount: perPerson + (idx === 0 ? remainder : 0),
    }));
  }

  const expense: Expense = {
    id: randomUUID(),
    description: input.description.trim(),
    amount: totalPaise,
    category: input.category,
    expenseDate: input.expenseDate,
    paidByUserId: input.paidByUserId,
    shares,
    notes: input.notes?.trim(),
    createdAt: new Date().toISOString(),
  };

  trip.expenses.unshift(expense); // newest first
  return expense;
}

export function updateExpense(
  tripId: string,
  expenseId: string,
  input: Partial<{
    description: string;
    amount: number;
    category: Category;
    expenseDate: string;
    paidByUserId: string;
    splitUserIds: string[];
    notes: string;
  }>
): Expense | null {
  const trip = trips.get(tripId);
  if (!trip) return null;

  const idx = trip.expenses.findIndex((e) => e.id === expenseId);
  if (idx === -1) return null;

  const exp = trip.expenses[idx];

  if (input.description !== undefined) exp.description = input.description.trim();
  if (input.category !== undefined) exp.category = input.category;
  if (input.expenseDate !== undefined) exp.expenseDate = input.expenseDate;
  if (input.notes !== undefined) exp.notes = input.notes.trim();
  if (input.paidByUserId !== undefined) exp.paidByUserId = input.paidByUserId;

  if (input.amount !== undefined) {
    const newTotal = Math.round(input.amount * 100);
    exp.amount = newTotal;

    // Recompute equal shares using current members in the expense's shares
    const currentSplitIds = exp.shares.map((s) => s.userId);
    const perPerson = Math.floor(newTotal / currentSplitIds.length);
    let rem = newTotal - perPerson * currentSplitIds.length;

    exp.shares = currentSplitIds.map((uid, i) => ({
      userId: uid,
      amount: perPerson + (i === 0 ? rem : 0),
    }));
  }

  if (input.splitUserIds !== undefined && input.splitUserIds.length > 0) {
    const newTotal = exp.amount;
    const perPerson = Math.floor(newTotal / input.splitUserIds.length);
    let rem = newTotal - perPerson * input.splitUserIds.length;
    exp.shares = input.splitUserIds.map((uid, i) => ({
      userId: uid,
      amount: perPerson + (i === 0 ? rem : 0),
    }));
  }

  return exp;
}

export function deleteExpense(tripId: string, expenseId: string): boolean {
  const trip = trips.get(tripId);
  if (!trip) return false;
  const before = trip.expenses.length;
  trip.expenses = trip.expenses.filter((e) => e.id !== expenseId);
  return trip.expenses.length < before;
}

// === Calculations ===

export function calculateBalances(trip: Trip): Balance[] {
  const paidMap = new Map<string, number>();
  const shareMap = new Map<string, number>();

  // Initialize for all current members
  trip.members.forEach((m) => {
    paidMap.set(m.userId, 0);
    shareMap.set(m.userId, 0);
  });

  for (const exp of trip.expenses) {
    // What was paid
    const prevPaid = paidMap.get(exp.paidByUserId) || 0;
    paidMap.set(exp.paidByUserId, prevPaid + exp.amount);

    // What each person shares
    for (const share of exp.shares) {
      const prevShare = shareMap.get(share.userId) || 0;
      shareMap.set(share.userId, prevShare + share.amount);
    }
  }

  const balances: Balance[] = trip.members.map((member) => {
    const totalPaid = paidMap.get(member.userId) || 0;
    const totalShare = shareMap.get(member.userId) || 0;
    return {
      userId: member.userId,
      name: member.name,
      totalPaid,
      totalShare,
      net: totalPaid - totalShare,
    };
  });

  return balances.sort((a, b) => b.net - a.net);
}

export function calculateSettlements(balances: Balance[]): Settlement[] {
  const settlements: Settlement[] = [];

  // Make working copies
  const creditors = balances
    .filter((b) => b.net > 0)
    .map((b) => ({ ...b }));
  const debtors = balances
    .filter((b) => b.net < 0)
    .map((b) => ({ ...b }));

  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const cred = creditors[i];
    const debt = debtors[j];

    const amount = Math.min(cred.net, -debt.net);

    if (amount > 0) {
      settlements.push({
        fromUserId: debt.userId,
        fromName: debt.name,
        toUserId: cred.userId,
        toName: cred.name,
        amount,
      });

      cred.net -= amount;
      debt.net += amount;
    }

    if (cred.net === 0) i++;
    if (debt.net === 0) j++;
  }

  return settlements;
}

export function getTripSummary(trip: Trip) {
  const totalSpent = trip.expenses.reduce((sum, e) => sum + e.amount, 0);
  return {
    totalSpent,
    expenseCount: trip.expenses.length,
    memberCount: trip.members.length,
  };
}
