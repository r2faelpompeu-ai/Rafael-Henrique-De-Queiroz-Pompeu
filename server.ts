import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy Gemini API Client initialization
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY" || key === "") {
      throw new Error("GEMINI_API_KEY_MISSING");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Simulated data storage
interface Vehicle {
  id: string;
  name: string;
  plate: string;
  type: string;
  odometer: number;
  fuel: number; // percentage
  status: "Disponível" | "Em Viagem" | "Manutenção" | "Indisponível";
  lastMaintenanceOdometer: number;
  nextMaintenanceOdometer: number;
  alerts: string[];
}

interface Driver {
  id: string;
  name: string;
  cnh: string;
  cnhCategory: string;
  cnhExpiration: string;
  status: "Disponível" | "Em Atividade" | "De Férias" | "Afastado";
}

interface TripRequest {
  id: string;
  vehicleId: string;
  driverId: string;
  destination: string;
  reason: string;
  requestDate: string;
  departureDate: string;
  returnDate: string;
  status: "Pendente" | "Aprovada" | "Recusada" | "Concluída";
  approvedBy?: string;
}

interface Checklist {
  id: string;
  tripId: string;
  vehicleId: string;
  driverId: string;
  type: "Saída" | "Retorno";
  date: string;
  odometer: number;
  fuel: number;
  items: {
    headlights: boolean;
    brakes: boolean;
    tyres: boolean;
    liquids: boolean;
    cleaning: boolean;
    safetyEquipment: boolean;
  };
  comments: string;
  status: "Aprovado" | "Atenção" | "Reprovado";
}

// In-memory data structures reflecting Unioeste real needs
let vehicles: Vehicle[] = [
  {
    id: "v-hilux",
    name: "Toyota Hilux CD 4x4",
    plate: "PR-3082",
    type: "Caminhonete",
    odometer: 145210,
    fuel: 85,
    status: "Disponível",
    lastMaintenanceOdometer: 140000,
    nextMaintenanceOdometer: 150000,
    alerts: [],
  },
  {
    id: "v-uno",
    name: "Fiat Uno Mille 1.0",
    plate: "AE-9081",
    type: "Passeio",
    odometer: 298400,
    fuel: 48,
    status: "Disponível",
    lastMaintenanceOdometer: 295000,
    nextMaintenanceOdometer: 300000,
    alerts: ["Filtro de óleo próximo da troca de 300 kkm"],
  },
  {
    id: "v-spin",
    name: "Chevrolet Spin LTZ 7L",
    plate: "PU-2849",
    type: "Minivan",
    odometer: 78510,
    fuel: 18,
    status: "Em Viagem",
    lastMaintenanceOdometer: 75000,
    nextMaintenanceOdometer: 85000,
    alerts: ["Nível crítico de combustível (18%)"],
  },
  {
    id: "v-master",
    name: "Renault Master Shutt Bus",
    plate: "OB-4828",
    type: "Van / Micro-ônibus",
    odometer: 195430,
    fuel: 95,
    status: "Manutenção",
    lastMaintenanceOdometer: 195000,
    nextMaintenanceOdometer: 205000,
    alerts: ["Revisão preventiva da embreagem em andamento"],
  }
];

let drivers: Driver[] = [
  { id: "d-roberto", name: "Roberto de Souza", cnh: "1928471556", cnhCategory: "D", cnhExpiration: "2027-08-15", status: "Em Atividade" },
  { id: "d-ana", name: "Ana Paula Lima", cnh: "8573210412", cnhCategory: "B", cnhExpiration: "2029-10-12", status: "Disponível" },
  { id: "d-carlos", name: "Carlos Eduardo Santos", cnh: "4851239991", cnhCategory: "D", cnhExpiration: "2026-06-25", status: "Disponível" },
  { id: "d-maria", name: "Maria Heloísa Vieira", cnh: "9382104234", cnhCategory: "D", cnhExpiration: "2028-03-30", status: "De Férias" },
];

