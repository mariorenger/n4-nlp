/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Settings, Save, CheckCircle2, XCircle, Database, Cpu, Activity, AlertCircle } from 'lucide-react';
import { getServerConfig, updateServerConfig, checkHealth, type ServerConfig } from '../lib/api';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function SettingsPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [health, setHealth] = useState<{ online: boolean; external?: string; timestamp?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      verifyHealth();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    const data = await getServerConfig();
    setConfig(data);
  };

  const verifyHealth = async () => {
    const status = await checkHealth();
    setHealth(status);
  };

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    await updateServerConfig(config);
    setIsSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 400 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 400 }}
        className="fixed right-0 top-0 h-full w-full max-w-sm bg-white border-l border-[var(--border)] shadow-2xl z-50 p-6 flex flex-col gap-6 overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-[14px] font-bold uppercase tracking-tight">Cấu hình Hệ thống</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-md transition-colors">
            <XCircle className="w-5 h-5 text-slate-300" />
          </button>
        </div>

        {health && (
          <div className="space-y-2">
            <div className={cn(
              "p-3 rounded-lg flex items-center justify-between text-[13px] font-medium border",
              health.online ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100"
            )}>
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                <span>BFF Server: {health.online ? 'ONLINE' : 'OFFLINE'}</span>
              </div>
              {health.online && <CheckCircle2 className="w-3.5 h-3.5" />}
            </div>

            {health.online && health.external && health.external !== 'n/a' && (
              <div className={cn(
                "p-3 rounded-lg flex items-center justify-between text-[13px] font-medium border",
                health.external === 'connected' ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-amber-50 text-amber-700 border-amber-100"
              )}>
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5" />
                  <span>Python Backend: {health.external.toUpperCase()}</span>
                </div>
                {health.external === 'connected' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              </div>
            )}
          </div>
        )}

        {config && (
          <div className="space-y-5">
            <div className="space-y-1.5 font-mono">
              <label className="hd-label">System Prompt (orchestrator.md)</label>
              <textarea
                value={config.systemPrompt}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                className="w-full min-h-[220px] p-3 text-[12px] bg-[var(--code-bg)] text-slate-300 border border-white/10 rounded-lg outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all resize-none leading-relaxed"
                placeholder="# SYSTEM INSTRUCTIONS..."
              />
            </div>

            <div className="space-y-4">
              <label className="hd-label">API Endpoints (External Service)</label>
              <div className="space-y-3">
                <div className="form-group">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Retrieval Service URL</label>
                  <input
                    type="text"
                    value={config.retrievalApiUrl}
                    onChange={(e) => setConfig({ ...config, retrievalApiUrl: e.target.value })}
                    className="hd-input bg-slate-50 border-slate-200"
                    placeholder="http://localhost:8000/retrieve"
                  />
                </div>
                <div className="form-group">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Aggregation Service URL</label>
                  <input
                    type="text"
                    value={config.aggregationApiUrl}
                    onChange={(e) => setConfig({ ...config, aggregationApiUrl: e.target.value })}
                    className="hd-input bg-slate-50 border-slate-200"
                    placeholder="http://localhost:8000/aggregate"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="hd-label">Cơ chế Tổng hợp (Synthesis)</label>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setConfig({ ...config, aggregationMode: 'api' })}
                  className={cn(
                    "flex-1 text-[12px] font-bold py-1.5 rounded-md transition-all",
                    config.aggregationMode === 'api' 
                      ? "bg-white text-indigo-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Local LLM (Python)
                </button>
                <button
                  onClick={() => setConfig({ ...config, aggregationMode: 'llm' })}
                  className={cn(
                    "flex-1 text-[12px] font-bold py-1.5 rounded-md transition-all",
                    config.aggregationMode === 'llm' 
                      ? "bg-white text-indigo-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Gemini API (Cloud)
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 italic">
                {config.aggregationMode === 'api' 
                  ? "* Gọi API /aggregate trên server của bạn (Qwen/Llama...)" 
                  : "* Gọi trực tiếp Google Gemini từ Browser."}
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                   <div className="text-[12px] font-bold uppercase tracking-tight">Mock API Mode</div>
                   <div className="text-[10px] text-slate-500 font-medium">Intercept all diagnostic calls</div>
                </div>
                <div 
                  onClick={() => setConfig({ ...config, useMockApi: !config.useMockApi })}
                  className={cn(
                    "w-10 h-5 rounded-full relative cursor-pointer transition-colors",
                    config.useMockApi ? "bg-[var(--success)]" : "bg-slate-300"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                    config.useMockApi ? "right-1" : "left-1"
                  )} />
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="hd-button-primary w-full py-3 text-[14px] uppercase tracking-widest"
            >
              {isSaving ? "Synchronizing..." : "Cập nhật Hệ thống"}
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
