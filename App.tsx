import React, { useState, useEffect } from 'react';
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
    if (!silent) alert("Informe guardat a l'historial.");
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
    if (confirm("Segur que vols eliminar aquest informe?")) {
      const updated = savedReports.filter(r => r.id !== id);
      saveToLocalStorage(updated);
    }
  };

  const reset = () => {
    if (confirm("Vols iniciar un nou informe?")) {
      window.location.reload();
    }
  };

  const isReportStarted = report.rawInput.trim().length > 0 || report.studentName.trim().length > 0;

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      {/* Historial Overlay */}
      {showHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold">Historial</h2>
              <button onClick={() => setShowHistory(false)}><i className="fas fa-times"></i></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              {savedReports.length === 0 ? <p className="text-center text-slate-400">No hi ha informes.</p> : 
                savedReports.map(r => (
                  <div key={r.id} onClick={() => loadReport(r.id!)} className="p-4 border rounded-2xl hover:bg-blue-50 cursor-pointer flex justify-between items-center group">
                    <div>
                      <h4 className="font-bold">{r.studentName || 'Sense nom'}</h4>
                      <p className="text-xs text-slate-500">{new Date(r.timestamp!).toLocaleDateString()}</p>
                    </div>
                    <button onClick={(e) => deleteReport(e, r.id!)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition-all"><i className="fas fa-trash-alt"></i></button>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between mb-8 no-print">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg"><i className="fas fa-file-medical"></i></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Elaboració de NESE</h1>
            <p className="text-slate-500 text-sm">IA per a informes psicopedagògics</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowHistory(true)} className="px-4 py-2 text-slate-600 font-bold text-sm">Historial</button>
          <button onClick={() => saveReportToHistory()} disabled={!isReportStarted} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm disabled:opacity-50">Guardar</button>
          <button onClick={reset} className="px-4 py-2 border rounded-xl font-bold text-sm">Nou</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto">
        <StepIndicator currentStep={step} />

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)}><i className="fas fa-times"></i></button>
          </div>
        )}

        {step === AppStep.INPUT && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input type="text" value={report.studentName} onChange={e => setReport({...report, studentName: e.target.value})} className="p-3 border rounded-xl outline-none focus:border-blue-500" placeholder="Nom de l'alumne" />
              <select value={report.schoolLevel} onChange={e => setReport({...report, schoolLevel: e.target.value})} className="p-3 border rounded-xl outline-none focus:border-blue-500">
                <option value="">Selecciona nivell...</option>
                {SCHOOL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <input type="text" value={report.schoolYear} onChange={e => setReport({...report, schoolYear: e.target.value})} className="p-3 border rounded-xl outline-none focus:border-blue-500" placeholder="Curs (ex 2024-25)" />
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border">
              <h2 className="text-lg font-bold mb-4">1. Blocs NESE</h2>
              <div className="flex flex-col gap-2">
                {BLOCK_OPTIONS.map(block => (
                  <button key={block.id} onClick={() => toggleBlock(block.id)} className={`text-left p-4 rounded-xl border transition-all ${report.selectedBlocks.includes(block.id) ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'bg-white hover:border-slate-300'}`}>
                    <span className="font-bold text-sm">{block.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">2. Observacions</h2>
                <label className="cursor-pointer px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all">
                  {fileProcessing ? 'Carregant...' : 'Adjuntar Fitxer'}
                  <input type="file" onChange={handleFileUpload} disabled={fileProcessing} className="hidden" />
                </label>
              </div>
              <textarea value={report.rawInput} onChange={e => setReport({...report, rawInput: e.target.value})} className="w-full h-80 p-5 border rounded-2xl outline-none bg-slate-50 focus:bg-white transition-all" placeholder="Escriu o enganxa aquí les notes..." />
            </div>

            <button onClick={generateApartat1} disabled={loading || !report.rawInput.trim()} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 text-lg">
              {loading ? <i className="fas fa-circle-notch fa-spin mr-2"></i> : null}
              Generar Apartat 1
            </button>
          </div>
        )}

        {step === AppStep.CONCLUSIONS && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center no-print">
              <button onClick={() => setStep(AppStep.INPUT)} className="text-slate-500 font-medium">← Enrere</button>
              <button onClick={generateApartat2} disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold">Següent →</button>
            </div>
            <RichTextEditor label="CONCLUSIONS" value={report.conclusions} onChange={v => setReport({...report, conclusions: v})} />
          </div>
        )}

        {step === AppStep.ORIENTATIONS && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center no-print">
              <button onClick={() => setStep(AppStep.CONCLUSIONS)} className="text-slate-500 font-medium">← Enrere</button>
              <button onClick={() => setStep(AppStep.FINALIZE)} className="px-6 py-2 bg-green-600 text-white rounded-xl font-bold">Revisió Final</button>
            </div>
            <RichTextEditor label="ORIENTACIONS" value={report.orientations} onChange={v => setReport({...report, orientations: v})} />
          </div>
        )}

        {step === AppStep.FINALIZE && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between no-print">
              <button onClick={() => setStep(AppStep.ORIENTATIONS)} className="text-slate-500 font-medium">Editar</button>
              <button onClick={() => window.print()} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold">Imprimir PDF</button>
            </div>
            <div className="bg-white p-12 border report-container shadow-sm prose prose-slate max-w-none">
              <h1 className="text-center uppercase underline">Informe NESE</h1>
              <p>Alumne/a: <strong>{report.studentName}</strong> | Curs: <strong>{report.schoolYear}</strong></p>
              <h3>1. CONCLUSIONS</h3>
              <div dangerouslySetInnerHTML={{__html: report.conclusions}} />
              <h3>2. ORIENTACIONS</h3>
              <div dangerouslySetInnerHTML={{__html: report.orientations}} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;