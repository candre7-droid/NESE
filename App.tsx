
import React, { useState, useEffect, useRef } from 'react';
import { AppStep, ReportData } from './types';
import { BLOCK_OPTIONS, SCHOOL_LEVELS } from './constants';
import { geminiService } from './services/geminiService';
import { fileService } from './services/fileService';
import { StepIndicator } from './components/StepIndicator';
import { RichTextEditor } from './components/RichTextEditor';

const GeminiIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3C12 3 12 9 18 12C12 15 12 21 12 21C12 21 12 15 6 12C12 9 12 3 12 3Z" />
    <path d="M19 8C19 8 19 10 21 11C19 12 19 14 19 14C19 14 19 12 17 11C19 10 19 8 19 8Z" />
  </svg>
);

const ACCESS_CODE = 'EAP50'; 

const App: React.FC = () => {
  const [authorized, setAuthorized] = useState<boolean>(() => {
    return sessionStorage.getItem('nese_auth') === 'true';
  });
  const [passInput, setPassInput] = useState('');
  const [authError, setAuthError] = useState(false);

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
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  
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
    if (!authorized) return;
    const history = localStorage.getItem('nese_reports_history');
    if (history) {
      try {
        setSavedReports(JSON.parse(history));
      } catch (e) {
        console.error("Error carregant historial", e);
      }
    }
  }, [authorized]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, showChat]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (passInput.trim().toUpperCase() === ACCESS_CODE) {
      setAuthorized(true);
      sessionStorage.setItem('nese_auth', 'true');
    } else {
      setAuthError(true);
      setTimeout(() => setAuthError(false), 2000);
    }
  };

  const saveToLocalStorage = (reports: ReportData[]) => {
    try {
      localStorage.setItem('nese_reports_history', JSON.stringify(reports));
      setSavedReports(reports);
    } catch (e) {
      console.error("Error guardant a localStorage", e);
      setError("No s'ha pogut guardar l'historial.");
    }
  };

  const toggleBlock = (id: number) => {
    setReport(prev => {
      const selectedBlocks = prev.selectedBlocks.includes(id)
        ? prev.selectedBlocks.filter(b => b !== id)
        : [...prev.selectedBlocks, id];
      return { ...prev, selectedBlocks };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileProcessing(true);
    setError(null);
    setOcrStatus(null);
    
    try {
      const extracted = await fileService.extractText(file);
      let textToAppend = extracted.text;

      if (extracted.isScan && extracted.images && extracted.images.length > 0) {
        setOcrStatus("Detectat PDF escanejat. Realitzant anàlisi visual amb IA...");
        try {
          const aiText = await geminiService.visionExtractText(extracted.images);
          textToAppend = (textToAppend ? textToAppend + "\n\n" : "") + "[Extracció Visual IA]:\n" + aiText;
        } catch (visionErr: any) {
          console.error("Error en visió:", visionErr);
          setError("S'ha detectat un PDF escanejat però l'anàlisi visual ha fallat. Revisa la clau d'API a Vercel.");
        }
      }

      setReport(prev => ({ 
        ...prev, 
        rawInput: prev.rawInput + (prev.rawInput ? '\n\n' : '') + `[Contingut de ${file.name}]:\n` + textToAppend 
      }));
    } catch (err: any) {
      setError(`Error en el fitxer: ${err.message || 'Error desconegut'}`);
    } finally {
      setFileProcessing(false);
      setOcrStatus(null);
      if (e.target) e.target.value = '';
    }
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
      setError(`Error de la IA: ${err.message || 'No s\'ha pogut generar el text. Revisa la configuració de la clau d\'API.'}`);
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(`Error de la IA: ${err.message || 'Error en generar orientacions.'}`);
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
        role: m.role === 'user' ? 'user' : 'model', 
        parts: [{ text: m.content }] 
      }));
      const response = await geminiService.askAssistant(msg, report.rawInput, history);
      setChatMessages(prev => [...prev, { role: 'model', content: response }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'model', content: "Ho sento, no he pogut connectar amb el servei d'intel·ligència artificial." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const finalizeReport = () => {
    const finalReport: ReportData = {
      ...report,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      currentStep: AppStep.FINALIZE
    };
    setReport(finalReport);
    const updatedHistory = [finalReport, ...savedReports];
    saveToLocalStorage(updatedHistory);
    setStep(AppStep.FINALIZE);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetApp = () => {
    if (window.confirm("Vols començar un nou informe? Es perdran les dades no guardades.")) {
      setReport(initialReportState);
      setStep(AppStep.INPUT);
      setChatMessages([]);
      setError(null);
    }
  };

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm border border-slate-100 flex flex-col items-center">
          <div className="mb-6 flex flex-col items-center">
            <div className="w-16 h-16 bg-emerald-600 rounded-3xl flex items-center justify-center text-white text-3xl mb-4 shadow-xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
              <i className="fas fa-lock"></i>
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Accés protegit</h1>
            <p className="text-slate-400 text-xs text-center mt-2 font-medium leading-relaxed">
              Introdueix codi
            </p>
          </div>
          <form onSubmit={handleAuth} className="w-full space-y-4">
            <input
              type="password"
              placeholder="Codi"
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              className={`w-full p-3 bg-slate-50 border ${authError ? 'border-red-500 bg-red-50' : 'border-slate-200'} rounded-2xl outline-none focus:ring-4 focus:ring-emerald-100 transition-all text-center font-bold tracking-widest text-base`}
              autoFocus
            />
            {authError && <p className="text-red-500 text-[10px] text-center mt-2 font-black uppercase tracking-widest animate-pulse">Codi incorrecte</p>}
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg active:scale-95 uppercase tracking-widest text-xs">
              ENTRAR
            </button>
          </form>
          <div className="mt-6 pt-4 border-t border-slate-50 w-full text-center">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Equip d'Assessorament Psicopedagògic</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b sticky top-0 z-30 px-6 py-4 flex justify-between items-center no-print shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setStep(AppStep.INPUT)}>
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white text-xl shadow-md group-hover:scale-105 transition-all">
            <i className="fas fa-brain"></i>
          </div>
          <div>
            <h1 className="font-black text-slate-800 text-lg leading-none">Elaboració NESE</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Inclusió Educativa</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowHistory(true)}
            className="p-3 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
            title="Historial d'informes"
          >
            <i className="fas fa-history text-lg"></i>
          </button>
          <button 
            onClick={resetApp}
            className="hidden md:flex items-center gap-2 px-4 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50 border border-emerald-100 rounded-xl transition-all uppercase tracking-wider"
          >
            <i className="fas fa-plus text-[10px]"></i> Nou Informe
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8">
        <StepIndicator currentStep={step} />

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-start gap-3 animate-shake no-print">
            <i className="fas fa-exclamation-circle text-red-500 mt-1"></i>
            <div className="flex-1">
              <p className="text-red-800 text-sm font-bold">{error}</p>
              <button onClick={() => setError(null)} className="text-red-500 text-[10px] font-black underline mt-2 uppercase tracking-wider">TANCAR AVIS</button>
            </div>
          </div>
        )}

        {step === AppStep.INPUT && (
          <div className="space-y-8 animate-fadeIn">
            <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
              <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center text-sm font-black">1</span>
                Dades de l'alumne/a
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NOM DE L'ALUMNE</label>
                  <input
                    type="text"
                    value={report.studentName}
                    onChange={(e) => setReport({...report, studentName: e.target.value})}
                    placeholder="Ex: Marc G. P."
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NIVELL / CURS</label>
                  <select
                    value={report.schoolLevel}
                    onChange={(e) => setReport({...report, schoolLevel: e.target.value})}
                    className={`w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold cursor-pointer ${report.schoolLevel ? 'text-slate-700' : 'text-slate-400'}`}
                  >
                    <option value="">Selecciona curs</option>
                    {SCHOOL_LEVELS.map(l => <option key={l} value={l} className="text-slate-700">{l}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CURS ESCOLAR</label>
                  <input
                    type="text"
                    value={report.schoolYear}
                    onChange={(e) => setReport({...report, schoolYear: e.target.value})}
                    placeholder="2024-2025"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-slate-700"
                  />
                </div>
              </div>
            </section>

            <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
              <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center text-sm font-black">2</span>
                Àmbits NESE a avaluar
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {BLOCK_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => toggleBlock(opt.id)}
                    className={`text-left p-4 rounded-2xl border transition-all flex flex-col gap-2 ${
                      report.selectedBlocks.includes(opt.id) 
                        ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className={`text-xs font-black uppercase tracking-tighter ${report.selectedBlocks.includes(opt.id) ? 'text-emerald-700' : 'text-slate-400'}`}>
                        BLOC {opt.id}
                      </span>
                      {report.selectedBlocks.includes(opt.id) && <i className="fas fa-check-circle text-emerald-600"></i>}
                    </div>
                    <p className={`font-black text-sm leading-tight ${report.selectedBlocks.includes(opt.id) ? 'text-emerald-900' : 'text-slate-700'}`}>{opt.label}</p>
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">{opt.description}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <span className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center text-sm font-black">3</span>
                  Observacions de l'avaluació
                </h2>
                <div className="flex gap-2 w-full md:w-auto">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".pdf,.docx,.txt,.xlsx,.xls"
                    disabled={fileProcessing}
                  />
                  <label
                    htmlFor="file-upload"
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer transition-all font-bold text-xs shadow-md ${fileProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {fileProcessing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-cloud-arrow-up"></i>}
                    {fileProcessing ? 'Processant...' : 'Adjuntar document'}
                  </label>
                </div>
              </div>
              
              {ocrStatus && (
                <div className="mb-4 text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-100 animate-pulse flex items-center gap-2">
                  <i className="fas fa-microchip"></i> {ocrStatus}
                </div>
              )}

              <textarea
                value={report.rawInput}
                onChange={(e) => setReport({...report, rawInput: e.target.value})}
                placeholder="Transcriu notes d'observació, informes d'escola, resultats de WISC-V, BAS-II, PROLEC... O adjunta el document original."
                className="w-full h-80 p-6 bg-slate-50 border border-slate-200 rounded-[2rem] outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-slate-700 resize-none shadow-inner leading-relaxed"
              />
            </section>

            <div className="flex justify-center pt-8">
              <button
                onClick={generateApartat1}
                disabled={loading || fileProcessing}
                className={`flex items-center gap-4 px-12 py-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:transform-none tracking-tight text-lg`}
              >
                {loading ? <i className="fas fa-sparkles fa-spin"></i> : <i className="fas fa-brain"></i>}
                {loading ? 'ANALITZANT DADES...' : 'GENERAR CONCLUSIONS'}
              </button>
            </div>
          </div>
        )}

        {(step === AppStep.CONCLUSIONS || step === AppStep.ORIENTATIONS) && (
          <div className="space-y-6 animate-slideUp">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 mb-2 no-print shadow-sm">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setStep(step === AppStep.CONCLUSIONS ? AppStep.INPUT : AppStep.CONCLUSIONS)} 
                  className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-xl text-slate-500 transition-all"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
                <div>
                  <h2 className="font-black text-slate-800 leading-tight uppercase text-xs tracking-widest">
                    {step === AppStep.CONCLUSIONS ? 'PAS 2: CONCLUSIONS' : 'PAS 3: ORIENTACIONS'}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold">REVISIÓ I EDICIÓ PROFESSIONALS</p>
                </div>
              </div>
            </div>
            
            <RichTextEditor
              label={step === AppStep.CONCLUSIONS ? "CONCLUSIONS DE L'AVALUACIÓ PSICOPEDAGÒGICA" : "ORIENTACIONS PER A L'ATENCIÓ EDUCATIVA INCLUSIVA"}
              value={step === AppStep.CONCLUSIONS ? report.conclusions : report.orientations}
              onChange={(val) => setReport({...report, [step === AppStep.CONCLUSIONS ? 'conclusions' : 'orientations']: val})}
            />

            <div className="flex justify-center pt-8 no-print">
              <button
                onClick={step === AppStep.CONCLUSIONS ? generateApartat2 : finalizeReport}
                disabled={loading}
                className="flex items-center gap-4 px-12 py-6 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-[2.5rem] shadow-xl transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 tracking-tight"
              >
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className={step === AppStep.CONCLUSIONS ? "fas fa-compass" : "fas fa-check-double"}></i>}
                {loading ? 'GENERANT...' : step === AppStep.CONCLUSIONS ? 'CONTINUAR A ORIENTACIONS' : 'FINALITZAR INFORME'}
              </button>
            </div>
          </div>
        )}

        {step === AppStep.FINALIZE && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex justify-between items-center no-print">
              <button onClick={() => setStep(AppStep.ORIENTATIONS)} className="px-5 py-3 text-xs font-black text-slate-500 hover:bg-white border border-transparent hover:border-slate-200 rounded-2xl transition-all uppercase tracking-widest">
                <i className="fas fa-edit mr-2"></i> Editar
              </button>
              <div className="flex gap-3">
                <button onClick={() => window.print()} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-black text-xs rounded-2xl hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm uppercase tracking-widest">
                  <i className="fas fa-file-pdf text-emerald-600"></i> Exportar PDF
                </button>
                <button onClick={resetApp} className="px-6 py-3 bg-emerald-600 text-white font-black text-xs rounded-2xl hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg uppercase tracking-widest">
                  <i className="fas fa-plus-circle"></i> Nou Informe
                </button>
              </div>
            </div>

            <div className="bg-white p-12 md:p-20 rounded-[3rem] border border-slate-200 shadow-2xl print:shadow-none print:border-none print:p-0 print:m-0" ref={reportContentRef}>
              <div className="flex justify-between items-start mb-16 border-b border-slate-100 pb-8">
                <div className="space-y-1">
                  <h1 className="text-4xl font-black text-slate-800 tracking-tighter">Informe Psicopedagògic</h1>
                  <p className="text-emerald-700 font-black tracking-[0.3em] uppercase text-[10px]">EAP - Equip d'Assessorament i Orientació</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-16 p-10 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-inner">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alumne/a</p>
                  <p className="text-xl font-black text-slate-800">{report.studentName || '---'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Curs i Nivell</p>
                  <p className="text-xl font-black text-slate-800">{report.schoolLevel || '---'} ({report.schoolYear || '---'})</p>
                </div>
              </div>

              <div className="space-y-20">
                <section>
                  <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-8">1. Conclusions de l'avaluació</h2>
                  <div className="prose prose-slate max-w-none text-justify" dangerouslySetInnerHTML={{ __html: report.conclusions }} />
                </section>

                <section>
                  <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-8">2. Orientacions</h2>
                  <div className="prose prose-slate max-w-none text-justify" dangerouslySetInnerHTML={{ __html: report.orientations }} />
                </section>
              </div>
            </div>
          </div>
        )}
      </main>

      <div className="fixed bottom-6 right-6 z-50 no-print">
        {showChat ? (
          <div className="bg-white w-80 md:w-96 h-[550px] rounded-[2.5rem] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-slideUp">
            <div className="bg-slate-800 p-5 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <GeminiIcon className="w-5 h-5" />
                </div>
                <p className="font-black text-sm uppercase tracking-tighter">Elaboració NESE</p>
              </div>
              <button onClick={() => setShowChat(false)} className="hover:bg-slate-700 w-8 h-8 rounded-full transition-colors flex items-center justify-center">
                <i className="fas fa-times text-sm"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-3xl text-xs font-medium shadow-sm ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-4 bg-white border-t flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Pregunta o demana ajustos..."
                className="flex-1 bg-slate-100 border-none rounded-2xl px-5 py-3 text-xs outline-none"
              />
              <button onClick={handleSendMessage} disabled={isChatLoading || !chatInput.trim()} className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50 transition-all">
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowChat(true)} className="w-16 h-16 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-all border-4 border-white">
            <GeminiIcon className="w-8 h-8" />
          </button>
        )}
      </div>

      <footer className="py-10 px-6 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] no-print opacity-60">
        © {new Date().getFullYear()} ELABORACIÓ NESE • REDACCIÓ COMPETENCIAL INCLUSIVA
      </footer>
    </div>
  );
};

export default App;
