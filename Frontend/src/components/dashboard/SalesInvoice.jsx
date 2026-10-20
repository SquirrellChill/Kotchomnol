import React, { forwardRef } from 'react';
import { formatDisplayDate, resolveUnitPrice } from '../../utils/sales';
import './SalesInvoice.css';

// A4 at 96 dpi. Pages are laid out in CSS pixels and captured one at a time.
export const INVOICE_PAGE_HEIGHT = 1123;

const formatMoney = (value, currency) => {
  const n = Number(value || 0);
  if (currency === 'USD') {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${Math.round(n).toLocaleString('en-US')} ៛`;
};

/**
 * Flattens sales into invoice lines (oldest first) and totals them per
 * currency. Grand totals are derived from the same lines so the table and
 * the totals always agree.
 */
export function buildInvoiceData(sales, { isKm, exchangeRate }) {
  const lang = isKm ? 'km' : 'en';
  const sorted = [...sales].sort((a, b) => new Date(a.date) - new Date(b.date));

  const lines = [];
  let subtotalUSD = 0;
  let subtotalKHR = 0;
  let itemsSold = 0;

  sorted.forEach((sale) => {
    (sale.items || []).forEach((item, idx) => {
      const qty = Number(item.quantity || 0);
      const unitPrice = resolveUnitPrice(item);
      const currency = item.currency === 'USD' ? 'USD' : 'KHR';
      const amount = item.amount ? Number(item.amount) : qty * unitPrice;

      if (currency === 'USD') subtotalUSD += amount;
      else subtotalKHR += amount;
      itemsSold += qty;

      lines.push({
        key: `${sale.id}-${item.id ?? idx}`,
        date: formatDisplayDate(sale.date, lang),
        description: item.product || item.description || (isKm ? 'ទំនិញទូទៅ' : 'General item'),
        qty,
        unitPrice,
        currency,
        amount,
      });
    });
  });

  return {
    lines,
    transactions: sorted.length,
    itemsSold,
    subtotalUSD,
    subtotalKHR,
    grandUSD: subtotalUSD + subtotalKHR / exchangeRate,
    grandKHR: subtotalKHR + subtotalUSD * exchangeRate,
  };
}

function InvoiceHeader({ meta, L, compact }) {
  if (compact) {
    return (
      <div className="inv-header-compact" data-block="header-compact">
        <strong>{meta.shopName}</strong>
        <span>{L('វិក្កយបត្រ', 'Invoice')} {meta.invoiceNo} · {L('បន្ត', 'continued')}</span>
      </div>
    );
  }

  return (
    <div data-block="header">
      <div className="inv-header">
        <div className="inv-shop">
          <h1 className="inv-shop-name">{meta.shopName}</h1>
          {meta.ownerName && meta.ownerName !== meta.shopName && <div>{meta.ownerName}</div>}
          {meta.phone && <div>{meta.phone}</div>}
          {meta.email && <div>{meta.email}</div>}
        </div>
        <div className="inv-doc">
          <div className="inv-doc-title">KotChomnol</div>
          <table className="inv-meta">
            <tbody>
              <tr><th>{L('លេខ', 'No.')}</th><td>{meta.invoiceNo}</td></tr>
              <tr><th>{L('ថ្ងៃចេញ', 'Issued')}</th><td>{meta.issuedLabel}</td></tr>
              <tr><th>{L('រយៈពេល', 'Period')}</th><td>{meta.periodLabel}</td></tr>
              <tr><th /><td className="inv-meta-range">{meta.rangeLabel}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="inv-rule" />
    </div>
  );
}

function InvoiceSummary({ data, L }) {
  const cells = [
    [L('ប្រតិបត្តិការ', 'Transactions'), data.transactions.toLocaleString('en-US')],
    [L('ទំនិញលក់បាន', 'Items sold'), data.itemsSold.toLocaleString('en-US')],
    [L('សរុប (USD)', 'Total (USD)'), formatMoney(data.grandUSD, 'USD')],
    [L('សរុប (KHR)', 'Total (KHR)'), formatMoney(data.grandKHR, 'KHR')],
  ];
  return (
    <div className="inv-summary" data-block="summary">
      {cells.map(([label, value]) => (
        <div key={label} className="inv-summary-cell">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function InvoiceTable({ lines, startIndex, L, empty }) {
  return (
    <table className="inv-table">
      <thead data-block="thead">
        <tr>
          <th className="inv-c-no">#</th>
          <th className="inv-c-date">{L('កាលបរិច្ឆេទ', 'Date')}</th>
          <th>{L('បរិយាយ', 'Description')}</th>
          <th className="inv-num inv-c-qty">{L('ចំនួន', 'Qty')}</th>
          <th className="inv-num inv-c-price">{L('តម្លៃឯកតា', 'Unit price')}</th>
          <th className="inv-num inv-c-amount">{L('ទឹកប្រាក់', 'Amount')}</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, i) => (
          <tr key={line.key} data-row>
            <td className="inv-c-no">{startIndex + i + 1}</td>
            <td className="inv-c-date">{line.date}</td>
            <td className="inv-desc">{line.description}</td>
            <td className="inv-num">{line.qty.toLocaleString('en-US')}</td>
            <td className="inv-num">{formatMoney(line.unitPrice, line.currency)}</td>
            <td className="inv-num inv-strong">{formatMoney(line.amount, line.currency)}</td>
          </tr>
        ))}
        {empty && (
          <tr>
            <td colSpan={6} className="inv-empty">{L('មិនមានការលក់ក្នុងកំឡុងពេលនេះទេ។', 'No sales recorded in this period.')}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function InvoiceTotals({ data, meta, L }) {
  return (
    <div data-block="totals">
      <div className="inv-totals">
        <div className="inv-totals-row"><span>{L('សរុបរង (ទំនិញជាដុល្លារ)', 'Subtotal (USD items)')}</span><span>{formatMoney(data.subtotalUSD, 'USD')}</span></div>
        <div className="inv-totals-row"><span>{L('សរុបរង (ទំនិញជារៀល)', 'Subtotal (KHR items)')}</span><span>{formatMoney(data.subtotalKHR, 'KHR')}</span></div>
        <div className="inv-totals-row inv-muted"><span>{L('អត្រាប្តូរប្រាក់', 'Exchange rate')}</span><span>1 USD = {meta.exchangeRate.toLocaleString('en-US')} ៛</span></div>
        <div className="inv-totals-grand">
          <span>{L('សរុបរួម', 'Grand total')}</span>
          <span>
            <strong>{formatMoney(data.grandUSD, 'USD')}</strong>
            <small>≈ {formatMoney(data.grandKHR, 'KHR')}</small>
          </span>
        </div>
      </div>
      <p className="inv-note">
        {L(
          'វិក្កយបត្រនេះសង្ខេបការលក់ដែលបានកត់ត្រាក្នុង KOTCHOMNOL សម្រាប់រយៈពេលខាងលើ។ សូមអរគុណ!',
          'This invoice summarises the sales recorded in KOTCHOMNOL for the period above. Thank you!'
        )}
      </p>
    </div>
  );
}

function InvoiceFooter({ meta, L, pageLabel }) {
  return (
    <div className="inv-footer" data-block="footer">
      <span className="inv-brand">
        <img src="/logo-mascot.png" alt="" />
        {L('បង្កើតដោយ KOTCHOMNOL', 'Generated with KOTCHOMNOL')} · {meta.generatedLabel}
      </span>
      {pageLabel && <span>{pageLabel}</span>}
    </div>
  );
}

/** One continuous sheet: used for PNG/JPG and for measuring PDF page breaks. */
export const InvoiceSheet = forwardRef(function InvoiceSheet({ data, meta, isKm }, ref) {
  const L = (km, en) => (isKm ? km : en);
  return (
    <div className="inv-sheet" ref={ref}>
      <InvoiceHeader meta={meta} L={L} />
      <InvoiceSummary data={data} L={L} />
      <InvoiceTable lines={data.lines} startIndex={0} L={L} empty={data.lines.length === 0} />
      <InvoiceTotals data={data} meta={meta} L={L} />
      <InvoiceFooter meta={meta} L={L} />
    </div>
  );
});

/** Fixed-size A4 pages for PDF. `layout` is the output of paginateInvoice. */
export const InvoicePages = forwardRef(function InvoicePages({ data, meta, isKm, layout }, ref) {
  const L = (km, en) => (isKm ? km : en);
  return (
    <div ref={ref}>
      {layout.map((page, i) => (
        <div key={i} className="inv-page" data-page>
          <InvoiceHeader meta={meta} L={L} compact={i > 0} />
          {i === 0 && <InvoiceSummary data={data} L={L} />}
          {(page.end > page.start || (i === 0 && data.lines.length === 0)) && (
            <InvoiceTable
              lines={data.lines.slice(page.start, page.end)}
              startIndex={page.start}
              L={L}
              empty={data.lines.length === 0}
            />
          )}
          {page.totals && <InvoiceTotals data={data} meta={meta} L={L} />}
          <div className="inv-page-spacer" />
          <InvoiceFooter
            meta={meta}
            L={L}
            pageLabel={L(`ទំព័រ ${i + 1} / ${layout.length}`, `Page ${i + 1} of ${layout.length}`)}
          />
        </div>
      ))}
    </div>
  );
});

/**
 * Splits invoice rows across A4 pages using heights measured from a rendered
 * InvoiceSheet, so long product names that wrap never get cut in half.
 */
export function paginateInvoice(sheetEl) {
  const height = (selector) => sheetEl.querySelector(selector)?.getBoundingClientRect().height || 0;
  const rows = Array.from(sheetEl.querySelectorAll('[data-row]')).map((r) => r.getBoundingClientRect().height);

  const pagePadding = 96; // .inv-page top + bottom padding
  const usable = INVOICE_PAGE_HEIGHT - pagePadding - height('[data-block="footer"]') - 24;
  const thead = height('[data-block="thead"]');
  const totals = height('[data-block="totals"]');
  const compactHeader = 56;

  const pages = [];
  let start = 0;
  let used = height('[data-block="header"]') + height('[data-block="summary"]') + thead;

  rows.forEach((rowHeight, i) => {
    if (used + rowHeight > usable && i > start) {
      pages.push({ start, end: i, totals: false });
      start = i;
      used = compactHeader + thead;
    }
    used += rowHeight;
  });

  if (used + totals > usable && rows.length > start) {
    pages.push({ start, end: rows.length, totals: false });
    pages.push({ start: rows.length, end: rows.length, totals: true });
  } else {
    pages.push({ start, end: rows.length, totals: true });
  }

  return pages;
}