let trips: TripRequest[] = [
  {
    id: "t-1",
    vehicleId: "v-spin",
    driverId: "d-roberto",
    destination: "Campus Unioeste Toledo (PR)",
    reason: "Transporte de docentes para banca de mestrado cooperativa.",
    requestDate: "2026-05-28",
    departureDate: "2026-05-29",
    returnDate: "2026-05-31",
    status: "Aprovada",
    approvedBy: "Prof. Dr. Cláudio (Diretor)",
  },
  {
    id: "t-2",
    vehicleId: "v-hilux",
    driverId: "d-ana",
    destination: "Foz do Iguaçu (PR) - Parque Tecnológico Itaipu",
    reason: "Coleta de amostras biológicas e fita de teste no Rio Paraná.",
    requestDate: "2026-05-30",
    departureDate: "2026-06-02",
    returnDate: "2026-06-03",
    status: "Pendente",
  }
];

let checklists: Checklist[] = [
  {
    id: "ch-101",
    tripId: "t-1",
    vehicleId: "v-spin",
    driverId: "d-roberto",
    type: "Saída",
    date: "2026-05-29T08:00:00Z",
    odometer: 78200,
    fuel: 95,
    items: {
      headlights: true,
      brakes: true,
      tyres: true,
      liquids: true,
      cleaning: true,
      safetyEquipment: true,
    },
    comments: "Carro limpo, tanque cheio entregue pela zeladoria.",
    status: "Aprovado",
  }
];

let auditLogs = [
  { timestamp: "2026-05-30T01:10:00Z", user: "Coordenador Geral (Admin)", action: "Aprovação de Viagem", detail: "Viagem ID t-1 autorizada com veículo Chevrolet Spin plate PR-2849." },
  { timestamp: "2026-05-30T01:54:12Z", user: "Zelador de Garagem", action: "Troca de Status de Veículo", detail: "Renault Master (PR-4828) enviado para manutenção preventiva." },
  { timestamp: "2026-05-30T02:00:15Z", user: "Motorista Roberto", action: "Checklist de Saída Registrado", detail: "Checklist de saída aprovado para Chevrolet Spin." },
  { timestamp: "2026-05-30T02:03:00Z", user: "Sistema", action: "Início de Telemetria de Viagem", detail: "Início do rastreio e transmissão de dados para Hilux PR-3082." }
];

// Telemetry state modifiers for dynamic polling simulation
let telemetryActive = true;

// Background simulated updating interval to model "SaaS Real Telemetry" (updates every 15s to client updates)
setInterval(() => {
  if (!telemetryActive) return;

  // Let's simulate a trip odometer progress
  trips.forEach(trip => {
    if (trip.status === "Aprovada") {
      const v = vehicles.find(car => car.id === trip.vehicleId);
      if (v && v.status === "Em Viagem") {
        // Increase odometer slightly, consume small fuel percentage
        v.odometer += Math.floor(Math.random() * 3) + 1;
        v.fuel = Math.max(5, v.fuel - (Math.random() > 0.7 ? 1 : 0));
        
        // Critical level fuel trigger warning
        if (v.fuel <= 20 && !v.alerts.some(a => a.includes("crítico"))) {
          v.alerts.push(`Nível crítico de combustível (${v.fuel}%)`);
          auditLogs.unshift({
            timestamp: new Date().toISOString(),
            user: "Sistema (Telemetria)",
            action: "Alerta Crítico Gerado",
            detail: `Combustível do veículo ${v.name} (${v.plate}) abaixo do percentual de reserva (${v.fuel}%).`
          });
        }
      }
    }
  });
}, 15000);

// API Endpoints for UI consumption
app.get("/api/fleet/all", (req, res) => {
  res.json({
    vehicles,
    drivers,
    trips,
    checklists,
    auditLogs: auditLogs.slice(0, 100), // Return last 100 entries
    telemetryActive
  });
});

