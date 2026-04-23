/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ServerConfig {
  systemPrompt: string;
  aggregationMode: 'api' | 'llm';
  useMockApi: boolean;
  retrievalApiUrl: string;
  aggregationApiUrl: string;
  healthCheckUrl: string;
}

export async function checkHealth(): Promise<{ online: boolean; external?: string; timestamp?: string }> {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    return { online: res.ok && data.status === 'online', external: data.external, timestamp: data.timestamp };
  } catch {
    return { online: false };
  }
}

export async function getServerConfig(): Promise<ServerConfig> {
  const res = await fetch('/api/config');
  return res.json();
}

export async function updateServerConfig(config: Partial<ServerConfig>): Promise<void> {
  await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}

export async function sendChatMessage(query: string, messages: ChatMessage[]) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, messages }),
  });
  
  if (!res.ok) {
    let errorMessage = 'Yêu cầu thất bại';
    try {
      const err = await res.json();
      errorMessage = err.error || errorMessage;
    } catch (e) {
      errorMessage = `Lỗi máy chủ (${res.status}): Không thể kết nối hoặc phản hồi không đúng định dạng.`;
    }
    throw new Error(errorMessage);
  }
  
  return res.json();
}

export async function sendFeedback(messageId: string, rating: 'like' | 'dislike', comment?: string) {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId, rating, comment }),
  });
  return res.ok;
}
