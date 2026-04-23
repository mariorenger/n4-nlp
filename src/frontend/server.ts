import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper to read config
  const getConfig = () => {
    try {
      const configPath = path.join(__dirname, "config.server.json");
      if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, "utf-8"));
      }
    } catch (e) {
      console.error("Error reading config:", e);
    }
    return {};
  };

  // Helper to save config
  const saveConfig = (newConfig: any) => {
    try {
      const configPath = path.join(__dirname, "config.server.json");
      const currentConfig = getConfig();
      const updatedConfig = { ...currentConfig, ...newConfig };
      fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
      return true;
    } catch (e) {
      console.error("Error saving config:", e);
      return false;
    }
  };

  // API: Health Check - Actually verifies external connectivity
  app.get("/api/health", async (req, res) => {
    const config = getConfig();
    let externalStatus = "n/a";
    
    if (!config.useMockApi) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); 
        
        try {
          const check = await fetch(config.retrievalApiUrl, { 
            method: "GET",
            headers: { "ngrok-skip-browser-warning": "true" },
            signal: controller.signal 
          });
          externalStatus = check.ok || check.status === 405 ? "connected" : `error_${check.status}`;
        } catch (e) {
          externalStatus = "unreachable";
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (e) {
        externalStatus = "check_failed";
      }
    }

    res.json({ 
      status: "online", 
      external: externalStatus,
      useMockApi: config.useMockApi,
      timestamp: new Date().toISOString()
    });
  });

  // API: Config Management
  app.get("/api/config", (req, res) => {
    res.json(getConfig());
  });

  app.post("/api/config", (req, res) => {
    if (saveConfig(req.body)) {
      res.json({ message: "Config updated" });
    } else {
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  // API: Feedback Proxy
  app.post("/api/feedback", async (req, res) => {
    const config = getConfig();
    const feedbackData = req.body;

    if (config.useMockApi) {
      console.log("[Mock Feedback Received]:", feedbackData);
      return res.json({ status: "success" });
    }

    try {
      const fbRes = await fetch(`${new URL(config.retrievalApiUrl).origin}/feedback`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify(feedbackData)
      });
      const fbText = await fbRes.text();
      let fbJson;
      try { fbJson = JSON.parse(fbText); } catch(e) { fbJson = { result: fbText.slice(0, 100) }; }
      res.status(fbRes.status).json(fbJson);
    } catch (e) {
      console.error("Feedback proxy failed:", e);
      res.status(500).json({ error: "Không thể gửi phản hồi đến backend." });
    }
  });

  // Mock Retrieval API
  app.post("/api/mock/retrieve", (req, res) => {
    const { query } = req.body;
    const results = [
      { id: 1, content: `Thông tin giả lập về ${query}: Dữ liệu mẫu giúp bạn xem thử giao diện.`, source: "Pháp luật Mock" }
    ];
    res.json({ results });
  });

  // Main Chat Processing Endpoint
  app.post("/api/chat", async (req, res) => {
    const { messages, query } = req.body;
    const config = getConfig();

    try {
      // 1. Retrieval Phase
      let retrievedInfo = "";
      if (config.useMockApi) {
        retrievedInfo = `Thông tin giả lập về "${query}": Các quy định hiện hành về pháp luật dân sự và hình sự tại Việt Nam.`;
      } else {
        let retRes;
        try {
          retRes = await fetch(config.retrievalApiUrl, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "ngrok-skip-browser-warning": "true" 
            },
            body: JSON.stringify({ query })
          });
        } catch (e) {
          console.error("Retrieval Network Error:", e);
          return res.status(503).json({ error: "Lỗi kết nối mạng: Backend Retrieval không phản hồi hoặc sai URL." });
        }

        const retText = await retRes.text();
        if (!retRes.ok) {
          console.error(`Retrieval failed (${retRes.status}):`, retText.slice(0, 200));
          if (retRes.status === 401 || retRes.status === 403) {
             return res.status(503).json({ error: `Backend bị chặn (Lỗi ${retRes.status}). Nễu dùng Ngrok/Cloud Run, hãy Public API hoặc bypass xác thực.` });
          }
          return res.status(503).json({ error: `External API lỗi ${retRes.status}: ${retText.slice(0, 50)}...` });
        }
        
        let retData: any;
        try {
          retData = JSON.parse(retText);
        } catch (e) {
          console.error("Retrieval JSON Parse Error on text:", retText.slice(0, 200));
          return res.status(503).json({ error: "Backend trả về HTML thay vì JSON. Bạn đang gặp màn hình chặn của Ngrok hoặc sai địa chỉ API." });
        }
        
        retrievedInfo = retData.results?.map((r: any) => r.content || r.text).join("\n") || "";
        
        if (!retrievedInfo) {
          return res.status(404).json({ error: "Không tìm thấy dữ liệu pháp luật liên quan." });
        }
      }

      // 2. Aggregation Phase
      if (config.aggregationMode === "api") {
        let summary = "";
        if (config.useMockApi) {
          summary = `[Mock API] Tổng hợp cho bạn: Theo các tài liệu tìm thấy, vấn đề của bạn được quy định tại Bộ luật Dân sự...`;
        } else {
          let aggRes;
          try {
            aggRes = await fetch(config.aggregationApiUrl, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true" 
              },
              body: JSON.stringify({ 
                results: retrievedInfo, 
                query,
                systemPrompt: config.systemPrompt 
              })
            });
          } catch (e) {
             console.error("Aggregation Network Error:", e);
             return res.status(503).json({ error: "Lỗi kết nối mạng: Backend Aggregation không phản hồi." });
          }

          const aggText = await aggRes.text();
          if (!aggRes.ok) {
            console.error(`Aggregation failed (${aggRes.status}):`, aggText.slice(0, 200));
            return res.status(503).json({ error: `Aggregation API lỗi ${aggRes.status}.` });
          }
          
          let aggData: any;
          try {
            aggData = JSON.parse(aggText);
          } catch (e) {
            console.error("Aggregation JSON Parse Error on text:", aggText.slice(0, 200));
            return res.status(503).json({ error: "Aggregation API trả về HTML thay vì JSON." });
          }
          
          summary = aggData.summary || aggData.content || "";
        }
        return res.json({ content: summary });
      } else {
        return res.json({ 
          needsLlm: true, 
          context: retrievedInfo,
          systemPrompt: config.systemPrompt 
        });
      }
    } catch (err) {
      res.status(500).json({ error: "Lỗi hệ thống nghiêm trọng" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
