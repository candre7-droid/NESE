import React from 'react';
import { AppStep } from '../types';

interface StepIndicatorProps {
  currentStep: AppStep;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const steps = [
    { key: AppStep.INPUT, label: 'Dades', icon: 'fa-file-import' },
    { key: AppStep.CONCLUSIONS, label: 'Conclusions', icon: 'fa-brain' },
    { key: AppStep.ORIENTATIONS, label: 'Orientacions', icon: 'fa-compass' },
    { key: AppStep.FINALIZE, label: 'Finalitza', icon: 'fa-check-double' },
  ];

  const getStatus = (stepKey: AppStep) => {
    const order = [AppStep.INPUT, AppStep.CONCLUSIONS, AppStep.ORIENTATIONS, AppStep.FINALIZE];
    const currentIndex = order.indexOf(currentStep);
    const stepIndex = order.indexOf(stepKey);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="flex items-center justify-between w-full max-w-3xl mx-auto mb-8 no-print">
      {steps.map((step, index) => {
        const status = getStatus(step.key);
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center group relative">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                ${status === 'completed' ? 'bg-emerald-700 text-white' : 
                  status === 'current' ? 'bg-emerald-100 text-emerald-700 ring-4 ring-emerald-50' : 
                  'bg-white text-slate-400 border border-slate-200'}
              `}>
                <i className={`fas ${status === 'completed' ? 'fa-check' : step.icon}`}></i>
              </div>
              <span className={`mt-2 text-xs font-medium ${status === 'current' ? 'text-emerald-700' : 'text-slate-500'}`}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className="flex-1 h-px bg-slate-200 mx-4 -mt-6"></div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};