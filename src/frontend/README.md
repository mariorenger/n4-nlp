# Law Consultant AI Platform - Hướng dẫn vận hành v3.0

Hệ thống tư vấn pháp luật sử dụng kiến trúc Hybrid RAG (Dense + Sparse Retrieval).

## 1. Cơ chế Prompt & LLM (Thống nhất)
Hệ thống sử dụng **Cài đặt Prompt tập trung** để đảm bảo tính đồng bộ:
- **Quản lý**: Bạn chỉ cần chỉnh sửa `System Prompt` một lần duy nhất tại giao diện **Settings** (Cài đặt) trên App.
- **Lưu trữ**: Cấu hình này được lưu vào file `config.server.json` thông qua BFF (Node.js).
- **Phân phối**:
  - **Khi dùng External API (Aggregation: `api`)**: BFF sẽ tự động gửi Prompt hiện tại xuống Python Backend (Local LLM/Qwen) qua API.
  - **Khi dùng Gemini (Aggregation: `llm`)**: BFF gửi Prompt về Frontend để gọi trực tiếp Google Gemini API.
- **Lợi ích**: Dù bạn đổi model từ Local sang Cloud, tính cách và kiến thức của Bot vẫn được giữ nguyên mà không cần sửa code.

## 2. Yêu cầu hệ thống (Backend Python)
- **RAM**: Tối thiểu 8GB.
- **GPU**: Khuyên dùng (tối ưu nhất trên CUDA) để chạy Qwen (LLM) và BGE-M3 (Embedding).
- **Dữ liệu**: Chuẩn bị tệp `data/vector.jsonl` và `data/metadata.json` trong thư mục chạy backend.

## 3. Cài đặt & Chạy Backend Python
Chạy các lệnh sau trên môi trường Python 3.9+:
```bash
pip install fastapi uvicorn pydantic numpy torch transformers FlagEmbedding rank_bm25
python backend_python_example.py
```

## 4. Cơ sở dữ liệu (Persistence)
Dữ liệu được lưu bền vững tại thư mục `data/` dưới định dạng JSONL:
- **`chat_history.jsonl`**: Lưu vết lịch sử hỏi đáp theo session.
- **`feedbacks.jsonl`**: Lưu các đánh giá Like/Dislike và góp ý của người dùng.

## 5. Cấu hình trên Giao diện App
1. Vào biểu tượng **Cài đặt** (Settings).
2. Tắt **Mock API Mode**.
3. Điền URL Python Backend (ví dụ: `http://localhost:8000/retrieve`).
4. Kiểm tra mục **Python Backend**: Nếu báo **CONNECTED**, hệ thống đã thông suốt.

## 6. Đặc tả API dành cho Backend Python
### POST /retrieve
- **Input**: `{ "query": "string" }`
- **Output**: `{ "results": [ { "content": "string" } ] }`

### POST /aggregate
- **Input**: `{ "results": "string", "query": "string", "systemPrompt": "string" }`
- **Output**: `{ "summary": "string" }`

### POST /feedback
- **Input**: `{ "messageId": "string", "rating": "like|dislike", "comment": "string (optional)" }`
- **Output**: `{ "status": "success" }`
