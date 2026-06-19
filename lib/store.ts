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
import { getDb } from "./db";

// === Persistent store using SQLite ===
// Data survives server restarts. Perfect for VPS deploys.

function generateShortId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Hydrate a full Trip object from DB (members + expenses + shares)
function hydrateTrip(tripId: string): Trip | undefined {
  const db = getDb();

  const tripRow = db
    .prepare("SELECT * FROM trips WHERE id = ?")
    .get(tripId) as any;
  if (!tripRow) return undefined;

  const members = db
    .prepare(
      "SELECT user_id as userId, name, phone FROM members WHERE trip_id = ? ORDER BY joined_at"
    )
    .all(tripId) as TripMember[];

  const expensesRows = db
    .prepare(
      `SELECT id, description, amount, category, expense_date as expenseDate, 
              paid_by_user_id as paidByUserId, notes, created_at as createdAt
       FROM expenses 
       WHERE trip_id = ? 
       ORDER BY created_at DESC`
    )
    .all(tripId) as any[];

  const expenses: Expense[] = expensesRows.map((e) => {
    const shares = db
      .prepare(
        "SELECT user_id as userId, amount FROM expense_shares WHERE expense_id = ?"
      )
      .all(e.id) as ExpenseShare[];

    return {
      id: e.id,
      description: e.description,
      amount: e.amount,
      category: e.category,
      expenseDate: e.expenseDate,
      paidByUserId: e.paidByUserId,
      shares,
      notes: e.notes || undefined,
      createdAt: e.createdAt,
    };
  });

  return {
    id: tripRow.id,
    name: tripRow.name,
    currency: tripRow.currency,
    currencySymbol: tripRow.currency_symbol,
    createdAt: tripRow.created_at,
    members,
    expenses,
  };
}

export function createTrip(name: string, currency = "INR", symbol = "₹"): Trip {
  const db = getDb();
  const id = generateShortId();
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO trips (id, name, currency, currency_symbol, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, name.trim() || "Untitled Trip", currency, symbol, createdAt);

  return hydrateTrip(id)!;
}

export function getTrip(tripId: string): Trip | undefined {
  return hydrateTrip(tripId.toUpperCase());
}

export function getAllTrips(): Trip[] {
  const db = getDb();
  const rows = db.prepare("SELECT id FROM trips ORDER BY created_at DESC").all() as any[];
  return rows.map((r) => hydrateTrip(r.id)).filter(Boolean) as Trip[];
}

export function addMember(
  tripId: string,
  name: string,
  phone: string
): TripMember | null {
  const db = getDb();
  const normTripId = tripId.toUpperCase();
  const normalized = normalizePhone(phone);

  // Check if trip exists
  const tripExists = db.prepare("SELECT 1 FROM trips WHERE id = ?").get(normTripId);
  if (!tripExists) return null;

  // Check for existing by phone within this trip
  const existing = db
    .prepare("SELECT user_id as userId, name, phone FROM members WHERE trip_id = ? AND phone = ?")
    .get(normTripId, normalized) as TripMember | undefined;

  if (existing) {
    // Update display name if changed
    db.prepare("UPDATE members SET name = ? WHERE trip_id = ? AND phone = ?")
      .run(name.trim(), normTripId, normalized);
    return { ...existing, name: name.trim() };
  }

  const userId = randomUUID();
  const joinedAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO members (user_id, trip_id, name, phone, joined_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, normTripId, name.trim(), normalized, joinedAt);

  return { userId, name: name.trim(), phone: normalized };
}

export function removeMember(tripId: string, userId: string): boolean {
  const db = getDb();
  const normTripId = tripId.toUpperCase();

  // Optional: keep historical expenses even after remove (current behavior)
  db.prepare("DELETE FROM members WHERE trip_id = ? AND user_id = ?").run(normTripId, userId);
  return true;
}

