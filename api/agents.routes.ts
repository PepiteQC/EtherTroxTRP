import { Router }          from "express";
import type { AppContext }  from "../types/context.js";
import { logger }           from "../lib/logger.js";
import { v4 as uuid }       from "uuid";

// ── Store en mémoire (remplaçable par DB) ────────────────────
const AGENTS = [
  { id: "ether-forge",   name: "Ether-Forge",   role: "Constructor",  description: "Builds technical systems and modules",           color: "#ff6b6b", status: "idle", taskCount: 0, completedCount: 0, confidence: 95, lastActive: Date.now() },
  { id: "ether-lens",    name: "Ether-Lens",    role: "Inspector",    description: "Analyzes, audits and validates code systems",    color: "#00d4ff", status: "idle", taskCount: 0, completedCount: 0, confidence: 92, lastActive: Date.now() },
  { id: "ether-prism",   name: "Ether-Prism",   role: "Transformer",  description: "Creates variants and style categories",         color: "#a78bfa", status: "idle", taskCount: 0, completedCount: 0, confidence: 88, lastActive: Date.now() },
  { id: "ether-weave",   name: "Ether-Weave",   role: "Connector",    description: "Connects modules and data flows together",      color: "#43e97b", status: "idle", taskCount: 0, completedCount: 0, confidence: 90, lastActive: Date.now() },
  { id: "forge-factory", name: "Forge-Factory", role: "Producer",     description: "Mass generates assets from validated rules",    color: "#f59e0b", status: "idle", taskCount: 0, completedCount: 0, confidence: 85, lastActive: Date.now() },
  { id: "ether-guard",   name: "Ether-Guard",   role: "Security",     description: "Validates permissions and blocks abuse",        color: "#ef4444", status: "idle", taskCount: 0, completedCount: 0, confidence: 97, lastActive: Date.now() },
  { id: "ether-ui",      name: "Ether-UI",      role: "Interface",    description: "Designs HUD, menus and player interfaces",     color: "#ec4899", status: "idle", taskCount: 0, completedCount: 0, confidence: 87, lastActive: Date.now() },
  { id: "ether-sim",     name: "Ether-Sim",     role: "Tester",       description: "Tests complete RP player scenarios",           color: "#06b6d4", status: "idle", taskCount: 0, completedCount: 0, confidence: 83, lastActive: Date.now() },
];

const tasks: any[] = [];

export function createAgentsRouter(ctx: AppContext): Router {
  const router = Router();

  // ── GET /api/agents ──────────────────────────────────────
  router.get("/", (_req, res) => {
    res.json({ ok: true, agents: AGENTS });
  });

  // ── GET /api/agents/:id ──────────────────────────────────
  router.get("/:id", (req, res) => {
    const agent = AGENTS.find(a => a.id === req.params.id);
    if (!agent) return res.status(404).json({ ok: false, error: "Agent not found" });
    res.json({ ok: true, agent });
  });

  // ── GET /api/agents/tasks ────────────────────────────────
  router.get("/tasks", (req, res) => {
    let result = [...tasks];
    if (req.query.agentId) result = result.filter(t => t.agentId === req.query.agentId);
    if (req.query.status)  result = result.filter(t => t.status  === req.query.status);
    res.json({ ok: true, tasks: result.reverse() });
  });

  // ── POST /api/agents/tasks ───────────────────────────────
  router.post("/tasks", async (req, res) => {
    const { agentId, title, mission, context, input, expectedOutput, rules, dependencies, priority } = req.body;

    if (!agentId || !title || !mission || !expectedOutput) {
      return res.status(400).json({ ok: false, error: "agentId, title, mission, expectedOutput requis" });
    }

    const agent = AGENTS.find(a => a.id === agentId);
    if (!agent) return res.status(404).json({ ok: false, error: "Agent not found" });

    const task = {
      id:             uuid(),
      agentId,
      agentName:      agent.name,
      title,
      mission,
      context:        context ?? "",
      input:          input ?? "",
      expectedOutput,
      rules:          rules ?? [],
      dependencies:   dependencies ?? [],
      priority:       priority ?? "normal",
      status:         "pending",
      result:         null,
      confidence:     null,
      createdAt:      new Date().toISOString(),
      updatedAt:      new Date().toISOString(),
    };

    tasks.push(task);

    // Mettre à jour les stats agent
    agent.taskCount++;
    agent.status    = "busy";
    agent.lastActive = Date.now();

    // Émettre sur le bus
    ctx.bus.emit("agent:task:created", { task, agent });

    // Simuler exécution via Brain si actif
    if (ctx.brain) {
      setTimeout(async () => {
        try {
          task.status    = "in_progress";
          task.updatedAt = new Date().toISOString();

          // Envoyer au Brain
          const result = await (ctx.brain as any).processTask?.({
            taskId:   task.id,
            agent:    agentId,
            mission,
            context,
            input,
            expected: expectedOutput,
            priority: priority ?? "normal",
            timeout:  30000,
            sentAt:   Date.now(),
          });

          task.status     = "completed";
          task.result     = result;
          task.confidence = result?.confidence ?? 80;
          task.updatedAt  = new Date().toISOString();
          agent.completedCount++;
          agent.status    = "idle";

          ctx.bus.emit("agent:task:completed", { task, agent });
          logger.info(`[AgentRouter] Task completed: ${task.id}`);
        } catch (err: any) {
          task.status    = "needs_correction";
          task.updatedAt = new Date().toISOString();
          agent.status   = "error";
          logger.error(`[AgentRouter] Task failed: ${err.message}`);
        }
      }, 500);
    }

    res.json({ ok: true, task });
  });

  // ── PATCH /api/agents/tasks/:id/status ──────────────────
  router.patch("/tasks/:id/status", (req, res) => {
    const task = tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ ok: false, error: "Task not found" });

    task.status    = req.body.status;
    task.updatedAt = new Date().toISOString();

    if (req.body.status === "completed") {
      const agent = AGENTS.find(a => a.id === task.agentId);
      if (agent) { agent.completedCount++; agent.status = "idle"; }
    }

    res.json({ ok: true, task });
  });

  // ── DELETE /api/agents/tasks/:id ────────────────────────
  router.delete("/tasks/:id", (req, res) => {
    const idx = tasks.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: "Task not found" });
    tasks.splice(idx, 1);
    res.json({ ok: true });
  });

  return router;
}
