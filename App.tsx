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
      setError(`Error fitxer: ${err.message || 'Error desconegut'}`);
    } finally {
      setFileProcessing(false);
      e.target.value = '';
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
      setError("Si us plau, introdueix dades o notes de l'alumne.");
      return;
    }
    if (report.selectedBlocks.length === 0) {
      setError("Selecciona almenys un bloc.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await geminiService.generateConclusions(report.rawInput, report.selectedBlocks, report.schoolLevel);
      setReport(prev => ({ ...prev, conclusions: result, currentStep: AppStep.CONCLUSIONS }));
      setStep(AppStep.CONCLUSIONS);
    } catch (err: any) {
      setError(`Error IA: ${err.message || 'No s\'ha pogut generar l\'apartat 1'}`);
    } finally {
      setLoading(false);
    }
  };

  const generateApartat2 = async () => {
    if (!report.conclusions || report.conclusions.length < 10) {
      setError("No hi ha conclusions suficients per generar les orientacions.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await geminiService.generateOrientations(report.conclusions, report.schoolLevel);
      setReport(prev => ({ ...prev, orientations: result, currentStep: AppStep.ORIENTATIONS }));
      setStep(AppStep.ORIENTATIONS);
    } catch (err: any) {
      setError(`Error IA: ${err.message || 'No s\'ha pogut generar l\'apartat 2'}`);
      // Ens quedem a la pantalla actual si falla
    } finally {
      setLoading(false);
    }
  };

  const saveReportToHistory = () => {
    const newReport = { 
      ...report, 
      id: report.id || Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      currentStep: step
    };
    const updatedHistory = report.id ? savedReports.map(r => r.id === report.id ? newReport : r) : [newReport, ...savedReports];
    saveToLocalStorage(updatedHistory);
    setReport(newReport);
    alert("Informe guardat.");
  };

  const reset = () => {
    if (confirm("Vols iniciar un nou informe?")) window.location.reload();
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      {showHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold">Historial</h2>
              <button onClick={() => setShowHistory(false)} className="p-2"><i className="fas fa-times"></i></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              {savedReports.length === 0 ? <p className="text-center text-slate-400">No hi ha informes guardats.</p> : 
                savedReports.map(r => (
                  <div key={r.id} onClick={() => { setReport(r); setStep(r.currentStep || AppStep.INPUT); setShowHistory(false); }} className="p-4 border rounded-2xl hover:bg-blue-50 cursor-pointer flex justify-between items-center group">
                    <div>
                      <h4 className="font-bold">{r.studentName || 'Sense nom'}</h4>
                      <p className="text-xs text-slate-500">{new Date(r.timestamp!).toLocaleDateString()}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); saveToLocalStorage(savedReports.filter(x => x.id !== r.id)); }} className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500"><i className="fas fa-trash-alt"></i></button>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

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
          <button onClick={saveReportToHistory} disabled={!report.rawInput.trim() && !report.studentName} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm disabled:opacity-50">Guardar</button>
          <button onClick={reset} className="px-4 py-2 border rounded-xl font-bold text-sm">Nou</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto">
        <StepIndicator currentStep={step} />

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex justify-between items-center animate-fadeIn">
            <span>{error}</span>
            <button onClick={() => setError(null)}><i className="fas fa-times"></i></button>
          </div>
        )}

        {step === AppStep.INPUT && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input type="text" value={report.studentName} onChange={e => setReport({...report, studentName: e.target.value})} className="p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nom de l'alumne" />
              <select value={report.schoolLevel} onChange={e => setReport({...report, schoolLevel: e.target.value})} className="p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecciona nivell...</option>
                {SCHOOL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <input type="text" value={report.schoolYear} onChange={e => setReport({...report, schoolYear: e.target.value})} className="p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Curs (ex 2024-25)" />
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
                <h2 className="text-lg font-bold">2. Observacions i Notes</h2>
                <label className="cursor-pointer px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all">
                  {fileProcessing ? 'Processant...' : 'Adjuntar Document'}
                  <input type="file" onChange={handleFileUpload} disabled={fileProcessing} className="hidden" />
                </label>
              </div>
              <textarea value={report.rawInput} onChange={e => setReport({...report, rawInput: e.target.value})} className="w-full h-80 p-5 border rounded-2xl outline-none bg-slate-50 focus:bg-white transition-all resize-none" placeholder="Enganxa aquí les notes de l'avaluació..." />
            </div>

            <button onClick={generateApartat1} disabled={loading || !report.rawInput.trim()} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50 text-lg">
              {loading ? <><i className="fas fa-spinner fa-spin mr-2"></i> Generant Apartat 1...</> : 'Generar Conclusions'}
            </button>
          </div>
        )}

        {step === AppStep.CONCLUSIONS && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center no-print">
              <button onClick={() => setStep(AppStep.INPUT)} className="text-slate-500 font-medium hover:text-slate-800 transition-colors">← Tornar a dades</button>
              <button onClick={generateApartat2} disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50">
                {loading ? <><i className="fas fa-spinner fa-spin mr-2"></i> Generant...</> : 'Generar Orientacions →'}
              </button>
            </div>
            <RichTextEditor label="APARTAT 1: CONCLUSIONS" value={report.conclusions} onChange={v => setReport({...report, conclusions: v})} />
          </div>
        )}

        {step === AppStep.ORIENTATIONS && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center no-print">
              <button onClick={() => setStep(AppStep.CONCLUSIONS)} className="text-slate-500 font-medium hover:text-slate-800 transition-colors">← Tornar a conclusions</button>
              <button onClick={() => setStep(AppStep.FINALIZE)} className="px-6 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all">Revisió Final</button>
            </div>
            <RichTextEditor label="APARTAT 2: ORIENTACIONS" value={report.orientations} onChange={v => setReport({...report, orientations: v})} />
          </div>
        )}

        {step === AppStep.FINALIZE && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between no-print">
              <button onClick={() => setStep(AppStep.ORIENTATIONS)} className="text-slate-500 font-medium hover:text-slate-800">← Editar orientacions</button>
              <button onClick={() => window.print()} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all"><i className="fas fa-print mr-2"></i> Imprimir PDF</button>
            </div>
            <div className="bg-white p-12 border report-container shadow-sm prose prose-slate max-w-none">
              <h1 className="text-center uppercase underline mb-8">Informe de Reconeixement NESE</h1>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <p>Alumne/a: <strong>{report.studentName || '________________'}</strong></p>
                <p>Curs: <strong>{report.schoolYear || '________________'}</strong></p>
                <p>Nivell: <strong>{report.schoolLevel || '________________'}</strong></p>
                <p>Data: <strong>{new Date().toLocaleDateString()}</strong></p>
              </div>
              <hr className="my-8" />
              <h3>1. CONCLUSIONS DE L'AVALUACIÓ</h3>
              <div dangerouslySetInnerHTML={{__html: report.conclusions}} />
              <div className="page-break my-12"></div>
              <h3>2. ORIENTACIONS PER A LA RESPOSTA EDUCATIVA</h3>
              <div dangerouslySetInnerHTML={{__html: report.orientations}} />
              <div className="mt-20 flex justify-end">
                <div className="text-center border-t border-slate-300 pt-4 px-8">
                  <p className="text-xs text-slate-400 mb-8 italic">Signat per:</p>
                  <p className="font-bold">Equip d'Orientació Psicopedagògica</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;