export function addExpense(
  tripId: string,
  input: {
    description: string;
    amount: number;
    category: Category;
    expenseDate: string;
    paidByUserId: string;
    splitUserIds: string[];
    customShares?: { userId: string; amount: number }[];
    notes?: string;
  }
): Expense | null {
  const db = getDb();
  const normTripId = tripId.toUpperCase();

  const trip = getTrip(normTripId);
  if (!trip) return null;

  const totalPaise = Math.round(input.amount * 100);
  if (totalPaise <= 0 || input.splitUserIds.length === 0) return null;

  let shares: ExpenseShare[];

  if (input.customShares?.length) {
    shares = input.customShares.map((cs) => ({ userId: cs.userId, amount: cs.amount }));
    const sum = shares.reduce((a, b) => a + b.amount, 0);
    if (sum !== totalPaise) {
      shares[shares.length - 1].amount += totalPaise - sum;
    }
  } else {
    const perPerson = Math.floor(totalPaise / input.splitUserIds.length);
    let remainder = totalPaise - perPerson * input.splitUserIds.length;
    shares = input.splitUserIds.map((uid, idx) => ({
      userId: uid,
      amount: perPerson + (idx === 0 ? remainder : 0),
    }));
  }

  const expenseId = randomUUID();
  const createdAt = new Date().toISOString();

  // Insert expense
  db.prepare(
    `INSERT INTO expenses 
     (id, trip_id, description, amount, category, expense_date, paid_by_user_id, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    expenseId,
    normTripId,
    input.description.trim(),
    totalPaise,
    input.category,
    input.expenseDate,
    input.paidByUserId,
    input.notes?.trim() || null,
    createdAt
  );

  // Insert shares
  const insertShare = db.prepare(
    "INSERT INTO expense_shares (expense_id, user_id, amount) VALUES (?, ?, ?)"
  );
  for (const s of shares) {
    insertShare.run(expenseId, s.userId, s.amount);
  }

  return getTrip(normTripId)!.expenses.find((e) => e.id === expenseId)!;
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
  const db = getDb();
  const normTripId = tripId.toUpperCase();

  const existing = db.prepare("SELECT * FROM expenses WHERE id = ? AND trip_id = ?").get(expenseId, normTripId) as any;
  if (!existing) return null;

  let newAmount = existing.amount;
  let newShares: ExpenseShare[] | null = null;

  if (input.amount !== undefined) {
    newAmount = Math.round(input.amount * 100);
  }

  // Determine final split
  const finalSplitIds =
    input.splitUserIds && input.splitUserIds.length > 0
      ? input.splitUserIds
      : db
          .prepare("SELECT user_id FROM expense_shares WHERE expense_id = ?")
          .all(expenseId)
          .map((r: any) => r.user_id);

  if (input.amount !== undefined || input.splitUserIds) {
    const perPerson = Math.floor(newAmount / finalSplitIds.length);
    let rem = newAmount - perPerson * finalSplitIds.length;
    newShares = finalSplitIds.map((uid, i) => ({
      userId: uid,
      amount: perPerson + (i === 0 ? rem : 0),
    }));
  }

  // Update expense row
  db.prepare(
    `UPDATE expenses SET 
       description = COALESCE(?, description),
       amount = ?,
       category = COALESCE(?, category),
       expense_date = COALESCE(?, expense_date),
       paid_by_user_id = COALESCE(?, paid_by_user_id),
       notes = COALESCE(?, notes)
     WHERE id = ?`
  ).run(
    input.description?.trim() ?? null,
    newAmount,
    input.category ?? null,
    input.expenseDate ?? null,
    input.paidByUserId ?? null,
    input.notes?.trim() ?? null,
    expenseId
  );

  // Replace shares if changed
  if (newShares) {
    db.prepare("DELETE FROM expense_shares WHERE expense_id = ?").run(expenseId);
    const insert = db.prepare("INSERT INTO expense_shares (expense_id, user_id, amount) VALUES (?, ?, ?)");
    for (const s of newShares) {
      insert.run(expenseId, s.userId, s.amount);
    }
  }

  return getTrip(normTripId)!.expenses.find((e) => e.id === expenseId)!;
}

export function deleteExpense(tripId: string, expenseId: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM expenses WHERE id = ? AND trip_id = ?").run(expenseId, tripId.toUpperCase());
  return result.changes > 0;
}

// === Calculations (unchanged - operate on hydrated Trip) ===

export function calculateBalances(trip: Trip): Balance[] {
  const paidMap = new Map<string, number>();
  const shareMap = new Map<string, number>();

  trip.members.forEach((m) => {
    paidMap.set(m.userId, 0);
    shareMap.set(m.userId, 0);
  });

  for (const exp of trip.expenses) {
    const prevPaid = paidMap.get(exp.paidByUserId) || 0;
    paidMap.set(exp.paidByUserId, prevPaid + exp.amount);

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
  const creditors = balances.filter((b) => b.net > 0).map((b) => ({ ...b }));
  const debtors = balances.filter((b) => b.net < 0).map((b) => ({ ...b }));

  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const cred = creditors[i];
    const debt = debtors[j];
    const amt = Math.min(cred.net, -debt.net);

    if (amt > 1) {
      settlements.push({
        fromUserId: debt.userId,
        fromName: debt.name,
        toUserId: cred.userId,
        toName: cred.name,
        amount: amt,
      });
    }
    cred.net -= amt;
    debt.net += amt;
    if (cred.net < 1) i++;
    if (debt.net > -1) j++;
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
