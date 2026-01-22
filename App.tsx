
import React, { useState, useEffect, useRef } from 'react';
import { AppStep, ReportData } from './types';
import { BLOCK_OPTIONS, SCHOOL_LEVELS } from './constants';
import { geminiService } from './services/geminiService';
import { fileService } from './services/fileService';
import { StepIndicator } from './components/StepIndicator';
import { RichTextEditor } from './components/RichTextEditor';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.INPUT);
  const [loading, setLoading] = useState(false);
  const [fileProcessing, setFileProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [savedReports, setSavedReports] = useState<ReportData[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const reportContentRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const initialReportState: ReportData = {
    rawInput: '',
    selectedBlocks: [],
    conclusions: '',
    orientations: '',
    studentName: '',
    schoolYear: '', 
    schoolLevel: '', 
    currentStep: AppStep.INPUT
  };

  const [report, setReport] = useState<ReportData>(initialReportState);

  useEffect(() => {
    const history = localStorage.getItem('nese_reports_history');
    if (history) {
      try {
        setSavedReports(JSON.parse(history));
      } catch (e) {
        console.error("Error carregant historial", e);
      }
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const saveToLocalStorage = (reports: ReportData[]) => {
    try {
      localStorage.setItem('nese_reports_history', JSON.stringify(reports));
      setSavedReports(reports);
    } catch (e) {
      console.error("Error guardant a localStorage", e);
      setError("No s'ha pogut guardar l'historial.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileProcessing(true);
    setError(null);
    try {
      const text = await fileService.extractText(file);
      setReport(prev => ({ 
        ...prev, 
        rawInput: prev.rawInput + (prev.rawInput ? '\n\n' : '') + `[Contingut de ${file.name}]:\n` + text 
      }));
    } catch (err: any) {
      setError(`Error en el fitxer: ${err.message || 'Error desconegut'}`);
    } finally {
      setFileProcessing(false);
      if (e.target) e.target.value = '';
    }
  };

  const toggleBlock = (id: number) => {
    setReport(prev => ({
      ...prev,
      selectedBlocks: prev.selectedBlocks.includes(id)
        ? prev.selectedBlocks.filter(b => b !== id)
        : [...prev.selectedBlocks, id]
    }));
  };

  const generateApartat1 = async () => {
    if (!report.rawInput.trim()) {
      setError("Si us plau, introdueix dades o notes de l'alumne a l'apartat d'observacions.");
      return;
    }
    if (report.selectedBlocks.length === 0) {
      setError("Selecciona almenys un dels blocs NESE superiors.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await geminiService.generateConclusions(report.rawInput, report.selectedBlocks, report.schoolLevel);
      setReport(prev => ({ ...prev, conclusions: result, currentStep: AppStep.CONCLUSIONS }));
      setStep(AppStep.CONCLUSIONS);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(`${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateApartat2 = async () => {
    if (!report.conclusions || report.conclusions.trim().length < 20) {
      setError("Cal que hi hagi contingut a l'apartat de conclusions per poder generar les orientacions.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await geminiService.generateOrientations(report.conclusions, report.schoolLevel);
      setReport(prev => ({ ...prev, orientations: result, currentStep: AppStep.ORIENTATIONS }));
      setStep(AppStep.ORIENTATIONS);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(`${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const msg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setIsChatLoading(true);
    
    try {
      const history = chatMessages.map(m => ({ 
        role: m.role, 
        parts: [{ text: m.content }] 
      }));
      const response = await geminiService.askAssistant(msg, report.rawInput, history);
      setChatMessages(prev => [...prev, { role: 'model', content: response }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const saveReportToHistory = () => {
    if (!report.rawInput.trim() && !report.studentName.trim() && !report.conclusions) {
      setError("No hi ha dades suficients per guardar l'informe.");
      return;
    }

    const newId = report.id || Math.random().toString(36).substr(2, 9);
    const newReport = { 
      ...report, 
      id: newId,
      timestamp: Date.now(),
      currentStep: step
    };
    
    setSavedReports(prev => {
      const exists = prev.find(r => r.id === newReport.id);
      const updated = exists 
        ? prev.map(r => r.id === newReport.id ? newReport : r) 
        : [newReport, ...prev];
      
      localStorage.setItem('nese_reports_history', JSON.stringify(updated));
      return updated;
    });

    setReport(newReport);
    alert("Informe guardat correctament a l'historial local.");
  };

  const reset = () => {
    const confirmation = window.confirm("Estàs segur que vols iniciar un nou informe? Es perdrà qualsevol canvi no guardat.");
    if (confirmation) {
      window.location.reload();
    }
  };

  const downloadAsWord = () => {
    if (!reportContentRef.current) return;

    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Informe NESE</title>
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.5; color: #333; padding: 20px; }
          h1 { color: #065f46; text-align: center; text-transform: uppercase; border-bottom: 2px solid #065f46; padding-bottom: 10px; margin-bottom: 30px; }
          h2 { color: #065f46; text-transform: uppercase; margin-top: 40px; margin-bottom: 20px; border-left: 5px solid #065f46; padding-left: 10px; font-size: 16pt; }
          h3 { color: #065f46; margin-top: 25px; margin-bottom: 15px; font-weight: bold; font-size: 14pt; }
          p { margin-bottom: 20px; text-align: justify; line-height: 1.5; }
          ul { margin-bottom: 20px; padding-left: 20px; }
          li { margin-bottom: 12px; line-height: 1.5; }
          .data-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; background-color: #f0fdf4; }
          .data-table td { padding: 15px; border: 1px solid #d1fae5; }
          .label { font-weight: bold; color: #065f46; font-size: 10pt; text-transform: uppercase; }
          .value { font-size: 12pt; }
          .section-break { margin-top: 50px; }
        </style>
      </head>
      <body>
    `;

    const footer = "</body></html>";
    
    const content = `
      <h1>Informe Psicopedagògic</h1>
      <table class="data-table">
        <tr>
          <td><span class="label">Alumne/a:</span><br/><span class="value">${report.studentName || 'N/A'}</span></td>
          <td><span class="label">Nivell:</span><br/><span class="value">${report.schoolLevel || 'N/A'}</span></td>
        </tr>
        <tr>
          <td><span class="label">Curs Escolar:</span><br/><span class="value">${report.schoolYear || 'N/A'}</span></td>
          <td><span class="label">Data:</span><br/><span class="value">${new Date().toLocaleDateString('ca-ES')}</span></td>
        </tr>
      </table>

      <div class="section-break">
        <h2>1. Conclusions de l'Avaluació</h2>
        <div>${report.conclusions}</div>
      </div>

      <br clear="all" style="page-break-before:always" />

      <div class="section-break">
        <h2>2. Orientacions per a la Resposta Educativa</h2>
        <div>${report.orientations}</div>
      </div>
    `;

    const sourceHTML = header + content + footer;
    
    const blob = new Blob(['\ufeff', sourceHTML], {
      type: 'application/msword'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Informe_NESE_${report.studentName || 'alumne'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto pb-24">
      <style>{`
        .report-content { line-height: 1.5 !important; }
        .report-content p { margin-bottom: 1.5rem !important; text-align: justify; }
        .report-content h3 { margin-top: 2.5rem !important; margin-bottom: 1.25rem !important; font-weight: 800; }
        .report-content ul { list-style-type: none !important; padding-left: 0.5rem !important; margin-left: 0 !important; margin-bottom: 1.5rem !important; }
        .report-content li { margin-bottom: 0.75rem !important; line-height: 1.5 !important; }
        .report-content section { margin-bottom: 4rem !important; }
        
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          .report-container { border: none !important; box-shadow: none !important; padding: 0 !important; }
        }
      `}</style>

      {/* Floating Chat Assistant */}
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${showChat ? 'w-[calc(100vw-3rem)] sm:w-[550px] h-[480px] max-h-[80vh] shadow-2xl scale-100 opacity-100' : 'w-16 h-16 scale-95 opacity-80 hover:opacity-100'}`}>
        {!showChat ? (
          <button 
            onClick={() => setShowChat(true)} 
            className="w-full h-full bg-emerald-700 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all p-3"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <path d="M12 22C12 22 12.1307 16.6322 15.0118 13.7512C17.8929 10.8701 22.2609 10.7394 22.2609 10.7394C22.2609 10.7394 17.8929 10.6087 15.0118 7.72765C12.1307 4.84659 12 0 12 0C12 0 11.8693 4.84659 8.98822 7.72765C6.10714 10.6087 1.73913 10.7394 1.73913 10.7394C1.73913 10.7394 6.10714 10.8701 8.98822 13.7512C11.8693 16.6322 12 22 12 22Z" fill="white"/>
            </svg>
          </button>
        ) : (
          <div className="bg-white w-full h-full rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col no-print">
            <div className="p-4 bg-emerald-700 text-white flex justify-between items-center shrink-0">
              <span className="font-bold flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                  <path d="M12 22C12 22 12.1307 16.6322 15.0118 13.7512C17.8929 10.8701 22.2609 10.7394 22.2609 10.7394C22.2609 10.7394 17.8929 10.6087 15.0118 7.72765C12.1307 4.84659 12 0 12 0C12 0 11.8693 4.84659 8.98822 7.72765C6.10714 10.6087 1.73913 10.7394 1.73913 10.7394C1.73913 10.7394 6.10714 10.8701 8.98822 13.7512C11.8693 16.6322 12 22 12 22Z" fill="white"/>
                </svg>
                Assistent Gemini
              </span>
              <button onClick={() => setShowChat(false)} className="hover:text-emerald-200 p-1"><i className="fas fa-times"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {chatMessages.length === 0 && <p className="text-xs text-slate-400 text-center mt-10 italic">Pregunta sobre dades de l'alumne o dubtes sobre el Decret 150/2017.</p>}
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-xs ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none shadow-sm'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-100 p-3 rounded-2xl rounded-bl-none shadow-sm flex gap-1">
                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t bg-white flex gap-2 shrink-0">
              <input 
                value={chatInput} 
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Escriu..." 
                className="flex-1 text-xs p-2 outline-none bg-slate-50 rounded-lg focus:ring-1 focus:ring-emerald-500"
              />
              <button onClick={handleSendMessage} disabled={isChatLoading} className="p-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition-colors"><i className="fas fa-paper-plane"></i></button>
            </div>
          </div>
        )}
      </div>

      {/* Historial Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-none border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Historial d'informes</h2>
              <button onClick={() => setShowHistory(false)} className="p-2 text-slate-400 hover:text-slate-600"><i className="fas fa-times"></i></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              {savedReports.length === 0 ? <p className="text-center text-slate-400 py-10">No hi ha informes guardats encara.</p> : 
                savedReports.map(r => (
                  <div key={r.id} onClick={() => { setReport(r); setStep(r.currentStep || AppStep.INPUT); setShowHistory(false); }} className="p-4 border border-slate-100 rounded-2xl hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer flex justify-between items-center group transition-all">
                    <div>
                      <h4 className="font-bold text-slate-700">{r.studentName || 'Alumne sense nom'}</h4>
                      <p className="text-xs text-slate-500">{new Date(r.timestamp!).toLocaleString()}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); if(confirm("Eliminar?")) saveToLocalStorage(savedReports.filter(x => x.id !== r.id)); }} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all"><i className="fas fa-trash-alt"></i></button>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col sm:flex-row items-center justify-between mb-10 no-print gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-700 to-teal-800 rounded-2xl flex items-center justify-center text-white text-3xl"><i className="fas fa-file-medical"></i></div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Elaboració de NESE</h1>
            <p className="text-emerald-700 font-medium">Eina d'elaboració d'informes</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => setShowHistory(true)} className="px-5 py-2.5 text-slate-600 font-bold text-sm bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">Historial</button>
          <button type="button" onClick={() => saveReportToHistory()} className="px-5 py-2.5 bg-emerald-700 text-white rounded-xl font-bold text-sm hover:bg-emerald-800 transition-all">Guardar</button>
          <button type="button" onClick={reset} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">Nou informe</button>
        </div>
      </header>

      <main>
        <StepIndicator currentStep={step} />

        {error && (
          <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 text-red-800 rounded-r-xl flex justify-between items-start animate-fadeIn no-print">
            <div className="flex gap-3">
              <i className="fas fa-exclamation-circle mt-1"></i>
              <p className="font-medium">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 px-2"><i className="fas fa-times"></i></button>
          </div>
        )}

        {/* STEP 1: INPUT */}
        {step === AppStep.INPUT && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-3xl border border-slate-100">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nom de l'alumne/a</label>
                <input type="text" value={report.studentName} onChange={e => setReport({...report, studentName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-700 focus:bg-white transition-all" placeholder="Ex: Marc G. P." />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nivell Educatiu</label>
                <select value={report.schoolLevel} onChange={e => setReport({...report, schoolLevel: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-700 focus:bg-white transition-all appearance-none">
                  <option value="">Selecciona nivell...</option>
                  {SCHOOL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Curs Escolar</label>
                <input type="text" value={report.schoolYear} onChange={e => setReport({...report, schoolYear: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-700 focus:bg-white transition-all" placeholder="Ex: 2024-2025" />
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-100">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-slate-800">
                <span className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm">1</span>
                Selecció de Blocs NESE
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {BLOCK_OPTIONS.map(block => (
                  <button 
                    key={block.id} 
                    onClick={() => toggleBlock(block.id)} 
                    className={`text-left p-5 rounded-2xl border-2 transition-all group ${report.selectedBlocks.includes(block.id) ? 'border-emerald-700 bg-emerald-50/50 ring-4 ring-emerald-50' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${report.selectedBlocks.includes(block.id) ? 'bg-emerald-700 border-emerald-700 text-white' : 'border-slate-300'}`}>
                        {report.selectedBlocks.includes(block.id) && <i className="fas fa-check text-[10px]"></i>}
                      </div>
                      <span className="font-bold text-sm text-slate-700 leading-tight">{block.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed opacity-80 group-hover:opacity-100">{block.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-100">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-xl font-bold flex items-center gap-3 text-slate-800">
                  <span className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm">2</span>
                  Observacions i Dades de l'Avaluació
                </h2>
                <div className="flex gap-2">
                  <label className="cursor-pointer px-5 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-bold hover:bg-emerald-800 transition-all flex items-center gap-2">
                    <i className="fas fa-cloud-upload-alt"></i>
                    {fileProcessing ? 'Llegint...' : 'Adjuntar Document'}
                    <input type="file" onChange={handleFileUpload} disabled={fileProcessing} className="hidden" />
                  </label>
                </div>
              </div>
              
              <div className="w-full">
                <textarea 
                  value={report.rawInput} 
                  onChange={e => setReport({...report, rawInput: e.target.value})} 
                  className="w-full h-96 p-6 border border-slate-200 rounded-3xl outline-none bg-slate-50 focus:bg-white focus:ring-4 focus:ring-emerald-50 transition-all resize-none text-slate-700 leading-relaxed" 
                  placeholder="Escriu o enganxa aquí les notes de l'avaluació..." 
                />
              </div>
            </div>

            <button 
              onClick={generateApartat1} 
              disabled={loading || !report.rawInput.trim() || report.selectedBlocks.length === 0} 
              className="w-full py-5 bg-gradient-to-r from-emerald-700 to-teal-800 text-white rounded-3xl font-extrabold hover:scale-[1.01] transition-all disabled:opacity-50 text-xl"
            >
              {loading ? <><i className="fas fa-circle-notch fa-spin mr-3"></i> Elaborant Conclusions...</> : "Generar conclusions de l'avaluació psicopedagògica"}
            </button>
          </div>
        )}

        {/* STEP 2: CONCLUSIONS */}
        {step === AppStep.CONCLUSIONS && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex justify-between items-center no-print">
              <button onClick={() => setStep(AppStep.INPUT)} className="text-slate-500 font-bold flex items-center gap-2 hover:text-emerald-800 transition-all group">
                <i className="fas fa-arrow-left group-hover:-translate-x-1 transition-transform"></i> Tornar a l'edició de dades
              </button>
              <button 
                onClick={generateApartat2} 
                disabled={loading} 
                className="px-8 py-3 bg-emerald-700 text-white rounded-2xl font-bold hover:bg-emerald-800 transition-all flex items-center gap-3 disabled:opacity-50"
              >
                {loading ? <><i className="fas fa-spinner fa-spin"></i> Generant Orientacions...</> : <>Generar Orientacions <i className="fas fa-arrow-right"></i></>}
              </button>
            </div>
            
            <RichTextEditor 
              label="APARTAT 1: CONCLUSIONS DE L'AVALUACIÓ" 
              value={report.conclusions} 
              onChange={v => setReport({...report, conclusions: v})} 
            />

            <div className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100 text-center flex flex-col items-center gap-4 no-print">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xl"><i className="fas fa-lightbulb"></i></div>
              <div>
                <h3 className="text-lg font-bold text-emerald-900">Pas següent: Orientacions Educatives</h3>
                <p className="text-emerald-800 text-sm max-w-lg mx-auto mt-1">Un cop hagis revisat les conclusions anteriors, fes clic al botó de sota per generar automàticament les propostes de suport i mesures segons el Decret 150/2017.</p>
              </div>
              <button 
                onClick={generateApartat2} 
                disabled={loading} 
                className="mt-2 px-10 py-5 bg-emerald-700 text-white rounded-2xl font-black text-xl hover:bg-emerald-800 hover:scale-[1.02] transition-all flex items-center gap-4 disabled:opacity-50"
              >
                {loading ? <><i className="fas fa-circle-notch fa-spin"></i> Elaborant Orientacions...</> : <>ELABORAR ORIENTACIONS <i className="fas fa-wand-magic-sparkles"></i></>}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: ORIENTATIONS */}
        {step === AppStep.ORIENTATIONS && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex justify-between items-center no-print">
              <button onClick={() => setStep(AppStep.CONCLUSIONS)} className="text-slate-500 font-bold flex items-center gap-2 hover:text-emerald-800 transition-all">
                <i className="fas fa-arrow-left"></i> Editar Conclusions
              </button>
              <button 
                onClick={() => setStep(AppStep.FINALIZE)} 
                className="px-8 py-3 bg-green-700 text-white rounded-2xl font-bold hover:bg-green-800 transition-all flex items-center gap-3"
              >
                Vista Prèvia Final <i className="fas fa-check-circle"></i>
              </button>
            </div>
            
            <RichTextEditor 
              label="APARTAT 2: ORIENTACIONS PER A LA RESPOSTA EDUCATIVA" 
              value={report.orientations} 
              onChange={v => setReport({...report, orientations: v})} 
            />

            <div className="flex justify-center pt-6 no-print">
              <button 
                onClick={() => setStep(AppStep.FINALIZE)} 
                className="px-12 py-5 bg-green-700 text-white rounded-2xl font-black text-xl hover:bg-green-800 hover:scale-[1.02] transition-all flex items-center gap-4"
              >
                CONCLOURE INFORME <i className="fas fa-flag-checkered"></i>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: FINALIZE / PRINT */}
        {step === AppStep.FINALIZE && (
          <div className="space-y-10 animate-fadeIn">
            <div className="flex flex-col sm:flex-row justify-between no-print items-center gap-4 border-b pb-6">
              <button onClick={() => setStep(AppStep.ORIENTATIONS)} className="text-slate-500 font-bold hover:text-slate-800 flex items-center gap-2">
                <i className="fas fa-arrow-left"></i> Seguir editant
              </button>
              <div className="flex items-center gap-3">
                <button type="button" onClick={downloadAsWord} className="px-6 py-2.5 bg-blue-700 text-white rounded-xl font-bold hover:bg-blue-800 transition-all flex items-center gap-2 whitespace-nowrap">
                  <i className="fas fa-file-word"></i> DESCARREGAR WORD
                </button>
              </div>
            </div>
            
            <div ref={reportContentRef} className="bg-white p-12 sm:p-20 border report-container rounded-none sm:rounded-[3rem] prose prose-slate max-w-none relative overflow-hidden shadow-none">
              {/* Capçalera d'institució */}
              <div className="flex justify-between items-start mb-16 border-b pb-8 border-slate-100">
                <div className="flex flex-col gap-1">
                  <h1 className="text-2xl font-black text-emerald-800 m-0 p-0 leading-none uppercase">EQUIP D'ORIENTACIÓ</h1>
                  <p className="text-xs font-bold text-slate-400 m-0 uppercase tracking-widest">Generalitat de Catalunya • Departament d'Educació</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-700 m-0 uppercase">Informe de Reconeixement NESE</p>
                  <p className="text-xs text-slate-400 m-0">Segons Decret 150/2017</p>
                </div>
              </div>

              <div className="mb-12">
                <h1 className="text-center text-3xl font-black uppercase underline decoration-emerald-700/30 underline-offset-8 mb-10">Informe Psicopedagògic</h1>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-12 bg-emerald-50/30 p-8 rounded-3xl border border-emerald-100 mb-10">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">Alumne/a</span>
                    <span className="text-lg font-bold text-slate-800">{report.studentName || '________________________________'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">Nivell Educatiu</span>
                    <span className="text-lg font-bold text-slate-800">{report.schoolLevel || '________________________________'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">Curs Escolar</span>
                    <span className="text-lg font-bold text-slate-800">{report.schoolYear || '________________________________'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">Data de l'Informe</span>
                    <span className="text-lg font-bold text-slate-800">{new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>

              {/* CONTINGUT DE L'INFORME */}
              <div className="space-y-12 report-content">
                <section>
                  <div className="mb-10">
                    <h2 className="text-2xl font-black uppercase text-emerald-900 m-0">1. Conclusions de l'Avaluació</h2>
                    <div className="w-24 h-1.5 bg-emerald-700 mt-2"></div>
                  </div>
                  <div className="text-slate-700" dangerouslySetInnerHTML={{__html: report.conclusions}} />
                </section>

                <div className="page-break my-16"></div>

                <section>
                  <div className="mb-10">
                    <h2 className="text-2xl font-black uppercase text-teal-900 m-0">2. Orientacions per a la Resposta Educativa</h2>
                    <div className="w-24 h-1.5 bg-teal-700 mt-2"></div>
                  </div>
                  <div className="text-slate-700" dangerouslySetInnerHTML={{__html: report.orientations}} />
                </section>
              </div>

              <div className="mt-32 pt-12 border-t border-slate-100 flex justify-end">
                <div className="text-center w-64">
                  <div className="h-24 flex items-center justify-center italic text-slate-300 text-xs mb-2">Signatura Digital / Segell</div>
                  <hr className="border-emerald-200" />
                  <p className="mt-4 font-black text-emerald-900 text-sm">Equip d'Orientació</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Referent de l'Informe</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <footer className="mt-20 py-8 border-t border-slate-200 text-center no-print">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-widest flex items-center justify-center gap-2">
          Eina Professional de Suport a l'Avaluació <i className="fas fa-leaf text-emerald-600"></i> NESE AI 2024
        </p>
      </footer>
    </div>
  );
};

export default App;
