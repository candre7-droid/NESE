
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
        if ((window as any).pdfjsLib) {
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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
    if (!(window as any).pdfjsLib) throw new Error("La llibreria PDF.js no s'ha carregat correctament.");
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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
    
    // Si hem extret molt poc text (< 50 caràcters per pàgina de mitjana), probablement és un escaneig
    const threshold = pdf.numPages * 50;
    if (fullText.trim().length < threshold) {
      console.log("PDF detectat com a possible escaneig. Renderitzant pàgines a imatges per OCR...");
      
      const images: string[] = [];
      // Limitem a les primeres 5 pàgines per evitar latència i costos excessius en aquesta demo
      const pagesToProcess = Math.min(pdf.numPages, 5);
      
      for (let i = 1; i <= pagesToProcess; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // Escala alta per a millor OCR
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        images.push(canvas.toDataURL('image/jpeg', 0.8));
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
