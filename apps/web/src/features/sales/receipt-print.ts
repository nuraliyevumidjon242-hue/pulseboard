import { formatCurrency, formatDateTime, paymentLabel } from '../../lib/utils';
import type { CreateSaleResponse } from '../../types';

/** Opens a print-ready receipt in a new window. */
export function printReceipt(result: CreateSaleResponse): void {
  const { sale, receipt } = result;
  const rows = sale.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.productName)}</td>
          <td class="num">${item.quantity}</td>
          <td class="num">${formatCurrency(item.unitPrice, receipt.currency)}</td>
          <td class="num">${formatCurrency(item.subtotal, receipt.currency)}</td>
        </tr>`,
    )
    .join('');

  const discount = Number(sale.discount);
  const discountRow =
    discount > 0
      ? `<div class="row"><span>Discount</span><span>-${formatCurrency(sale.discount, receipt.currency)}</span></div>`
      : '';

  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><title>${receipt.transactionId}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-monospace, Menlo, Consolas, monospace; width: 320px; margin: 24px auto; color: #111; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 2px; }
  .muted { text-align: center; color: #555; font-size: 11px; margin: 0; }
  .meta { margin: 14px 0 8px; font-size: 11px; line-height: 1.6; border-top: 1px dashed #999; border-bottom: 1px dashed #999; padding: 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; padding: 4px 0; border-bottom: 1px solid #ddd; }
  td { padding: 4px 0; vertical-align: top; }
  .num { text-align: right; }
  .totals { margin-top: 10px; border-top: 1px dashed #999; padding-top: 8px; font-size: 12px; }
  .row { display: flex; justify-content: space-between; padding: 2px 0; }
  .grand { font-weight: 700; font-size: 15px; margin-top: 4px; }
  .foot { margin-top: 18px; text-align: center; font-size: 10px; color: #555; }
  @media print { body { margin: 0; width: auto; } }
</style></head>
<body>
  <h1>${escapeHtml(receipt.storeName)}</h1>
  <p class="muted">${escapeHtml(receipt.address ?? '')}</p>
  <div class="meta">
    <div>Receipt: ${escapeHtml(receipt.transactionId)}</div>
    <div>Date: ${formatDateTime(receipt.createdAt, 'UTC')}</div>
    <div>Cashier: ${escapeHtml(receipt.cashierName ?? 'Store team')}</div>
    <div>Payment: ${paymentLabel(sale.paymentMethod)}</div>
  </div>
  <table>
    <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${formatCurrency(sale.totalAmount, receipt.currency)}</span></div>
    ${discountRow}
    <div class="row grand"><span>Total</span><span>${formatCurrency(sale.finalAmount, receipt.currency)}</span></div>
  </div>
  <p class="foot">Thank you for shopping with us!<br />Powered by PulseBoard</p>
  <script>window.onload = function () { window.print(); };</script>
</body></html>`;

  const win = window.open('', '_blank', 'width=420,height=720');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
