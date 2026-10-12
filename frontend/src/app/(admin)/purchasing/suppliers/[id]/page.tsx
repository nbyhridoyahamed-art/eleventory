"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useRecordSupplierPayment, useSupplier, useSupplierLedger, useUpdateSupplier } from "@/hooks/use-suppliers";
import { formatMoney } from "@/lib/money";
import { PermissionDenied } from "@/components/permission-denied";
import { SupplierForm } from "@/components/purchasing/supplier-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/types/api";
import type { SupplierPaymentTerms } from "@/types/supplier";

const PAYMENT_TERMS_LABELS: Record<SupplierPaymentTerms, string> = {
  due_on_receipt: "Due on receipt",
  net_15: "Net 15",
  net_30: "Net 30",
  net_60: "Net 60",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  bkash: "bKash",
  nagad: "Nagad",
  cheque: "Cheque",
};

const LEDGER_ENTRY_LABELS: Record<string, string> = { receipt: "Goods received", payment: "Payment", credit: "Return credit" };

function RecordPaymentDialog({ supplierId, open, onOpenChange }: { supplierId: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const recordPayment = useRecordSupplierPayment(supplierId);

  const reset = () => {
    setAmount("");
    setMethod("bank_transfer");
    setReference("");
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>Adds a credit to this supplier&apos;s ledger.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {recordPayment.error instanceof ApiError ? (
            <Alert variant="danger">
              <AlertDescription>{recordPayment.error.message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount">Amount</Label>
              <Input
                id="payment-amount"
                type="number"
                min={0.01}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-method">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="payment-method">
                  <SelectValue>{PAYMENT_METHOD_LABELS[method]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment-reference">Reference (optional)</Label>
            <Input id="payment-reference" placeholder="e.g. transaction ID" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment-note">Note (optional)</Label>
            <Textarea id="payment-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={recordPayment.isPending}
            disabled={!amount || Number(amount) <= 0}
            onClick={() =>
              recordPayment.mutate(
                { amount, method: method as "cash" | "bank_transfer" | "bkash" | "nagad" | "cheque", reference: reference || null, note: note || null },
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    reset();
                  },
                },
              )
            }
          >
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SupplierDetailPage({ params }: PageProps<"/purchasing/suppliers/[id]">) {
  const { id } = use(params);
  const supplierId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const { data: supplier, isLoading, isError } = useSupplier(supplierId);
  const { data: ledger, isLoading: ledgerLoading } = useSupplierLedger(supplierId);
  const updateSupplier = useUpdateSupplier(supplierId);
  const [paymentOpen, setPaymentOpen] = useState(false);

  if (currentUser && !can(currentUser, "suppliers.view")) {
    return <PermissionDenied />;
  }

  if (isLoading || !storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !supplier) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this supplier. It may have been deleted.</AlertDescription>
      </Alert>
    );
  }

  const canUpdate = can(currentUser, "suppliers.update");
  const canPay = can(currentUser, "suppliers.pay");

  return (
    <div className="space-y-4">
      {canUpdate ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit {supplier.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <SupplierForm
              storeId={storeId}
              defaultValues={supplier}
              isPending={updateSupplier.isPending}
              submitLabel="Save changes"
              serverError={updateSupplier.error instanceof ApiError ? updateSupplier.error.message : null}
              onSubmit={(values) =>
                updateSupplier.mutate(values, {
                  onSuccess: () => router.push("/purchasing/suppliers"),
                })
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{supplier.name}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-text-muted">Contact</p>
              <p className="font-medium text-text-primary">{supplier.contact_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-text-muted">Email / Phone</p>
              <p className="font-medium text-text-primary">{supplier.email ?? "—"} / {supplier.phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-text-muted">Payment terms</p>
              <p className="font-medium text-text-primary">
                {supplier.payment_terms ? PAYMENT_TERMS_LABELS[supplier.payment_terms] : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Ledger</CardTitle>
          {canPay ? (
            <Button size="sm" onClick={() => setPaymentOpen(true)}>
              <Wallet />
              Record payment
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {ledgerLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-table">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="px-4 py-2 font-medium text-text-secondary">Date</th>
                      <th className="px-4 py-2 font-medium text-text-secondary">Type</th>
                      <th className="px-4 py-2 font-medium text-text-secondary">Description</th>
                      <th className="px-4 py-2 text-right font-medium text-text-secondary">Debit</th>
                      <th className="px-4 py-2 text-right font-medium text-text-secondary">Credit</th>
                      <th className="px-4 py-2 text-right font-medium text-text-secondary">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger?.entries.length ? (
                      ledger.entries.map((entry, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-4 py-2 text-text-muted">{new Date(entry.date).toLocaleDateString()}</td>
                          <td className="px-4 py-2">
                            <Badge variant={entry.type === "receipt" ? "warning" : "success"}>
                              {LEDGER_ENTRY_LABELS[entry.type]}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-text-primary">{entry.description}</td>
                          <td className="px-4 py-2 text-right text-text-primary">
                            {entry.debit_amount !== null ? formatMoney(entry.debit_amount, ledger.currency_code) : "—"}
                          </td>
                          <td className="px-4 py-2 text-right text-text-primary">
                            {entry.credit_amount !== null ? formatMoney(entry.credit_amount, ledger.currency_code) : "—"}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-text-primary">
                            {formatMoney(entry.running_balance, ledger.currency_code)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-text-muted">
                          No ledger activity yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-right text-sm font-medium text-text-primary">
                Balance owed: {formatMoney(ledger?.balance_amount ?? 0, ledger?.currency_code ?? "BDT")}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <RecordPaymentDialog supplierId={supplierId} open={paymentOpen} onOpenChange={setPaymentOpen} />
    </div>
  );
}
