"use client";

import React, { useEffect, useState } from "react";
import {
  Plus,
  Users,
  Receipt,
  ArrowLeftRight,
  Download,
  Trash2,
  Edit2,
  LogOut,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Trip,
  Expense,
  Category,
  CATEGORIES,
  Balance,
  Settlement,
  normalizePhone,
  formatAmount,
} from "@/lib/types";

// Local type for current user
interface CurrentUser {
  name: string;
  phone: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export default function XpenseApp() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState<"balances" | "expenses" | "settle">("balances");

  const [showLogin, setShowLogin] = useState(true);
  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [showJoinTrip, setShowJoinTrip] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showTripSettings, setShowTripSettings] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form states
  const [loginName, setLoginName] = useState("");
  const [loginPhone, setLoginPhone] = useState("");

  const [newTripName, setNewTripName] = useState("");
  const [newTripCurrency, setNewTripCurrency] = useState("INR");

  const [joinTripId, setJoinTripId] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinPhone, setJoinPhone] = useState("");

  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: "",
    category: "Food & Drinks" as Category,
    expenseDate: format(new Date(), "yyyy-MM-dd"),
    paidByUserId: "",
    splitMode: "equal" as "equal" | "custom",
    selectedMembers: [] as string[],
    notes: "",
  });

  const [balances, setBalances] = useState<Balance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("xpense_user");
    const savedTripId = localStorage.getItem("xpense_current_trip_id");

    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setShowLogin(false);

      if (savedTripId) {
        // Load trip from server
        loadTrip(savedTripId);
      }
    }
  }, []);

  // Persist user
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("xpense_user", JSON.stringify(currentUser));
    }
  }, [currentUser]);

  // Persist current trip id
  useEffect(() => {
    if (currentTrip) {
      localStorage.setItem("xpense_current_trip_id", currentTrip.id);
    }
  }, [currentTrip]);

  // Load trip from API
  async function loadTrip(tripId: string) {
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) {
        localStorage.removeItem("xpense_current_trip_id");
        setCurrentTrip(null);
        return;
      }
      const trip: Trip = await res.json();
      setCurrentTrip(trip);
      setShowLogin(false);
      computeDerived(trip);
    } catch (e) {
      console.error(e);
      toast.error("Could not load trip. It may have expired on the server.");
    }
  }

  function computeDerived(trip: Trip) {
    // We calculate on client for now using local copy
    // For accuracy, we can fetch from server later
    const b: Balance[] = calculateBalancesLocal(trip);
    setBalances(b);
    setSettlements(calculateSettlementsLocal(b));
  }

  function calculateBalancesLocal(trip: Trip): Balance[] {
    const paid: Record<string, number> = {};
    const share: Record<string, number> = {};

    trip.members.forEach((m) => {
      paid[m.userId] = 0;
      share[m.userId] = 0;
    });

    trip.expenses.forEach((exp) => {
      paid[exp.paidByUserId] = (paid[exp.paidByUserId] || 0) + exp.amount;
      exp.shares.forEach((s) => {
        share[s.userId] = (share[s.userId] || 0) + s.amount;
      });
    });

    return trip.members
      .map((m) => {
        const totalPaid = paid[m.userId] || 0;
        const totalShare = share[m.userId] || 0;
        return {
          userId: m.userId,
          name: m.name,
          totalPaid,
          totalShare,
          net: totalPaid - totalShare,
        };
      })
      .sort((a, b) => b.net - a.net);
  }

  function calculateSettlementsLocal(bals: Balance[]): Settlement[] {
    const settlements: Settlement[] = [];
    const creditors = bals.filter((b) => b.net > 0).map((b) => ({ ...b }));
    const debtors = bals.filter((b) => b.net < 0).map((b) => ({ ...b }));

    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const c = creditors[ci];
      const d = debtors[di];
      const amt = Math.min(c.net, -d.net);

      if (amt > 1) {
        settlements.push({
          fromUserId: d.userId,
          fromName: d.name,
          toUserId: c.userId,
          toName: c.name,
          amount: amt,
        });
      }
      c.net -= amt;
      d.net += amt;

      if (c.net < 1) ci++;
      if (d.net > -1) di++;
    }
    return settlements;
  }

  // === Login flow ===
  function handleLogin() {
    const name = loginName.trim();
    const phone = normalizePhone(loginPhone);

    if (!name || phone.length < 6) {
      toast.error("Please enter your name and a valid phone number");
      return;
    }

    const user = { name, phone };
    setCurrentUser(user);
    setShowLogin(false);
    localStorage.setItem("xpense_user", JSON.stringify(user));
    toast.success(`Welcome, ${name}!`);
  }

  function logout() {
    localStorage.removeItem("xpense_user");
    localStorage.removeItem("xpense_current_trip_id");
    setCurrentUser(null);
    setCurrentTrip(null);
    setShowLogin(true);
    setActiveTab("balances");
  }

  // === Trip creation / joining ===
  async function createTrip() {
    if (!newTripName.trim()) {
      toast.error("Please give your trip a name");
      return;
    }
    if (!currentUser) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTripName.trim(),
          currency: newTripCurrency,
        }),
      });
      const trip: Trip = await res.json();

      // Auto add current user as first member
      await fetch(`/api/trips/${trip.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: currentUser.name,
          phone: currentUser.phone,
        }),
      });

      // Reload fresh
      await loadTrip(trip.id);
      setShowCreateTrip(false);
      setNewTripName("");
      toast.success("Trip created! Add some members and start logging expenses.");
    } catch (e) {
      toast.error("Failed to create trip");
    } finally {
      setIsLoading(false);
    }
  }

  async function joinExistingTrip() {
    if (!joinTripId.trim() || !currentUser) return;

    const tripId = joinTripId.trim().toUpperCase();

    setIsLoading(true);
    try {
      // First try loading
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) {
        toast.error("Trip not found. Make sure the code is correct.");
        setIsLoading(false);
        return;
      }

      // Add current user
      await fetch(`/api/trips/${tripId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: currentUser.name, phone: currentUser.phone }),
      });

      await loadTrip(tripId);
      setShowJoinTrip(false);
      setJoinTripId("");
      toast.success("Joined trip successfully!");
    } catch {
      toast.error("Could not join trip");
    } finally {
      setIsLoading(false);
    }
  }

  async function addOrUpdateMember(name: string, phone: string) {
    if (!currentTrip || !currentUser) return;
    const res = await fetch(`/api/trips/${currentTrip.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    if (res.ok) {
      await loadTrip(currentTrip.id);
    }
  }

  // === Expense handling ===
  function openAddExpense() {
    if (!currentTrip) return;

    setEditingExpense(null);
    setExpenseForm({
      description: "",
      amount: "",
      category: "Food & Drinks",
      expenseDate: format(new Date(), "yyyy-MM-dd"),
      paidByUserId: currentTrip.members[0]?.userId || "",
      splitMode: "equal",
      selectedMembers: currentTrip.members.map((m) => m.userId),
      notes: "",
    });
    setShowAddExpense(true);
  }

  function openEditExpense(exp: Expense) {
    if (!currentTrip) return;
    setEditingExpense(exp);

    const memberIds = exp.shares.map((s) => s.userId);

    setExpenseForm({
      description: exp.description,
      amount: (exp.amount / 100).toFixed(2),
      category: exp.category,
      expenseDate: exp.expenseDate,
      paidByUserId: exp.paidByUserId,
      splitMode: "equal",
      selectedMembers: memberIds,
      notes: exp.notes || "",
    });
    setShowAddExpense(true);
  }

  async function saveExpense() {
    if (!currentTrip || !currentUser) return;

    const amountNum = parseFloat(expenseForm.amount);
    if (!amountNum || amountNum <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!expenseForm.description.trim()) {
      toast.error("Enter a description");
      return;
    }

    setIsLoading(true);

    const payload: any = {
      description: expenseForm.description,
      amount: amountNum,
      category: expenseForm.category,
      expenseDate: expenseForm.expenseDate,
      paidByUserId: expenseForm.paidByUserId,
      splitUserIds: expenseForm.selectedMembers,
      notes: expenseForm.notes || undefined,
    };

    try {
      let res;
      if (editingExpense) {
        res = await fetch(
          `/api/trips/${currentTrip.id}/expenses/${editingExpense.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
      } else {
        res = await fetch(`/api/trips/${currentTrip.id}/expenses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error();

      await loadTrip(currentTrip.id);
      setShowAddExpense(false);
      setEditingExpense(null);
      toast.success(editingExpense ? "Expense updated" : "Expense added");
    } catch {
      toast.error("Failed to save expense");
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteExpense(expId: string) {
    if (!currentTrip) return;
    if (!confirm("Delete this expense?")) return;

    const res = await fetch(
      `/api/trips/${currentTrip.id}/expenses/${expId}`,
      { method: "DELETE" }
    );

    if (res.ok) {
      await loadTrip(currentTrip.id);
      toast.success("Expense deleted");
    } else {
      toast.error("Failed to delete");
    }
  }

  // === Sharing & Export ===
  function copyTripCode() {
    if (!currentTrip) return;
    navigator.clipboard.writeText(currentTrip.id);
    toast.success(`Trip code copied: ${currentTrip.id}`);
  }

  function exportTrip() {
    if (!currentTrip) return;

    const data = JSON.stringify(currentTrip, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xpense-${currentTrip.name.replace(/\s+/g, "-")}-${currentTrip.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Trip exported. Keep this file safe.");
  }

  async function importTripFromFile(file: File) {
    try {
      const text = await file.text();
      const imported: Trip = JSON.parse(text);

      // Post to server to recreate
      const res = await fetch("/api/trips/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(imported),
      });

      if (!res.ok) throw new Error();
      const newTrip: Trip = await res.json();
      await loadTrip(newTrip.id);
      toast.success("Trip imported successfully!");
    } catch {
      toast.error("Invalid trip file");
    }
  }

  function leaveTrip() {
    localStorage.removeItem("xpense_current_trip_id");
    setCurrentTrip(null);
    setBalances([]);
    setSettlements([]);
    setActiveTab("balances");
  }

  // === Render Helpers ===
  const symbol = currentTrip?.currencySymbol || "₹";

  function getMemberName(userId: string) {
    return currentTrip?.members.find((m) => m.userId === userId)?.name || "Unknown";
  }

  // === UI ===
  if (showLogin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="mb-8">
          <div className="w-16 h-16 bg-[#0f766e] rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <Receipt className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tighter">Xpense</h1>
          <p className="text-[#64748b] mt-1">Track & split travel expenses together</p>
        </div>

        <div className="w-full max-w-sm space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-left">Your Name</label>
            <input
              className="input"
              placeholder="Rahul Sharma"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-left">Phone Number</label>
            <input
              className="input"
              placeholder="98765 43210"
              value={loginPhone}
              onChange={(e) => setLoginPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              inputMode="tel"
            />
            <p className="text-xs text-[#64748b] mt-1 text-left">
              No password. We use your name + number to identify you in trips.
            </p>
          </div>

          <button onClick={handleLogin} className="btn btn-primary w-full py-3 mt-2 text-base">
            Continue
          </button>
        </div>

        <p className="mt-10 text-xs text-[#64748b]">
          Built for group travel • Mobile friendly
        </p>
      </div>
    );
  }

  if (!currentTrip) {
    return (
      <div className="p-6 pt-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter">Hi, {currentUser?.name}</h1>
            <p className="text-[#64748b]">Ready to track some expenses?</p>
          </div>
          <button onClick={logout} className="text-sm text-[#64748b] flex items-center gap-1">
            <LogOut className="w-4 h-4" /> Switch user
          </button>
        </div>

        <div className="grid gap-4">
          <button
            onClick={() => {
              setShowCreateTrip(true);
              setShowJoinTrip(false);
            }}
            className="btn btn-primary w-full py-4 text-lg"
          >
            <Plus className="w-5 h-5" /> Create a new trip
          </button>

          <button
            onClick={() => {
              setShowJoinTrip(true);
              setShowCreateTrip(false);
            }}
            className="btn btn-secondary w-full py-4 text-lg"
          >
            <Users className="w-5 h-5" /> Join an existing trip
          </button>
        </div>

        {/* Create Trip Modal */}
        {showCreateTrip && (
          <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
            <div className="modal bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6">
              <h3 className="text-xl font-semibold mb-4">Create New Trip</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Trip Name</label>
                  <input
                    className="input mt-1.5"
                    placeholder="Goa Trip 2026"
                    value={newTripName}
                    onChange={(e) => setNewTripName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Currency</label>
                  <select
                    className="select mt-1.5"
                    value={newTripCurrency}
                    onChange={(e) => setNewTripCurrency(e.target.value)}
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowCreateTrip(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button onClick={createTrip} disabled={isLoading} className="btn btn-primary flex-1">
                  Create Trip
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Join Trip Modal */}
        {showJoinTrip && (
          <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
            <div className="modal bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6">
              <h3 className="text-xl font-semibold mb-4">Join Trip</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Trip Code (e.g. A3K9P2)</label>
                  <input
                    className="input mt-1.5 font-mono uppercase tracking-widest text-center text-lg"
                    placeholder="ABC123"
                    value={joinTripId}
                    onChange={(e) => setJoinTripId(e.target.value)}
                    maxLength={8}
                  />
                </div>
                <p className="text-xs text-[#64748b]">
                  Ask the trip creator for the 6-character code.
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowJoinTrip(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button onClick={joinExistingTrip} disabled={isLoading} className="btn btn-primary flex-1">
                  Join
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-auto pt-12 text-center text-xs text-[#64748b]">
          Data lives on the server while the app is running.
          <br /> Export often as backup.
        </div>
      </div>
    );
  }

  // === Main App (has a trip) ===
  const summaryTotal = currentTrip.expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#f8fafc]/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0f766e] flex items-center justify-center flex-shrink-0">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold tracking-tight text-lg leading-none">{currentTrip.name}</div>
            <div className="text-[10px] text-[#64748b] font-mono tracking-[2px] mt-0.5">
              {currentTrip.id}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={copyTripCode} className="p-2 text-[#64748b] active:bg-slate-100 rounded-lg">
            <Share2 className="w-4 h-4" />
          </button>
          <button onClick={() => setShowTripSettings(true)} className="p-2 text-[#64748b] active:bg-slate-100 rounded-lg">
            <Users className="w-4 h-4" />
          </button>
          <button onClick={leaveTrip} className="p-2 text-[#64748b] active:bg-slate-100 rounded-lg">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="card p-4 flex justify-between items-end">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#64748b]">Total Spent</div>
            <div className="big-number mt-0.5 text-[#0f172a]">{formatAmount(summaryTotal, symbol)}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-[#64748b]">{currentTrip.expenses.length} expenses</div>
            <div className="text-sm text-[#64748b]">{currentTrip.members.length} people</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mx-4 mt-1 sticky top-[57px] bg-[#f8fafc] z-30">
        {[
          { id: "balances", label: "Balances", icon: Users },
          { id: "expenses", label: "Expenses", icon: Receipt },
          { id: "settle", label: "Settle Up", icon: ArrowLeftRight },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition ${
                isActive
                  ? "border-[#0f766e] text-[#0f766e]"
                  : "border-transparent text-[#64748b]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {/* BALANCES TAB */}
        {activeTab === "balances" && (
          <div className="space-y-3">
            <div className="text-sm font-medium px-1 text-[#64748b]">Who’s up and who’s down</div>
            {balances.length === 0 && <p className="text-sm text-[#64748b] p-4">No expenses yet.</p>}

            {balances.map((b) => (
              <div key={b.userId} className="card p-4 flex justify-between items-center">
                <div>
                  <div className="font-semibold">{b.name}</div>
                  <div className="text-xs text-[#64748b]">
                    Paid {formatAmount(b.totalPaid, symbol)} • Share {formatAmount(b.totalShare, symbol)}
                  </div>
                </div>
                <div className={`text-right font-semibold tabular-nums ${b.net >= 0 ? "balance-positive" : "balance-negative"}`}>
                  {b.net >= 0 ? "+" : ""}{formatAmount(b.net, symbol)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* EXPENSES TAB */}
        {activeTab === "expenses" && (
          <div>
            <div className="flex justify-between items-center mb-3 px-1">
              <div className="text-sm font-medium text-[#64748b]">All expenses</div>
              <button onClick={exportTrip} className="text-xs flex items-center gap-1 text-[#0f766e]">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>

            {currentTrip.expenses.length === 0 && (
              <div className="text-center py-10 text-[#64748b]">
                No expenses recorded yet.<br />Tap the + button to add one.
              </div>
            )}

            <div className="space-y-2">
              {currentTrip.expenses.map((exp) => (
                <div key={exp.id} className="card p-4 expense-row" onClick={() => openEditExpense(exp)}>
                  <div className="flex justify-between">
                    <div>
                      <div className="font-medium">{exp.description}</div>
                      <div className="text-xs text-[#64748b]">
                        {format(new Date(exp.expenseDate), "dd MMM")} • {getMemberName(exp.paidByUserId)} paid
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold tabular-nums">{formatAmount(exp.amount, symbol)}</div>
                      <div className="text-[10px] text-[#64748b]">{exp.category}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-between items-center">
                    <div className="text-xs text-[#64748b]">
                      Split {exp.shares.length} way{exp.shares.length > 1 ? "s" : ""}
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => openEditExpense(exp)} className="p-1 text-[#64748b]">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteExpense(exp.id)} className="p-1 text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTLE UP TAB */}
        {activeTab === "settle" && (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-3 px-1">Suggested settlements</div>
              {settlements.length === 0 ? (
                <div className="card p-6 text-center text-[#64748b]">
                  Everyone is settled! 🎉
                </div>
              ) : (
                settlements.map((s, index) => (
                  <div key={index} className="card p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold">{s.fromName}</span>
                        <span className="mx-1.5 text-[#64748b]">pays</span>
                        <span className="font-semibold">{s.toName}</span>
                      </div>
                      <div className="font-semibold text-lg tabular-nums">
                        {formatAmount(s.amount, symbol)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs px-1 text-[#64748b]">
              These are minimal transfers to make all balances zero.
            </p>
          </div>
        )}
      </div>

      {/* FAB - Add Expense */}
      <button
        onClick={openAddExpense}
        className="fixed bottom-6 right-5 z-50 shadow-xl btn btn-primary rounded-full w-14 h-14 p-0 flex items-center justify-center"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add/Edit Expense Modal */}
      {showAddExpense && currentTrip && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setShowAddExpense(false)}>
          <div
            className="modal w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between mb-4 items-center">
              <div className="font-semibold text-xl">{editingExpense ? "Edit Expense" : "Add Expense"}</div>
              <button onClick={() => { setShowAddExpense(false); setEditingExpense(null); }} className="text-xl leading-none">×</button>
            </div>

            <div className="space-y-4">
              {/* Amount */}
              <div>
                <label className="text-xs font-medium text-[#64748b]">AMOUNT</label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-2xl font-medium text-[#64748b]">{symbol}</div>
                  <input
                    type="number"
                    step="0.01"
                    className="input text-2xl font-semibold flex-1"
                    placeholder="0.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-[#64748b]">DESCRIPTION</label>
                <input
                  className="input mt-1.5"
                  placeholder="Hotel deposit, dinner, cab to airport..."
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-medium text-[#64748b] mb-1.5 block">CATEGORY</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <div
                      key={cat}
                      onClick={() => setExpenseForm({ ...expenseForm, category: cat })}
                      className={`category-chip text-sm ${expenseForm.category === cat ? "active" : ""}`}
                    >
                      {cat}
                    </div>
                  ))}
                </div>
              </div>

              {/* Paid By */}
              <div>
                <label className="text-xs font-medium text-[#64748b]">PAID BY</label>
                <select
                  className="select mt-1.5"
                  value={expenseForm.paidByUserId}
                  onChange={(e) => setExpenseForm({ ...expenseForm, paidByUserId: e.target.value })}
                >
                  {currentTrip.members.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="text-xs font-medium text-[#64748b]">DATE</label>
                <input
                  type="date"
                  className="input mt-1.5"
                  value={expenseForm.expenseDate}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                />
              </div>

              {/* Split */}
              <div>
                <label className="text-xs font-medium text-[#64748b]">SPLIT AMONG</label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {currentTrip.members.map((m) => {
                    const isSelected = expenseForm.selectedMembers.includes(m.userId);
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => {
                          let selected = [...expenseForm.selectedMembers];
                          if (isSelected) {
                            if (selected.length > 1) selected = selected.filter((id) => id !== m.userId);
                          } else {
                            selected.push(m.userId);
                          }
                          setExpenseForm({ ...expenseForm, selectedMembers: selected });
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm border ${isSelected ? "bg-[#0f766e] text-white border-[#0f766e]" : "border-[#cbd5e1]"}`}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-[#64748b] mt-1">Equal split among selected people</p>
              </div>

              <div>
                <label className="text-xs font-medium text-[#64748b]">NOTES (OPTIONAL)</label>
                <input
                  className="input mt-1.5"
                  placeholder="Bill no. 284, paid in cash..."
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAddExpense(false); setEditingExpense(null); }}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button onClick={saveExpense} disabled={isLoading} className="btn btn-primary flex-1">
                {editingExpense ? "Save Changes" : "Add Expense"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trip Settings Drawer */}
      {showTripSettings && currentTrip && (
        <div className="fixed inset-0 bg-black/40 z-[80] flex items-end" onClick={() => setShowTripSettings(false)}>
          <div className="modal w-full bg-white rounded-t-2xl p-5 max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-xl mb-4">Trip Settings</div>

            <div className="mb-4">
              <div className="text-sm font-medium mb-2">Members ({currentTrip.members.length})</div>
              <div className="space-y-2">
                {currentTrip.members.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl">
                    <div>
                      <div>{m.name}</div>
                      <div className="font-mono text-xs text-[#64748b]">+{m.phone}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add member */}
            <div className="mb-6">
              <div className="text-sm font-medium mb-2">Add person</div>
              <AddMemberForm onAdd={addOrUpdateMember} />
            </div>

            <div className="border-t pt-4 flex flex-col gap-2">
              <button onClick={exportTrip} className="btn btn-secondary w-full">
                <Download className="w-4 h-4" /> Export trip data (backup)
              </button>
              <label className="btn btn-secondary w-full cursor-pointer text-center">
                Import trip from file
                <input type="file" accept=".json" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importTripFromFile(f);
                  setShowTripSettings(false);
                }} />
              </label>

              <button onClick={() => { setShowTripSettings(false); leaveTrip(); }} className="text-red-600 text-sm mt-2">
                Leave this trip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Small component for adding member inline
function AddMemberForm({ onAdd }: { onAdd: (name: string, phone: string) => void }) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");

  return (
    <div className="flex gap-2">
      <input className="input flex-1" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input w-32" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
      <button
        className="btn btn-primary px-4"
        onClick={() => {
          if (name.trim() && phone.trim()) {
            onAdd(name, phone);
            setName("");
            setPhone("");
          }
        }}
      >
        Add
      </button>
    </div>
  );
}