// Configure real-time telemetry trigger
app.post("/api/fleet/telemetry/toggle", (req, res) => {
  const { active } = req.body;
  if (typeof active === "boolean") {
    telemetryActive = active;
    auditLogs.unshift({
      timestamp: new Date().toISOString(),
      user: "Gestor logado",
      action: "Configuração do Sistema",
      detail: telemetryActive ? "Monitoramento por poller de telemetria ativo" : "Poller de telemetria pausado pelo usuário"
    });
  }
  res.json({ success: true, telemetryActive });
});

// Register new vehicle checklist (Outbound / Return)
app.post("/api/fleet/checklist", (req, res) => {
  const { tripId, vehicleId, driverId, type, odometer, fuel, items, comments } = req.body;

  // Basic guard
  if (!vehicleId || !driverId || !odometer) {
    return res.status(400).json({ error: "Parâmetros obrigatórios ausentes para o Checklist." });
  }

  const car = vehicles.find(v => v.id === vehicleId);
  if (!car) {
    return res.status(404).json({ error: "Veículo não encontrado." });
  }

  // Prevent regression of odometer readings (Error preventative rule of SaaS)
  if (odometer < car.odometer) {
    return res.status(400).json({
      error: `Erro de Validação de Odômetro: O odômetro cadastrado (${odometer} km) é inferior ao odômetro atual registrado no sistema (${car.odometer} km) para o veículo ${car.name}.`
    });
  }

  // Set checklist status based on key check issues
  const hasCriticalFailure = !items.brakes || !items.headlights || !items.safetyEquipment;
  const hasCautionIssue = !items.tyres || !items.liquids || !items.cleaning;
  const status = hasCriticalFailure ? "Reprovado" : hasCautionIssue ? "Atenção" : "Aprovado";

  const newChecklist: Checklist = {
    id: `ch-${Math.floor(1000 + Math.random() * 9000)}`,
    tripId: tripId || `t-mock-${Math.floor(10 + Math.random() * 90)}`,
    vehicleId,
    driverId,
    type,
    date: new Date().toISOString(),
    odometer,
    fuel,
    items,
    comments,
    status
  };

  checklists.unshift(newChecklist);

  // Apply state adaptations to the vehicle
  car.odometer = odometer;
  car.fuel = fuel;
  
  if (type === "Saída") {
    car.status = "Em Viagem";
  } else {
    car.status = "Disponível";
    // If the vehicle was closed with any critical error, put it straight into Maintenance
    if (status === "Reprovado") {
      car.status = "Manutenção";
      car.alerts.push("Reprovado na avaliação de retorno dadas as falhas relatadas!");
    }
  }

  // Also update driver status
  const driver = drivers.find(d => d.id === driverId);
  if (driver) {
    driver.status = type === "Saída" ? "Em Atividade" : "Disponível";
  }

  // Push to audit log
  auditLogs.unshift({
    timestamp: new Date().toISOString(),
    user: driver ? driver.name : "Motorista",
    action: `Checklist de ${type} Concluído`,
    detail: `O veículo ${car.name} (${car.plate}) foi classificado como '${status}' após a vistoria.`
  });

  res.json({ success: true, checklist: newChecklist, vehicle: car });
});

// Register new fuel refill or maintenance tickets
app.post("/api/fleet/maintenance", (req, res) => {
  const { vehicleId, type, odometer, cost, notes } = req.body;
  const car = vehicles.find(v => v.id === vehicleId);

  if (!car) return res.status(404).json({ error: "Veículo não encontrado" });

  if (type === "Abastecimento") {
    car.fuel = 100; // Tanked up
    car.odometer = Math.max(car.odometer, odometer);
    car.alerts = car.alerts.filter(a => !a.includes("combustível"));
    
    auditLogs.unshift({
      timestamp: new Date().toISOString(),
      user: "Zeladoria / Motorista",
      action: "Abastecimento Registrado",
      detail: `Abastecido R$ ${cost} no veículo ${car.name} em odômetro ${odometer} km. Tanque cheio.`
    });
  } else {
    // Maintenance
    car.status = "Disponível";
    car.lastMaintenanceOdometer = odometer;
    car.nextMaintenanceOdometer = odometer + 10000;
    car.alerts = car.alerts.filter(a => !a.includes("Revisão") && !a.includes("embreagem"));
    
    auditLogs.unshift({
      timestamp: new Date().toISOString(),
      user: "Mecânico Geral (Oficina)",
      action: "Manutenção Concluída",
      detail: `Serviço de manutenção ID de R$ ${cost} concluído para ${car.name}. Revisão preventiva agendada para ${car.nextMaintenanceOdometer} km.`
    });
  }

  res.json({ success: true, vehicle: car });
});

