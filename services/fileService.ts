declare const pdfjsLib: any;
declare const mammoth: any;
declare const XLSX: any;

export class FileService {
  constructor() {
    // Configuració del worker de PDF.js de forma segura
    if (typeof window !== 'undefined') {
      const checkPdfJs = setInterval(() => {
        if ((window as any).pdfjsLib) {
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          clearInterval(checkPdfJs);
        }
      }, 500);
      
      // Stop checking after 10 seconds to avoid infinite loop
      setTimeout(() => clearInterval(checkPdfJs), 10000);
    }
  }

  async extractText(file: File): Promise<string> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    try {
      switch (extension) {
        case 'pdf':
          return await this.extractFromPdf(file);
        case 'docx':
          return await this.extractFromDocx(file);
        case 'xlsx':
        case 'xls':
          return await this.extractFromExcel(file);
        case 'txt':
          return await file.text();
        default:
          throw new Error('Format de fitxer no suportat.');
      }
    } catch (error: any) {
      console.error("Error extraient text:", error);
      throw new Error(`Error en processar ${file.name}: ${error.message}`);
    }
  }

  private async extractFromPdf(file: File): Promise<string> {
    if (!(window as any).pdfjsLib) throw new Error("La llibreria PDF.js no s'ha carregat correctament.");
    
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
    if (!(window as any).mammoth) throw new Error("La llibreria Mammoth no s'ha carregat correctament.");
    const arrayBuffer = await file.arrayBuffer();
    const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  private async extractFromExcel(file: File): Promise<string> {
    if (!(window as any).XLSX) throw new Error("La llibreria SheetJS no s'ha carregat correctament.");
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