/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { SettingsPanel } from './components/SettingsPanel';
import { Settings as SettingsIcon, MessageSquare, ShieldCheck, Scale, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="h-screen flex flex-col font-sans overflow-hidden bg-slate-50">
      {/* Header */}
      <header className="h-16 bg-[#1e293b] text-white flex items-center justify-between px-6 border-b border-white/10 shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors md:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2">
                <Scale className="w-6 h-6 text-indigo-400" />
                <MessageSquare className="w-6 h-6 text-indigo-400" />
             </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 rounded-lg text-xs font-bold transition-all text-slate-300"
          >
            {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            {isSidebarOpen ? 'Ẩn Menu' : 'Hiện Menu'}
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="hd-button-primary bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2"
          >
            <SettingsIcon className="w-4 h-4" />
            Cấu hình
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Simplified Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.aside 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 256, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-white border-r border-slate-200 flex flex-col p-6 gap-8 overflow-y-auto shrink-0 relative overflow-hidden"
            >
              <div className="min-w-[208px]">
                <label className="hd-label">Trạng thái</label>
                <div className="mt-3 flex flex-col gap-4">
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-3 text-[13px] font-semibold text-slate-700">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> 
                      Hệ thống
                    </div>
                    <span className="hd-badge">Sẵn sàng</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 min-w-[208px]">
                <h4 className="text-[12px] font-bold text-indigo-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Bảo mật
                </h4>
                <p className="text-[11px] text-indigo-700/70 mt-2 leading-relaxed">
                  Dữ liệu được mã hóa theo tiêu chuẩn pháp lý.
                </p>
              </div>

              <div className="mt-auto pt-6 border-t border-slate-100 min-w-[208px]">
                 <div className="flex flex-col gap-2">
                    <button className="text-left text-xs font-semibold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest px-2 py-1">Lịch sử</button>
                    <button className="text-left text-xs font-semibold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest px-2 py-1">Tài liệu</button>
                 </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Chat Area - Maximize this */}
        <main className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden bg-slate-50/50 transition-all duration-300">
          <div className="max-w-4xl mx-auto w-full h-full flex flex-col">
             <ChatInterface />
          </div>
        </main>
      </div>

      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
