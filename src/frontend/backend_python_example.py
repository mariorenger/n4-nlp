import os
import json
import re
import gc
import uuid
import numpy as np
import torch
import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import uvicorn

# AI Frameworks
from rank_bm25 import BM25Okapi
from transformers import AutoTokenizer, AutoModelForCausalLM
from FlagEmbedding import BGEM3FlagModel

app = FastAPI(title="Legal Consultant High-Performance AI Backend")

# =======================================================
# 1. CONFIGURATION & DATABASE SETUP
# =======================================================
class Config:
    DATA_DIR = "data"
    VECTOR_DB_PATH = os.path.join(DATA_DIR, "vector.jsonl")
    METADATA_PATH = os.path.join(DATA_DIR, "metadata.json")
    HISTORY_PATH = os.path.join(DATA_DIR, "chat_history.jsonl")
    FEEDBACK_PATH = os.path.join(DATA_DIR, "feedbacks.jsonl")
    
    EMBEDDING_MODEL_PATH = "BAAI/bge-m3"
    LLM_NAME = "Qwen/Qwen2.5-1.5B-Instruct" 
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    TOP_K_RETRIEVE = 5

# Tạo thư mục dữ liệu nếu chưa có
os.makedirs(Config.DATA_DIR, exist_ok=True)

def persist_to_file(file_path: str, data: dict):
    """Lưu dữ liệu vào tệp theo định dạng JSONL (append-only) để đảm bảo hiệu năng"""
    try:
        with open(file_path, "a", encoding="utf-8") as f:
            data["timestamp"] = datetime.datetime.now().isoformat()
            f.write(json.dumps(data, ensure_ascii=False) + "\n")
    except Exception as e:
        print(f"[ERROR Persistence]: {e}")

# In-memory session để xử lý nhanh (kết hợp persist xuống file)
sessions_db: Dict[str, List[dict]] = {}

# =======================================================
# 2. CORE AI CLASSES
# =======================================================
class LegalCore:
    def __init__(self):
        print(f"[*] Đang tải mô hình trên thiết bị: {Config.DEVICE}")
        
        # 1. Load Metadata & Vectors
        self.docs = []
        self.vectors = []
        self.metadata_dict = {}
        
        if os.path.exists(Config.METADATA_PATH):
            with open(Config.METADATA_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                items = data.get("root", data) if isinstance(data, dict) else data
                for item in items:
                    meta = item.get("metadata", {})
                    meta_id = meta.get("id", "")
                    if meta_id: self.metadata_dict[str(meta_id)] = meta

        if os.path.exists(Config.VECTOR_DB_PATH):
            with open(Config.VECTOR_DB_PATH, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        obj = json.loads(line)
                        raw_text = obj.get("text", "")
                        vec_id = str(obj.get("id", ""))
                        base_id = vec_id.split("_")[0] if "_" in vec_id else vec_id
                        
                        final_text = raw_text
                        if base_id in self.metadata_dict:
                            m = self.metadata_dict[base_id]
                            final_text = (
                                f"### VĂN BẢN: {m.get('title', 'N/A')}\n"
                                f"- Trạng thái: {m.get('status', 'N/A')} | Hiệu lực: {m.get('effective_date', 'N/A')}\n"
                                f"- Link: {m.get('link', 'N/A')}\n"
                                f"- Nội dung: {raw_text}"
                            )
                        self.docs.append(final_text)
                        self.vectors.append(obj["embedding"])
            
            self.vectors = np.array(self.vectors, dtype=np.float32)
            tokenized_corpus = [doc.lower().split() for doc in self.docs]
            self.bm25 = BM25Okapi(tokenized_corpus)
        else:
            print("[!] CẢNH BÁO: Không tìm thấy tệp vector.jsonl tại data/. Chế độ Demo...")
            self.docs = ["Khoản 1 Điều 5 Bộ luật Dân sự 2015: Cá nhân, pháp nhân phải tự chịu trách nhiệm về việc không thực hiện hoặc thực hiện không đúng nghĩa vụ dân sự."]
            self.vectors = np.random.rand(1, 1024).astype(np.float32)
            self.bm25 = BM25Okapi([d.split() for d in self.docs])

        # 2. Load Embedder
        self.embedder = BGEM3FlagModel(Config.EMBEDDING_MODEL_PATH, use_fp16=(Config.DEVICE=="cuda"), devices=[Config.DEVICE])
        
        # 3. Load LLM
        self.tokenizer = AutoTokenizer.from_pretrained(Config.LLM_NAME)
        self.llm = AutoModelForCausalLM.from_pretrained(
            Config.LLM_NAME, 
            torch_dtype=torch.float16 if Config.DEVICE=="cuda" else torch.float32, 
            device_map="auto"
        )

    def hybrid_search(self, query: str, top_k: int = Config.TOP_K_RETRIEVE):
        out = self.embedder.encode([query], batch_size=1, max_length=128, return_dense=True)
        q_vec = np.array(out["dense_vecs"][0], dtype=np.float32)
        
        norms = np.linalg.norm(self.vectors, axis=1) * np.linalg.norm(q_vec)
        cosine_sim = np.dot(self.vectors, q_vec) / np.clip(norms, a_min=1e-8, a_max=None)
        vector_top_idx = np.argsort(cosine_sim)[::-1][:top_k]
        
        tokenized_query = query.lower().split()
        bm25_scores = self.bm25.get_scores(tokenized_query)
        bm25_top_idx = np.argsort(bm25_scores)[::-1][:top_k]
        
        rrf_scores = {idx: 0.0 for idx in range(len(self.docs))}
        for rank, idx in enumerate(vector_top_idx): rrf_scores[idx] += 1.0 / (60 + rank + 1)
        for rank, idx in enumerate(bm25_top_idx): rrf_scores[idx] += 1.0 / (60 + rank + 1)
            
        sorted_idx = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)[:top_k]
        return [self.docs[i] for i in sorted_idx]

    def generate(self, query: str, contexts: List[str], system_prompt: str):
        context_str = "\n\n---\n\n".join(contexts)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Dữ liệu nguồn:\n{context_str}\n\nCâu hỏi: {query}"}
        ]
        
        text = self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = self.tokenizer(text, return_tensors="pt").to(Config.DEVICE)
        
        with torch.no_grad():
            outputs = self.llm.generate(**inputs, max_new_tokens=768, do_sample=False, pad_token_id=self.tokenizer.pad_token_id)
        
        gen_tokens = outputs[0][inputs.input_ids.shape[1]:]
        answer = self.tokenizer.decode(gen_tokens, skip_special_tokens=True)
        
        del inputs, outputs; torch.cuda.empty_cache(); gc.collect()
        return answer.strip()

