import React, { useEffect, useMemo, useState } from 'react';
import { Check, FileUp, Lock, Play, RotateCcw, ShieldCheck, UploadCloud } from 'lucide-react';
import onboardingSuiteApi from './api';
import './onboardingSuite.css';

export default function OnboardingSuitePortal({ assignmentId }) {
  const [data, setData] = useState({ assignment: null, steps: [], documents: [], approvals: [] });
  const [activeStepKey, setActiveStepKey] = useState('');
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(false);

  const activeStep = useMemo(
    () => data.steps.find((step) => step.stepKey === activeStepKey) || data.steps.find((step) => ['pending', 'in_progress', 'failed', 'rejected'].includes(step.status)) || data.steps[0],
    [data.steps, activeStepKey]
  );

  const completed = data.steps.filter((step) => step.status === 'completed').length;
  const total = data.steps.length || 1;

  const load = async () => {
    if (!assignmentId) return;
    setLoading(true);
    try {
      const result = await onboardingSuiteApi.getAssignment(assignmentId);
      setData(result);
      if (!activeStepKey) {
        const next = result.steps?.find((step) => ['pending', 'in_progress', 'failed', 'rejected'].includes(step.status)) || result.steps?.[0];
        setActiveStepKey(next?.stepKey || '');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [assignmentId]);

  const complete = async () => {
    if (!activeStep) return;
    await onboardingSuiteApi.completeStep(data.assignment._id, activeStep.stepKey, draft[activeStep.stepKey] || {});
    await load();
  };

  const retry = async () => {
    await onboardingSuiteApi.retryStep(data.assignment._id, activeStep.stepKey);
    await load();
  };

  return (
    <div className="os-shell os-portal">
      <header className="os-header">
        <div>
          <p className="os-kicker">Employee onboarding</p>
          <h1>{data.assignment?.employeeSnapshot?.name || 'Welcome'}</h1>
        </div>
        <div className="os-progress-card">
          <span>{completed} of {total} steps</span>
          <strong>{data.assignment?.progressPercent || 0}%</strong>
          <div className="os-progress"><i style={{ width: `${data.assignment?.progressPercent || 0}%` }} /></div>
        </div>
      </header>

      <main className="os-workspace">
        <aside className="os-stepper">
          {data.steps.map((step) => (
            <button
              type="button"
              key={step.stepKey}
              className={`os-step-button ${activeStep?.stepKey === step.stepKey ? 'active' : ''}`}
              disabled={step.status === 'locked'}
              onClick={() => setActiveStepKey(step.stepKey)}
            >
              {step.status === 'completed' ? <Check size={16} /> : step.status === 'locked' ? <Lock size={16} /> : <Play size={16} />}
              <span>{step.title}</span>
              <small>{step.status}</small>
            </button>
          ))}
        </aside>

        <section className="os-panel os-step-panel">
          {loading && <p className="os-muted">Loading onboarding...</p>}
          {activeStep && (
            <>
              <div className="os-panel-head">
                <div>
                  <h2>{activeStep.title}</h2>
                  <p>{activeStep.phase} - {activeStep.type}</p>
                </div>
                {['failed', 'rejected'].includes(activeStep.status) && (
                  <button className="os-secondary" onClick={retry}><RotateCcw size={16} /> Retry</button>
                )}
              </div>

              <DynamicStep
                assignment={data.assignment}
                step={activeStep}
                value={draft[activeStep.stepKey] || {}}
                documents={data.documents}
                onChange={(value) => setDraft((current) => ({ ...current, [activeStep.stepKey]: value }))}
                onUploaded={load}
              />

              {!['completed', 'locked'].includes(activeStep.status) && (
                <div className="os-action-bar">
                  <button className="os-button" onClick={complete}><Check size={16} /> Complete step</button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function DynamicStep({ assignment, step, value, onChange, documents, onUploaded }) {
  if (step.type === 'document') {
    return <DocumentStep assignment={assignment} step={step} documents={documents} onUploaded={onUploaded} />;
  }
  if (step.type === 'approval') {
    return <ApprovalStep step={step} />;
  }
  if (step.type === 'training') {
    return <TrainingStep step={step} value={value} onChange={onChange} />;
  }
  if (step.type === 'face_registration') {
    return <FaceStep assignment={assignment} step={step} value={value} onChange={onChange} />;
  }
  return <FormStep step={step} value={value} onChange={onChange} />;
}

function FormStep({ step, value, onChange }) {
  const fields = Array.isArray(step.configSnapshot?.formSchema) ? step.configSnapshot.formSchema : [];
  return (
    <div className="os-form-grid">
      {fields.map((field) => (
        <label key={field.name}>
          {field.label || field.name}
          <input
            type={field.type || 'text'}
            required={field.required}
            value={value[field.name] || ''}
            onChange={(event) => onChange({ ...value, [field.name]: event.target.value })}
          />
        </label>
      ))}
      {fields.length === 0 && <p className="os-muted">No form schema configured for this step.</p>}
    </div>
  );
}

function DocumentStep({ assignment, step, documents, onUploaded }) {
  const required = step.configSnapshot?.requiredDocuments || [];
  const [uploading, setUploading] = useState('');

  const upload = async (docType, file) => {
    if (!file) return;
    setUploading(docType);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('assignmentId', assignment._id);
      formData.append('employeeId', assignment.employee);
      formData.append('stepProgressId', step._id);
      formData.append('documentType', docType);
      await onboardingSuiteApi.uploadDocument(formData);
      onUploaded();
    } finally {
      setUploading('');
    }
  };

  return (
    <div className="os-doc-grid">
      {required.map((docType) => {
        const document = documents.find((item) => item.documentType === docType);
        return (
          <label className="os-upload" key={docType}>
            <UploadCloud size={22} />
            <strong>{docType.replace(/_/g, ' ')}</strong>
            <span>{document ? document.status : 'Upload PDF, image, or DOCX'}</span>
            <input type="file" onChange={(event) => upload(docType, event.target.files?.[0])} />
            {uploading === docType && <small>Uploading...</small>}
          </label>
        );
      })}
    </div>
  );
}

function ApprovalStep({ step }) {
  return (
    <div className="os-empty">
      <ShieldCheck size={30} />
      <h3>Waiting for approval</h3>
      <p>Assigned approvers will review this step and unlock the next stage.</p>
      {step.rejectionReason && <p className="os-error">{step.rejectionReason}</p>}
    </div>
  );
}

function TrainingStep({ step, value, onChange }) {
  return (
    <div className="os-empty">
      <FileUp size={30} />
      <h3>Training acknowledgement</h3>
      {step.configSnapshot?.trainingUrl && <a href={step.configSnapshot.trainingUrl} target="_blank" rel="noreferrer">Open training</a>}
      <label className="os-check">
        <input type="checkbox" checked={value.completed === true} onChange={(event) => onChange({ ...value, completed: event.target.checked })} />
        I completed this training.
      </label>
    </div>
  );
}

function FaceStep({ assignment, value, onChange }) {
  const register = async () => {
    await onboardingSuiteApi.registerFace({
      assignmentId: assignment._id,
      employeeId: assignment.employee,
      descriptor: value.descriptor || new Array(128).fill(0).map((_, index) => Math.sin(index)),
      geo: value.geo || { lat: 23.0225, lng: 72.5714, accuracy: 20 },
      liveness: { score: 0.9 },
      deviceId: navigator.userAgent,
    });
    onChange({ ...value, registered: true });
  };

  return (
    <div className="os-empty">
      <ShieldCheck size={30} />
      <h3>Face registration</h3>
      <p>Connect this step to the existing face-api camera component. This fallback button sends a demo descriptor for integration testing.</p>
      <button className="os-button" onClick={register}>Register face</button>
      {value.registered && <span className="os-badge os-badge-ok">Submitted for HR approval</span>}
    </div>
  );
}
