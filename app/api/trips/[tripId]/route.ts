import { NextRequest, NextResponse } from "next/server";
import { getTrip } from "../../../../lib/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const trip = getTrip(tripId.toUpperCase());

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }
  return NextResponse.json(trip);
}
