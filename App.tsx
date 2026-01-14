
import React, { useState, useEffect, useCallback } from 'react';
import { AppStep, ReportData } from './types';
import { BLOCK_OPTIONS, SCHOOL_LEVELS } from './constants';
import { geminiService } from './services/geminiService';
import { fileService } from './services/fileService';
import { googleDriveService } from './services/googleDriveService';
import { StepIndicator } from './components/StepIndicator';
import { RichTextEditor } from './components/RichTextEditor';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.INPUT);
  const [loading, setLoading] = useState(false);
  const [fileProcessing, setFileProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [savedReports, setSavedReports] = useState<ReportData[]>([]);
  
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

  // Carregar historial al muntar el component
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

  const saveToLocalStorage = (reports: ReportData[]) => {
    localStorage.setItem('nese_reports_history', JSON.stringify(reports));
    setSavedReports(reports);
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
      setError(`No s'ha pogut processar el fitxer: ${err.message || 'Error desconegut'}`);
    } finally {
      setFileProcessing(false);
      e.target.value = '';
    }
  };

  const handleGoogleDrive = async () => {
    setFileProcessing(true);
    setError(null);
    try {
      await googleDriveService.openPicker((content, fileName) => {
        setReport(prev => ({ 
          ...prev, 
          rawInput: prev.rawInput + (prev.rawInput ? '\n\n' : '') + `[Contingut de Google Drive: ${fileName}]:\n` + content 
        }));
        setFileProcessing(false);
      });
    } catch (err: any) {
      setError("No s'ha pogut accedir a Google Drive. Revisa la configuració del navegador.");
      setFileProcessing(false);
    }
  };

  const toggleBlock = (id: number) => {
    setReport(prev => {
      const blocks = prev.selectedBlocks.includes(id)
        ? prev.selectedBlocks.filter(b => b !== id)
        : [...prev.selectedBlocks, id];
      return { ...prev, selectedBlocks: blocks };
    });
  };

  const generateApartat1 = async () => {
    if (!report.rawInput.trim()) {
      setError("Si us plau, introdueix dades o notes de l'alumne.");
      return;
    }
    if (report.selectedBlocks.length === 0) {
      setError("Selecciona almenys un bloc per a l'informe.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await geminiService.generateConclusions(report.rawInput, report.selectedBlocks, report.schoolLevel);
      setReport(prev => ({ ...prev, conclusions: result, currentStep: AppStep.CONCLUSIONS }));
      setStep(AppStep.CONCLUSIONS);
    } catch (err) {
      setError("Error en connectar amb la IA. Torna-ho a provar.");
    } finally {
      setLoading(false);
    }
  };

  const generateApartat2 = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await geminiService.generateOrientations(report.conclusions, report.schoolLevel);
      setReport(prev => ({ ...prev, orientations: result, currentStep: AppStep.ORIENTATIONS }));
      setStep(AppStep.ORIENTATIONS);
    } catch (err) {
      setError("Error generant les orientacions.");
    } finally {
      setLoading(false);
    }
  };

  const saveReportToHistory = (silent: boolean = false) => {
    const newReport = { 
      ...report, 
      id: report.id || Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      currentStep: step
    };
    
    let updatedHistory;
    if (report.id) {
      updatedHistory = savedReports.map(r => r.id === report.id ? newReport : r);
    } else {
      updatedHistory = [newReport, ...savedReports];
    }
    
    saveToLocalStorage(updatedHistory);
    setReport(newReport);
    if (!silent) alert("Informe guardat a l'historial. Ja pots tancar la sessió o la pestanya i continuar més tard des de l'apartat 'Historial'.");
  };

  const loadReport = (id: string) => {
    const found = savedReports.find(r => r.id === id);
    if (found) {
      setReport(found);
      setStep(found.currentStep || AppStep.FINALIZE);
      setShowHistory(false);
    }
  };

  const deleteReport = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Segur que vols eliminar aquest informe de l'historial?")) {
      const updated = savedReports.filter(r => r.id !== id);
      saveToLocalStorage(updated);
    }
  };

  const reset = () => {
    if (confirm("Estàs segur que vols iniciar un nou informe? Es perdrà qualsevol canvi no guardat.")) {
      window.location.reload();
    }
  };

  const handlePrint = () => window.print();

  const handleDownloadWord = () => {
    const content = document.querySelector('.report-container')?.innerHTML;
    if (!content) return;
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
          "xmlns:w='urn:schemas-microsoft-com:office:word' " +
          "xmlns='http://www.w3.org/TR/REC-html40'>" +
          "<head><meta charset='utf-8'><title>Informe NESE</title><style>" +
          "body { font-family: Arial, sans-serif; }" +
          "h1 { text-transform: uppercase; border-bottom: 2px solid #000; }" +
          "h2 { color: #1e3a8a; border-left: 4px solid #1e3a8a; padding-left: 10px; }" +
          ".prose { margin-bottom: 20px; text-align: justify; }" +
          "</style></head><body>";
    const footer = "</body></html>";
    const blob = new Blob(['\ufeff', header + content + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Informe_NESE_${report.studentName.replace(/\s+/g, '_') || 'alumne'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isReportStarted = report.rawInput.trim().length > 0 || report.studentName.trim().length > 0;

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      {/* Overlay Historial */}
      {showHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col max-h-[80vh]">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <i className="fas fa-history text-blue-600"></i>
                Historial d'Informes
              </h2>
              <button onClick={() => setShowHistory(false)} className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              {savedReports.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <i className="fas fa-folder-open text-4xl mb-4 opacity-20"></i>
                  <p>Encara no has guardat cap informe.</p>
                </div>
              ) : (
                savedReports.map((r) => (
                  <div 
                    key={r.id} 
                    onClick={() => loadReport(r.id!)}
                    className="p-4 border border-slate-200 rounded-2xl hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                        <i className="fas fa-file-alt"></i>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">{r.studentName || 'Alumne sense nom'}</h4>
                        <p className="text-xs text-slate-500">{r.schoolLevel || 'Sense nivell'} • {r.schoolYear || 'Sense curs'} • {new Date(r.timestamp!).toLocaleDateString()}</p>
                        <span className="text-[10px] uppercase font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded mt-1 inline-block">
                          Pas actual: {r.currentStep || 'Finalitzat'}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => deleteReport(e, r.id!)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition-all"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t text-center">
              <p className="text-xs text-slate-400">Els informes es guarden localment al teu navegador.</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between mb-8 no-print">
        <div className="flex items-center gap-3 mb-4 sm:mb-0">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg">
            <i className="fas fa-file-medical"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Elaboració de NESE</h1>
            <p className="text-slate-500 text-sm">IA per a la redacció d'informes psicopedagògics</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <button 
            onClick={() => setShowHistory(true)}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-2 text-sm font-bold"
            title="Veure informes guardats"
          >
            <i className="fas fa-history"></i> Historial
          </button>
          
          <button 
            onClick={() => saveReportToHistory()}
            disabled={!isReportStarted}
            className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 text-sm font-bold shadow-sm ${
              isReportStarted 
              ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100" 
              : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
            }`}
            title="Guarda per continuar més tard"
          >
            <i className="fas fa-save"></i> Guardar Informe
          </button>

          <button 
            onClick={reset}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-2 text-sm font-bold shadow-sm"
          >
            <i className="fas fa-plus"></i> Nou Informe
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto">
        <StepIndicator currentStep={step} />

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-3">
              <i className="fas fa-exclamation-circle text-xl"></i>
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><i className="fas fa-times"></i></button>
          </div>
        )}

        {/* STEP 1: INPUT */}
        {step === AppStep.INPUT && (
          <div className="space-y-8 animate-fadeIn">
            {/* 1. DADES DE L'ALUMNE - ARA A DALT DE TOT */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nom de l'alumne</label>
                <input type="text" value={report.studentName} onChange={(e) => setReport(prev => ({ ...prev, studentName: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" placeholder="Ex: Joan P." />
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nivell Escolar</label>
                <select 
                  value={report.schoolLevel} 
                  onChange={(e) => setReport(prev => ({ ...prev, schoolLevel: e.target.value }))} 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                >
                  <option value="" disabled>Selecciona un nivell...</option>
                  {SCHOOL_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                </select>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Curs Escolar</label>
                <input 
                  type="text" 
                  value={report.schoolYear} 
                  onChange={(e) => setReport(prev => ({ ...prev, schoolYear: e.target.value }))} 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" 
                  placeholder="Ex: 2024-25"
                />
              </div>
            </div>

            {/* 2. BLOCS A INCLOURE */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <i className="fas fa-layer-group text-blue-600"></i>
                1. Necessitat específica de suport educatiu
              </h2>
              <div className="flex flex-col gap-3">
                {BLOCK_OPTIONS.map((block) => (
                  <button 
                    key={block.id} 
                    onClick={() => toggleBlock(block.id)} 
                    className={`text-left p-4 rounded-xl border transition-all duration-200 group flex items-start justify-between ${report.selectedBlocks.includes(block.id) ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                  >
                    <div className="flex-1">
                      <span className={`font-bold text-xs uppercase tracking-tight block mb-1 ${report.selectedBlocks.includes(block.id) ? 'text-blue-700' : 'text-slate-400'}`}>Bloc {block.id}</span>
                      <span className={`font-bold text-sm leading-tight block ${report.selectedBlocks.includes(block.id) ? 'text-blue-900' : 'text-slate-700'}`}>{block.label}</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${report.selectedBlocks.includes(block.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                      {report.selectedBlocks.includes(block.id) && <i className="fas fa-check text-[10px]"></i>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. OBSERVACIONS */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <i className="fas fa-pencil-alt text-blue-600"></i>
                  2. Observacions i dades d'interès
                </h2>
                <div className="flex items-center gap-2">
                  <label className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${fileProcessing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                    {fileProcessing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-file-upload"></i>}
                    <span>{fileProcessing ? '...' : 'Local'}</span>
                    <input type="file" accept=".txt,.pdf,.docx,.xlsx,.xls" onChange={handleFileUpload} disabled={fileProcessing} className="hidden" />
                  </label>
                  <button 
                    onClick={handleGoogleDrive}
                    disabled={fileProcessing}
                    className={`px-4 py-2 bg-white border border-slate-200 rounded-xl transition-all flex items-center gap-2 text-xs font-bold shadow-sm ${fileProcessing ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50'}`}
                    title="Cerca a Google Drive"
                  >
                    <i className={`fab fa-google-drive ${fileProcessing ? 'text-slate-300' : 'text-blue-500'}`}></i>
                    <span>Drive</span>
                  </button>
                </div>
              </div>
              <div className="relative">
                <textarea
                  value={report.rawInput}
                  onChange={(e) => setReport(prev => ({ ...prev, rawInput: e.target.value }))}
                  placeholder="Enganxa aquí informació, notes d'observació a l'aula o puja documents per analitzar..."
                  className="w-full h-80 p-5 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none resize-none bg-slate-50 transition-all leading-relaxed"
                />
                {(report.rawInput || fileProcessing) && (
                  <div className="absolute bottom-4 right-4 flex items-center gap-2">
                    {fileProcessing && <span className="text-xs text-blue-600 font-bold animate-pulse"><i className="fas fa-sync fa-spin mr-1"></i> Carregant...</span>}
                    {report.rawInput && !fileProcessing && (
                      <button onClick={() => setReport(prev => ({ ...prev, rawInput: '' }))} className="text-xs font-bold text-red-500 hover:text-red-700 bg-white px-3 py-1.5 rounded-lg border border-red-100 shadow-sm transition-all">
                        <i className="fas fa-trash-alt mr-1"></i> Buidar text
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* BOTÓ DE GENERACIÓ */}
            <div className="flex justify-center pt-4">
              <button 
                onClick={generateApartat1} 
                disabled={loading || !report.rawInput.trim() || fileProcessing} 
                className="w-full max-w-md py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-lg"
              >
                {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
                Generar Apartat 1
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CONCLUSIONS */}
        {step === AppStep.CONCLUSIONS && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex items-center justify-between no-print">
               <button onClick={() => { setStep(AppStep.INPUT); setReport(p => ({...p, currentStep: AppStep.INPUT})); }} className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-2"><i className="fas fa-arrow-left"></i> Enrere</button>
               <h2 className="text-xl font-bold text-slate-800">Apartat 1: Conclusions</h2>
               <button onClick={generateApartat2} disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 transition-all shadow-md">
                 {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-lightbulb"></i>} Generar Orientacions
               </button>
            </div>
            <RichTextEditor label="CONCLUSIONS" value={report.conclusions} onChange={(val) => setReport(prev => ({ ...prev, conclusions: val }))} className="shadow-xl" />
          </div>
        )}

        {/* STEP 3: ORIENTATIONS */}
        {step === AppStep.ORIENTATIONS && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex items-center justify-between no-print">
               <button onClick={() => { setStep(AppStep.CONCLUSIONS); setReport(p => ({...p, currentStep: AppStep.CONCLUSIONS})); }} className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-2"><i className="fas fa-arrow-left"></i> Enrere</button>
               <h2 className="text-xl font-bold text-slate-800">Apartat 2: Orientacions</h2>
               <button onClick={() => { setStep(AppStep.FINALIZE); setReport(p => ({...p, currentStep: AppStep.FINALIZE})); }} className="px-6 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 flex items-center gap-2 transition-all shadow-md">
                 <i className="fas fa-file-check"></i> Revisió Final
               </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="opacity-60 pointer-events-none no-print"><RichTextEditor label="Apartat 1 (Lectura)" value={report.conclusions} onChange={() => {}} /></div>
              <RichTextEditor label="ORIENTACIONS" value={report.orientations} onChange={(val) => setReport(prev => ({ ...prev, orientations: val }))} className="shadow-xl ring-2 ring-blue-500" />
            </div>
          </div>
        )}

        {/* STEP 4: FINALIZE */}
        {step === AppStep.FINALIZE && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex items-center justify-between no-print">
               <button onClick={() => { setStep(AppStep.ORIENTATIONS); setReport(p => ({...p, currentStep: AppStep.ORIENTATIONS})); }} className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-2"><i className="fas fa-arrow-left"></i> Editar</button>
               <div className="flex flex-wrap gap-4">
                 <button onClick={() => saveReportToHistory()} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg transition-all">
                   <i className="fas fa-save"></i> Guardar Historial
                 </button>
                 <button onClick={handleDownloadWord} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg transition-all">
                   <i className="fas fa-file-word"></i> Guardar (.doc)
                 </button>
                 <button onClick={handlePrint} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 flex items-center gap-2 shadow-lg transition-all">
                   <i className="fas fa-print"></i> Imprimir / PDF
                 </button>
               </div>
            </div>

            <div className="bg-white p-12 rounded-lg shadow-2xl border border-slate-200 report-container">
              <div className="border-b-2 border-slate-800 pb-6 mb-8 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-black uppercase text-slate-800 tracking-tighter">Informe NESE</h1>
                  <p className="text-sm font-bold text-slate-600">Reconeixement de Necessitats Específiques de Suport Educatiu</p>
                </div>
                <div className="text-right text-xs text-slate-500 space-y-1">
                  <p><strong>ALUMNE:</strong> {report.studentName || '—'}</p>
                  <p><strong>NIVELL:</strong> {report.schoolLevel || '—'}</p>
                  <p><strong>CURS:</strong> {report.schoolYear || '—'}</p>
                  <p><strong>DATA:</strong> {new Date(report.timestamp || Date.now()).toLocaleDateString('ca-ES')}</p>
                </div>
              </div>
              <section className="mb-12">
                <h2 className="text-lg font-black text-blue-900 border-l-4 border-blue-900 pl-4 mb-6 uppercase tracking-wide">1. Conclusions de l'avaluació psicopedagògica</h2>
                <div className="prose prose-slate max-w-none text-justify leading-relaxed" dangerouslySetInnerHTML={{ __html: report.conclusions }} />
              </section>
              <section className="mb-12">
                <h2 className="text-lg font-black text-blue-900 border-l-4 border-blue-900 pl-4 mb-6 uppercase tracking-wide">2. Orientacions per a l'atenció educativa</h2>
                <div className="prose prose-slate max-w-none text-justify leading-relaxed" dangerouslySetInnerHTML={{ __html: report.orientations }} />
              </section>
              <div className="mt-20 pt-10 border-t border-slate-100 grid grid-cols-2 gap-20">
                <div className="border-t border-slate-300 pt-2 text-center text-xs text-slate-400">Equip d'Assessorament i Orientació (EAP)</div>
                <div className="border-t border-slate-300 pt-2 text-center text-xs text-slate-400">Signatura del Professional</div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-20 pb-10 text-center text-slate-400 text-sm no-print">
        <p>© {new Date().getFullYear()} Elaboració de NESE — Basat en el Decret 150/2017</p>
      </footer>
    </div>
  );
};

export default App;
