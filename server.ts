import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { getEntity, saveEntity } from "./server/db";
import {
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  INITIAL_PROMOS,
  INITIAL_INVOICES,
  INITIAL_EXPENSES,
  INITIAL_USERS,
  INITIAL_STORE_DETAILS,
  INITIAL_AUDIT_LOGS
} from "./src/data/seedData";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DOTNET_API_URL = process.env.VITE_API_URL || "http://localhost:5080";

app.use(express.json({ limit: "2mb" }));

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "avasurface-billing-system" } }
  });
}

const entityDefaults: Record<string, unknown> = {
  products: INITIAL_PRODUCTS,
  customers: INITIAL_CUSTOMERS,
  promos: INITIAL_PROMOS,
  invoices: INITIAL_INVOICES,
  expenses: INITIAL_EXPENSES,
  users: INITIAL_USERS,
  storeDetails: INITIAL_STORE_DETAILS,
  auditLogs: INITIAL_AUDIT_LOGS,
  stockLogs: [],
  drafts: []
};

const allowedEntities = new Set(Object.keys(entityDefaults));

const ASPNET_PROXY_PREFIXES = [
  "/api/auth",
  "/api/invoice-workflow",
  "/api/invoices",
  "/api/customers",
  "/api/companies",
  "/api/products",
  "/api/promotions",
  "/api/stock",
  "/api/expenses",
  "/api/salespersons",
  "/api/gst-verification",
  "/api/manager",
  "/api/accounts"
];

app.use(ASPNET_PROXY_PREFIXES, async (req, res, next) => {
  try {
    const targetUrl = `${DOTNET_API_URL}${req.originalUrl}`;
    const headers: Record<string, string> = {};
    const authorization = req.get("authorization");
    const contentType = req.get("content-type");
    const accept = req.get("accept");
    if (authorization) headers.authorization = authorization;
    if (contentType) headers["content-type"] = contentType;
    if (accept) headers.accept = accept;

    const hasBody = !["GET", "HEAD"].includes(req.method);
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: hasBody ? JSON.stringify(req.body) : undefined
    });
    const responseText = await upstream.text();
    res.status(upstream.status);
    const upstreamContentType = upstream.headers.get("content-type");
    if (upstreamContentType) res.set("content-type", upstreamContentType);
    return res.send(responseText);
  } catch (error) {
    console.error(`ASP.NET API proxy failed for ${req.method} ${req.originalUrl}:`, error);
    return next(error);
  }
});

let invoiceNumberQueue = Promise.resolve();

app.post("/api/invoice-number", async (_req, res, next) => {
  const task = invoiceNumberQueue.then(async () => {
    const now = new Date();
    const fiscalStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fiscalStart = String(fiscalStartYear).slice(-2);
    const fiscalEnd = String(fiscalStartYear + 1).slice(-2);
    const fy = `${fiscalStart}${fiscalEnd}`;
    const current = await getEntity("invoiceSequence", { fiscalYear: fy, nextNumber: 1 });
    const nextNumber = current?.fiscalYear === fy && Number(current?.nextNumber) > 0 ? Number(current.nextNumber) : 1;
    await saveEntity("invoiceSequence", { fiscalYear: fy, nextNumber: nextNumber + 1, updatedAt: new Date().toISOString() });
    return `AVA-${String(nextNumber).padStart(4, "0")}-${fy}`;
  });
  invoiceNumberQueue = task.then(() => undefined, () => undefined);
  try { return res.json({ invoiceNumber: await task }); }
  catch (error) { console.error("Invoice number allocation failed:", error); return next(error); }
});

app.get("/api/health", async (_req, res) => {
  try { await getEntity("__health__", { initialized: false }); res.json({ status: "ok", persistence: "server", database: "sqlite", timestamp: new Date().toISOString() }); }
  catch (error) { console.error("Health check failed:", error); res.status(503).json({ status: "error", persistence: "server" }); }
});

