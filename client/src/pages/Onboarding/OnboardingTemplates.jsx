import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import onboardingService from '../../services/onboardingService';
import OnboardingTemplateBuilder from '../../components/OnboardingTemplateBuilder';
import './OnboardingWorkspace.css';

export default function OnboardingTemplates() {
  const [templates, setTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);

  const loadTemplates = () => onboardingService.getTemplates().then((data) => setTemplates(data.templates || []));
  useEffect(() => { loadTemplates(); }, []);

  return (
    <div className="onb-shell rounded-[28px] p-4 md:p-6">
      <div className="flex flex-col gap-6">
        {/* Header Section */}
        <div className="onb-card rounded-[32px] p-8 bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-2xl shadow-indigo-200">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h2 className="text-3xl font-black tracking-tight">Dynamic Template Engine</h2>
              <p className="mt-2 text-indigo-100 font-medium max-w-md">
                Design multi-versioned, SaaS-ready onboarding workflows with custom sections, fields, and document requirements.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingTemplate(null);
                setShowBuilder(true);
              }}
              className="inline-flex items-center gap-3 rounded-2xl bg-white px-8 py-4 text-sm font-black text-indigo-600 shadow-xl hover:scale-105 transition-all active:scale-95"
            >
              <Plus size={20} strokeWidth={3} />
              Create New Template
            </button>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div key={template._id} className="onb-card rounded-[28px] p-6 bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-50 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900">{template.name}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-[10px] font-black text-indigo-600 uppercase tracking-tighter">v{template.version}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`w-2 h-2 rounded-full ${template.status === 'published' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${template.status === 'published' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {template.status}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setEditingTemplate(template);
                    setShowBuilder(true);
                  }}
                  className="p-2 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all"
                >
                  <Plus size={18} className="rotate-45" />
                </button>
              </div>

              <p className="text-sm text-slate-500 line-clamp-2 min-h-[40px] mb-6">
                {template.description || 'No description provided for this template version.'}
              </p>

              <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sections</span>
                  <span className="text-sm font-black text-slate-900">{template.sections?.length || 0}</span>
                </div>
                <button 
                  onClick={() => {
                    setEditingTemplate(template);
                    setShowBuilder(true);
                  }}
                  className="px-6 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-black hover:bg-indigo-600 hover:text-white transition-all"
                >
                  Edit / View
                </button>
              </div>
            </div>
          ))}

          {/* Empty State */}
          {templates.length === 0 && (
            <div className="lg:col-span-3 py-20 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                <Plus size={40} className="text-slate-200" />
              </div>
              <h3 className="text-xl font-black text-slate-900">No templates found</h3>
              <p className="text-slate-500 max-w-xs mx-auto mt-2">Get started by creating your first dynamic onboarding template.</p>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Form Builder Modal */}
      {showBuilder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
          <OnboardingTemplateBuilder 
            onCancel={() => setShowBuilder(false)}
            initialData={editingTemplate}
            onSave={(newTemplate) => {
              setShowBuilder(false);
              loadTemplates();
            }}
          />
        </div>
      )}
    </div>
  );
}
