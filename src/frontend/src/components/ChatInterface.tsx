/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, User, Loader2, Sparkles, AlertCircle, ThumbsUp, ThumbsDown, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { sendChatMessage, sendFeedback, type ChatMessage } from '../lib/api';
import { GoogleGenAI } from '@google/genai';

interface MessageWithId extends ChatMessage {
  id: string;
  feedbackGiven?: boolean;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<MessageWithId[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackState, setFeedbackState] = useState<{ id: string, show: boolean, rating: 'like' | 'dislike' } | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const generateId = () => Math.random().toString(36).substring(7);

  // Regex check for law citations (Điều, Bộ luật, Nghị định...)
  const hasLawCitation = (text: string) => {
    const lawRegex = /Điều \d+|Bộ luật|Nghị định|Thông tư|Khoản \d+|Luật \d+|Nghị quyết/i;
    return lawRegex.test(text);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: MessageWithId = { id: generateId(), role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const data = await sendChatMessage(input, messages.concat(userMessage));
      let content = "";

      if (data.needsLlm) {
        const prompt = `${data.systemPrompt}\n\nContext information:\n${data.context}\n\nUser Question: ${input}`;
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
        });
        content = response.text || "Xin lỗi, tôi không thể tìm lời giải đáp.";
      } else {
        content = data.content;
      }

      setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content }]);
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || "Đã xảy ra lỗi không xác định.";
      setMessages(prev => [...prev, { 
        id: generateId(),
        role: 'assistant', 
        content: `⚠️ **Lỗi hệ thống:** ${errorMessage}\n\nVui lòng kiểm tra lại cấu hình Backend trong mục cài đặt.` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (messageId: string, rating: 'like' | 'dislike') => {
    if (rating === 'dislike') {
      setFeedbackState({ id: messageId, show: true, rating });
    } else {
      await sendFeedback(messageId, rating);
      setMessages(messages.map(m => m.id === messageId ? { ...m, feedbackGiven: true } : m));
    }
  };

  const submitFeedbackComment = async () => {
    if (!feedbackState) return;
    await sendFeedback(feedbackState.id, feedbackState.rating, feedbackComment);
    setMessages(messages.map(m => m.id === feedbackState.id ? { ...m, feedbackGiven: true } : m));
    setFeedbackState(null);
    setFeedbackComment('');
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-[var(--border)] overflow-hidden shadow-sm relative">
      <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between bg-white z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-[14px] font-bold text-[var(--text-main)] leading-tight">Trợ lý Luật pháp</h1>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-6 bg-white scroll-smooth cursor-default">
        <AnimatePresence initial={false}>
          {messages.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center space-y-4 max-w-sm mx-auto"
            >
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <Sparkles className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-[14px] text-slate-800">Sẵn sàng tư vấn Pháp luật</h3>
                <p className="text-[12px] text-slate-500 mt-1 px-4 leading-relaxed">
                  Hãy nhập câu hỏi pháp lý của bạn bên dưới. Hệ thống sẽ trích xuất điều luật và tư vấn dựa trên dữ liệu hiện hành.
                </p>
              </div>
            </motion.div>
          )}

          {messages.map((m) => {
            const isAssistant = m.role === 'assistant';
            const hasCitation = isAssistant && hasLawCitation(m.content);
            const isError = m.content.includes("⚠️");

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-3",
                  m.role === 'user' ? "flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm text-[10px] font-bold",
                  m.role === 'user' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 border border-slate-200"
                )}>
                  {m.role === 'user' ? 'USR' : 'LAW'}
                </div>
                <div className="flex flex-col gap-1.5 max-w-[85%]">
                  <div className={cn(
                    "p-4 rounded-2xl text-[13px] leading-relaxed shadow-sm transition-colors relative group",
                    m.role === 'user' 
                      ? "bg-indigo-600 text-white" 
                      : isError
                        ? "bg-red-50 border border-red-100 text-red-900"
                        : hasCitation
                          ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                          : "bg-amber-50 border border-amber-200 text-amber-900"
                  )}>
                    <div className="markdown-body">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>

                    {isAssistant && !isError && (
                      <div className="absolute -bottom-8 right-0 hidden group-hover:flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-lg shadow-sm z-20">
                        {m.feedbackGiven ? (
                          <div className="text-[10px] px-2 py-1 text-emerald-600 font-medium">Đã nhận phản hồi</div>
                        ) : (
                          <>
                            <button onClick={() => handleFeedback(m.id, 'like')} className="p-1 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded transition-colors" title="Câu trả lời hữu ích">
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleFeedback(m.id, 'dislike')} className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors" title="Câu trả lời chưa tốt">
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {isAssistant && hasCitation && (
                    <div className="flex items-center gap-1.5 px-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-bold text-emerald-600/70 uppercase">Trích dẫn Pháp lý Phù hợp</span>
                    </div>
                  )}
                  {isAssistant && !hasCitation && !isError && (
                    <div className="flex items-center gap-1.5 px-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="text-[10px] font-bold text-amber-600/70 uppercase">Tham khảo (Không trích dẫn bộ luật)</span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl italic text-slate-400 text-[13px] shadow-sm">
                Đang đối soát kho dữ liệu pháp luật...
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {feedbackState && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute bottom-24 right-6 left-6 p-4 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden"
          >
            <div className="flex items-start gap-4">
              <div className="bg-red-50 p-2 rounded-xl">
                <MessageCircle className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1">
                <h4 className="text-[13px] font-bold text-slate-800">Tại sao câu trả lời không hữu ích?</h4>
                <textarea 
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Chia sẻ lý do để tôi hoàn thiện hơn..."
                  className="w-full mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[12px] outline-none focus:border-indigo-500 transition-all resize-none h-24"
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={() => setFeedbackState(null)} className="px-4 py-1.5 text-[12px] font-bold text-slate-400 hover:text-slate-600">Đóng</button>
                  <button onClick={submitFeedbackComment} className="px-4 py-1.5 bg-indigo-600 text-white text-[12px] font-bold rounded-lg hover:opacity-90">Gửi Phản hồi</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 bg-white border-t border-slate-100 shrink-0">
        <div className="flex gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-50 focus-within:border-indigo-600 transition-all">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Hỏi về Điều 5 Bộ luật Dân sự, thủ tục tố tụng..."
            className="flex-1 bg-transparent px-3 py-1.5 outline-none text-[13px] text-slate-700 placeholder:text-slate-400"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              "p-2.5 rounded-xl transition-all shadow-sm shrink-0",
              !input.trim() || isLoading 
                ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                : "bg-indigo-600 text-white hover:opacity-90 active:scale-95"
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