// Action Trip Requests Approval
app.post("/api/fleet/trip/action", (req, res) => {
  const { tripId, action, approvedBy } = req.body;
  const t = trips.find(trip => trip.id === tripId);
  if (!t) return res.status(404).json({ error: "Viagem não encontrada" });

  t.status = action === "Aprovar" ? "Aprovada" : "Recusada";
  if (action === "Aprovar") {
    t.approvedBy = approvedBy || "Diretoria de Frota";
    const car = vehicles.find(v => v.id === t.vehicleId);
    if (car) car.status = "Em Viagem";
    const driver = drivers.find(d => d.id === t.driverId);
    if (driver) driver.status = "Em Atividade";
  }

  auditLogs.unshift({
    timestamp: new Date().toISOString(),
    user: approvedBy || "Gestor de Frota",
    action: `Viagem ${action === "Aprovar" ? "Aprovada" : "Recusada"}`,
    detail: `Solicitação da viagem dest. ${t.destination} foi ${action === "Aprovar" ? "autorizada" : "cancelada"}.`
  });

  res.json({ success: true, trip: t });
});

// AI Assistant endpoint using Google GenAI SDK (with fallback)
app.post("/api/fleet/ai-assistant", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Faltando o prompt do usuário." });
  }

  // Create compact status representation for the AI
  const systemContext = `Você é Dola, a Assistente de IA de Gestão de Frotas e Logística Integrada da FADEC/UNIOESTE.
Você dá suporte aos motoristas, secretários de campus e guardas de portaria na Universidade Estadual do Oeste do Paraná.
Abaixo está o estado atual da frota em tempo real:

**VEÍCULOS (FLEET STATUS)**:
${vehicles.map(v => `- [${v.plate}] ${v.name} (${v.type}): status ${v.status}, Odômetro: ${v.odometer}km, Nível Combustível: ${v.fuel}%, Próxima Manutenção: ${v.nextMaintenanceOdometer}km. Alertas: [${v.alerts.join(", ")}]`).join("\n")}

**MOTORISTAS (DRIVERS)**:
${drivers.map(d => `- ${d.name} (Cat ${d.cnhCategory}, expira em ${d.cnhExpiration}): status ${d.status}`).join("\n")}

**SOLICITAÇÕES DE VIAGENS RECENTES**:
${trips.map(t => `- Viagem ID: ${t.id} de motorista: ${t.driverId || "não designado"} para ${t.destination}. Status: ${t.status}`).join("\n")}

**CHECKLISTS EXECUTADOS**:
${checklists.map(c => `- Cheklist ${c.type} do carro ${c.vehicleId}, Data: ${c.date}, Estado Odometer: ${c.odometer}km. Status de avaliação: ${c.status}`).join("\n")}

Responda perguntas de usuários com as seguintes orientações:
1. Responda em Português do Brasil com postura amigável, confiável, corporativa e incrivelmente atenciosa.
2. Seja cirúrgica ao referenciar os veículos exatos (chapa, nome) e motoristas se o usuário perguntar.
3. Se o usuário quiser criar uma viagem, explique as regras (ex: CNH do motorista deve ser compatível, veículo de passageiro precisa de motorista cat D se for Van).
4. Forneça análises de risco de segurança de forma imediata (ex: Hilux ou Uno com viagem pendente que requer revisão, ou óleo esgotado).
5. Mostre que é uma IA atenta a detalhes operacionais reais.`;

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { text: systemContext },
        { text: prompt }
      ],
      config: {
        temperature: 0.7,
      }
    });

    res.json({
      success: true,
      text: response.text,
      usedAI: true
    });
  } catch (error: any) {
    console.error("AI Assistant calling failed:", error);

    const isMissingKey = error.message === "GEMINI_API_KEY_MISSING";
    let warningNote = "";
    if (isMissingKey) {
      warningNote = `\n\n*(💡 **Nota de Desenvolvimento**: Esta resposta inteligente é baseada em regras de negócio locais. Para ativar insights profundos alimentados pela IA do Gemini 3.5, basta configurar a \`GEMINI_API_KEY\` no painel Settings do AI Studio.)*`;
    }

    // High fidelity offline mock agent matching user input
    let fallbackText = "";
    const cleanPrompt = prompt.toLowerCase();

    if (cleanPrompt.includes("veículo") || cleanPrompt.includes("carro") || cleanPrompt.includes("uno") || cleanPrompt.includes("hilux")) {
      fallbackText = `Olá! Sou a **Dola Assistente**. Atualmente, vejo 4 veículos na garagem da UNIOESTE:\n\n1. **Toyota Hilux (PR-3082)**: Pronta para decolagem (status: **Disponível**, tanque com 85%).\n2. **Fiat Uno Mille (AE-9081)**: Disponível, porém o filtro de óleo se aproxima da quilometragem máxima (298.400 km de 300.000 km).\n3. **Chevrolet Spin (PU-2849)**: Em trânsito ativo carregando docentes para Toledo (combustível na reserva: 18%).\n4. **Renault Master Bus (OB-4828)**: Em manutenção corretiva da embreagem.\n\nRecomendo reservar a Hilux para deslocamentos de campo ou estradas rurais do oeste.`;
    } else if (cleanPrompt.includes("motorista") || cleanPrompt.includes("roberto") || cleanPrompt.includes("ana")) {
      fallbackText = `Análise de motoristas ativos da UNIOESTE:\n\n- **Roberto de Souza**: Em atividade na rodovia (viagem Toledo ID t-1).\n- **Ana Paula Lima**: Disponível e com CNH regularizada até 2029 (Cat B).\n- **Carlos Eduardo Santos**: CNH (Cat D - apto para conduzir Vans) de vencimento próximo em 25 de Junho de 2026. Aconselho alertá-lo para revalidação rápida no DETRAN.\n- **Maria Heloísa**: Em gozo de férias regulamentares.`;
    } else if (cleanPrompt.includes("checklist") || cleanPrompt.includes("saída") || cleanPrompt.includes("retorno")) {
      fallbackText = `Histórico e Auditoria de Checklists da UNIOESTE:\n\nO checklist recente mais relevante foi registrado para o veículo **Chevrolet Spin (PU-2849)** pelo motorista **Roberto de Souza** (Status: **Aprovado**). Todos os testes críticos de freios, faróis e pneus passaram sem anormalidades. O veículo seguiu viagem com odômetro de partida marcado em 78.200 km.`;
    } else {
      fallbackText = `Olá! Como **Dola Assistente**, sou seu co-piloto de frotas para a UNIOESTE. Posso analisar o status de uso de combustível dos veículos, sugerir manutenções, acompanhar CNH de motoristas e auxiliar na validação automatizada de vistorias diárias.\n\nComo posso te apoiar nesta jornada operacional hoje?`;
    }

    res.json({
      success: true,
      text: fallbackText + warningNote,
      usedAI: false,
      apiKeyMissing: isMissingKey
    });
  }
});

// Setup Vite middleware for development or serve production builds dynamically
async function startServer() {
  const distPath = path.join(process.cwd(), "dist");
  const useStatic = process.env.NODE_ENV === "production" && fs.existsSync(path.join(distPath, "index.html"));

  if (!useStatic) {
    console.log("[Unioeste Frotas] Executando em Modo Desenvolvimento (Vite Middleware)...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Unioeste Frotas] Servindo build estático em produção na pasta dist...");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Unioeste Frotas] Servidor backend ativo na porta ${PORT}`);
  });
}

startServer();
