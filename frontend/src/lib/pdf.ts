// Real, downloadable PDF generation for the Loading Guide feature — replaces the old
// window.print()-to-a-new-tab flow with an actual .pdf file saved to disk.
//
// jsPDF is loaded via a dynamic import() rather than a top-level import, so a missing
// `npm install` doesn't break the whole app bundle — only these two functions fail
// (with a clear thrown error) until the dependency is installed. Run `npm install` in
// frontend/ to pick up the "jspdf" entry added to package.json.

import { COMPANY_INFO } from './freight';

async function loadJsPDF() {
  const mod = await import('jspdf');
  return mod.default;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function formatDropOffDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export interface LoadingGuidePdfRow {
  description: string;
  height: number;
  width: number;
  length: number;
  pieces: number;
  cubes: number;
}

export interface LoadingGuidePdfOpts {
  drNumber: string;
  dropOffDate: string;
  destination: string;
  dropOffBy: string;
  consignee: string;
  description: string;
  items: LoadingGuidePdfRow[];
  totalCubes: number;
  totalPieces: number;
}

// The full Loading Guide document — logo/header, meta grid, consignee/description,
// measurement table (incl. PC column) and totals — as a real downloadable PDF.
export async function downloadLoadingGuidePdf(opts: LoadingGuidePdfOpts) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  const pageW = 612;
  const pageH = 792;
  const margin = 40;
  const contentW = pageW - margin * 2;
  const blue: [number, number, number] = [37, 99, 235];
  const black: [number, number, number] = [0, 0, 0];
  const lightBorder: [number, number, number] = [225, 228, 232];
  const boxFill: [number, number, number] = [249, 250, 251];

  let y = margin;

  // Header — logo + company name/address on the left, "LOADING GUIDE" + DR# on the right.
  try {
    const logo = await loadImage('/logo-print.png');
    doc.addImage(logo, 'PNG', margin, y, 40, 40);
  } catch {
    // Logo failed to load (offline, asset missing) — continue without it rather than
    // failing the whole PDF.
  }
  doc.setTextColor(...black);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(COMPANY_INFO.name, margin + 50, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(COMPANY_INFO.address, margin + 50, y + 32);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...blue);
  doc.text('LOADING GUIDE', pageW - margin, y + 10, { align: 'right' });
  doc.setTextColor(...black);
  doc.setFontSize(20);
  doc.text(opts.drNumber || '—', pageW - margin, y + 32, { align: 'right' });

  y += 56;
  doc.setDrawColor(...lightBorder);
  doc.setLineWidth(1);
  doc.line(margin, y, pageW - margin, y);
  y += 20;

  // Meta grid — 4 equal boxes: Drop Off Date / DR# / Destination / Drop Off By.
  const metaGap = 10;
  const metaW = (contentW - metaGap * 3) / 4;
  const metaH = 46;
  const metaItems = [
    ['DROP OFF DATE', formatDropOffDate(opts.dropOffDate)],
    ['DR#', opts.drNumber || '—'],
    ['DESTINATION', opts.destination || '—'],
    ['DROP OFF BY', opts.dropOffBy || '—'],
  ];
  metaItems.forEach(([label, value], i) => {
    const bx = margin + i * (metaW + metaGap);
    doc.setFillColor(...boxFill);
    doc.roundedRect(bx, y, metaW, metaH, 6, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...black);
    doc.text(label, bx + 10, y + 16);
    doc.setFontSize(11);
    doc.text(value, bx + 10, y + 32, { maxWidth: metaW - 20 });
  });
  y += metaH + 22;

  // Consignee / Description.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CONSIGNEE', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const consigneeLines = doc.splitTextToSize(opts.consignee || '—', contentW);
  doc.text(consigneeLines, margin, y + 15);
  y += 15 + consigneeLines.length * 13 + 12;

  if (opts.description) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('DESCRIPTION', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const descLines = doc.splitTextToSize(opts.description, contentW);
    doc.text(descLines, margin, y + 15);
    y += 15 + descLines.length * 13 + 12;
  }

  y += 10;

  // Measurement table.
  const cols = [
    { key: 'description', label: 'DESCRIPTION', w: contentW - 60 * 4 - 70, align: 'left' as const },
    { key: 'pieces', label: 'PC', w: 60, align: 'right' as const },
    { key: 'height', label: 'HEIGHT', w: 60, align: 'right' as const },
    { key: 'width', label: 'WIDTH', w: 60, align: 'right' as const },
    { key: 'length', label: 'LENGTH', w: 60, align: 'right' as const },
    { key: 'cubes', label: 'CUBES', w: 70, align: 'right' as const },
  ];

  const drawTableHeader = () => {
    let x = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...blue);
    cols.forEach(c => {
      doc.text(c.label, c.align === 'right' ? x + c.w : x, y, { align: c.align });
      x += c.w;
    });
    y += 6;
    doc.setDrawColor(...blue);
    doc.setLineWidth(1.5);
    doc.line(margin, y, pageW - margin, y);
    y += 16;
  };

  drawTableHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...black);
  opts.items.forEach(item => {
    if (y > pageH - 120) {
      doc.addPage();
      y = margin;
      drawTableHeader();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...black);
    }
    let x = margin;
    const values: Record<string, string> = {
      description: item.description || '—',
      pieces: String(item.pieces || 1),
      height: String(item.height || 0),
      width: String(item.width || 0),
      length: String(item.length || 0),
      cubes: String(item.cubes || 0),
    };
    cols.forEach(c => {
      if (c.key === 'cubes') doc.setFont('helvetica', 'bold'); else doc.setFont('helvetica', 'normal');
      doc.text(values[c.key], c.align === 'right' ? x + c.w : x, y, { align: c.align });
      x += c.w;
    });
    y += 6;
    doc.setDrawColor(...lightBorder);
    doc.setLineWidth(0.75);
    doc.line(margin, y, pageW - margin, y);
    y += 16;
  });

  // Totals — PC and Cubes side by side, right-aligned.
  y += 14;
  if (y > pageH - 80) { doc.addPage(); y = margin; }
  const totalBoxW = 130;
  const totalBoxH = 44;
  const totalsX2 = pageW - margin - totalBoxW;
  const totalsX1 = totalsX2 - 12 - totalBoxW;
  [
    { x: totalsX1, label: 'TOTAL PC', value: String(opts.totalPieces || 0) },
    { x: totalsX2, label: 'TOTAL CUBES', value: String(opts.totalCubes || 0) },
  ].forEach(({ x, label, value }) => {
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(x, y, totalBoxW, totalBoxH, 8, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...blue);
    doc.text(label, x + 12, y + 17);
    doc.setFontSize(17);
    doc.setTextColor(...black);
    doc.text(value, x + 12, y + 35);
  });
  y += totalBoxH + 30;

  // Footer.
  if (y > pageH - 40) { doc.addPage(); y = pageH - 60; }
  doc.setDrawColor(...lightBorder);
  doc.setLineWidth(1);
  doc.line(margin, y, pageW - margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...black);
  doc.text(`${COMPANY_INFO.name}  ·  ${COMPANY_INFO.phone}  ·  ${COMPANY_INFO.website}`, pageW / 2, y + 16, { align: 'center' });

  doc.save(`Loading-Guide-${opts.drNumber || 'RXL'}.pdf`);
}

