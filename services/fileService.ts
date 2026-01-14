
declare const pdfjsLib: any;
declare const mammoth: any;
declare const XLSX: any;

export class FileService {
  constructor() {
    // Set up PDF.js worker
    if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }

  async extractText(file: File): Promise<string> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'pdf':
        return this.extractFromPdf(file);
      case 'docx':
        return this.extractFromDocx(file);
      case 'xlsx':
      case 'xls':
        return this.extractFromExcel(file);
      case 'txt':
        return file.text();
      default:
        throw new Error('Format de fitxer no suportat.');
    }
  }

  private async extractFromPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `--- Pàgina ${i} ---\n${pageText}\n\n`;
    }
    
    return fullText;
  }

  private async extractFromDocx(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  private async extractFromExcel(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = (window as any).XLSX.read(arrayBuffer, { type: 'array' });
    let fullText = '';

    workbook.SheetNames.forEach((sheetName: string) => {
      const worksheet = workbook.Sheets[sheetName];
      const csv = (window as any).XLSX.utils.sheet_to_csv(worksheet);
      fullText += `--- Full: ${sheetName} ---\n${csv}\n\n`;
    });

    return fullText;
  }
}

export const fileService = new FileService();
