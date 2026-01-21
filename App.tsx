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
  const prevNameRef = useRef('');

  const getIntroTemplate = (name: string) => {
    const displayName = name.trim() || 'XXX';
    return `En l'avaluació psicopedagògica de ${displayName} observem diferents aspectes a tenir presents per oferir una resposta educativa davant d'unes necessitats específiques relacionades amb els següents àmbits:`;
  };

  useEffect(() => {
    const currentName = report.studentName;
    const oldTemplate = getIntroTemplate(prevNameRef.current);
    const newTemplate = getIntroTemplate(currentName);

    setReport(prev => {
      if (!prev.rawInput.trim() || prev.rawInput === oldTemplate || prev.rawInput === getIntroTemplate('')) {
        return { ...prev, rawInput: newTemplate };
      }
      if (prev.rawInput.startsWith(oldTemplate)) {
        return { ...prev, rawInput: prev.rawInput.replace(oldTemplate, newTemplate) };
      }
      return prev;
    });
    prevNameRef.current = currentName;
  }, [report.studentName]);

  useEffect(() => {
    const history = localStorage.getItem('nese_reports_history');
    if (history) {
      try {
        setSavedReports(JSON.parse(history));
      } catch (e) {
        console.error("Error history:", e);
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
        rawInput: prev.rawInput + (prev.rawInput ? '\n\n' : '') + `[Fitxer: ${file.name}]:\n` + text 
      }));
    } catch (err: any) {
      setError(`Error: ${err.message || 'Error fitxer'}`);
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
    if (!report.rawInput.trim() || report.rawInput === getIntroTemplate(report.studentName)) {
      setError("Afegeix més informació després de la introducció.");
      return;
    }
    if (report.selectedBlocks.length === 0) {
      setError("Selecciona un bloc.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await geminiService.generateConclusions(report.rawInput, report.selectedBlocks, report.schoolLevel);
      setReport(prev => ({ ...prev, conclusions: result, currentStep: AppStep.CONCLUSIONS }));
      setStep(AppStep.CONCLUSIONS);
    } catch (err) {
      setError("Error IA.");
    } finally {
      setLoading(false);
    }
  };

  const generateApartat2 = async () => {
    setLoading(true);
    try {
      const result = await geminiService.generateOrientations(report.conclusions, report.schoolLevel);
      setReport(prev => ({ ...prev, orientations: result, currentStep: AppStep.ORIENTATIONS }));
      setStep(AppStep.ORIENTATIONS);
    } catch (err) {
      setError("Error IA.");
    } finally {
      setLoading(false);
    }
  };

  const saveReport = () => {
    const newReport = { ...report, id: report.id || Math.random().toString(36).substr(2, 9), timestamp: Date.now(), currentStep: step };
    const updated = report.id ? savedReports.map(r => r.id === report.id ? newReport : r) : [newReport, ...savedReports];
    saveToLocalStorage(updated);
    setReport(newReport);
    alert("Guardat.");
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      {showHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold">Historial</h2>
              <button onClick={() => setShowHistory(false)} className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              {savedReports.map(r => (
                <div key={r.id} onClick={() => { setReport(r); setStep(r.currentStep || AppStep.INPUT); setShowHistory(false); }} className="p-4 border border-slate-200 rounded-2xl hover:bg-blue-50 cursor-pointer flex justify-between items-center group">
                  <div>
                    <div className="font-bold">{r.studentName || 'Sense nom'}</div>
                    <div className="text-xs text-slate-500">{new Date(r.timestamp!).toLocaleDateString()}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); saveToLocalStorage(savedReports.filter(x => x.id !== r.id)); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"><i className="fas fa-trash"></i></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <header className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between mb-8 no-print">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg"><i className="fas fa-file-medical"></i></div>
          <div><h1 className="text-2xl font-bold">NESE Report Builder</h1></div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowHistory(true)} className="px-4 py-2 hover:bg-slate-100 rounded-xl font-bold text-sm">Historial</button>
          <button onClick={saveReport} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm">Guardar</button>
          <button onClick={() => window.location.reload()} className="px-4 py-2 border rounded-xl font-bold text-sm">Nou</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto">
        <StepIndicator currentStep={step} />
        {error && <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex justify-between"><span>{error}</span><button onClick={() => setError(null)}><i className="fas fa-times"></i></button></div>}

        {step === AppStep.INPUT && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input type="text" value={report.studentName} onChange={e => setReport({...report, studentName: e.target.value})} className="p-3 border rounded-xl" placeholder="Nom alumne" />
              <select value={report.schoolLevel} onChange={e => setReport({...report, schoolLevel: e.target.value})} className="p-3 border rounded-xl">
                <option value="">Nivell</option>
                {SCHOOL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <input type="text" value={report.schoolYear} onChange={e => setReport({...report, schoolYear: e.target.value})} className="p-3 border rounded-xl" placeholder="Curs (ex 2024-25)" />
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
              <h2 className="font-bold mb-4">1. Blocs NESE</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BLOCK_OPTIONS.map(b => (
                  <button key={b.id} onClick={() => toggleBlock(b.id)} className={`p-4 border rounded-xl text-left ${report.selectedBlocks.includes(b.id) ? 'bg-blue-50 border-blue-500' : ''}`}>
                    <div className="text-xs font-bold opacity-50">BLOC {b.id}</div>
                    <div className="font-bold text-sm">{b.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold">2. Observacions</h2>
                <label className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold cursor-pointer">
                  {fileProcessing ? 'Processant...' : 'Adjuntar Fitxer'}
                  <input type="file" onChange={handleFileUpload} className="hidden" disabled={fileProcessing} />
                </label>
              </div>
              <textarea value={report.rawInput} onChange={e => setReport({...report, rawInput: e.target.value})} className="w-full h-80 p-5 border rounded-2xl bg-slate-50 outline-none" placeholder="Notes aquí..." />
            </div>
            <button onClick={generateApartat1} disabled={loading} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg disabled:opacity-50">
              {loading ? 'Generant...' : 'Generar Conclusions'}
            </button>
          </div>
        )}

        {step === AppStep.CONCLUSIONS && (
          <div className="space-y-6">
            <div className="flex justify-between">
              <button onClick={() => setStep(AppStep.INPUT)} className="text-slate-500">Enrere</button>
              <button onClick={generateApartat2} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">{loading ? '...' : 'Següent'}</button>
            </div>
            <RichTextEditor label="CONCLUSIONS" value={report.conclusions} onChange={v => setReport({...report, conclusions: v})} />
          </div>
        )}

        {step === AppStep.ORIENTATIONS && (
          <div className="space-y-6">
            <div className="flex justify-between">
              <button onClick={() => setStep(AppStep.CONCLUSIONS)} className="text-slate-500">Enrere</button>
              <button onClick={() => setStep(AppStep.FINALIZE)} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold">Finalitzar</button>
            </div>
            <RichTextEditor label="ORIENTACIONS" value={report.orientations} onChange={v => setReport({...report, orientations: v})} />
          </div>
        )}

        {step === AppStep.FINALIZE && (
          <div className="space-y-6">
            <div className="flex justify-between no-print">
              <button onClick={() => setStep(AppStep.ORIENTATIONS)} className="text-slate-500">Editar</button>
              <button onClick={() => window.print()} className="bg-slate-800 text-white px-6 py-2 rounded-xl font-bold">Imprimir PDF</button>
            </div>
            <div className="bg-white p-12 border report-container shadow-sm prose prose-slate max-w-none">
              <h1 className="text-center">INFORME NESE</h1>
              <div className="flex justify-between border-b pb-4 mb-8">
                <div>Alumne: <strong>{report.studentName}</strong></div>
                <div>Curs: <strong>{report.schoolYear}</strong></div>
              </div>
              <h3>1. Conclusions</h3>
              <div dangerouslySetInnerHTML={{__html: report.conclusions}} />
              <h3>2. Orientacions</h3>
              <div dangerouslySetInnerHTML={{__html: report.orientations}} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;