# Khởi tạo lõi AI
core = LegalCore()

# =======================================================
# 3. API ENDPOINTS
# =======================================================
class ChatRequest(BaseModel):
    query: str

class RetrievalResponse(BaseModel):
    results: List[dict]

class AggregationRequest(BaseModel):
    results: str
    query: str
    systemPrompt: Optional[str] = "Bạn là Trợ lý Luật sư cao cấp Việt Nam."

class FeedbackRequest(BaseModel):
    messageId: str
    rating: str
    comment: Optional[str] = None

@app.post("/retrieve")
async def retrieve(request: ChatRequest, session_id: Optional[str] = Header(None)):
    sid = session_id or str(uuid.uuid4())
    print(f"\n{'='*60}")
    print(f"[API: RETRIEVE] Session ID: {sid}")
    print(f"[-] Câu hỏi (Query): {request.query}")
    
    docs = core.hybrid_search(request.query)
    
    print(f"[-] Đã tìm thấy Top {len(docs)} tài liệu phù hợp (RRF Fusion).")
    for i, doc in enumerate(docs):
        # In ra 150 ký tự đầu tiên để kiểm chứng Metadata đã được chèn chuẩn xác chưa
        preview = doc[:150].replace('\n', ' | ') + "..."
        print(f"    + Top {i+1}: {preview}")
    print(f"{'='*60}\n")
    
    formatted_results = [{"content": doc} for doc in docs]
    
    # Lưu vào DB tệp
    persist_to_file(Config.HISTORY_PATH, {
        "session_id": sid,
        "role": "user",
        "query": request.query,
        "retrieved_count": len(docs)
    })
    
    return {"results": formatted_results}

@app.post("/aggregate")
async def aggregate(request: AggregationRequest, session_id: Optional[str] = Header(None)):
    sid = session_id or "unknown"
    print(f"\n{'='*60}")
    print(f"[API: AGGREGATE] Session ID: {sid}")
    print(f"[-] System Prompt: {request.systemPrompt}")
    
    contexts = request.results.split("\n\n---\n\n")
    print(f"[-] Ngữ cảnh (Context) đã chuẩn bị: {len(contexts)} văn bản pháp luật.")
    print("[-] Đang gọi LLM generation...")
    
    summary = core.generate(request.query, contexts, request.systemPrompt)
    
    print(f"\n[LLM RESPONSE]:\n{summary}\n")
    print(f"{'='*60}\n")
    
    # Lưu kết quả Bot vào DB tệp
    persist_to_file(Config.HISTORY_PATH, {
        "session_id": sid,
        "role": "assistant",
        "content": summary
    })
        
    return {"summary": summary}

@app.post("/feedback")
async def feedback(request: FeedbackRequest):
    # Lưu feedback vào DB tệp
    persist_to_file(Config.FEEDBACK_PATH, request.dict())
    print(f"[FEEDBACK] Persistent Saved: {request.messageId}")
    return {"status": "success"}

@app.get("/health")
async def health():
    return {
        "status": "online", 
        "device": Config.DEVICE,
        "files": {
            "history": os.path.exists(Config.HISTORY_PATH),
            "feedback": os.path.exists(Config.FEEDBACK_PATH)
        }
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