app.get("/api/data/:entity", async (req, res) => {
  const { entity } = req.params;
  if (!allowedEntities.has(entity)) return res.status(404).json({ error: "Unknown entity" });
  try { const data = await getEntity(entity, entityDefaults[entity]); res.json({ entity, data, source: "server" }); }
  catch (error) { console.error(`GET /api/data/${entity} failed:`, error); res.status(500).json({ error: "Unable to load server data" }); }
});

app.put("/api/data/:entity", async (req, res) => {
  const { entity } = req.params;
  if (!allowedEntities.has(entity)) return res.status(404).json({ error: "Unknown entity" });
  if (typeof req.body?.data === "undefined") return res.status(400).json({ error: "Request body must contain data" });
  try { await saveEntity(entity, req.body.data); res.json({ entity, saved: true, source: "server", updatedAt: new Date().toISOString() }); }
  catch (error) { console.error(`PUT /api/data/${entity} failed:`, error); res.status(500).json({ error: "Unable to save server data" }); }
});

app.post("/api/data/bootstrap", async (_req, res) => {
  try {
    for (const [entity, data] of Object.entries(entityDefaults)) {
      const existing = await getEntity(entity, null);
      if (existing === null) await saveEntity(entity, data);
    }
    res.json({ initialized: true, entities: [...allowedEntities], source: "server" });
  } catch (error) { console.error("Bootstrap failed:", error); res.status(500).json({ error: "Unable to initialize server data" }); }
});

app.post("/api/ai-insights", async (req, res) => {
  const { metrics, inventoryAlerts, salesSummary, requestType } = req.body;
  const defaultFallbackInsight = { insight: "Current sales trends show steady momentum.", recommendations: ["Maintain safety stock on top-selling tiles.", "Run targeted promotions on slower-moving products.", "Follow up on outstanding unpaid accounts."], promoIdea: { code: "BUILD10", discount: "10%", description: "10% off on bulk tile orders." } };
  const defaultFallbackPromo = { promoCode: "TILESPECIAL15", title: "Premium Tile & Mosaic Special", discountText: "15% OFF", targetCategory: "PGVT & Ceramic Wall Tiles", marketingCopy: "Upgrade your living space with premium tiles.", recommendedMinSpend: 200 };
  try {
    const ai = getGeminiClient();
    if (!ai) return res.json(requestType === "promo_generator" ? defaultFallbackPromo : defaultFallbackInsight);
    const prompt = requestType === "promo_generator"
      ? `You are an expert small business marketing consultant. Given inventory context ${JSON.stringify(inventoryAlerts || [])} and business metrics ${JSON.stringify(metrics || {})}, generate a promotion campaign. Respond as JSON with keys: promoCode, title, discountText, targetCategory, marketingCopy, recommendedMinSpend.`
      : `You are a CFO and small business growth advisor. Analyze metrics ${JSON.stringify(metrics)}, low stock ${JSON.stringify(inventoryAlerts)}, sales ${JSON.stringify(salesSummary)}. Respond as JSON with keys: insight, recommendations (array of 3 strings), promoIdea ({ code, discount, description }).`;
    let responseText = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({ model: "gemini-3.6-flash", contents: prompt, config: { responseMimeType: "application/json" } });
        responseText = response.text || ""; break;
      } catch (error) { if (attempt === 2) throw error; await new Promise(resolve => setTimeout(resolve, 1000)); }
    }
    if (!responseText) throw new Error("Empty response from Gemini API");
    return res.json(JSON.parse(responseText));
  } catch (error) {
    console.error("AI Insights API Error:", error);
    return res.json(requestType === "promo_generator" ? defaultFallbackPromo : defaultFallbackInsight);
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`AVASurface Billing Server running on http://localhost:${PORT}`));
}

startServer().catch(error => { console.error("Server startup failed:", error); process.exit(1); });