export interface DrLabelPdfOpts {
  drNumber: string;
  totalPieces: number;
}

// Shrinks the font size (bold Helvetica) until `text` fits within `maxWidth`, so long
// DR numbers never overflow their box — starts big and only backs off as needed.
function fitBoldFontSize(doc: any, text: string, maxWidth: number, maxSize: number, minSize = 14): number {
  let size = maxSize;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  while (size > minSize && doc.getTextWidth(text) > maxWidth) {
    size -= 1;
    doc.setFontSize(size);
  }
  return size;
}

// DR shipping label — 6in wide x 4in tall (landscape), one page per physical piece so
// the admin can print and stick one label on each box/pallet. Matches the reference
// layout: logo centered on top (fixed size, independent of the label's own
// dimensions), a "PCS" row (label + piece-index + total-pieces) and a "DR#" row
// (label + DR number), each in a black-bordered rounded box, with the text sized as
// large as each cell can hold.
export async function downloadDrLabelPdf(opts: DrLabelPdfOpts) {
  const jsPDF = await loadJsPDF();
  const pageW = 432; // 6in
  const pageH = 288; // 4in
  const doc = new jsPDF({ unit: 'pt', format: [pageW, pageH], orientation: 'landscape' });

  const pieces = Math.max(1, Math.floor(opts.totalPieces) || 1);
  const margin = 14;
  const rowW = pageW - margin * 2;
  const cellPad = 10;

  let logo: HTMLImageElement | null = null;
  try {
    logo = await loadImage('/logo-dr-label.png');
  } catch {
    logo = null;
  }

  const drawLabel = (pieceIndex: number) => {
    // Logo, centered top — fixed size regardless of the label's own dimensions.
    const logoSize = 92;
    if (logo) {
      doc.addImage(logo, 'PNG', (pageW - logoSize) / 2, 8, logoSize, logoSize);
    }

    // Two rows filling the rest of the 6x4 label exactly, sized to use up all the
    // remaining height so the text can run as large as possible.
    const rowY1 = 8 + logoSize + 8;
    const rowH = 78;
    const rowY2 = rowY1 + rowH + 8;

    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(0, 0, 0);

    // --- PCS row: label | piece index | total pieces ---
    const pcsLabelW = rowW * 0.30;
    const pcsCol2W = rowW * 0.35;
    const pcsCol3W = rowW - pcsLabelW - pcsCol2W;
    const pcsMidY = rowY1 + rowH / 2;

    doc.setLineWidth(3);
    doc.roundedRect(margin, rowY1, rowW, rowH, 14, 14, 'S');
    doc.setLineWidth(2);
    doc.line(margin + pcsLabelW, rowY1, margin + pcsLabelW, rowY1 + rowH);
    doc.line(margin + pcsLabelW + pcsCol2W, rowY1, margin + pcsLabelW + pcsCol2W, rowY1 + rowH);

    let fs = fitBoldFontSize(doc, 'PCS', pcsLabelW - cellPad * 2, 40);
    doc.text('PCS', margin + pcsLabelW / 2, pcsMidY + fs * 0.32, { align: 'center' });

    const pieceIndexStr = String(pieceIndex);
    fs = fitBoldFontSize(doc, pieceIndexStr, pcsCol2W - cellPad * 2, 52);
    doc.text(pieceIndexStr, margin + pcsLabelW + pcsCol2W / 2, pcsMidY + fs * 0.32, { align: 'center' });

    const piecesStr = String(pieces);
    fs = fitBoldFontSize(doc, piecesStr, pcsCol3W - cellPad * 2, 52);
    doc.text(piecesStr, margin + pcsLabelW + pcsCol2W + pcsCol3W / 2, pcsMidY + fs * 0.32, { align: 'center' });

    // --- DR# row: label | DR number ---
    const drLabelW = rowW * 0.30;
    const drValueW = rowW - drLabelW;
    const drMidY = rowY2 + rowH / 2;

    doc.setLineWidth(3);
    doc.roundedRect(margin, rowY2, rowW, rowH, 14, 14, 'S');
    doc.setLineWidth(2);
    doc.line(margin + drLabelW, rowY2, margin + drLabelW, rowY2 + rowH);

    fs = fitBoldFontSize(doc, 'DR#', drLabelW - cellPad * 2, 40);
    doc.text('DR#', margin + drLabelW / 2, drMidY + fs * 0.32, { align: 'center' });

    const drText = opts.drNumber || '\u2014';
    fs = fitBoldFontSize(doc, drText, drValueW - cellPad * 2, 52);
    doc.text(drText, margin + drLabelW + drValueW / 2, drMidY + fs * 0.32, { align: 'center' });
  };

  for (let i = 1; i <= pieces; i++) {
    if (i > 1) doc.addPage([pageW, pageH], 'landscape');
    drawLabel(i);
  }

  doc.save(`DR-Label-${opts.drNumber || 'RXL'}.pdf`);
}
