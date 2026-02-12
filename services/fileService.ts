
declare const pdfjsLib: any;
declare const mammoth: any;
declare const XLSX: any;

export interface ExtractedContent {
  text: string;
  isScan: boolean;
  images?: string[];
}

export class FileService {
  constructor() {
    if (typeof window !== 'undefined') {
      const checkPdfJs = setInterval(() => {
        // En versions modernes (4.x), pdfjsLib pot trigar un moment a ser global si es carrega com a mòdul
        const lib = (window as any).pdfjsLib;
        if (lib) {
          lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
          clearInterval(checkPdfJs);
        }
      }, 500);
      setTimeout(() => clearInterval(checkPdfJs), 10000);
    }
  }

  async extractText(file: File): Promise<ExtractedContent> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    try {
      switch (extension) {
        case 'pdf':
          return await this.extractFromPdf(file);
        case 'docx':
          const docxText = await this.extractFromDocx(file);
          return { text: docxText, isScan: false };
        case 'xlsx':
        case 'xls':
          const excelText = await this.extractFromExcel(file);
          return { text: excelText, isScan: false };
        case 'txt':
          const txt = await file.text();
          return { text: txt, isScan: false };
        default:
          throw new Error('Format de fitxer no suportat.');
      }
    } catch (error: any) {
      console.error("Error extraient text:", error);
      throw new Error(`Error en processar ${file.name}: ${error.message}`);
    }
  }

  private async extractFromPdf(file: File): Promise<ExtractedContent> {
    const lib = (window as any).pdfjsLib;
    if (!lib) throw new Error("La llibreria PDF.js no s'ha carregat correctament.");
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    // Extracció de text estàndard
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      if (pageText.trim()) {
        fullText += `--- Pàgina ${i} ---\n${pageText}\n\n`;
      }
    }
    
    // Llindar per detectar escanejos
    const threshold = pdf.numPages * 50;
    if (fullText.trim().length < threshold) {
      const images: string[] = [];
      const pagesToProcess = Math.min(pdf.numPages, 5);
      
      for (let i = 1; i <= pagesToProcess; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport: viewport }).promise;
          images.push(canvas.toDataURL('image/jpeg', 0.8));
        }
      }

      return {
        text: fullText,
        isScan: true,
        images: images
      };
    }
    
    return { text: fullText, isScan: false };
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
