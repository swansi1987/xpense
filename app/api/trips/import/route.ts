import { NextRequest, NextResponse } from "next/server";
import { createTrip, addMember, addExpense } from "../../../lib/store";
import { Trip } from "../../../lib/types";

export async function POST(request: NextRequest) {
  try {
    const imported: Trip = await request.json();

    // Create a fresh trip with same meta
    const trip = createTrip(
      imported.name,
      imported.currency,
      imported.currencySymbol
    );

    // Recreate members
    for (const member of imported.members) {
      addMember(trip.id, member.name, member.phone);
    }

    // Recreate expenses (note: paidBy and shares use old userIds - we remap by phone)
    // For simplicity in MVP: we just store the expense using current member ids where names match
    const freshTrip = trip; // re-fetch
    const nameToId: Record<string, string> = {};
    freshTrip.members.forEach((m) => {
      nameToId[m.name] = m.userId;
    });

    for (const exp of [...imported.expenses].reverse()) {
      // try to resolve paidBy
      const paidByName = imported.members.find((m) => m.userId === exp.paidByUserId)?.name;
      const paidById = paidByName ? nameToId[paidByName] : freshTrip.members[0]?.userId;

      const resolvedShares = exp.shares
        .map((s) => {
          const name = imported.members.find((m) => m.userId === s.userId)?.name;
          const uid = name ? nameToId[name] : null;
          return uid ? { userId: uid, amount: s.amount } : null;
        })
        .filter(Boolean) as { userId: string; amount: number }[];

      if (!paidById || resolvedShares.length === 0) continue;

      addExpense(trip.id, {
        description: exp.description,
        amount: exp.amount / 100,
        category: exp.category,
        expenseDate: exp.expenseDate,
        paidByUserId: paidById,
        splitUserIds: resolvedShares.map((s) => s.userId),
        // pass custom shares
        customShares: resolvedShares,
        notes: exp.notes,
      });
    }

    return NextResponse.json(trip);
  } catch (e) {
    return NextResponse.json({ error: "Invalid import data" }, { status: 400 });
  }
}
