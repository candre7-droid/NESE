import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Spacing } from "https://esm.sh/docx";
import { ReportData } from "../types";

export class ExportService {
  async exportToWord(report: ReportData) {
    // Funció per netejar HTML bàsic de l'editor i convertir-lo en text pla per al Word
    const cleanHtml = (html: string) => {
      return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();
    };

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              size: 24, // 12pt (24 half-points)
              font: "Arial",
            },
          },
        },
      },
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "INFORME PSICOPEDAGÒGIC NESE",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Dades de l'alumne/a", bold: true, size: 28, font: "Arial" }),
            ],
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Nom: `, bold: true, font: "Arial", size: 24 }),
              new TextRun({ text: report.studentName || "---", font: "Arial", size: 24 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Curs: `, bold: true, font: "Arial", size: 24 }),
              new TextRun({ text: `${report.schoolLevel || "---"} (${report.schoolYear || "---"})`, font: "Arial", size: 24 }),
            ],
            spacing: { after: 400 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({ text: "En l'avaluació psicopedagògica de ", font: "Arial", size: 24 }),
              new TextRun({ text: report.studentName || "l'alumne/a", bold: true, font: "Arial", size: 24 }),
              new TextRun({ text: " observem diferents aspectes a tenir presents per oferir una resposta educativa davant d'unes necessitats específiques relacionades amb els següents àmbits:", font: "Arial", size: 24 }),
            ],
            spacing: { before: 400, after: 400 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: "1. Conclusions de l'avaluació", bold: true, size: 24, font: "Arial" }),
            ],
            spacing: { before: 400, after: 200 },
          }),
          ...cleanHtml(report.conclusions).split('\n').map(line => 
            new Paragraph({
              children: [new TextRun({ text: line, font: "Arial", size: 24 })],
              spacing: { after: 120 },
              alignment: AlignmentType.JUSTIFIED
            })
          ),

          new Paragraph({
            children: [
              new TextRun({ text: "2. Orientacions per a l'atenció educativa", bold: true, size: 24, font: "Arial" }),
            ],
            spacing: { before: 600, after: 200 },
          }),
          ...cleanHtml(report.orientations).split('\n').map(line => 
            new Paragraph({
              children: [new TextRun({ text: line, font: "Arial", size: 24 })],
              spacing: { after: 120 },
              alignment: AlignmentType.JUSTIFIED
            })
          ),
          
          new Paragraph({
            children: [
              new TextRun({ text: `Generat el dia: ${new Date().toLocaleDateString('ca-ES')}`, font: "Arial", size: 20 })
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { before: 1000 },
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Informe_NESE_${report.studentName.replace(/\s+/g, '_') || 'alumne'}.docx`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}

export const exportService = new ExportService();
