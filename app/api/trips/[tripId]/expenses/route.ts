import { NextRequest, NextResponse } from "next/server";
import { addExpense, getTrip } from "@/lib/store";
import { Category } from "@/lib/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
    const body = await request.json();

    const {
      description,
      amount,
      category,
      expenseDate,
      paidByUserId,
      splitUserIds,
      notes,
    } = body;

    if (!description || !amount || !category || !paidByUserId || !splitUserIds?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const expense = addExpense(tripId.toUpperCase(), {
      description,
      amount: Number(amount),
      category: category as Category,
      expenseDate: expenseDate || new Date().toISOString().split("T")[0],
      paidByUserId,
      splitUserIds,
      notes,
    });

    if (!expense) {
      return NextResponse.json({ error: "Failed to add expense" }, { status: 400 });
    }

    const trip = getTrip(tripId.toUpperCase());
    return NextResponse.json(trip);
  } catch (error: any) {
    console.error("[POST /api/trips/:tripId/expenses]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save expense" },
      { status: 500 }
    );
  }
}
