import { useState, useRef, useEffect } from "react";

const STATUS_CONFIG = {
  nova: { label: "Nova", color: "#6C63FF", bg: "#F0EEFF" },
  em_andamento: { label: "Em andamento", color: "#F59E0B", bg: "#FFFBEB" },
  bloqueada: { label: "Bloqueada", color: "#EF4444", bg: "#FEF2F2" },
  concluida: { label: "Concluída", color: "#10B981", bg: "#ECFDF5" },
};

const PRIORIDADE_CONFIG = {
  alta: { label: "Alta", color: "#EF4444" },
  media: { label: "Média", color: "#F59E0B" },
  baixa: { label: "Baixa", color: "#10B981" },
};

const initialTasks = [];

export default function GestorDemandas() {
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState("lista"); // lista | kanban
  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [filterStatus, setFilterStatus] = useState("todas");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    status: "nova",
    prioridade: "media",
    prazo: "",
    tags: "",
  });

  // AI chat state
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  const handleAddTask = () => {
    if (!form.titulo.trim()) return;
    const newTask = {
      id: Date.now(),
      ...form,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      criadaEm: new Date().toLocaleDateString("pt-BR"),
      anotacoes: [],
    };
    setTasks([newTask, ...tasks]);
    setForm({ titulo: "", descricao: "", status: "nova", prioridade: "media", prazo: "", tags: "" });
    setShowForm(false);
    setSelectedTask(newTask);
    setAiMessages([
      {
        role: "assistant",
        content: `Demanda **"${newTask.titulo}"** adicionada! Quer que eu te ajude a montar um plano de ação, levantar riscos, ou definir os próximos passos? É só perguntar.`,
      },
    ]);
  };

  const updateTaskStatus = (id, status) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, status } : t)));
    if (selectedTask?.id === id) setSelectedTask({ ...selectedTask, status });
  };

  const filteredTasks = tasks.filter((t) => {
    const matchStatus = filterStatus === "todas" || t.status === filterStatus;
    const matchSearch = t.titulo.toLowerCase().includes(search.toLowerCase()) ||
      t.descricao.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const sendAiMessage = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = { role: "user", content: aiInput };
    const updatedMessages = [...aiMessages, userMsg];
    setAiMessages(updatedMessages);
    setAiInput("");
    setAiLoading(true);

    const taskContext = selectedTask
      ? `Contexto da demanda atual: Título: "${selectedTask.titulo}", Status: ${STATUS_CONFIG[selectedTask.status]?.label}, Prioridade: ${PRIORIDADE_CONFIG[selectedTask.prioridade]?.label}, Descrição: "${selectedTask.descricao || "sem descrição"}", Prazo: ${selectedTask.prazo || "não definido"}, Tags: ${selectedTask.tags?.join(", ") || "nenhuma"}.`
      : `Total de demandas no sistema: ${tasks.length}. Demandas: ${tasks.map(t => `"${t.titulo}" (${STATUS_CONFIG[t.status]?.label})`).join(", ") || "nenhuma ainda"}.`;

    const systemPrompt = `Você é uma assistente de gestão de demandas pessoal, parceira estratégica de quem usa este sistema. Seu tom é direto, empático e prático — como uma colega de confiança que entende de projetos. 

${taskContext}

Sua função:
- Ajudar a montar planos de ação e próximos passos concretos
- Identificar riscos, dependências ou pontos de atenção
- Sugerir como priorizar e organizar demandas
- Dar estrutura a tarefas confusas ou grandes demais
- Ser prática: responda com listas curtas, passos numerados ou perguntas de clarificação quando necessário

Responda sempre em português brasileiro, de forma concisa. Máximo 4-5 parágrafos.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await response.json();
      const text = data.content?.map((i) => i.text || "").join("\n") || "Não consegui processar sua mensagem.";
      setAiMessages([...updatedMessages, { role: "assistant", content: text }]);
    } catch {
      setAiMessages([...updatedMessages, { role: "assistant", content: "Erro ao conectar com a IA. Tente novamente." }]);
    }
    setAiLoading(false);
  };

  const renderMarkdown = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/^(\d+)\.\s/gm, "<br/><strong>$1.</strong> ")
      .replace(/^[-•]\s/gm, "<br/>• ")
      .replace(/\n/g, "<br/>");
  };

  const counts = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
    acc[s] = tasks.filter((t) => t.status === s).length;
    return acc;
  }, {});

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#F7F7FB", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "#1A1A2E", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: "#6C63FF", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>Suas Demandas</div>
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>Central de Projetos</div>
        </div>
        <button
          onClick={() => { setShowForm(true); setSelectedTask(null); setAiMessages([]); }}
          style={{ background: "#6C63FF", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          + Nova demanda
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #EBEBF5", display: "flex", gap: 0, overflow: "auto" }}>
        {[{ key: "todas", label: "Todas", count: tasks.length, color: "#6C63FF" },
          ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ key: k, label: v.label, count: counts[k] || 0, color: v.color }))
        ].map(({ key, label, count, color }) => (
          <button key={key} onClick={() => setFilterStatus(key)}
            style={{ border: "none", background: "none", padding: "14px 20px", cursor: "pointer", borderBottom: filterStatus === key ? `3px solid ${color}` : "3px solid transparent", color: filterStatus === key ? color : "#888", fontWeight: filterStatus === key ? 700 : 400, fontSize: 13, whiteSpace: "nowrap", transition: "all 0.15s" }}>
            {label} <span style={{ background: filterStatus === key ? color : "#F0EEFF", color: filterStatus === key ? "#fff" : color, borderRadius: 20, padding: "1px 7px", fontSize: 11, marginLeft: 4 }}>{count}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, display: "flex", gap: 0 }}>
        {/* Task list */}
        <div style={{ flex: selectedTask ? "0 0 360px" : "1", borderRight: selectedTask ? "1px solid #EBEBF5" : "none", background: "#F7F7FB", overflowY: "auto", maxHeight: "calc(100vh - 120px)" }}>
          <div style={{ padding: "16px 16px 8px" }}>
            <input
              placeholder="Buscar demandas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #EBEBF5", borderRadius: 10, fontSize: 13, background: "#fff", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {showForm && !selectedTask && (
            <div style={{ margin: "8px 16px 0", background: "#fff", borderRadius: 14, padding: 18, border: "2px solid #6C63FF", boxShadow: "0 4px 20px rgba(108,99,255,0.1)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: "#1A1A2E" }}>Nova demanda</div>
              <input placeholder="Título da demanda*" value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #EBEBF5", borderRadius: 8, fontSize: 13, marginBottom: 8, boxSizing: "border-box", outline: "none" }} />
              <textarea placeholder="Descrição (opcional)" value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} rows={2}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #EBEBF5", borderRadius: 8, fontSize: 13, marginBottom: 8, resize: "vertical", boxSizing: "border-box", outline: "none" }} />
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <select value={form.prioridade} onChange={e => setForm({...form, prioridade: e.target.value})}
                  style={{ flex: 1, padding: "8px 10px", border: "1px solid #EBEBF5", borderRadius: 8, fontSize: 12, outline: "none" }}>
                  {Object.entries(PRIORIDADE_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label} prioridade</option>)}
                </select>
                <input type="date" value={form.prazo} onChange={e => setForm({...form, prazo: e.target.value})}
                  style={{ flex: 1, padding: "8px 10px", border: "1px solid #EBEBF5", borderRadius: 8, fontSize: 12, outline: "none" }} />
              </div>
              <input placeholder="Tags (separadas por vírgula)" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #EBEBF5", borderRadius: 8, fontSize: 13, marginBottom: 12, boxSizing: "border-box", outline: "none" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleAddTask} style={{ flex: 1, background: "#6C63FF", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Adicionar</button>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, background: "#F7F7FB", color: "#888", border: "1px solid #EBEBF5", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              </div>
            </div>
          )}

          <div style={{ padding: "8px 16px 16px" }}>
            {filteredTasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: "#888" }}>
                  {tasks.length === 0 ? "Nenhuma demanda ainda" : "Nenhuma demanda encontrada"}
                </div>
                <div style={{ fontSize: 12, color: "#bbb" }}>
                  {tasks.length === 0 ? "Clique em '+ Nova demanda' para começar" : "Tente outro filtro ou busca"}
                </div>
              </div>
            ) : filteredTasks.map((task) => (
              <div key={task.id}
                onClick={() => { setSelectedTask(task); setAiMessages([]); setShowForm(false); }}
                style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", marginBottom: 8, cursor: "pointer", border: selectedTask?.id === task.id ? "2px solid #6C63FF" : "2px solid transparent", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", transition: "all 0.15s" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#1A1A2E", lineHeight: 1.4, flex: 1 }}>{task.titulo}</div>
                  <div style={{ background: PRIORIDADE_CONFIG[task.prioridade]?.color + "22", color: PRIORIDADE_CONFIG[task.prioridade]?.color, borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {PRIORIDADE_CONFIG[task.prioridade]?.label}
                  </div>
                </div>
                {task.descricao && <div style={{ fontSize: 11, color: "#999", marginTop: 4, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{task.descricao}</div>}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                  <div style={{ background: STATUS_CONFIG[task.status]?.bg, color: STATUS_CONFIG[task.status]?.color, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>
                    {STATUS_CONFIG[task.status]?.label}
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {task.prazo && <span style={{ fontSize: 10, color: "#bbb" }}>📅 {task.prazo}</span>}
                    {task.tags?.length > 0 && <span style={{ fontSize: 10, color: "#bbb" }}>🏷 {task.tags[0]}{task.tags.length > 1 ? ` +${task.tags.length - 1}` : ""}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Task detail + AI chat */}
        {selectedTask && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 120px)" }}>
            {/* Task header */}
            <div style={{ background: "#fff", padding: "20px 24px 16px", borderBottom: "1px solid #EBEBF5" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 17, color: "#1A1A2E", marginBottom: 6 }}>{selectedTask.titulo}</div>
                  {selectedTask.descricao && <div style={{ fontSize: 13, color: "#888", lineHeight: 1.5 }}>{selectedTask.descricao}</div>}
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <select value={selectedTask.status} onChange={e => updateTaskStatus(selectedTask.id, e.target.value)}
                      style={{ background: STATUS_CONFIG[selectedTask.status]?.bg, color: STATUS_CONFIG[selectedTask.status]?.color, border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", outline: "none" }}>
                      {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <span style={{ background: PRIORIDADE_CONFIG[selectedTask.prioridade]?.color + "22", color: PRIORIDADE_CONFIG[selectedTask.prioridade]?.color, borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600 }}>
                      Prioridade {PRIORIDADE_CONFIG[selectedTask.prioridade]?.label}
                    </span>
                    {selectedTask.prazo && <span style={{ fontSize: 12, color: "#aaa" }}>📅 {selectedTask.prazo}</span>}
                    {selectedTask.tags?.map(t => <span key={t} style={{ background: "#F0EEFF", color: "#6C63FF", borderRadius: 6, padding: "3px 8px", fontSize: 11 }}>#{t}</span>)}
                  </div>
                </div>
                <button onClick={() => setSelectedTask(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#bbb", padding: 4 }}>✕</button>
              </div>
            </div>

            {/* AI chat */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", background: "#F7F7FB", display: "flex", flexDirection: "column", gap: 12 }}>
              {aiMessages.length === 0 && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>✨</div>
                  <div style={{ fontWeight: 600, color: "#1A1A2E", marginBottom: 6, fontSize: 14 }}>Assistente de demanda</div>
                  <div style={{ color: "#aaa", fontSize: 13, marginBottom: 20 }}>Posso te ajudar a montar um plano de ação, identificar riscos ou estruturar os próximos passos desta demanda.</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                    {["Monte um plano de ação pra isso", "Quais são os riscos?", "Quais os próximos passos?", "Como priorizar essa demanda?"].map(s => (
                      <button key={s} onClick={() => { setAiInput(s); }}
                        style={{ background: "#fff", border: "1px solid #EBEBF5", borderRadius: 20, padding: "7px 14px", fontSize: 12, color: "#6C63FF", cursor: "pointer", fontWeight: 500 }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {aiMessages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "80%", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    background: msg.role === "user" ? "#6C63FF" : "#fff",
                    color: msg.role === "user" ? "#fff" : "#1A1A2E",
                    padding: "11px 15px", fontSize: 13, lineHeight: 1.6,
                    boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                  }} dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                </div>
              ))}
              {aiLoading && (
                <div style={{ display: "flex" }}>
                  <div style={{ background: "#fff", borderRadius: "14px 14px 14px 4px", padding: "11px 15px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#6C63FF", opacity: 0.5, animation: `pulse 1s ${i*0.2}s infinite` }} />)}
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* AI input */}
            <div style={{ background: "#fff", padding: "12px 16px", borderTop: "1px solid #EBEBF5", display: "flex", gap: 8 }}>
              <input
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendAiMessage()}
                placeholder="Pergunte sobre esta demanda..."
                style={{ flex: 1, padding: "10px 14px", border: "1px solid #EBEBF5", borderRadius: 10, fontSize: 13, outline: "none", background: "#F7F7FB" }}
              />
              <button onClick={sendAiMessage} disabled={aiLoading || !aiInput.trim()}
                style={{ background: aiLoading || !aiInput.trim() ? "#E0DFFF" : "#6C63FF", color: "#fff", border: "none", borderRadius: 10, padding: "0 18px", fontWeight: 700, fontSize: 14, cursor: aiLoading || !aiInput.trim() ? "not-allowed" : "pointer" }}>
                ↑
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #DEDDF0; border-radius: 4px; }
      `}</style>
    </div>
  );
}
