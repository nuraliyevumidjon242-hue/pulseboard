import PDFDocument from 'pdfkit';
import { formatMoney } from './money';
import { formatDateInTimeZone } from './time';

export interface ReportMetric {
  label: string;
  value: string;
  hint?: string;
}

export interface ReportSeriesPoint {
  label: string;
  value: number;
}

export interface ReportTableRow {
  cells: string[];
}

export interface ReportInput {
  storeName: string;
  storeAddress?: string | null;
  currency: string;
  periodLabel: string;
  generatedAt: Date;
  timeZone: string;
  metrics: ReportMetric[];
  series: ReportSeriesPoint[];
  paymentBreakdown: Array<{ method: string; amount: string; count: number }>;
  topProducts: Array<{ name: string; quantity: number; revenue: string }>;
  footer?: string;
}

const INK = '#0f172a';
const MUTED = '#64748b';
const BRAND = '#4f46e5';
const BORDER = '#e2e8f0';
const SOFT = '#f8fafc';

export function renderReportPdf(input: ReportInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 46, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 92;
    const left = 46;

    // ── Header ──────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 8).fill(BRAND);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(24).text('Sales report', left, 48);
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(11)
      .text(`${input.storeName}${input.storeAddress ? ` · ${input.storeAddress}` : ''}`, left, 80);
    doc
      .fontSize(10)
      .fillColor(MUTED)
      .text(
        `${input.periodLabel} · generated ${formatDateInTimeZone(
          input.generatedAt,
          input.timeZone,
          { dateStyle: 'medium', timeStyle: 'short' },
        )}`,
        left,
        96,
      );

    doc
      .fillColor(BRAND)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('PulseBoard', doc.page.width - 160, 52, { width: 114, align: 'right' });
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(8)
      .text('REAL-TIME RETAIL ANALYTICS', doc.page.width - 200, 70, { width: 154, align: 'right' });

    // ── Metric cards ────────────────────────────────────────────
    let y = 132;
    const cardWidth = (pageWidth - 24) / 3;
    input.metrics.slice(0, 6).forEach((metric, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = left + column * (cardWidth + 12);
      const cardY = y + row * 78;

      doc.roundedRect(x, cardY, cardWidth, 66, 8).fillAndStroke(SOFT, BORDER);
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(8)
        .text(metric.label.toUpperCase(), x + 12, cardY + 12, {
          width: cardWidth - 24,
        });
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(17)
        .text(metric.value, x + 12, cardY + 27, { width: cardWidth - 24 });
      if (metric.hint) {
        doc
          .fillColor(MUTED)
          .font('Helvetica')
          .fontSize(8)
          .text(metric.hint, x + 12, cardY + 49, {
            width: cardWidth - 24,
          });
      }
    });

    y += Math.ceil(Math.min(input.metrics.length, 6) / 3) * 78 + 12;

    // ── Revenue series (simple bar chart) ───────────────────────
    if (input.series.length > 0) {
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(13).text('Revenue trend', left, y);
      y += 22;
      const chartHeight = 110;
      const max = Math.max(...input.series.map((point) => point.value), 1);
      const barWidth = Math.max(3, pageWidth / input.series.length - 4);

      doc
        .moveTo(left, y + chartHeight)
        .lineTo(left + pageWidth, y + chartHeight)
        .strokeColor(BORDER)
        .lineWidth(1)
        .stroke();

      input.series.forEach((point, index) => {
        const height = Math.max(2, (point.value / max) * (chartHeight - 10));
        const x = left + index * (pageWidth / input.series.length);
        doc
          .rect(x, y + chartHeight - height, barWidth, height)
          .fill(point.value === max ? BRAND : '#c7d2fe');
      });

      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(8)
        .text(input.series[0]?.label ?? '', left, y + chartHeight + 6);
      doc.text(input.series[input.series.length - 1]?.label ?? '', left, y + chartHeight + 6, {
        width: pageWidth,
        align: 'right',
      });
      doc.text(`Peak: ${formatMoney(max, input.currency)}`, left, y + chartHeight + 6, {
        width: pageWidth,
        align: 'center',
      });

      y += chartHeight + 28;
    }

    // ── Tables ──────────────────────────────────────────────────
    const drawTable = (
      title: string,
      headers: string[],
      rows: ReportTableRow[],
      widths: number[],
    ): void => {
      if (y > doc.page.height - 150) {
        doc.addPage();
        y = 60;
      }
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(13).text(title, left, y);
      y += 20;

      doc.rect(left, y, pageWidth, 22).fill('#eef2ff');
      let x = left;
      headers.forEach((header, index) => {
        doc
          .fillColor('#3730a3')
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(header.toUpperCase(), x + 6, y + 8, { width: (widths[index] ?? 100) - 12 });
        x += widths[index] ?? 100;
      });
      y += 22;

      rows.forEach((row, rowIndex) => {
        if (y > doc.page.height - 60) {
          doc.addPage();
          y = 60;
        }
        if (rowIndex % 2 === 1) doc.rect(left, y, pageWidth, 20).fill(SOFT);
        x = left;
        row.cells.forEach((cell, index) => {
          doc
            .fillColor(INK)
            .font('Helvetica')
            .fontSize(9)
            .text(cell, x + 6, y + 6, { width: (widths[index] ?? 100) - 12, ellipsis: true });
          x += widths[index] ?? 100;
        });
        y += 20;
      });

      y += 18;
    };

    drawTable(
      'Payment methods',
      ['Method', 'Transactions', 'Amount'],
      input.paymentBreakdown.map((row) => ({
        cells: [
          row.method.charAt(0).toUpperCase() + row.method.slice(1),
          String(row.count),
          formatMoney(row.amount, input.currency),
        ],
      })),
      [pageWidth * 0.5, pageWidth * 0.25, pageWidth * 0.25],
    );

    drawTable(
      'Top products',
      ['Product', 'Units sold', 'Revenue'],
      input.topProducts.map((row) => ({
        cells: [row.name, String(row.quantity), formatMoney(row.revenue, input.currency)],
      })),
      [pageWidth * 0.55, pageWidth * 0.2, pageWidth * 0.25],
    );

    // ── Footer ──────────────────────────────────────────────────
    const footer = input.footer ?? 'Confidential — generated automatically by PulseBoard.';
    const range = doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page += 1) {
      doc.switchToPage(page);
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(8)
        .text(footer, left, doc.page.height - 38, { width: pageWidth * 0.7 });
      doc.text(`Page ${page + 1} of ${range.count}`, doc.page.width - 120, doc.page.height - 38, {
        width: 74,
        align: 'right',
      });
    }

    doc.end();
  });
}
