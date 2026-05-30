import React, { useState, useEffect, useRef } from "react";
import { 
  Car, 
  User, 
  Calendar, 
  CheckSquare, 
  Wrench, 
  AlertTriangle, 
  Fuel, 
  TrendingUp, 
  Bot, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Search, 
  Sparkles, 
  Clock, 
  ArrowRight, 
  Lock, 
  Shield, 
  Activity, 
  RotateCw, 
  Power, 
  MapPin, 
  Users,
  Eye,
  LogOut,
  ChevronRight,
  Send,
  Loader2,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Types corresponding to the server definitions
interface Vehicle {
  id: string;
  name: string;
  plate: string;
  type: string;
  odometer: number;
  fuel: number;
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

interface AuditLog {
  timestamp: string;
  user: string;
  action: string;
  detail: string;
}

export default function App() {
  // Session / Role State mimicking Tess/Inner architectures
  const [currentUserRole, setCurrentUserRole] = useState<"admin" | "driver" | "inspector">("admin");
  const [currentTab, setCurrentTab] = useState<"dashboard" | "checklists" | "viagens" | "frota" | "ai" | "logs">("dashboard");
  
  // Simulated Logged users (names change depending on role)
  const loggedUsers = {
    admin: { name: "Ing. Cláudio Alencar", sector: "Setor de Transportes FADEC/UNIOESTE" },
    driver: { name: "Roberto de Souza", sector: "Condução e Linhas intermunicipais" },
    inspector: { name: "Sérgio Martins", sector: "Garagem Central Cascavel" }
  };

  // Operational Data States
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<TripRequest[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Poll intervals & live telemetry settings (SaaS Telemetry Core)
  const [isPollingActive, setIsPollingActive] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>("");
  const [syncFlicker, setSyncFlicker] = useState(false);

  // Manual Creation States (forms)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVehicleForChecklist, setSelectedVehicleForChecklist] = useState<string>("");
  const [checklistType, setChecklistType] = useState<"Saída" | "Retorno">("Saída");

  // Checklist Step wizard state (prevent clicks overhead and human-error input validations)
  const [checklistStep, setChecklistStep] = useState(1);
  const [checklistOdometer, setChecklistOdometer] = useState<string>("");
  const [checklistFuel, setChecklistFuel] = useState<number>(100);
  const [checklistComments, setChecklistComments] = useState<string>("");
  const [checklistItems, setChecklistItems] = useState({
    headlights: true,
    brakes: true,
    tyres: true,
    liquids: true,
    cleaning: true,
    safetyEquipment: true
  });
  const [checklistError, setChecklistError] = useState<string | null>(null);

  // Trip Request creation form state
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [newTrip, setNewTrip] = useState({
    vehicleId: "",
    driverId: "",
    destination: "",
    reason: "",
    departureDate: "",
    returnDate: ""
  });

  // Maintenance & Refill States
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({
    vehicleId: "",
    type: "Manutenção", // "Abastecimento" | "Manutenção"
    odometer: "",
    cost: "",
    notes: ""
  });

  // Chatbot State (Dola & Tess AI integrated experience)
  const [aiChat, setAiaChat] = useState<Array<{ sender: "user" | "dola"; text: string; timestamp: string }>>([
    { sender: "dola", text: "Olá! Sou a **Dola Assistant** da UNIOESTE. Posso ajudar você com perguntas sobre a telemetria, CNH dos motoristas, veículos na manutenção, checklists de saída pendentes ou na criação rápida de trajetos. Como posso te ajudar?", timestamp: "02:11" }
  ]);
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [suggestedPrompts] = useState([
    "Como está o status dos veículos?",
    "Quais veículos possuem alertas de revisão?",
    "Selecione uma rota ideal para Foz do Iguaçu",
    "Verificar CNH de motoristas"
  ]);

  // Real-time UTC clock (UNIOESTE operations)
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync / Fetch operational data function
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/fleet/all");
      const data = await res.json();
      setVehicles(data.vehicles);
      setDrivers(data.drivers);
      setTrips(data.trips);
      setChecklists(data.checklists);
      setAuditLogs(data.auditLogs);
      
      const now = new Date();
      setLastSyncTime(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      
      // Visual feedback blink
      setSyncFlicker(true);
      setTimeout(() => setSyncFlicker(false), 800);
    } catch (e) {
      console.error("Erro ao sincronizar dados da frota", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Setup periodic background poller to ensure user sees latest active telemetry & diagnostic logs instantly
  useEffect(() => {
    fetchData(); // first fetch
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (isPollingActive) {
      intervalId = setInterval(() => {
        fetchData(true);
      }, 8000); // Poll every 8 seconds for beautiful responsive dashboard updates!
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPollingActive]);

  // Handle active telemetry polling remote trigger
  const handleTogglePolling = async () => {
    const nextState = !isPollingActive;
    setIsPollingActive(nextState);
    try {
      await fetch("/api/fleet/telemetry/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextState })
      });
      fetchData(true);
    } catch (e) {
      console.error("Falha no toggle", e);
    }
  };

  // Handle Checklist Submission with strict error preventive validation
  const handleSubmitChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecklistError(null);

    const vehicle = vehicles.find(v => v.id === selectedVehicleForChecklist);
    if (!vehicle) {
      setChecklistError("Por favor, selecione um veículo válido.");
      return;
    }

    const odomVal = parseInt(checklistOdometer);
    if (isNaN(odomVal)) {
      setChecklistError("Odômetro inválido. Insira apenas números inteiros.");
      return;
    }

    // Tess inspired Odometer guard: prevents driver typo error & odometer regression
    if (odomVal < vehicle.odometer) {
      setChecklistError(
        `Erro de Validação: Quilometragem de entrada (${odomVal} km) não pode ser menor que o registro cadastrado mais recente (${vehicle.odometer} km). Digite o valor correto para evitar erros de auditoria.`
      );
      return;
    }

    try {
      const response = await fetch("/api/fleet/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: selectedVehicleForChecklist,
          driverId: currentUserRole === "driver" ? "d-roberto" : "d-ana", // Match logged simulated characters
          type: checklistType,
          odometer: odomVal,
          fuel: checklistFuel,
          items: checklistItems,
          comments: checklistComments
        })
      });

      const result = await response.json();
      if (!response.ok) {
        setChecklistError(result.error || "Erro ao registrar checklist.");
        return;
      }

      // Reset Checklist Wizard form
      setSelectedVehicleForChecklist("");
      setChecklistOdometer("");
      setChecklistFuel(100);
      setChecklistComments("");
      setChecklistItems({
        headlights: true,
        brakes: true,
        tyres: true,
        liquids: true,
        cleaning: true,
        safetyEquipment: true
      });
      setChecklistStep(1);
      
      // Go back to Dashboard and fetch
      setCurrentTab("dashboard");
      fetchData();
    } catch (err) {
      setChecklistError("Falha na chamada de rede com o servidor de telemetria.");
    }
  };

  // Approve / Recuse Trip Request Flow
  const handleTripAction = async (tripId: string, action: "Aprovar" | "Recusar") => {
    try {
      const response = await fetch("/api/fleet/trip/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          action,
          approvedBy: loggedUsers[currentUserRole].name
        })
      });
      
      if (response.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Falha ao responder solicitação", err);
    }
  };

  // Register maintenance or refilling cost ticket
  const handleSubmitMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    const { vehicleId, type, odometer, cost, notes } = maintenanceForm;
    if (!vehicleId || !odometer || !cost) return;

    try {
      const response = await fetch("/api/fleet/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId,
          type,
          odometer: parseInt(odometer),
          cost: parseFloat(cost),
          notes
        })
      });

      if (response.ok) {
        setIsMaintenanceModalOpen(false);
        setMaintenanceForm({ vehicleId: "", type: "Manutenção", odometer: "", cost: "", notes: "" });
        fetchData();
      }
    } catch (e) {
      console.error("Erro ao registrar manutenção", e);
    }
  };

  // Launch Trip Request form
  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate immediate mock posting logic inside audit/server via state
    // To ensure fluid visual loop
    setIsTripModalOpen(false);
    fetchData();1
  };

  // Submit trigger to modern AI Assistant with server side proxy
  const handleSendAiMessage = async (textToSend?: string) => {
    const rawPrompt = textToSend || aiInput;
    if (!rawPrompt.trim()) return;

    const userMsg = { sender: "user" as const, text: rawPrompt, timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) };
    setAiaChat(prev => [...prev, userMsg]);
    if (!textToSend) setAiInput("");
    setIsAiLoading(true);

    try {
      const response = await fetch("/api/fleet/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: rawPrompt })
      });
      
      const data = await response.json();
      const botMsg = {
        sender: "dola" as const,
        text: data.text || "Sem resposta.",
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      };
      setAiaChat(prev => [...prev, botMsg]);
    } catch (e) {
      const errorMsg = {
        sender: "dola" as const,
        text: "Desculpe, ocorreu uma pane na conexão com o gateway de IA. Por favor, tente novamente em instantes.",
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      };
      setAiaChat(prev => [...prev, errorMsg]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Statistics calculation helpers
  const totalVehicles = vehicles.length;
  const availableVehicles = vehicles.filter(v => v.status === "Disponível").length;
  const inTransitVehicles = vehicles.filter(v => v.status === "Em Viagem").length;
  const maintenanceVehicles = vehicles.filter(v => v.status === "Manutenção").length;

  const fleetIssuesCount = vehicles.reduce((acc, v) => acc + v.alerts.length, 0);

  // Search filter
  const filteredVehicles = vehicles.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    v.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
      
      {/* GLOBAL HIGH-FIDELITY MANAGEMENT CONTROL BAR */}
      <div className="bg-slate-900 text-white text-xs px-4 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shadow-inner">
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-mono text-slate-300">ADMIN-GATEWAY: UNIOESTE-CASCAVEL - PROD-SERVER</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span className="text-slate-400">Simulador de Telemetria</span>
        </div>

        {/* Polling update trigger as requested */}
        <div className="flex items-center gap-3">
          <button 
            id="polling-button-toggle"
            onClick={handleTogglePolling}
            className={`flex items-center gap-2 px-3 py-1 rounded transition-all duration-250 cursor-pointer ${
              isPollingActive 
                ? "bg-emerald-950 text-emerald-300 ring-1 ring-emerald-500/30" 
                : "bg-slate-800 text-slate-400 ring-1 ring-slate-700"
            }`}
          >
            <Power className={`w-3.5 h-3.5 ${isPollingActive ? "text-emerald-400 animate-spin" : ""}`} />
            <span className="font-bold">{isPollingActive ? "POLLEANDO (LIVE ATIVO 8s)" : "PAUSADO"}</span>
          </button>
          
          <div className="flex items-center gap-1.5 text-slate-400 bg-slate-950 px-2 py-0.5 rounded font-mono">
            <span>Última Sincronia:</span>
            <span className={`font-bold transition-all ${syncFlicker ? "text-emerald-300 text-sm" : "text-slate-200"}`}>
              {lastSyncTime || "N/A"}
            </span>
          </div>

          {/* Role selector showcasing multi-permission SaaS capabilities */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded">
            <span className="text-slate-400 font-medium">Perfil Teste:</span>
            <select 
              value={currentUserRole}
              onChange={(e) => {
                setCurrentUserRole(e.target.value as any);
                // Prompt user notifications simulating role shift
                const user = loggedUsers[e.target.value as "admin" | "driver" | "inspector"];
                setAuditLogs(prev => [
                  { timestamp: new Date().toISOString(), user: "Sistema", action: "Perfil Alterado em Tempo de Execução", detail: `Visualização adaptada para a Categoria: ${user.name} (${e.target.value.toUpperCase()})` },
                  ...prev
                ]);
              }}
              className="bg-transparent text-emerald-400 text-xs font-bold border-none outline-none focus:ring-0 cursor-pointer"
            >
              <option value="admin" className="bg-slate-900 text-white font-sans">👔 Administrador de Frota</option>
              <option value="driver" className="bg-slate-900 text-white font-sans">🚗 Motorista Credenciado</option>
              <option value="inspector" className="bg-slate-900 text-white font-sans">🛠️ Fiscal de Garagem</option>
            </select>
          </div>
        </div>
      </div>

      {/* PRIMARY HEADER BRANDING */}
      <header className="bg-[#002D62] text-white border-b border-white/10 px-6 py-4 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-amber-400 p-2.5 rounded-lg text-[#002D62] font-black shadow-lg">
              <Car className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase bg-amber-400/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-400/30">
                  FADEC / UNIOESTE
                </span>
                <span className="font-mono text-white/50 text-[10px]">v2.6-SaaS</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">SGF - Sistema de Gestão de Frotas</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-white">{loggedUsers[currentUserRole].name}</p>
              <p className="text-xs text-white/60">{loggedUsers[currentUserRole].sector}</p>
            </div>
            <div className="bg-slate-950/40 border border-white/10 px-4 py-2 rounded-lg flex items-center gap-2 font-mono text-sm text-yellow-300">
              <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />
              <span>{currentTime || "Carregando..."}</span>
            </div>
          </div>
        </div>
      </header>

      {/* MIDDLE NOTIFICATION WARNING BLOCK */}
      {fleetIssuesCount > 0 && currentUserRole === "admin" && (
        <div className="bg-red-50 border-y border-red-200/60 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-1 rounded bg-red-100 text-red-600 animate-bounce">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <p className="text-sm text-red-800">
                <span className="font-bold">Aviso do Painel Operacional:</span> Foram diagnosticadas <span className="font-bold underline">{fleetIssuesCount} não conformidades críticas</span> na telemetria rodoviária hoje. Recomenda-se auditoria preventiva de garagem.
              </p>
            </div>
            <button 
              onClick={() => setCurrentTab("logs")}
              className="text-xs font-semibold text-red-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              Auditar Logs de Auditoria <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* DASHBOARD CONTAINER SVELTE SEPARATION */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SIDE NAV MENU (TABS) */}
        <section className="lg:col-span-3 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col gap-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Painéis & Vistas</h3>
            
            <button 
              onClick={() => setCurrentTab("dashboard")}
              className={`w-full text-left px-3.5 py-3 rounded-xl transition-all duration-150 flex items-center gap-3 cursor-pointer ${
                currentTab === "dashboard" 
                  ? "bg-[#002D62] text-white font-semibold shadow-md" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Activity className="w-4 h-4" />
              <span className="flex-1 text-sm">Painel Geral</span>
            </button>

            <button 
              onClick={() => {
                setCurrentTab("checklists");
                setChecklistStep(1);
              }}
              className={`w-full text-left px-3.5 py-3 rounded-xl transition-all duration-150 flex items-center gap-3 cursor-pointer ${
                currentTab === "checklists" 
                  ? "bg-[#002D62] text-white font-semibold shadow-md" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span className="flex-1 text-sm">Vistoria & Checklist</span>
              <span className="bg-amber-400 text-slate-900 font-bold text-[10px] px-1.5 py-0.5 rounded-full">
                {currentUserRole === "driver" ? "Ação" : "Gerir"}
              </span>
            </button>

            <button 
              onClick={() => setCurrentTab("viagens")}
              className={`w-full text-left px-3.5 py-3 rounded-xl transition-all duration-150 flex items-center gap-3 cursor-pointer ${
                currentTab === "viagens" 
                  ? "bg-[#002D62] text-white font-semibold shadow-md" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span className="flex-1 text-sm">Viagens & Despacho</span>
              {trips.filter(t => t.status === "Pendente").length > 0 && (
                <span className="bg-red-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                  {trips.filter(t => t.status === "Pendente").length}
                </span>
              )}
            </button>

            <button 
              onClick={() => setCurrentTab("frota")}
              className={`w-full text-left px-3.5 py-3 rounded-xl transition-all duration-150 flex items-center gap-3 cursor-pointer ${
                currentTab === "frota" 
                  ? "bg-[#002D62] text-white font-semibold shadow-md" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Car className="w-4 h-4" />
              <span className="flex-1 text-sm">Estoque da Frota</span>
            </button>

            <button 
              onClick={() => setCurrentTab("ai")}
              className={`w-full text-left px-3.5 py-3 rounded-xl transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer ${
                currentTab === "ai" 
                  ? "bg-slate-850 text-white border-l-4 border-amber-400 bg-slate-900 font-semibold shadow-md" 
                  : "text-slate-600 bg-emerald-50/50 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <Bot className="w-4 h-4 text-indigo-500" />
                <span className="text-sm">Dola Assistente IA</span>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </button>

            <button 
              onClick={() => setCurrentTab("logs")}
              className={`w-full text-left px-3.5 py-3 rounded-xl transition-all duration-150 flex items-center gap-3 cursor-pointer ${
                currentTab === "logs" 
                  ? "bg-[#002D62] text-white font-semibold shadow-md" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="flex-1 text-sm">Auditoria & Logs</span>
            </button>
          </div>

          {/* DOLA INTEGRATED QUICK STATS */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 text-white shadow-md">
            <h4 className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-3 flex items-center justify-between">
              <span>Status Operacional</span>
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </h4>
            <div className="grid grid-cols-2 gap-3 font-mono text-center mb-1">
              <div className="bg-slate-950 p-2 rounded border border-slate-800">
                <p className="text-[10px] text-slate-400">DISPONÍVEIS</p>
                <p className="text-xl font-bold text-emerald-400">{availableVehicles}</p>
              </div>
              <div className="bg-slate-950 p-2 rounded border border-slate-800">
                <p className="text-[10px] text-slate-400">EM ROTA</p>
                <p className="text-xl font-bold text-yellow-400">{inTransitVehicles}</p>
              </div>
              <div className="bg-slate-950 p-2 rounded border border-slate-800">
                <p className="text-[10px] text-slate-400">OFICINA</p>
                <p className="text-xl font-bold text-rose-400">{maintenanceVehicles}</p>
              </div>
              <div className="bg-slate-950 p-2 rounded border border-slate-800">
                <p className="text-[10px] text-slate-400">FALHAS</p>
                <p className="text-xl font-bold text-red-500">{fleetIssuesCount}</p>
              </div>
            </div>
          </div>
        </section>

        {/* WORKSPACE AREA (TAB PANELS) */}
        <section className="lg:col-span-9 flex flex-col gap-6">

          <AnimatePresence mode="wait">
            
            {/* TAB 1: PAINEL DE CONTROLE / DASHBOARD */}
            {currentTab === "dashboard" && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-6"
              >
                {/* INTERACTIVE COMPREHENSIVE GRIDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* METRIC 1 */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-indigo-100 transition-all flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Custo Abastecimento (Mês)</span>
                      <h3 className="text-2xl font-bold text-slate-800">R$ 8.420,00</h3>
                      <p className="text-xs text-slate-500 mt-1">Eficácia Média: <span className="font-bold text-emerald-600">11,4 km/l</span></p>
                    </div>
                    <div className="p-4 rounded-xl bg-indigo-50 text-[#002D62]">
                      <Fuel className="w-6 h-6" />
                    </div>
                  </div>

                  {/* METRIC 2 */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-indigo-100 transition-all flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Vistorias Concluídas</span>
                      <h3 className="text-2xl font-bold text-slate-800">{checklists.length} registradas</h3>
                      <p className="text-xs text-slate-500 mt-1">Garantia total de segurança na saída</p>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-50 text-emerald-600">
                      <CheckSquare className="w-6 h-6" />
                    </div>
                  </div>

                  {/* METRIC 3 */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-indigo-100 transition-all flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Quilometragem Total Frota</span>
                      <h3 className="text-2xl font-bold text-slate-800">
                        {vehicles.reduce((acc, current) => acc + current.odometer, 0).toLocaleString()} km
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">Oeste do Paraná mapeado</p>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-50 text-amber-600">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                  </div>

                </div>

                {/* GRAPH SECTION / QUICK ACTION WIDGETS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* ACTIONS COMPANION PANEL (REDUCES USER CLICKS) */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-amber-500" />
                        <span>Ações Rápidas de Operação</span>
                      </h3>
                      <p className="text-sm text-slate-500 mb-6 col-span-2">
                        Simplifique fluxos operacionais internos. Links diretos para ações sem tráfego de cliques adicionais.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button 
                          onClick={() => {
                            setChecklistType("Saída");
                            setCurrentTab("checklists");
                          }}
                          className="p-4 border border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-slate-50 text-left transition-all cursor-pointer group"
                        >
                          <CheckCircle className="w-5 h-5 text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
                          <p className="font-bold text-sm text-slate-800">Vistoria de Saída</p>
                          <p className="text-xs text-slate-400 mt-0.5">Liberar saída do veículo</p>
                        </button>

                        <button 
                          onClick={() => {
                            setChecklistType("Retorno");
                            setCurrentTab("checklists");
                          }}
                          className="p-4 border border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-slate-50 text-left transition-all cursor-pointer group"
                        >
                          <XCircle className="w-5 h-5 text-red-500 mb-2 group-hover:scale-110 transition-transform" />
                          <p className="font-bold text-sm text-slate-800">Vistoria de Retorno</p>
                          <p className="text-xs text-slate-400 mt-0.5">Auditar quilometragem no retorno</p>
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-100 flex gap-3">
                      <button 
                        onClick={() => {
                          setMaintenanceForm(prev => ({ ...prev, type: "Abastecimento" }));
                          setIsMaintenanceModalOpen(true);
                        }}
                        className="flex-1 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-[#002D62] text-sm font-semibold py-2.5 px-4 rounded-xl text-center cursor-pointer transition-all"
                      >
                        Reforçar Combustível
                      </button>
                      <button 
                        onClick={() => {
                          setMaintenanceForm(prev => ({ ...prev, type: "Manutenção" }));
                          setIsMaintenanceModalOpen(true);
                        }}
                        className="flex-1 bg-slate-900 border border-slate-950 hover:bg-slate-800 text-white text-sm font-semibold py-2.5 px-4 rounded-xl text-center cursor-pointer transition-all"
                      >
                        Acionar Oficina
                      </button>
                    </div>
                  </div>

                  {/* ACTIVE ALERTS / VEHICLE LIVE FEED */}
                  <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col justify-between border border-slate-800">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-sm uppercase tracking-wide text-slate-300">Quadro de Diagnóstico e Alertas</h4>
                        <span className="bg-red-950 text-red-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-red-500/20 shadow-sm animate-pulse">
                          Ao Vivo
                        </span>
                      </div>

                      {/* Display Alert Telemetry list */}
                      <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto">
                        {vehicles.map(vehicle => {
                          if (vehicle.alerts.length === 0) return null;
                          return (
                            <div key={`alert-${vehicle.id}`} className="bg-slate-950 rounded-xl p-3 border-l-4 border-amber-500 flex items-start gap-3">
                              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-sm text-slate-100 block truncate">{vehicle.name}</span>
                                  <span className="font-mono text-xs text-amber-500 font-bold shrink-0">{vehicle.plate}</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1 font-sans">{vehicle.alerts[0]}</p>
                              </div>
                            </div>
                          );
                        })}

                        {/* Standard compliance message if clean */}
                        {fleetIssuesCount === 0 && (
                          <div className="flex flex-col items-center justify-center text-center py-8 text-slate-500">
                            <CheckCircle className="w-10 h-10 text-emerald-400 mb-2" />
                            <p className="text-sm font-bold text-slate-300">Sem Alertas em Trânsito</p>
                            <p className="text-xs text-slate-500 max-w-xs mt-1">
                              Todos os veículos ativos operam com os parâmetros de combustível e óleo saudáveis nas rodovias.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-800 text-right">
                      <span className="text-[10px] font-mono text-slate-500 block">SISTEMA INTEGRADO DE TELEMETRIA CENTRAL • CASCAVEL-PR</span>
                    </div>
                  </div>

                </div>

                {/* TRIP QUEUE STATUS OVERVIEW CARD */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-indigo-600" />
                      <span>Viagens Autorizadas em Execução</span>
                    </h3>
                    <button 
                      onClick={() => setCurrentTab("viagens")}
                      className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Painel de Controle de Solicitações →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {trips.filter(t => t.status === "Aprovada").map(t => {
                      const v = vehicles.find(car => car.id === t.vehicleId);
                      const d = drivers.find(drv => drv.id === t.driverId);
                      return (
                        <div key={t.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between">
                          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Rastreio Ativo</span>
                              <h5 className="font-bold text-sm text-slate-850 truncate mt-1">{t.destination}</h5>
                            </div>
                            <span className="font-mono text-xs text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded font-extrabold">{v?.plate}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 font-sans">
                            <p>🚗 <span className="font-semibold text-slate-800">{v?.name}</span></p>
                            <p>👤 Condutor: <span className="font-semibold text-slate-850">{d?.name}</span></p>
                            <p>⏱️ Odômetro: <span className="font-bold text-slate-900 font-mono">{v?.odometer?.toLocaleString()} km</span></p>
                            <p>🔋 Tanque: <span className={`font-bold font-mono ${v && v.fuel <= 20 ? "text-red-500 animate-pulse" : "text-emerald-600"}`}>{v?.fuel}%</span></p>
                          </div>

                          <div className="mt-3 bg-white p-2 rounded border border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Despacho autorizado por:</span>
                            <span className="font-bold text-[#002D62]">{t.approvedBy || "FADEC"}</span>
                          </div>
                        </div>
                      );
                    })}

                    {trips.filter(t => t.status === "Aprovada").length === 0 && (
                      <div className="col-span-2 text-center py-6 text-slate-400 bg-slate-50 rounded-xl font-sans text-sm">
                        Não existem saídas registradas em execução nas últimas horas.
                      </div>
                    )}
                  </div>
                </div>

              </motion.div>
            )}

            {/* TAB 2: CHECKLISTS STEP-BY-STEP DIALOG WIZARD */}
            {currentTab === "checklists" && (
              <motion.div 
                key="checklists"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
              >
                <div className="border-b border-slate-100 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <CheckSquare className="w-5 h-5 text-indigo-600" />
                      <span>Inspeção Inteligente & Checklist de Liberação</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Fidelidade de auditoria. Procedimento obrigatório para liberação e estacionamento conforme regras da UNIOESTE.
                    </p>
                  </div>
                  
                  {/* Selector for Saída vs Retorno */}
                  <div className="inline-flex rounded-lg bg-slate-100 p-1 self-start">
                    <button 
                      onClick={() => setChecklistType("Saída")}
                      className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        checklistType === "Saída" ? "bg-[#002D62] text-white shadow" : "text-slate-600"
                      }`}
                    >
                      Liberar Saída
                    </button>
                    <button 
                      onClick={() => setChecklistType("Retorno")}
                      className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        checklistType === "Retorno" ? "bg-[#002D62] text-white shadow" : "text-slate-600"
                      }`}
                    >
                      Registrar Retorno
                    </button>
                  </div>
                </div>

                {/* STEP WIZARD BAR */}
                <div className="flex items-center justify-between max-w-md mx-auto mb-8 font-sans">
                  {[1, 2, 3].map((step) => (
                    <React.Fragment key={step}>
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                          checklistStep === step 
                            ? "bg-[#002D62] text-white border-[#002D62] shadow-sm" 
                            : checklistStep > step 
                              ? "bg-indigo-100 text-[#002D62] border-indigo-200" 
                              : "bg-slate-50 text-slate-400 border-slate-200"
                        }`}>
                          {step}
                        </div>
                        <span className={`text-xs font-bold ${checklistStep === step ? "text-[#002D62]" : "text-slate-400"}`}>
                          {step === 1 ? "Carro & Odo" : step === 2 ? "Filtros de Segurança" : "Assinatura"}
                        </span>
                      </div>
                      {step < 3 && <div className="flex-1 h-0.5 bg-slate-200 mx-2"></div>}
                    </React.Fragment>
                  ))}
                </div>

                {/* ERROR FEEDBACK BAR */}
                {checklistError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <p className="text-sm font-bold text-red-800">Falha na Validação do Formulário</p>
                      <p className="text-xs text-red-600 mt-1">{checklistError}</p>
                    </div>
                  </div>
                )}

                {/* STEP 1 PANEL: VEHICLE SELECT & ODOMETER LOCK */}
                {checklistStep === 1 && (
                  <div className="max-w-xl mx-auto flex flex-col gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Selecione o Veículo</label>
                      <select 
                        value={selectedVehicleForChecklist}
                        onChange={(e) => {
                          setSelectedVehicleForChecklist(e.target.value);
                          const chosen = vehicles.find(v => v.id === e.target.value);
                          if (chosen) {
                            setChecklistOdometer(String(chosen.odometer));
                            setChecklistFuel(chosen.fuel);
                          }
                        }}
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-[#002D62] focus:ring-1 focus:ring-[#002D62] outline-none"
                      >
                        <option value="">-- Selecione do Estoque Ativo --</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.plate}) - {v.status} • Odo Atual: {v.odometer} km
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedVehicleForChecklist && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Quilometragem (Odo {checklistType})
                          </label>
                          <input 
                            type="number"
                            placeholder="Digite o odômetro físico..."
                            value={checklistOdometer}
                            onChange={(e) => setChecklistOdometer(e.target.value)}
                            className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-[#002D62] outline-none font-mono"
                          />
                          <p className="text-[10px] text-indigo-600 mt-1">
                            Dispositivo de Trava SaaS: O valor deve ser ≥ {vehicles.find(v => v.id === selectedVehicleForChecklist)?.odometer} km.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Nível de Combustível ({checklistFuel}%)
                          </label>
                          <div className="flex items-center gap-3 py-1.5">
                            <input 
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={checklistFuel}
                              onChange={(e) => setChecklistFuel(parseInt(e.target.value))}
                              className="flex-1 accent-[#002D62] cursor-ew-resize"
                            />
                            <span className="font-mono text-sm font-bold bg-slate-100 px-3 py-1 rounded border border-slate-200">
                              {checklistFuel}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-100 flex justify-end">
                      <button 
                        disabled={!selectedVehicleForChecklist}
                        onClick={() => {
                          // Clean old validation error
                          setChecklistError(null);
                          // Fast odometer verification
                          const v = vehicles.find(item => item.id === selectedVehicleForChecklist);
                          const odoVal = parseInt(checklistOdometer);
                          if (v && odoVal < v.odometer) {
                            setChecklistError(`Erro Preventivo: O odômetro digitado (${odoVal} km) recua em relação à marca registrada de {${v.odometer} km}. Digite a numeração real.`);
                            return;
                          }
                          setChecklistStep(2);
                        }}
                        className="bg-[#002D62] hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        Próxima Etapa <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2 PANEL: DETAILED ITEM CHECKLIST FOR DEVIATION REDUCTION */}
                {checklistStep === 2 && (
                  <div className="max-w-xl mx-auto flex flex-col gap-6">
                    <div className="bg-slate-55 bg-slate-50 border border-slate-100 rounded-xl p-4">
                      <p className="text-xs text-slate-500 text-center uppercase tracking-wider font-bold mb-3">CONTRATO DE VISTORIA OPERACIONAL</p>
                      <p className="text-xs text-slate-600 font-sans leading-relaxed">
                        Inspecione os itens de segurança física listados abaixo e marque o interruptor como <span className="text-emerald-600 font-bold">Verde (Conforme)</span>. Falhas operacionais críticas (Faróis, Freios e Itens de Extintor) bloqueiam a liberação do carro automaticamente ou encaminham o mesmo de imediato para a Oficina da UNIOESTE.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Lights */}
                      <label className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50 cursor-pointer">
                        <span className="text-xs font-bold text-slate-700">Faróis & Lanternas</span>
                        <input 
                          type="checkbox"
                          checked={checklistItems.headlights}
                          onChange={(e) => setChecklistItems(prev => ({ ...prev, headlights: e.target.checked }))}
                          className="w-4 h-4 text-[#002D62] border-slate-300 rounded focus:ring-[#002D62]"
                        />
                      </label>

                      {/* Brakes */}
                      <label className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50 cursor-pointer">
                        <span className="text-xs font-bold text-slate-700">Sistema de Freios</span>
                        <input 
                          type="checkbox"
                          checked={checklistItems.brakes}
                          onChange={(e) => setChecklistItems(prev => ({ ...prev, brakes: e.target.checked }))}
                          className="w-4 h-4 text-[#002D62] border-slate-300 rounded focus:ring-[#002D62]"
                        />
                      </label>

                      {/* Tyres */}
                      <label className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50 cursor-pointer">
                        <span className="text-xs font-bold text-slate-700">Pneus & Calibragem</span>
                        <input 
                          type="checkbox"
                          checked={checklistItems.tyres}
                          onChange={(e) => setChecklistItems(prev => ({ ...prev, tyres: e.target.checked }))}
                          className="w-4 h-4 text-[#002D62] border-slate-300 rounded focus:ring-[#002D62]"
                        />
                      </label>

                      {/* Liquids */}
                      <label className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50 cursor-pointer">
                        <span className="text-xs font-bold text-slate-700">Líquidos (Arrefecimento/Óleo)</span>
                        <input 
                          type="checkbox"
                          checked={checklistItems.liquids}
                          onChange={(e) => setChecklistItems(prev => ({ ...prev, liquids: e.target.checked }))}
                          className="w-4 h-4 text-[#002D62] border-slate-300 rounded focus:ring-[#002D62]"
                        />
                      </label>

                      {/* Cleaning */}
                      <label className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50 cursor-pointer">
                        <span className="text-xs font-bold text-slate-700">Limpeza Geral (Conserva)</span>
                        <input 
                          type="checkbox"
                          checked={checklistItems.cleaning}
                          onChange={(e) => setChecklistItems(prev => ({ ...prev, cleaning: e.target.checked }))}
                          className="w-4 h-4 text-[#002D62] border-slate-300 rounded focus:ring-[#002D62]"
                        />
                      </label>

                      {/* Safety */}
                      <label className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50 cursor-pointer">
                        <span className="text-xs font-bold text-slate-700">Kit de Extintor & Macaco</span>
                        <input 
                          type="checkbox"
                          checked={checklistItems.safetyEquipment}
                          onChange={(e) => setChecklistItems(prev => ({ ...prev, safetyEquipment: e.target.checked }))}
                          className="w-4 h-4 text-[#002D62] border-slate-300 rounded focus:ring-[#002D62]"
                        />
                      </label>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-between">
                      <button 
                        onClick={() => setChecklistStep(1)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-lg transition-all"
                      >
                        Retornar Etapa
                      </button>
                      
                      <button 
                        onClick={() => setChecklistStep(3)}
                        className="bg-[#002D62] hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer"
                      >
                        Seguir Assinatura <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3 PANEL: COMMENTS & CONFIRMATION */}
                {checklistStep === 3 && (
                  <form onSubmit={handleSubmitChecklist} className="max-w-xl mx-auto flex flex-col gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Observações Adicionais (Se houver desvios)</label>
                      <textarea 
                        rows={3}
                        placeholder="Insira notas de rodagem, avarias prévias de para-choque ou comentários diversos..."
                        value={checklistComments}
                        onChange={(e) => setChecklistComments(e.target.value)}
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-[#002D62] outline-none outline-none font-sans"
                      />
                    </div>

                    <div className="bg-[#002D62]/5 rounded-xl border border-[#002D62]/10 p-4">
                      <p className="text-xs text-slate-500 uppercase font-bold text-slate-400 mb-1">Responsabilidade de Condução</p>
                      <p className="text-xs text-slate-600 leading-relaxed font-sans">
                        Ao clicar em confirmar abaixo, eu {loggedUsers[currentUserRole].name} certifico que realizei a vistoria física e me responsabilizo pela veracidade das informações e pela condução ética do veículo institucional de acordo com os regulamentos de trânsito.
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-between">
                      <button 
                        type="button"
                        onClick={() => setChecklistStep(2)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-lg transition-all"
                      >
                        Retornar Etapa
                      </button>
                      
                      <button 
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" /> Finalizar & Sincronizar Registro
                      </button>
                    </div>
                  </form>
                )}

              </motion.div>
            )}

            {/* TAB 3: VIAGENS & DESPACHO WITH APPROVAL CAPABILITIES */}
            {currentTab === "viagens" && (
              <motion.div 
                key="viagens"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-6"
              >
                
                {/* HEAD DETAILS */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        <span>Controle de Viagens & Despacho FADEC</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Aprovação das requisições de deslocamento emitidas pelos servidores dos campi Toledo, Cascavel e Foz do Iguaçu.
                      </p>
                    </div>

                    {isTripModalOpen ? (
                      <button 
                        onClick={() => setIsTripModalOpen(false)}
                        className="bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer"
                      >
                        Cancelar Cadastro
                      </button>
                    ) : (
                      <button 
                        onClick={() => setIsTripModalOpen(true)}
                        className="bg-[#002D62] hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow"
                      >
                        <Plus className="w-4 h-4" /> Registrar Solicitação
                      </button>
                    )}
                  </div>

                  {/* SLICK EXPANDABLE MODAL CONTAINER */}
                  {isTripModalOpen && (
                    <form onSubmit={handleCreateTrip} className="mt-6 border-t border-slate-100 pt-6">
                      <h4 className="text-sm font-bold text-slate-800 mb-4 bg-indigo-50/50 p-2 rounded">Nova Solicitação de Viagem (Formulário)</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Motorista Requisitado</label>
                          <select 
                            value={newTrip.driverId}
                            onChange={(e) => setNewTrip(prev => ({ ...prev, driverId: e.target.value }))}
                            className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-[#002D62] outline-none"
                            required
                          >
                            <option value="">-- Selecione Motorista --</option>
                            {drivers.map(d => (
                              <option key={d.id} value={d.id}>{d.name} (CNH Cat: {d.cnhCategory})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Veículo Alocado</label>
                          <select 
                            value={newTrip.vehicleId}
                            onChange={(e) => setNewTrip(prev => ({ ...prev, vehicleId: e.target.value }))}
                            className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-[#002D62] outline-none"
                            required
                          >
                            <option value="">-- Selecione Carro da Garagem --</option>
                            {vehicles.map(v => (
                              <option key={v.id} value={v.id}>{v.name} ({v.plate}) - Odo: {v.odometer} km</option>
                            ))}
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Destino Final</label>
                          <input 
                            type="text"
                            placeholder="Ex: Campus Marechal Cândido Rondon - Prédio Administrativo"
                            value={newTrip.destination}
                            onChange={(e) => setNewTrip(prev => ({ ...prev, destination: e.target.value }))}
                            className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-[#002D62] outline-none"
                            required
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Objetivo / Justificativa Institucional</label>
                          <input 
                            type="text"
                            placeholder="Ex: Participação no Encontro de Reitores do Paraná"
                            value={newTrip.reason}
                            onChange={(prev) => setNewTrip(p => ({ ...p, reason: prev.target.value }))}
                            className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-[#002D62] outline-none"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Data de Partida</label>
                          <input 
                            type="date"
                            value={newTrip.departureDate}
                            onChange={(e) => setNewTrip(prev => ({ ...prev, departureDate: e.target.value }))}
                            className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-[#002D62] outline-none"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Data de Retorno</label>
                          <input 
                            type="date"
                            value={newTrip.returnDate}
                            onChange={(e) => setNewTrip(prev => ({ ...prev, returnDate: e.target.value }))}
                            className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-[#002D62] outline-none"
                            required
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex justify-end gap-3">
                        <button 
                          type="button"
                          onClick={() => setIsTripModalOpen(false)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold px-4 py-2 rounded-xl text-center cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2 rounded-xl text-center cursor-pointer flex items-center gap-1 shadow"
                        >
                          Confirmar Registro No Sistema
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* TRIP REQUESTS QUEUES */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Fila Cronológica de Viagens</h3>

                  <div className="flex flex-col gap-4">
                    {trips.map(trip => {
                      const v = vehicles.find(car => car.id === trip.vehicleId);
                      const d = drivers.find(drv => drv.id === trip.driverId);
                      return (
                        <div key={`trip-item-${trip.id}`} className="border border-slate-150 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-indigo-100 bg-slate-50/20 transition-all">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-[10px] bg-slate-200 text-slate-800 font-mono font-bold px-2 py-0.5 rounded">
                                ID: {trip.id}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                trip.status === "Aprovada" ? "bg-emerald-100 text-emerald-800" :
                                trip.status === "Pendente" ? "bg-amber-100 text-amber-800 animate-pulse" :
                                "bg-rose-100 text-rose-800"
                              }`}>
                                {trip.status}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">{trip.requestDate}</span>
                            </div>

                            <p className="font-bold text-slate-800 text-sm md:text-base leading-snug truncate">
                              {trip.destination}
                            </p>
                            
                            <p className="text-xs text-slate-500 italic mt-0.5 mt-1">
                              "{trip.reason}"
                            </p>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600 mt-3 bg-white border border-slate-100 p-2.5 rounded-xl">
                              <p>👤 Motorista: <span className="font-semibold text-slate-800">{d?.name || "N/A"}</span></p>
                              <p>🚗 Veículo: <span className="font-semibold text-slate-800">{v?.name || "N/A"} ({v?.plate})</span></p>
                              <p>📆 Ida/Volta: <span className="font-semibold text-slate-800 font-mono">{trip.departureDate} a {trip.returnDate}</span></p>
                            </div>
                          </div>

                          {/* Approval Trigger Actions reserved for Gestor/Admin roles to simulate authentic access control */}
                          <div className="flex md:flex-col items-stretch gap-2 shrink-0">
                            {trip.status === "Pendente" ? (
                              currentUserRole === "admin" ? (
                                <>
                                  <button 
                                    onClick={() => handleTripAction(trip.id, "Aprovar")}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer text-center flex items-center justify-center gap-1 shadow"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" /> Autorizar Viagem
                                  </button>
                                  <button 
                                    onClick={() => handleTripAction(trip.id, "Recusar")}
                                    className="bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs px-4 py-2 rounded-xl cursor-pointer hover:bg-rose-100/50 text-center"
                                  >
                                    Recusar Despacho
                                  </button>
                                </>
                              ) : (
                                <div className="text-xs text-slate-400 max-w-xs italic text-center md:text-right bg-slate-100 p-2.5 rounded border border-slate-150">
                                  Apenas perfil Gestor de Frota (Administrador) possui permissão de liberação rápida.
                                </div>
                              )
                            ) : (
                              <div className="bg-slate-100 p-3 rounded-xl border border-slate-150 flex items-center justify-between text-xs max-w-xs shrink-0 select-none">
                                <div>
                                  <span className="text-slate-400 block text-[10px]">Ação de Auditoria</span>
                                  <span className="font-bold text-[#002D62] text-[10px] truncate block">Visto por: {trip.approvedBy || "Diretoria FADEC"}</span>
                                </div>
                              </div>
                            )}
                          </div>

                        </div>
                      );
                    })}

                    {trips.length === 0 && (
                      <div className="text-center py-8 text-slate-400">
                        Nenhuma viagem cadastrada na portaria.
                      </div>
                    )}
                  </div>
                </div>

              </motion.div>
            )}

            {/* TAB 4: ESTOQUE DA FROTA */}
            {currentTab === "frota" && (
              <motion.div 
                key="frota"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-6"
              >
                
                {/* SEARCH AND FILTERS TOOLBAR */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Pesquisar veículo por chapa, marca ou modelo..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 focus:border-[#002D62] focus:ring-1 focus:ring-[#002D62] outline-none outline-none"
                    />
                  </div>

                  <div className="text-xs font-mono text-slate-400 font-bold whitespace-nowrap bg-slate-100 px-3 py-1 rounded border border-slate-150">
                    Sincronizado: {vehicles.length} Veículos listados
                  </div>
                </div>

                {/* VEHICLES STATUS LIST */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredVehicles.map(v => (
                    <div key={v.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-[#002D62]/40 hover:shadow transition-all flex flex-col justify-between gap-4">
                      
                      {/* Brand Info */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-lg text-[#002D62] font-black ${
                            v.status === "Disponível" ? "bg-emerald-50 text-emerald-600" :
                            v.status === "Em Viagem" ? "bg-amber-50 text-amber-600" :
                            v.status === "Manutenção" ? "bg-red-50 text-red-600 animate-pulse" :
                            "bg-slate-100 text-slate-500"
                          }`}>
                            <Car className="w-6 h-6" />
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 font-mono font-extrabold tracking-wide">{v.type}</span>
                            <h4 className="font-bold text-slate-800 text-sm md:text-base">{v.name}</h4>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-mono bg-slate-900 text-slate-100 font-bold text-xs tracking-wider px-2 py-1 rounded block mb-1">
                            {v.plate}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            v.status === "Disponível" ? "bg-emerald-100 text-emerald-800" :
                            v.status === "Em Viagem" ? "bg-amber-100 text-amber-800" :
                            "bg-rose-100 text-rose-800"
                          }`}>
                            {v.status}
                          </span>
                        </div>
                      </div>

                      {/* Gauges and Telemetries */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl font-mono text-[11px]">
                        <div>
                          <p className="text-slate-400 uppercase text-[9px] mb-0.5">KM Atual</p>
                          <p className="font-bold text-slate-800">{v.odometer.toLocaleString()} km</p>
                        </div>
                        <div>
                          <p className="text-slate-400 uppercase text-[9px] mb-0.5">Combustível</p>
                          <p className={`font-bold ${v.fuel <= 20 ? "text-rose-600 animate-pulse" : "text-emerald-700"}`}>{v.fuel}%</p>
                        </div>
                        <div>
                          <p className="text-slate-400 uppercase text-[9px] mb-0.5">Manutenção em</p>
                          <p className="font-bold text-slate-700">{v.nextMaintenanceOdometer.toLocaleString()} km</p>
                        </div>
                      </div>

                      {/* Display Alert indicators inside vehicle card */}
                      {v.alerts.length > 0 && (
                        <div className="bg-rose-50 border border-rose-100 rounded-lg p-2.5 flex items-start gap-2 text-rose-800 text-xs mt-1 leading-snug">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <span>{v.alerts[0]}</span>
                        </div>
                      )}

                      {/* Quick refuel button for drivers inside vehicle lists */}
                      <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-sans">Garagem UNIOESTE • Cascavel</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setSelectedVehicleForChecklist(v.id);
                              setCurrentTab("checklists");
                            }}
                            className="bg-indigo-50 border border-indigo-200 text-[#002D62] text-xs font-bold py-1 px-2.5 rounded hover:bg-indigo-100"
                          >
                            Nova Vistoria (Checklist)
                          </button>
                        </div>
                      </div>

                    </div>
                  ))}

                  {filteredVehicles.length === 0 && (
                    <div className="col-span-2 text-center py-10 bg-white border border-slate-200 rounded-2xl text-slate-400">
                      Nenhum veículo encontrado com os filtros de busca.
                    </div>
                  )}
                </div>

              </motion.div>
            )}

            {/* TAB 5: DOLA ASSISTE IA SYSTEM CHAT (TESS INTEGRATED COMPANION) */}
            {currentTab === "ai" && (
              <motion.div 
                key="ai"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="bg-slate-900 rounded-3xl border border-slate-800 text-slate-100 shadow-xl overflow-hidden flex flex-col h-[600px]"
              >
                
                {/* AI Brand Header */}
                <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between gap-5 shadow">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-tr from-sky-400 via-indigo-500 to-indigo-600 shadow">
                      <Bot className="w-6 h-6 text-white animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-100 flex items-center gap-1.5 leading-snug">
                        <span>Dola Assistente IA</span>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                      </h3>
                      <p className="text-[10px] text-slate-400">Motor de Diagnostico Logístico & Resoluções Unioeste</p>
                    </div>
                  </div>

                  <div className="bg-indigo-950/60 text-indigo-400 border border-indigo-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full select-none">
                    Gemini 3.5 Active Gateway
                  </div>
                </div>

                {/* SUGGESTED TRIGGER CHIPS (REDUCES DRIFT OVERHEAD) */}
                <div className="bg-slate-950/60 p-2.5 border-b border-slate-800 overflow-x-auto flex gap-2 shrink-0 scrollbar-none">
                  {suggestedPrompts.map((p, idx) => (
                    <button 
                      key={`chip-${idx}`}
                      onClick={() => handleSendAiMessage(p)}
                      className="bg-slate-800 flex items-center gap-1 hover:bg-slate-700 text-slate-300 rounded-lg py-1 px-2.5 text-xs font-bold transition-all whitespace-nowrap cursor-pointer border border-slate-700/60"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                      <span>{p}</span>
                    </button>
                  ))}
                </div>

                {/* CHAT MESSAGES SCROLL SCREEN */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 font-sans leading-relaxed">
                  {aiChat.map((msg, idx) => (
                    <div 
                      key={`chat-${idx}`}
                      className={`flex gap-3 max-w-[85%] ${msg.sender === "user" ? "self-end flex-row-reverse" : "self-start"}`}
                    >
                      {/* Avatar */}
                      <div className={`p-2 rounded-xl shrink-0 h-9 w-9 flex items-center justify-center font-bold text-xs select-none ${
                        msg.sender === "user" ? "bg-slate-800 text-sky-400" : "bg-indigo-600 text-white"
                      }`}>
                        {msg.sender === "user" ? "EU" : <Bot className="w-4 h-4" />}
                      </div>

                      {/* Text contents */}
                      <div>
                        <div className={`p-4 rounded-2xl text-sm ${
                          msg.sender === "user" 
                            ? "bg-indigo-600 text-white rounded-tr-none" 
                            : "bg-slate-950 text-slate-200 border border-slate-800/85 rounded-tl-none whitespace-pre-wrap"
                        }`}>
                          {msg.text}
                        </div>
                        <span className={`text-[10px] text-slate-500 mt-1 block px-1 ${msg.sender === "user" ? "text-right" : "text-left"}`}>
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* AI Loader */}
                  {isAiLoading && (
                    <div className="flex gap-3 self-start max-w-[80%] animate-pulse">
                      <div className="bg-indigo-600 text-white p-2 rounded-xl shrink-0 h-9 w-9 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl rounded-tl-none">
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                          <Activity className="w-3.5 h-3.5 text-indigo-400 animate-ping" />
                          <span>Dola está compilando diagnóstico da frota...</span>
                        </div>
                        <div className="h-1.5 w-44 bg-slate-800 rounded-full overflow-hidden mt-3">
                          <div className="h-full bg-indigo-500 w-1/2 animate-shimmer" style={{ width: "65%" }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* CHAT INPUT FORM */}
                <div className="p-4 bg-slate-950 border-t border-slate-800 shrink-0">
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Fale com a Dola Assistente ia sobre vistorias, segurança..."
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendAiMessage();
                      }}
                      className="flex-1 text-sm bg-slate-900 border border-slate-800 focus:border-indigo-500 outline-none p-3 rounded-xl placeholder:text-slate-500 text-white"
                    />
                    <button 
                      onClick={() => handleSendAiMessage()}
                      className="bg-indigo-600 hover:bg-indigo-700 font-bold p-3.5 rounded-xl shadow cursor-pointer text-white flex items-center justify-center shrink-0 transition-all"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </motion.div>
            )}

            {/* TAB 6: AUDITORIA & REGISTROS IMUTÁVEIS CONSOLE */}
            {currentTab === "logs" && (
              <motion.div 
                key="logs"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="bg-slate-950 text-teal-400 p-6 rounded-2xl border border-slate-900 shadow-lg font-mono text-xs flex flex-col gap-4 overflow-hidden h-[540px]"
              >
                <div className="flex items-center justify-between border-b border-teal-900/40 pb-3 select-none shrink-0 bg-slate-950">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-teal-400 animate-pulse" />
                    <span className="font-bold uppercase tracking-wider text-teal-300">Portaria de Garagem - Log de Auditoria Imutável</span>
                  </div>
                  <span className="bg-teal-950/80 text-teal-400 text-[10px] border border-teal-800/40 px-2 py-0.5 rounded font-mono select-none">
                    Apenas Consulta (SLA de Segurança)
                  </span>
                </div>

                {/* Console list output */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-3 leading-relaxed">
                  {auditLogs.map((log, idx) => (
                    <div key={`log-${idx}`} className="border-b border-slate-900/50 pb-2">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-teal-500 mb-1">
                        <span className="bg-slate-900 text-teal-300 px-1 py-0.5 rounded font-semibold font-mono">
                          {new Date(log.timestamp).toLocaleString("pt-BR")}
                        </span>
                        <span>•</span>
                        <span className="font-bold text-teal-200 uppercase">{log.action}</span>
                        <span>•</span>
                        <span className="text-slate-400 bg-slate-900 py-0.5 px-1.5 rounded">{log.user}</span>
                      </div>
                      <p className="text-teal-300 ml-1 font-mono text-xs py-0.5 px-1 rounded hover:bg-slate-900/40 transition-colors">
                        &gt; {log.detail}
                      </p>
                    </div>
                  ))}

                  {auditLogs.length === 0 && (
                    <div className="text-center py-10 text-slate-500">
                      Nenhum registro de telemetria recebido pelo poller central.
                    </div>
                  )}
                </div>

                <div className="border-t border-teal-900/30 pt-3 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
                  <span>UNIOESTE SECURITY INFRASTRUCTURE PROTOCOL v49</span>
                  <span>ESTADO: AUDITANDO</span>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

        </section>

      </main>

      {/* FOOTER SECTION */}
      <footer className="bg-slate-950 p-6 text-white/55 border-t border-slate-900 text-xs mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-bold text-slate-300">FADEC • UNIOESTE - Cascavel</p>
            <p className="text-slate-500 mt-1">
              Universidade Estadual do Oeste do Paraná. Todos os direitos reservados.
            </p>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <span className="hover:text-amber-400 transition-colors">Termos de Uso</span>
            <span>•</span>
            <span className="hover:text-amber-400 transition-colors">Suporte TI Portaria</span>
          </div>
        </div>
      </footer>

      {/* QUICK FLOATING DIALOG: REFILL OR MAINTENANCE */}
      {isMaintenanceModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl border border-slate-200 p-6 w-full max-w-md shadow-2xl overflow-hidden font-sans"
          >
            <div className="border-b border-slate-100 pb-4 mb-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base md:text-lg flex items-center gap-1.5">
                <Wrench className="w-5 h-5 text-indigo-600" />
                <span>Registrar Saída Financeira da Frota</span>
              </h3>
              <button 
                onClick={() => setIsMaintenanceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 cursor-pointer text-sm font-bold"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSubmitMaintenance} className="flex flex-col gap-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tipo de Registro</label>
                <select 
                  value={maintenanceForm.type}
                  onChange={(e) => setMaintenanceForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-[#002D62] outline-none"
                >
                  <option value="Abastecimento">Gasolina / Abastecimento (Tanque)</option>
                  <option value="Manutenção">Oficina / Manutenção Corretiva</option>
                  <option value="Preventiva">Revisão Preventiva (Filtro, Correia)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-bold">Selecione o Veículo</label>
                <select 
                  value={maintenanceForm.vehicleId}
                  onChange={(e) => setMaintenanceForm(prev => ({ ...prev, vehicleId: e.target.value }))}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-[#002D62] outline-none"
                  required
                >
                  <option value="">-- Escolha um carro --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.plate}) • Atual: {v.odometer} km</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-bold">Odômetro Atual</label>
                  <input 
                    type="number"
                    placeholder="km físico"
                    value={maintenanceForm.odometer}
                    onChange={(e) => setMaintenanceForm(prev => ({ ...prev, odometer: e.target.value }))}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-[#002D62] outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-bold">Custo Total (R$)</label>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="Ex: 250.00"
                    value={maintenanceForm.cost}
                    onChange={(e) => setMaintenanceForm(prev => ({ ...prev, cost: e.target.value }))}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-[#002D62] outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-bold">Observações / Oficina</label>
                <input 
                  type="text"
                  placeholder="Ex: Auto-posto Cascavel ou Oficina Central Ltda."
                  value={maintenanceForm.notes}
                  onChange={(e) => setMaintenanceForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-[#002D62] outline-none"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-[#002D62] hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl text-center cursor-pointer text-sm shadow transition-all"
              >
                Lançar Registro Finanças
              </button>

            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
