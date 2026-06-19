import { NextRequest, NextResponse } from "next/server";
import { createTrip } from "@/lib/store";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, currency = "INR" } = body;

  const symbolMap: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
  };

  const trip = createTrip(name, currency, symbolMap[currency] || "₹");
  return NextResponse.json(trip);
}
