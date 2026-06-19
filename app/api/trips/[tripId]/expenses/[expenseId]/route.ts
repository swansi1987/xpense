import { NextRequest, NextResponse } from "next/server";
import { updateExpense, deleteExpense, getTrip } from "@/lib/store";
import { Category } from "@/lib/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string; expenseId: string }> }
) {
  try {
    const { tripId, expenseId } = await params;
    const body = await request.json();

    const updated = updateExpense(tripId.toUpperCase(), expenseId, {
      description: body.description,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
      category: body.category as Category,
      expenseDate: body.expenseDate,
      paidByUserId: body.paidByUserId,
      splitUserIds: body.splitUserIds,
      notes: body.notes,
    });

    if (!updated) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const trip = getTrip(tripId.toUpperCase());
    return NextResponse.json(trip);
  } catch (error: any) {
    console.error("[PATCH /api/trips/:tripId/expenses/:expenseId]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update expense" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string; expenseId: string }> }
) {
  const { tripId, expenseId } = await params;
  const ok = deleteExpense(tripId.toUpperCase(), expenseId);

  if (!ok) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 400 });
  }

  const trip = getTrip(tripId.toUpperCase());
  return NextResponse.json(trip);
}
