import { Injectable, Logger } from '@nestjs/common';

export interface ReceiptItemData {
  label: string;
  quantity: string;
  unitPriceFcfa: number;
  amountFcfa: number;
}

export interface ReceiptData {
  referenceNumber: string;
  saleDate: string;
  farmName: string;
  customerName: string | null;
  items: ReceiptItemData[];
  totalAmountFcfa: number;
  paidAmountFcfa: number;
  remainingFcfa: number;
  method: string;
}

export interface PnlReportData {
  farmName: string;
  title: string;
  period: string;
  rows: { label: string; value: string }[];
  totals: { label: string; value: string }[];
  grossMarginPct: number | null;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private fontPromise: Promise<void> | null = null;

  private readonly FONTS = [
    'Roboto-Regular.ttf',
    'Roboto-Medium.ttf',
    'Roboto-Italic.ttf',
    'Roboto-MediumItalic.ttf',
  ];

  /** Prépare pdfmake (Node) une seule fois : polices via virtualfs + addFonts. */
  private async ensurePdfmake(): Promise<any> {
    const pdfmake = (await import('pdfmake')).default as any;
    const pdfFonts = (await import('pdfmake/build/vfs_fonts.js'))
      .default as Record<string, string>;

    if (!this.fontPromise) {
      this.fontPromise = (async () => {
        pdfmake.setUrlAccessPolicy?.(() => false);
        pdfmake.setLocalAccessPolicy?.(() => false);
        for (const fontName of this.FONTS) {
          pdfmake.virtualfs.writeFileSync(
            fontName,
            Buffer.from(pdfFonts[fontName], 'base64'),
          );
        }
        pdfmake.addFonts({
          Roboto: {
            normal: 'Roboto-Regular.ttf',
            bold: 'Roboto-Medium.ttf',
            italics: 'Roboto-Italic.ttf',
            bolditalics: 'Roboto-MediumItalic.ttf',
          },
        });
      })();
    }
    await this.fontPromise;
    return pdfmake;
  }

  async createReceiptPdf(data: ReceiptData): Promise<Buffer> {
    const documentDefinition = {
      content: [
        { text: data.farmName, style: 'header' },
        { text: 'Reçu de vente', style: 'subheader' },
        {
          text: `Référence : ${data.referenceNumber}\nDate : ${data.saleDate}\nClient : ${data.customerName ?? 'Client comptoir'}`,
          style: 'meta',
        },
        {
          table: {
            widths: ['*', 'auto', 'auto', 'auto'],
            headerRows: 1,
            body: [
              [
                { text: 'Désignation', style: 'tableHeader' },
                { text: 'Qté', style: 'tableHeader' },
                { text: 'PU (FCFA)', style: 'tableHeader' },
                { text: 'Total (FCFA)', style: 'tableHeader' },
              ],
              ...data.items.map((item) => [
                item.label,
                item.quantity,
                String(item.unitPriceFcfa),
                String(item.amountFcfa),
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        },
        { text: '', margin: [0, 10, 0, 0] },
        { text: `TOTAL : ${data.totalAmountFcfa} FCFA`, style: 'total' },
        { text: `Payé : ${data.paidAmountFcfa} FCFA`, style: 'total' },
        data.remainingFcfa > 0
          ? {
              text: `RESTE À PAYER : ${data.remainingFcfa} FCFA`,
              style: 'warning',
            }
          : {},
        { text: `Paiement : ${data.method}`, style: 'meta' },
        {
          qr: `KOUKOU|VTE|${data.referenceNumber}|${data.totalAmountFcfa}`,
          fit: 110,
          alignment: 'center',
          margin: [0, 14, 0, 0],
        },
        {
          text: "Vérifiez l'authenticité de ce reçu en scannant le code QR.\nKouKou Ferme — reçu généré par l'appareil.",
          style: 'footer',
        },
      ],
      styles: {
        header: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
        subheader: {
          fontSize: 12,
          bold: true,
          color: '#444444',
          margin: [0, 0, 0, 8],
        },
        meta: {
          fontSize: 9,
          color: '#555555',
          alignment: 'left',
          margin: [0, 0, 0, 8],
        },
        tableHeader: { bold: true, color: '#222222' },
        total: { fontSize: 11, bold: true, margin: [0, 2, 0, 2] },
        warning: {
          fontSize: 11,
          bold: true,
          color: '#c0392b',
          margin: [0, 2, 0, 2],
        },
        footer: {
          fontSize: 8,
          color: '#888888',
          alignment: 'center',
          margin: [0, 12, 0, 0],
        },
      },
      defaultStyle: { font: 'Roboto' },
    };

    const pdfmake = await this.ensurePdfmake();
    const document = pdfmake.createPdf(documentDefinition);
    return document.getBuffer();
  }

  async createPnlReportPdf(data: PnlReportData): Promise<Buffer> {
    const documentDefinition = {
      content: [
        { text: data.farmName, style: 'header' },
        { text: data.title, style: 'subheader' },
        { text: data.period, style: 'meta' },
        {
          table: {
            widths: ['*', 'auto'],
            headerRows: 1,
            body: [
              [
                { text: 'Rubrique', style: 'tableHeader' },
                { text: 'Montant (FCFA)', style: 'tableHeader' },
              ],
              ...data.rows.map((row) => [row.label, row.value]),
              ...data.totals.map((t) => [
                { text: t.label, style: 'total' },
                { text: t.value, style: 'total' },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        },
        ...(data.grossMarginPct != null
          ? [
              {
                text: `Marge brute : ${data.grossMarginPct.toFixed(2)} %`,
                style: 'meta',
                margin: [0, 12, 0, 0],
              },
            ]
          : []),
      ],
      styles: {
        header: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
        subheader: {
          fontSize: 12,
          bold: true,
          color: '#444444',
          margin: [0, 0, 0, 8],
        },
        meta: {
          fontSize: 9,
          color: '#555555',
          margin: [0, 0, 0, 8],
        },
        tableHeader: { bold: true, color: '#222222' },
        total: { fontSize: 11, bold: true, color: '#222222' },
      },
      defaultStyle: { font: 'Roboto' },
    };

    const pdfmake = await this.ensurePdfmake();
    const document = pdfmake.createPdf(documentDefinition);
    return document.getBuffer();
  }
}
