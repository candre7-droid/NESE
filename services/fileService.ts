
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
    let pagesWithLowText = 0;
    
    // Extracció de text i anàlisi de densitat
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      
      // Si la pàgina té menys de 100 caràcters, és molt probable que sigui una imatge
      if (pageText.trim().length < 100) {
        pagesWithLowText++;
      }
      
      fullText += `--- Pàgina ${i} ---\n${pageText}\n\n`;
    }
    
    // Decidim si és un escaneig: si més del 50% de les pàgines tenen poc text
    const isScan = pagesWithLowText > (pdf.numPages / 2) || fullText.trim().length < (pdf.numPages * 50);
    
    if (isScan) {
      const images: string[] = [];
      // Capturem fins a 8 pàgines per no sobrecarregar el payload, amb bona resolució
      const pagesToProcess = Math.min(pdf.numPages, 8);
      
      for (let i = 1; i <= pagesToProcess; i++) {
        const page = await pdf.getPage(i);
        // Augmentem l'escala a 2.5 per a una millor definició del text petit (proves psicomètriques)
        const viewport = page.getViewport({ scale: 2.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport: viewport }).promise;
          // Qualitat alta per al reconeixement de caràcters
          images.push(canvas.toDataURL('image/jpeg', 0.9));
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
