import { NextRequest, NextResponse } from "next/server";
import { addMember, getTrip } from "@/lib/store";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const body = await request.json();
  const { name, phone } = body;

  if (!name || !phone) {
    return NextResponse.json({ error: "Name and phone required" }, { status: 400 });
  }

  const member = addMember(tripId.toUpperCase(), name, phone);
  if (!member) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  // Return updated trip
  const trip = getTrip(tripId.toUpperCase());
  return NextResponse.json(trip);
}
