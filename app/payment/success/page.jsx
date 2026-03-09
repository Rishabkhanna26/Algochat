const normalizeValue = (value) => {
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
};

const normalizeStatus = (value) => {
  const status = normalizeValue(value).toLowerCase();
  if (["paid", "partially_paid", "cancelled", "failed", "created", "expired"].includes(status)) {
    return status;
  }
  return "unknown";
};

const formatCurrency = (value = 0, currency = "INR") => {
  const amount = Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;
  const normalizedCurrency = String(currency || "INR").trim().toUpperCase() || "INR";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch (_error) {
    return `${normalizedCurrency} ${safe.toFixed(2)}`;
  }
};

const fromPaise = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Number((numeric / 100).toFixed(2));
};

const STATUS_CONFIG = {
  paid: {
    title: "Payment Successful",
    accent: "text-green-700",
    panel: "bg-green-50 border-green-200",
    detail: "Your payment was received successfully.",
  },
  partially_paid: {
    title: "Partial Payment Received",
    accent: "text-blue-700",
    panel: "bg-blue-50 border-blue-200",
    detail: "We received a partial payment. Remaining amount can be paid later.",
  },
  cancelled: {
    title: "Payment Cancelled",
    accent: "text-amber-700",
    panel: "bg-amber-50 border-amber-200",
    detail: "The payment link was cancelled before completion.",
  },
  failed: {
    title: "Payment Failed",
    accent: "text-red-700",
    panel: "bg-red-50 border-red-200",
    detail: "The transaction did not complete. Please try again.",
  },
  created: {
    title: "Payment Pending",
    accent: "text-gray-700",
    panel: "bg-gray-50 border-gray-200",
    detail: "Payment link is active, but payment is not completed yet.",
  },
  expired: {
    title: "Payment Link Expired",
    accent: "text-amber-700",
    panel: "bg-amber-50 border-amber-200",
    detail: "This payment link has expired.",
  },
  unknown: {
    title: "Payment Status Updated",
    accent: "text-gray-700",
    panel: "bg-gray-50 border-gray-200",
    detail: "We received a callback, but status was not recognized.",
  },
};

export default async function PaymentSuccessPage({ searchParams }) {
  const paymentId = normalizeValue(searchParams?.razorpay_payment_id);
  const linkId = normalizeValue(searchParams?.razorpay_payment_link_id);
  const referenceId = normalizeValue(searchParams?.razorpay_payment_link_reference_id);
  const callbackStatus = normalizeStatus(searchParams?.razorpay_payment_link_status);

  const effectiveStatus = normalizeStatus(callbackStatus);
  const config = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.unknown;
  const amountTotal = fromPaise(searchParams?.amount);
  const amountPaid = fromPaise(searchParams?.amount_paid);
  const currency = String(searchParams?.currency || "INR").toUpperCase();
  const transactionId = normalizeValue(searchParams?.razorpay_payment_id);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-10">
      <div className={`w-full max-w-2xl rounded-2xl border p-6 sm:p-8 shadow-sm ${config.panel}`}>
        <h1 className={`text-2xl sm:text-3xl font-bold ${config.accent}`}>{config.title}</h1>
        <p className="mt-3 text-gray-700">{config.detail}</p>

        <div className="mt-6 rounded-xl bg-white border border-gray-200 p-4 sm:p-5 space-y-2">
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-900">Status:</span> {effectiveStatus}
          </p>
          {amountTotal > 0 ? (
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">Amount:</span>{" "}
              {formatCurrency(amountTotal, currency)}
            </p>
          ) : null}
          {amountPaid > 0 ? (
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">Paid:</span>{" "}
              {formatCurrency(amountPaid, currency)}
            </p>
          ) : null}
          {paymentId ? (
            <p className="text-sm text-gray-700 break-all">
              <span className="font-semibold text-gray-900">Payment ID:</span> {paymentId}
            </p>
          ) : null}
          {transactionId ? (
            <p className="text-sm text-gray-700 break-all">
              <span className="font-semibold text-gray-900">Transaction ID:</span> {transactionId}
            </p>
          ) : null}
          {linkId ? (
            <p className="text-sm text-gray-700 break-all">
              <span className="font-semibold text-gray-900">Payment Link ID:</span> {linkId}
            </p>
          ) : null}
          {referenceId ? (
            <p className="text-sm text-gray-700 break-all">
              <span className="font-semibold text-gray-900">Reference ID:</span> {referenceId}
            </p>
          ) : null}
          <p className="text-xs text-amber-700">
            Detailed Razorpay verification now belongs in the backend service.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="https://wa.me/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Back to WhatsApp
          </a>
          <p className="text-sm text-gray-600 self-center">
            If this page shows payment details, your team can verify quickly.
          </p>
        </div>
      </div>
    </div>
  );
}
