import { copyText } from "@/lib/copyText";
import { MAX_CONTINUE, CONTINUE_PROMPT, looksCut, stitch } from "@/lib/codeContinue";
import { readChatRecovery, writeChatRecovery, shouldFollowChat } from "@/lib/chatRecovery";
import { useState, useEffect, useRef, useMemo } from "react";
import ImageGeneration, { type GeneratedImage } from "@/components/chat/ImageGeneration";
import { isImageRequest } from "@/lib/imageIntent";
import { grafikPrompt, grafikRequest } from "@/lib/grafik";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import MinecraftAvatar from "@/components/MinecraftAvatar";
import Logo, { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import MarkdownMessage from "@/components/MarkdownMessage";
import { adDue, pickAd, adMarkdown } from "@/lib/mythosAds";
import LogoOrb from "@/components/LogoOrb";
import {
  Plus, Send, Trash2, MessageSquare, Loader2, Sparkles, Brain, HelpCircle, Menu,
  AppWindow, Mic, MicOff, Volume2, VolumeX, Paperclip, X as XIcon, Drama, Copy, Download, Lightbulb,
  Image as ImageIcon, Music, Globe, FileText, Languages, UserCog, WifiOff, Smile, Film,
  PanelLeftClose, PanelLeft, LogOut, Key, Shield, Bot, Users, BarChart3,
  Crown, Gamepad2, Server, Ticket, User as UserIcon, Search, Puzzle,
  ArrowLeft, ArrowRight, FolderOpen, Shapes, Clock, Briefcase, Target, Square, Code2, Wrench, ChevronRight,
  Globe2, Compass, ArrowUp, MoreHorizontal, Monitor, Clapperboard, Phone, Pencil,
} from "lucide-react";
import { LegalLinks } from "@/components/CookieConsent";
import { DayDivider, SuggestionBar, StepsTimeline, ThinkingBlock, TimelineRow, dayKey, dayLabel, relTime, useMinuteTick } from "@/components/chat/ChatTimeline";
import { useSubscription } from "@/hooks/useSubscription";
import Paywall from "@/components/Paywall";
import { toast } from "sonner";
import { useVoiceMode } from "@/hooks/useVoiceMode";
import FunkPlayer, { type FunkPattern } from "@/components/FunkPlayer";
import SongPlayer, { type SongRequest, songSeconds } from "@/components/SongPlayer";
import VideoPlayer, { type VideoRequest } from "@/components/VideoPlayer";
import AgentBrowser from "@/components/AgentBrowser";
import BrowserExtensionPanel from "@/components/BrowserExtensionPanel";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { isPuterModel, getPuterLabel } from "@/lib/puterAi";
import ModelPicker from "@/components/ModelPicker";
import { DEFAULT_MYTHOS_ID, isAllowed, mythosLabel, renameLegacyModels } from "@/lib/mythosModels";

import { nvidiaChat, nvidiaLLM } from "@/lib/nvidiaApi";
import CustomizeDialog from "@/components/chat/CustomizeDialog";
import ArtifactsDialog from "@/components/chat/ArtifactsDialog";
import ProjectsDialog from "@/components/chat/ProjectsDialog";
import StarterPrompts from "@/components/chat/StarterPrompts";
import { getInstructions, getMcpServers, getProjects, projectOfChat, setProjects, type Project } from "@/lib/chatPrefs";
import { callTool, collectTools, connectorStates } from "@/lib/mcpClient";
import { FILE_PROMPT } from "@/lib/chatFiles";
import { defaultChatMode } from "@/lib/entry";
import { SMART_UI_PROMPT, SMART_UI_SEND, stripSmartUI, smartUIOptions } from "@/components/chat/SmartUI";
import PinnedChecklist from "@/components/chat/PinnedChecklist";
import { ChatSkeleton } from "@/components/chat/ChatSkeleton";
import LivePreview from "@/components/preview/LivePreview";
import { latestPreview } from "@/lib/livePreview";
import UsageDialog from "@/components/UsageDialog";
import FeedbackButtons from "@/components/chat/FeedbackButtons";
import FileViewer, { type ViewFile } from "@/components/chat/FileViewer";
import { filesOfChat, prepareFile } from "@/lib/chatFileParts";
import { checkAnswer, repairPrompt } from "@/lib/selfCheck";
import { checklistStatusPrompt, latestChecklist } from "@/lib/pinnedChecklist";
import { identityPrompt, capabilitiesPrompt } from "@/lib/mythosCapabilities";
import { fallbackTitle, generateChatTitle } from "@/lib/chatTitle";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SLASH_COMMANDS = [
  { cmd: "/grafik",    args: "<motiv>",         icon: ImageIcon, desc: "Grafik zeichnen lassen (Logo, Poster, Szene, Icon …) – erscheint direkt als Bild" },
  { cmd: "/goal",      args: "<ziel>",          icon: Target,    desc: "Ziel setzen – Mythos arbeitet selbstständig Schritt für Schritt, bis es erreicht ist" },
  { cmd: "/music",     args: "<stil/vibe>",     icon: Music,     desc: "Song mit Gesang erzeugen (1–3 Minuten)" },
  { cmd: "/video",     args: "<szene>",         icon: Film,      desc: "Kurzes KI-Video (Bild + Animation, kostenlos im Browser)" },
  { cmd: "/film",      args: "[idee]",          icon: Clapperboard, desc: "Mythos Filmstudio: aus einer Idee einen Kurzfilm mit Sprecher und Musik drehen (kostenlos)" },
  { cmd: "/cloudpc",   args: "[aufgabe]",       icon: Monitor,   desc: "Mythos Cloud-PC: Agent mit eigenem Computer, du schaust live zu (kostenlos)" },
  { cmd: "/agent",     args: "<aufgabe>",       icon: Globe,     desc: "Browser-Agent: KI surft live — du siehst jeden Klick (Pro)" },
  { cmd: "/browser",   args: "[anweisung]",     icon: Puzzle,    desc: "Deinen echten Browser steuern per Mythos-Erweiterung (Pro)" },
  { cmd: "/research",  args: "<thema>",         icon: Globe,     desc: "Deep Research mit Web-Suche" },
  { cmd: "/translate", args: "<sprache> [text]",icon: Languages, desc: "Übersetzen (letzte AI-Antwort wenn ohne Text)" },
  { cmd: "/summarize", args: "",                icon: FileText,  desc: "Konversation zusammenfassen" },
  { cmd: "/identity",  args: "<name>",          icon: UserCog,   desc: "AI-Persona im Chat wechseln" },
  { cmd: "/code",       args: "<prompt>",       icon: Bot,       desc: "Code‑Assist via Meta Llama (Kostenlos)" },
  { cmd: "/offline",   args: "<frage>",         icon: WifiOff,   desc: "Offline-Chat im Browser (Qwen2.5-0.5B, ~500MB einmalig)" },
  { cmd: "/offline-summary", args: "<text>",    icon: FileText,  desc: "Offline-Zusammenfassung (DistilBART, ~250MB)" },
  { cmd: "/sentiment", args: "<text>",          icon: Smile,     desc: "Offline-Stimmungsanalyse (~65MB)" },
  { cmd: "/koppeln",   args: "[code]",          icon: Code2,     desc: "Mit Mythos Code auf dem PC koppeln und ihn von hier steuern" },
  { cmd: "/codeprogramm", args: "",             icon: Download,  desc: "Mythos Code als Windows-App herunterladen" },
  { cmd: "/handyapp", args: "",                 icon: Download,  desc: "Mythos als iPhone-App herunterladen (Chat + Code-Fernsteuerung)" },
  { cmd: "/handyappadmin", args: "",            icon: Shield,    desc: "Admin: iOS-Projekt-ZIP für den GitHub-Build erzeugen", admin: true },
  { cmd: "/handyappupload", args: "<drive-link>", icon: Shield,  desc: "Admin: .ipa-Link veröffentlichen", admin: true },
  { cmd: "/codeprogrammadmin", args: "",        icon: Shield,    desc: "Admin: App-ZIP für den Setup-Build erzeugen", admin: true },
  { cmd: "/codeprogrammadminupload", args: "<drive-link>", icon: Shield, desc: "Admin: Setup-EXE-Link veröffentlichen", admin: true },
  { cmd: "/apikeyadmin", args: "[2] <AIza…>", icon: Shield, desc: "Admin: gratis Google-AI-Ausweichschlüssel speichern (wenn Lovable-Credits leer sind)", admin: true },
  { cmd: "/nvidiakeyadmin", args: "[bild] <nvapi-…>", icon: Shield, desc: "Admin: NVIDIA-Schlüssel sicher auf dem Server speichern", admin: true },
  { cmd: "/musikkeyadmin", args: "<sk_…>", icon: Shield, desc: "Admin: ElevenLabs-Schlüssel für echte Songs mit Gesang speichern", admin: true },
  { cmd: "/exeupdateadmin", args: "<drive-link> [version]", icon: Shield, desc: "Admin: Update-EXE für Mythos Code veröffentlichen", admin: true },
];

type Persona = { id: string; name: string; avatar_emoji: string | null };
type Attachment = { url: string; name: string; mime: string; text?: string };
type Conv = { id: string; title: string; mode: string; updated_at: string };
type Msg = { id?: string; role: "user" | "assistant" | "tool"; content: string; metadata?: any; videoNotes?: { name: string; text: string }[]; image?: GeneratedImage; imagePending?: { prompt: string }; music?: FunkPattern; song?: SongRequest; video?: VideoRequest; agent?: { task: string }; search?: string; ext?: { task: string }; attachments?: Attachment[]; agents?: AgentStatus[]; thinking?: string; thinkingMs?: number; steps?: string[]; created_at?: string };
/** Status eines Teil-Agenten im Multi-Agent-Modus (vom agent-Endpunkt gestreamt). */
type AgentStatus = { i: number; title: string; status: "läuft" | "fertig" | "fehler"; phase?: string };

const MODES = [
  { value: "general", label: "General", icon: Sparkles, desc: "Allgemeiner KI-Chat" },
  { value: "agent", label: "Agent", icon: Brain, desc: "Mit Web-Suche & Tools" },
  { value: "support", label: "Support", icon: HelpCircle, desc: "Mythoscraft Server-Support" },
];

const SIDEBAR_KEY = "mythos.sidebar.collapsed";

/** Braucht die Anfrage Werkzeuge/Helfer? Recherche, Aktuelles, Vergleiche, mehrere gleichartige Ergebnisse. */
export function needsAgent(text: string): boolean {
  const t = text.toLowerCase();
  if (t.length < 12) return false;
  return /recherchier|such(e)? (im|nach)|im internet|im web|quellen|aktuell|neueste|news|heute|preis(e)? |vergleich|unterschied zwischen|was kostet|wer ist (der|die) (aktuelle|neue)/.test(t)
    || /\b([2-9]|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s+(verschiedene\s+)?(modelle|hüte|dateien|seiten|webseiten|plugins|skins|ideen|varianten|versionen|items|texturen|level|bilder|logos|songs|rezepte)\b/.test(t)
    || /\bjeweils\b|\bfür jede[nrs]?\b|\bfür alle\b/.test(t);
}

/** Echte Fehlermeldung einer Edge Function (statt „Edge Function returned a non-2xx status code“). */
async function fnErrorText(error: unknown, data?: { error?: string } | null): Promise<string> {
  if (data?.error) return data.error;
  const e = error as { message?: string; context?: Response } | null;
  const res = e?.context;
  if (res && typeof res.clone === "function") {
    const status = res.status;
    let msg = "";
    try { const j = await res.clone().json(); msg = j?.error || j?.message || ""; } catch { try { msg = (await res.clone().text()).slice(0, 200); } catch { /* egal */ } }
    if (status === 404) return "Server-Funktion nicht gefunden (404) – sie ist noch nicht bereitgestellt. In Lovable einmal „Publish“ bzw. die Funktion deployen.";
    if (status === 401) return "Nicht angemeldet (401) – bitte neu einloggen.";
    return (msg || e?.message || "Unbekannter Fehler") + (status ? ` (HTTP ${status})` : "");
  }
  return e?.message || "Unbekannter Fehler";
}

// /goal: so viele Arbeitsschritte darf Mythos höchstens machen, bevor es von selbst anhält.
const GOAL_MAX_STEPS = 20;
// Obergrenze für alle Antworten einer Runde (Schritte + Werkzeug-Aufrufe).
const MAX_TURNS = 60;
const GOAL_DONE = /\[ZIEL ERREICHT\]/i;
// Werkzeug-Aufruf: <tool_call>…</tool_call>, aber auch <tool>/<tool_use> und ohne End-Tag (Modelle sind da nicht sauber).
const TOOL_OPEN = /<(tool_call|tool_use|tool)(?:\s[^>]*)?>/i;
const TOOL_BLOCK = /<(tool_call|tool_use|tool)(?:\s[^>]*)?>[\s\S]*?(?:<\/\1\s*>|$)/gi;
// So oft darf das Modell hintereinander ein Werkzeug erfinden, bevor wir abbrechen.
const MAX_BAD_TOOLS = 2;

type ApiMsg = { role: string; content: any };
type GoalState = { text: string; step: number; status: "läuft" | "erreicht" | "gestoppt" | "limit" };
type MythosUsage = { input_tokens?: number; output_tokens?: number; total_tokens?: number; measured: boolean };
type StreamResult = { full: string; image?: GeneratedImage; music?: FunkPattern; agents?: AgentStatus[]; thinking: string; thinkingMs?: number; steps?: string[]; aborted: boolean; usage?: MythosUsage; interrupted?: boolean; videoNotes?: { name: string; text: string }[]; workMs?: number };

/** Nachricht aus dem Verlauf so umwandeln, wie das Modell sie bekommt. */
const toApi = (m: Msg): ApiMsg =>
  m.role === "tool"
    ? { role: "user", content: `Ergebnis von Werkzeug ${m.metadata?.tool || ""}:\n${m.content}` }
    : { role: m.role, content: m.role === "user" ? expandPastes(m.content, m.attachments) : m.content };

/** Eingefügte lange Texte stehen als „[Eingefügt #1]“ in der Nachricht und als Anhang daneben (wie bei Claude).
 *  Für die KI wird der Text genau an dieser Stelle eingesetzt; nicht mehr im Text markierte kommen ans Ende. */
const PASTE_RE = /\[Eingefügt #(\d+)\]/g;
function expandPastes(text: string, atts?: Attachment[]): string {
  const pastes = (atts || []).filter(a => typeof a.text === "string");
  if (!pastes.length) return text;
  const used = new Set<string>();
  let out = text.replace(PASTE_RE, (m) => {
    const a = pastes.find(p => `[${p.name}]` === m);
    if (!a) return m;
    used.add(a.name);
    return `\n<eingefügter-text name="${a.name}">\n${a.text}\n</eingefügter-text>\n`;
  });
  for (const a of pastes) if (!used.has(a.name)) out += `\n\n<eingefügter-text name="${a.name}">\n${a.text}\n</eingefügter-text>`;
  return out;
}

function parseToolCall(text: string): { name: string; arguments: unknown } | null {
  const m = TOOL_OPEN.exec(text);
  if (!m) return null;
  let body = text.slice(m.index + m[0].length);
  const end = body.search(/<\/(?:tool_call|tool_use|tool)\s*>/i);
  if (end >= 0) body = body.slice(0, end);
  body = body.replace(/```[a-z]*\s*/gi, "").trim();
  const a = body.indexOf("{"), b = body.lastIndexOf("}");
  if (a < 0 || b < a) return { name: "", arguments: {} };
  try {
    const j = JSON.parse(body.slice(a, b + 1));
    if (typeof j?.name !== "string") return { name: "", arguments: {} };
    const { name, arguments: args1, args, input, ...rest } = j;
    return { name, arguments: args1 ?? args ?? input ?? rest };
  } catch { return { name: "", arguments: {} }; }
}

/** Technische Markierungen aus einer Antwort entfernen, bevor sie angezeigt wird. */
const forDisplay = (text: string) =>
  renameLegacyModels(text).replace(TOOL_BLOCK, "").replace(/<\/(?:tool_call|tool_use|tool)\s*>/gi, "").replace(GOAL_DONE, "").trimEnd();

const Chat = () => {
  const { user, session, profile, isAdmin, signOut } = useAuth();
  const nav = useNavigate();
  // Eine Route (/app/*) für alle Chats, damit die Seite beim Wechsel nicht neu startet.
  const splat = useParams()["*"] || "";
  const chatId = splat.match(/^c\/([^/]+)/)?.[1];
  const [searchParams, setSearchParams] = useSearchParams();
  // Chat, der gerade beim Senden neu angelegt wurde – dessen URL-Wechsel darf die laufende Antwort nicht neu laden.
  const createdIdRef = useRef<string | null>(null);
  const taskIdRef = useRef<string | null>(null);
  // Neu angelegter Chat, der nach der ersten Antwort noch seinen KI-Titel bekommt (temp = vorläufiger Titel).
  const pendingTitleRef = useRef<{ id: string; temp: string } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Conv | null>(null);
  const sub = useSubscription();
  const [paywall, setPaywall] = useState<{ open: boolean; reason?: string }>({ open: false });
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState(defaultChatMode);
  const [mythosId, setMythosId] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_MYTHOS_ID;
    return localStorage.getItem("mythos.model") || DEFAULT_MYTHOS_ID;
  });
  const mythosRef = useRef(mythosId);
  const lastUserTextRef = useRef("");
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  });
  const [voiceMode, setVoiceMode] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personaId, setPersonaId] = useState<string>("none");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestBodyRef = useRef<unknown>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [convSearch, setConvSearch] = useState("");
  // Chats, in deren Nachrichten der Suchtext vorkommt (nicht nur im Titel).
  const [contentHits, setContentHits] = useState<Set<string>>(new Set());
  // Nachrichten, die während einer laufenden Antwort eingegeben wurden – werden danach der Reihe nach gesendet.
  // Warteschlange: gehört immer zu einem bestimmten Chat (sonst landet sie nach einem Chat-Wechsel im falschen).
  const [queue, setQueue] = useState<{ id: string; text: string; chat: string | null }[]>([]);
  const [dragging, setDragging] = useState(false);
  // Seitenleiste wie bei Claude
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjectsState] = useState<Project[]>(() => getProjects());
  const [dialog, setDialog] = useState<null | "projects" | "artifacts" | "customize">(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // /goal
  const [goal, setGoal] = useState<GoalState | null>(null);
  const stopRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const loadEpochRef = useRef(0);
  const [loadingChat, setLoadingChat] = useState(false);
  const followRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const lastSpokenRef = useRef<string>("");
    const sendRef = useRef<(text?: string) => void>(() => {});
  const voice = useVoiceMode({
    lang: "de-DE",
    onTranscript: (t) => { sendRef.current?.(t); },
    onDictation: (t) => { setInput(prev => (prev ? prev.trimEnd() + " " + t : t)); },
  });

  useEffect(() => { localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? "1" : "0"); }, [sidebarCollapsed]);
  useEffect(() => { localStorage.setItem("mythos.model", mythosId); mythosRef.current = mythosId; }, [mythosId]);
  useEffect(() => {
    const sync = () => setProjectsState(getProjects());
    window.addEventListener("mythos-prefs", sync);
    return () => window.removeEventListener("mythos-prefs", sync);
  }, []);
  // downgrade silently if the stored choice is not covered by the current plan
  useEffect(() => {
    if (!sub.loading && !isAllowed(mythosId, sub.tier)) setMythosId(DEFAULT_MYTHOS_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub.loading, sub.tier]);

  // Anfrage geschickt und Seite verlassen? Der Server rechnet weiter und speichert die Antwort selbst.
  // Steht beim Öffnen als Letztes noch die Frage da, kurz nachschauen, bis die Antwort angekommen ist.
  useEffect(() => {
    if (!activeId || sending || loadingChat) return;
    const last = messages[messages.length - 1] as (Msg & { created_at?: string }) | undefined;
    if (!last || last.role !== "user" || !last.created_at) return;
    if (Date.now() - new Date(last.created_at).getTime() > 6 * 60_000) return;
    const id = activeId, since = last.created_at;
    let n = 0;
    const t = setInterval(async () => {
      if (sendingRef.current || ++n > 72) return clearInterval(t);
      const { count } = await supabase.from("messages").select("id", { count: "exact", head: true })
        .eq("conversation_id", id).eq("role", "assistant").gt("created_at", since);
      if (count) { clearInterval(t); void loadMessages(id); }
    }, 5000);
    return () => clearInterval(t);
  }, [messages, activeId, sending, loadingChat]); // eslint-disable-line react-hooks/exhaustive-deps

  const [convsLoaded, setConvsLoaded] = useState(false);
  const loadConvs = async () => {
    const { data } = await supabase.from("conversations").select("*").order("updated_at", { ascending: false });
    if (data) setConvs(data as any);
    setConvsLoaded(true);
  };

  useEffect(() => { if (user) loadConvs(); }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase.from("ai_personas").select("id,name,avatar_emoji").or(`user_id.eq.${user.id},is_public.eq.true`).then(({ data }) => {
      if (data) setPersonas(data as Persona[]);
    });
  }, [user]);

  const uploadFiles = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploading(true);
    const newAtts: Attachment[] = [];
    for (const file of Array.from(files).slice(0, 5)) {
      // Video: wird hochgeladen, die KI sieht es sich auf dem Server selbst an (Bild für Bild, mit Ton).
      if (file.type.startsWith("video/")) {
        if (file.size > 200 * 1024 * 1024) { toast.error(`${file.name}: Video max. 200 MB`); continue; }
        const tid = toast.loading(`Video wird hochgeladen: ${file.name}`);
        const vp = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabase.storage.from("chat-uploads").upload(vp, file, { contentType: file.type });
        if (error) { toast.error(`${file.name}: Hochladen fehlgeschlagen (${error.message})`, { id: tid }); continue; }
        newAtts.push({ url: supabase.storage.from("chat-uploads").getPublicUrl(vp).data.publicUrl, name: file.name, mime: file.type });
        toast.success(`${file.name} angehängt – Mythos schaut es sich beim Senden an`, { id: tid });
        continue;
      }
      if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name}: max 20MB`); continue; }
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("chat-uploads").upload(path, file);
      if (error) { toast.error(`Upload fehlgeschlagen: ${file.name}`); continue; }
      const { data: pub } = supabase.storage.from("chat-uploads").getPublicUrl(path);
      newAtts.push({ url: pub.publicUrl, name: file.name, mime: file.type });
    }
    setAttachments(prev => [...prev, ...newAtts]);
    setUploading(false);
    if (newAtts.length) toast.success(`${newAtts.length} Datei(en) angehängt`);
  };

  const loadMessages = async (id: string) => {
    if (!user) return;
    const epoch = ++loadEpochRef.current;
    setActiveId(id);
    setMobileSidebar(false);
    const cached = readChatRecovery<Msg>(user.id, id);
    setMessages(cached);
    setLoadingChat(true);
    try {
    const { data: conv, error } = await supabase.from("conversations").select("id,mode").eq("id", id).maybeSingle();
    if (epoch !== loadEpochRef.current) return;
    if (!conv) { toast.error(error ? "Chat derzeit nicht erreichbar. Gesicherter Verlauf bleibt erhalten." : "Chat nicht gefunden"); return; }
    setMode((conv as { mode: string }).mode);
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", id).order("created_at");
    if (epoch !== loadEpochRef.current) return;
    if (data) {
      const enriched = (data as any[]).map(m => ({
        ...m,
        image: m.metadata?.image,
        music: m.metadata?.music,
        song: m.metadata?.song,
        video: m.metadata?.video,
        offline: m.metadata?.offline,
        attachments: m.metadata?.attachments,
        ext: m.metadata?.ext,
        agents: m.metadata?.agents,
        thinking: m.metadata?.thinking,
        thinkingMs: m.metadata?.thinkingMs,
        videoNotes: m.metadata?.videoNotes,
        steps: m.metadata?.steps,
      })) as Msg[];
      setMessages(cached.length > enriched.length ? cached : enriched);
    }
    } finally { if (epoch === loadEpochRef.current) setLoadingChat(false); }
  };

  // Die URL bestimmt den offenen Chat: /app = neuer Chat, /app/c/<id> = genau dieser Chat.
  useEffect(() => {
    if (!user) return;
    ++loadEpochRef.current;
    if (chatId) {
      if (createdIdRef.current === chatId) { createdIdRef.current = null; return; }
      if (sending) stop();
      setGoal(null);
      loadMessages(chatId);
    } else {
      if (sending) stop();
      setGoal(null);
      setActiveId(null);
      setLoadingChat(false);
      setMessages([]);
      setMode(defaultChatMode());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, user?.id]);

  const openChat = (id: string) => {
    setMobileSidebar(false);
    if (id !== chatId) nav(`/app/c/${id}`);
  };

  useMinuteTick();
  // Neue Nachrichten bekommen sofort einen Zeitstempel (für "gerade eben", "vor 5 Minuten" und Tages-Trenner).
  useEffect(() => {
    if (messages.some(m => !m.created_at)) {
      const now = new Date().toISOString();
      setMessages(prev => prev.map(m => (m.created_at ? m : { ...m, created_at: now })));
    }
  }, [messages]);

  useEffect(() => {
    const box = scrollRef.current;
    if (box && followRef.current) box.scrollTop = box.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!user || !activeId || !messages.length) return;
    const save = () => writeChatRecovery(user.id, activeId, messages);
    const timer = window.setTimeout(save, 200);
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", save);
    return () => { window.clearTimeout(timer); window.removeEventListener("pagehide", save); document.removeEventListener("visibilitychange", save); };
  }, [messages, activeId, user?.id]);

  const newChat = () => {
    setActiveId(null);
    setMessages([]);
    setMobileSidebar(false);
    if (chatId) nav("/app");
  };

  const deleteChat = async (id: string) => {
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) { toast.error("Chat konnte nicht gelöscht werden"); return; }
    if (pendingTitleRef.current?.id === id) pendingTitleRef.current = null;
    setConvs(prev => prev.filter(c => c.id !== id));
    if (getProjects().some(p => p.chatIds.includes(id))) setProjects(getProjects().map(p => ({ ...p, chatIds: p.chatIds.filter(x => x !== id) })));
    if (activeId === id) { setActiveId(null); setMessages([]); nav("/app", { replace: true }); }
    toast.success("Chat gelöscht");
    loadConvs();
  };

  const renameChat = async (id: string, value: string) => {
    setRenaming(null);
    const title = value.replace(/\s+/g, " ").trim().slice(0, 80);
    const old = convs.find(c => c.id === id);
    if (!title || title === old?.title) return;
    // Selbst benannt: der KI-Titel überschreibt das nicht mehr.
    if (pendingTitleRef.current?.id === id) pendingTitleRef.current = null;
    setConvs(prev => prev.map(c => c.id === id ? { ...c, title } : c));
    const { error } = await supabase.from("conversations").update({ title }).eq("id", id);
    if (error) { toast.error("Umbenennen fehlgeschlagen"); loadConvs(); }
  };

  // Nach der ersten Antwort: passenden Titel von der KI holen, außer der Chat wurde inzwischen umbenannt.
  const autoTitle = async (convId: string, userText: string, answer: string) => {
    const pending = pendingTitleRef.current;
    if (!pending || pending.id !== convId) return;
    pendingTitleRef.current = null;
    const title = await generateChatTitle(userText, answer);
    if (!title || title === pending.temp) return;
    const { data } = await supabase.from("conversations").update({ title }).eq("id", convId).eq("title", pending.temp).select("id");
    if (data?.length) setConvs(prev => prev.map(c => c.id === convId ? { ...c, title } : c));
  };

  const send = async (override?: string) => {
    let text = (override ?? input).trim();
    if (!text || sending || sendingRef.current || !user) return;
    // Auto-detect generation commands
    const lowerText = text.toLowerCase();
    // „Dreh mir einen Kurzfilm über …“ → Filmstudio
    const filmAsk = text.match(/^(?:bitte\s+)?(?:dreh|drehe|mach|mache|erstell|erstelle|produzier|produziere)\s+(?:mir\s+|uns\s+)?(?:einen|ein)\s+(?:kurzfilm|film)\s+(?:über|ueber|von|zu|mit)\s+([\s\S]+)$/i);
    if (filmAsk) text = `/film ${filmAsk[1].trim()}`;
    if (lowerText.includes("generiere mir ein video von")) {
      const match = lowerText.match(/generiere mir ein video von (.+)/i);
      if (match && match[1]) {
        text = `/video ${match[1].trim()}`;
      }
    } else if (lowerText.includes("generiere mir musik von")) {
      const match = lowerText.match(/generiere mir musik von (.+)/i);
      if (match && match[1]) {
        text = `/music ${match[1].trim()}`;
      }
    }
    // Bild-Wünsche in normaler Sprache ("generiere mir das als Bild") erkennt der Server selbst
    // und löst "das" über den Chatverlauf auf. Hier nur für Paywall und Routing.
    // Bilder zeichnet Mythos jetzt selbst als Grafik (SVG) im normalen Chat – kein Bild-Pfad mehr.
    const wantsImage = false && !attachments.length && isImageRequest(text);
    const localReply = (content: string) => setMessages(prev => [...prev, { role: "user", content: text }, { role: "assistant", content }]);
    const downloadBlob = (blob: Blob, name: string) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    };
    if (/^\/codeadmin\b/i.test(text)) {
      if (!override) setInput("");
      if (!isAdmin) { toast.error("Nur für Admins."); return; }
      const { buildCliZip, ADMIN_GUIDE, CLI_PKG, CLI_VERSION } = await import("@/lib/mythosCli");
      if (localStorage.getItem("mythos_cli_built") === CLI_VERSION) {
        localReply(`Das Mythos-Code-Paket v${CLI_VERSION} wurde bereits erstellt. **/codeadmin** geht nur einmal pro Version.`);
        return;
      }
      downloadBlob(await buildCliZip(window.location.origin), `${CLI_PKG}.zip`);
      localStorage.setItem("mythos_cli_built", CLI_VERSION);
      localReply(ADMIN_GUIDE);
      return;
    }
    if (/^\/apikeyadmin\b/i.test(text)) {
      if (!override) setInput("");
      if (!isAdmin) { toast.error("Nur für Admins."); return; }
      const parts = text.replace(/^\/apikeyadmin\b/i, "").trim().split(/\s+/).filter(Boolean);
      const which = /^(2|zweit|backup)$/i.test(parts[0] ?? "") ? "google2" : "google";
      const value = which === "google2" ? parts[1] : parts[0];
      // Den Schlüssel nie im Chat anzeigen – nur maskiert.
      const reply = (content: string) => setMessages(prev => [...prev, { role: "user", content: `/apikeyadmin ${which === "google2" ? "2 " : ""}${value ? "AIza••••" : ""}` }, { role: "assistant", content }]);
      if (!value) { reply("So geht's:\n```\n/apikeyadmin AIza…      (Google-AI-Ausweichschlüssel, gratis)\n/apikeyadmin 2 AIza…    (zweiter, falls der erste ausgeschöpft ist)\n```\nGratis-Schlüssel: aistudio.google.com → „Get API key“ → „Create API key“.\nDer Schlüssel wird nur geschützt auf dem Server gespeichert und nie wieder angezeigt."); return; }
      const { data, error } = await supabase.functions.invoke("nvidia", { body: { kind: "setkey", which, value } });
      if (error || data?.error) { const why = await fnErrorText(error, data); toast.error("Speichern fehlgeschlagen: " + why); reply("✗ " + why); return; }
      reply(`✓ Google-AI-Ausweichschlüssel${which === "google2" ? " #2" : ""} sicher auf dem Server gespeichert. Wird automatisch genutzt, wenn Lovable-Credits leer sind.`);
      return;
    }
    if (/^\/musikkeyadmin\b/i.test(text)) {
      if (!override) setInput("");
      if (!isAdmin) { toast.error("Nur für Admins."); return; }
      const value = text.replace(/^\/musikkeyadmin\b/i, "").trim().split(/\s+/).filter(Boolean)[0];
      const reply = (content: string) => setMessages(prev => [...prev, { role: "user", content: `/musikkeyadmin ${value ? "sk_••••" : ""}` }, { role: "assistant", content }]);
      if (!value) { reply("So geht's:\n```\n/musikkeyadmin sk_…\n```\nSchlüssel: elevenlabs.io → Developers → API Keys → „Create API Key“ (Musik braucht einen bezahlten Plan).\nDer Schlüssel wird nur geschützt auf dem Server gespeichert und nie wieder angezeigt."); return; }
      const { data, error } = await supabase.functions.invoke("nvidia", { body: { kind: "setkey", which: "elevenlabs", value } });
      if (error || data?.error) { const why = await fnErrorText(error, data); toast.error("Speichern fehlgeschlagen: " + why); reply("✗ " + why); return; }
      reply("✓ ElevenLabs-Schlüssel gespeichert. Songs mit /music werden ab jetzt echte Tracks mit Gesang (1–3 Minuten).");
      return;
    }
    if (/^\/nvidiakeyadmin\b/i.test(text)) {
      if (!override) setInput("");
      if (!isAdmin) { toast.error("Nur für Admins."); return; }
      const parts = text.replace(/^\/nvidiakeyadmin\b/i, "").trim().split(/\s+/).filter(Boolean);
      const which = /^(bild|image)$/i.test(parts[0] ?? "") ? "image" : "main";
      const value = which === "image" ? parts[1] : parts[0];
      // Den Schlüssel nie im Chat anzeigen – nur maskiert.
      const reply = (content: string) => setMessages(prev => [...prev, { role: "user", content: `/nvidiakeyadmin ${which === "image" ? "bild " : ""}${value ? "nvapi-••••" : ""}` }, { role: "assistant", content }]);
      if (!value) { reply("So geht's:\n```\n/nvidiakeyadmin nvapi-…        (Chat & Vorlesen, auch Bilder)\n/nvidiakeyadmin bild nvapi-…   (nur Bilder)\n```\nDer Schlüssel wird nur geschützt auf dem Server gespeichert und nie wieder angezeigt."); return; }
      const { data, error } = await supabase.functions.invoke("nvidia", { body: { kind: "setkey", which, value } });
      if (error || data?.error) { const why = await fnErrorText(error, data); toast.error("Speichern fehlgeschlagen: " + why); reply("✗ " + why); return; }
      reply(`✓ NVIDIA-Schlüssel${which === "image" ? " für Bilder" : ""} sicher auf dem Server gespeichert.`);
      return;
    }
    if (/^\/exeupdateadmin\b/i.test(text)) {
      if (!override) setInput("");
      if (!isAdmin) { toast.error("Nur für Admins."); return; }
      const { toDirectDownloadUrl, APP_DOWNLOAD_SETTING, APP_UPDATE_SETTING, APP_VERSION } = await import("@/lib/mythosCli");
      const [rawLink = "", rawVersion] = text.replace(/^\/exeupdateadmin\b/i, "").trim().split(/\s+/);
      const url = toDirectDownloadUrl(rawLink);
      const version = rawVersion || APP_VERSION;
      if (!url || !/^\d+\.\d+\.\d+$/.test(version)) {
        localReply("So geht's:\n```\n/exeupdateadmin https://drive.google.com/file/d/…/view 1.3.0\n```\nOhne Version wird die Version der aktuellen ZIP (" + APP_VERSION + ") genommen.");
        return;
      }
      const now = new Date().toISOString();
      const { error } = await supabase.from("app_settings").upsert([
        { key: APP_UPDATE_SETTING, value: JSON.stringify({ version, url }), updated_at: now },
        { key: APP_DOWNLOAD_SETTING, value: url, updated_at: now },
      ]);
      if (error) { toast.error("Speichern fehlgeschlagen: " + error.message); return; }
      localReply(`✓ Update **v${version}** veröffentlicht. Neue Downloads über **/codeprogramm** bekommen ab jetzt diese Version.\n\nDirekter Link: ${url}`);
      return;
    }
    if (/^\/handyappupload\b/i.test(text)) {
      if (!override) setInput("");
      if (!isAdmin) { toast.error("Nur für Admins."); return; }
      const { toDirectDownloadUrl, HANDY_DOWNLOAD_SETTING } = await import("@/lib/mythosCli");
      const url = toDirectDownloadUrl(text.replace(/^\/handyappupload\b/i, ""));
      if (!url) { localReply("Bitte einen gültigen https-Link zur .ipa angeben:\n```\n/handyappupload https://drive.google.com/file/d/…/view\n```"); return; }
      const { error } = await supabase.from("app_settings")
        .upsert({ key: HANDY_DOWNLOAD_SETTING, value: url, updated_at: new Date().toISOString() });
      if (error) { toast.error("Speichern fehlgeschlagen: " + error.message); return; }
      localReply(`✓ Download-Link gespeichert. Ab jetzt kann jeder mit **/handyapp** die Installationsanleitung bekommen.\n\nDirekter Link: ${url}`);
      return;
    }
    if (/^\/handyappadmin\b/i.test(text)) {
      if (!override) setInput("");
      if (!isAdmin) { toast.error("Nur für Admins."); return; }
      const { buildHandyZip, HANDY_ADMIN_GUIDE, HANDY_PKG } = await import("@/lib/mythosCli");
      downloadBlob(await buildHandyZip(window.location.origin), `${HANDY_PKG}.zip`);
      localReply(HANDY_ADMIN_GUIDE);
      return;
    }
    if (/^\/handyapp\b/i.test(text)) {
      if (!override) setInput("");
      const { HANDY_DOWNLOAD_SETTING, HANDY_USER_GUIDE } = await import("@/lib/mythosCli");
      const { data } = await supabase.from("app_settings").select("value").eq("key", HANDY_DOWNLOAD_SETTING).maybeSingle();
      if (!data?.value) { localReply("Die Mythos-Handy-App ist noch nicht verfügbar – schau bald wieder vorbei."); return; }
      localReply(HANDY_USER_GUIDE(data.value));
      return;
    }
    if (/^\/codeprogrammadminupload\b/i.test(text)) {
      if (!override) setInput("");
      if (!isAdmin) { toast.error("Nur für Admins."); return; }
      const { toDirectDownloadUrl, APP_DOWNLOAD_SETTING } = await import("@/lib/mythosCli");
      const url = toDirectDownloadUrl(text.replace(/^\/codeprogrammadminupload\b/i, ""));
      if (!url) { localReply("Bitte einen gültigen https-Link angeben:\n```\n/codeprogrammadminupload https://drive.google.com/file/d/…/view\n```"); return; }
      const { error } = await supabase.from("app_settings")
        .upsert({ key: APP_DOWNLOAD_SETTING, value: url, updated_at: new Date().toISOString() });
      if (error) { toast.error("Speichern fehlgeschlagen: " + error.message); return; }
      localReply(`✓ Download-Link gespeichert. Ab jetzt kann jeder mit **/codeprogramm** die Setup-EXE herunterladen.\n\nDirekter Link: ${url}`);
      return;
    }
    if (/^\/codeprogrammadmin\b/i.test(text)) {
      if (!override) setInput("");
      if (!isAdmin) { toast.error("Nur für Admins."); return; }
      const { buildAppZip, APP_ADMIN_GUIDE, APP_PKG } = await import("@/lib/mythosCli");
      downloadBlob(await buildAppZip(window.location.origin), `${APP_PKG}.zip`);
      localReply(APP_ADMIN_GUIDE);
      return;
    }
    if (/^\/koppeln\b/i.test(text)) {
      if (!override) setInput("");
      // Den Code zeigt die Mythos-Code-App auf dem PC nach /koppeln an – hier wird er eingegeben.
      const code = text.replace(/^\/koppeln\b/i, "").replace(/\D/g, "").slice(0, 6);
      nav(code ? `/code?code=${code}` : "/code");
      return;
    }
    if (/^\/codeprogramm\b/i.test(text)) {
      if (!override) setInput("");
      // Die Setup-EXE wird automatisch von GitHub Actions gebaut (build-apps.yml) und liegt immer aktuell im Release.
      const { APP_USER_GUIDE } = await import("@/lib/mythosCli");
      const { APPS, latestDownloadUrl } = await import("@/lib/downloads");
      const url = await latestDownloadUrl(APPS.find((x) => x.id === "code")!);
      const a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.rel = "noopener"; a.click();
      localReply(APP_USER_GUIDE(url));
      return;
    }
    if (/^\/code\s*$/i.test(text)) {
      if (!override) setInput("");
      if (!sub.isPro) { setPaywall({ open: true, reason: "Mythos Code (CLI) ist eine Pro-Funktion." }); return; }
      const { USER_GUIDE } = await import("@/lib/mythosCli");
      setMessages(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: USER_GUIDE }]);
      return;
    }
    // /goal <ziel> — Mythos arbeitet selbstständig in mehreren Schritten, bis das Ziel erreicht ist.
    let goalText: string | undefined;
    const goalMatch = text.match(/^\/goal\b\s*([\s\S]*)$/i);
    if (goalMatch) {
      goalText = goalMatch[1].trim();
      if (!goalText) {
        if (!override) setInput("");
        localReply("So geht's:\n```\n/goal <dein Ziel>\n```\nBeispiel: `/goal Schreib mir einen kompletten Businessplan für einen Minecraft-Server`\n\nMythos macht dann einen Plan und arbeitet Schritt für Schritt selbstständig weiter, bis das Ziel erreicht ist. Oben siehst du das Ziel, mit **Stopp** hältst du es jederzeit an.");
        return;
      }
      text = `🎯 Ziel: ${goalText}`;
    }
    // /film — Mythos Filmstudio öffnen, optional direkt mit Idee
    const filmMatch = text.match(/^\/(?:film|filmstudio|kurzfilm)\b\s*([\s\S]*)$/i);
    if (filmMatch) {
      if (!override) setInput("");
      const t = filmMatch[1].trim();
      nav(t ? `/filmstudio?idee=${encodeURIComponent(t)}` : "/filmstudio");
      return;
    }
    // /cloudpc — Mythos Cloud-PC öffnen, optional direkt mit Aufgabe
    const pcMatch = text.match(/^\/(?:cloudpc|cloud-pc|pc|computer)\b\s*([\s\S]*)$/i);
    if (pcMatch) {
      if (!override) setInput("");
      const t = pcMatch[1].trim();
      nav(t ? `/cloud-pc?task=${encodeURIComponent(t)}` : "/cloud-pc");
      return;
    }
    if (sub.chatLimitReached) { setPaywall({ open: true, reason: `Du hast dein tägliches Free-Limit (${20} Chats) erreicht.` }); return; }
    if (wantsImage && !sub.canGenerateImage) { setPaywall({ open: true, reason: "Bilder generieren ist eine Pro-Funktion." }); return; }
    if (/^\/music\b/i.test(text) && !sub.canGenerateMusic) { setPaywall({ open: true, reason: "Musik generieren ist eine Pro-Funktion." }); return; }
    if (/^\/agent\b/i.test(text) && !sub.isPro) { setPaywall({ open: true, reason: "Der Browser-Agent ist eine Pro-Funktion." }); return; }
    if (/^\/browser\b/i.test(text) && !sub.isPro) { setPaywall({ open: true, reason: "Browser-Steuerung ist eine Pro-Funktion." }); return; }
    if (!override) setInput("");
    sendingRef.current = true;
    setSending(true);
    followRef.current = true;
    const fileAtts = attachments.filter(a => typeof a.text !== "string");
    const displayContent = fileAtts.length
      ? text + "\n" + fileAtts.map(a => `📎 ${a.name}`).join("\n")
      : text;
    setMessages(prev => [...prev, { role: "user", content: displayContent, attachments: [...attachments] }]);

    try {
    let convId = activeId;
    if (!convId) {
      const { data, error } = await supabase.from("conversations")
        .insert({ user_id: user.id, title: fallbackTitle(text), mode })
        .select().single();
      if (error || !data) { toast.error("Chat konnte nicht erstellt werden"); setSending(false); return; }
      convId = data.id;
      pendingTitleRef.current = { id: data.id, temp: data.title };
      setActiveId(convId);
      createdIdRef.current = convId;
      // Im geöffneten Projekt angelegt -> gehört zu diesem Projekt.
      if (projectId) setProjects(getProjects().map(p => p.id === projectId ? { ...p, chatIds: [data.id, ...p.chatIds] } : p));
      nav(`/app/c/${convId}`, { replace: true });
      loadConvs();
    }

    // /browser — echte Browser-Steuerung über die Mythos-Erweiterung
    const extMatch = text.match(/^\/browser\b\s*(.*)$/i);
    if (extMatch) {
      const t = extMatch[1].trim();
      const userMsg: Msg = { role: "user", content: text };
      const aiMsg: Msg = {
        role: "assistant",
        content: "🧩 **Browser Control** — ich steuere deinen echten Browser: klicken, tippen, Seiten öffnen. Beim ersten Mal einmalig die Erweiterung installieren, danach reicht `/browser <anweisung>`.",
        ext: { task: t },
      };
      setMessages(prev => [...prev, aiMsg]);
      await supabase.from("messages").insert([
        { conversation_id: convId, role: "user", content: text },
        { conversation_id: convId, role: "assistant", content: aiMsg.content, metadata: { ext: { task: t } } },
      ]);
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
      setSending(false); loadConvs(); return;
    }

    // /agent — Browser-Agent live im Chat
    const agentMatch = text.match(/^\/agent\s+(.+)$/i);
    if (agentMatch) {
      const task = agentMatch[1].trim();
      const userMsg: Msg = { role: "user", content: text };
      const aiMsg: Msg = { role: "assistant", content: "", agent: { task } };
      setMessages(prev => [...prev, aiMsg]);
      await supabase.from("messages").insert([
        { conversation_id: convId, role: "user", content: text },
      ]);
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
      setSending(false); loadConvs(); return;
    }


    const musicMatch = text.match(/^\/music\s+(.+)$/i);
    if (musicMatch) {
      const prompt = musicMatch[1].trim();
      const song: SongRequest = { prompt, title: prompt.slice(0, 60), duration: songSeconds(prompt), createdAt: Date.now() };
      const userMsg: Msg = { role: "user", content: text };
      const aiMsg: Msg = {
        role: "assistant",
        content: `🎵 **Song wird erzeugt:** _${prompt}_\n\nEchter Track mit Gesang, ${Math.round(song.duration! / 6) / 10} Minuten.`,
        song,
      };
      setMessages(prev => [...prev, aiMsg]);
      await supabase.from("messages").insert([
        { conversation_id: convId, role: "user", content: text },
        { conversation_id: convId, role: "assistant", content: aiMsg.content, metadata: { song } },
      ]);
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
      setSending(false); loadConvs(); return;
    }

    const videoMatch = text.match(/^\/video\s+(.+)$/i);
    if (videoMatch) {
      const prompt = videoMatch[1].trim();
      const video: VideoRequest = { prompt, title: prompt.slice(0, 60), duration: 8, motion: "kenburns" };
      const userMsg: Msg = { role: "user", content: text };
      const aiMsg: Msg = {
        role: "assistant",
        content: `🎬 **AI-Video wird vorbereitet:** _${prompt}_\n\nKlick „Generieren" — die KI erstellt ein Schlüsselbild und animiert es zu einem kurzen Clip. Komplett im Browser, kostenlos.`,
        video,
      };
      setMessages(prev => [...prev, aiMsg]);
      await supabase.from("messages").insert([
        { conversation_id: convId, role: "user", content: text },
        { conversation_id: convId, role: "assistant", content: aiMsg.content, metadata: { video } },
      ]);
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
      setSending(false); loadConvs(); return;
    }

    // /code command – Meta Llama coding assistance
    const codeMatch = text.match(/^\/code\s+(.+)$/i);
    if (codeMatch) {
      const prompt = codeMatch[1].trim();
      const aiContent = await nvidiaLLM("meta/llama-3.3-70b-instruct", [{ role: "user", content: prompt }]);
      const userMsg: Msg = { role: "user", content: text };
      const aiMsg: Msg = { role: "assistant", content: aiContent };
      setMessages(prev => [...prev, aiMsg]);
      await supabase.from("messages").insert([
        { conversation_id: convId, role: "user", content: text },
        { conversation_id: convId, role: "assistant", content: aiContent },
      ]);
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
      setSending(false);
      loadConvs();
      return;
    }


    const buildContent = (raw: string) => {
      const txt = expandPastes(raw, attachments);
      if (!fileAtts.length) return txt;
      const parts: any[] = [{ type: "text", text: txt }];
      for (const a of fileAtts) {
        if (a.mime.startsWith("video/")) parts.push({ type: "video_url", video_url: { url: a.url, name: a.name, mime: a.mime } });
        else if (a.mime.startsWith("image/")) parts.push({ type: "image_url", image_url: { url: a.url } });
        else parts.push({ type: "text", text: `\n[Anhang: ${a.name} (${a.mime}) — ${a.url}]` });
      }
      return parts;
    };
    // Grafik-Wunsch (/grafik oder „zeichne …“, „mach ein Logo …“): als SVG-Auftrag an die KI.
    const grafikMotif = grafikRequest(text, attachments.length > 0);
    const userContentForAI = buildContent(grafikMotif ? grafikPrompt(grafikMotif) : text);
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);
    // Nicht auf das Speichern warten: die KI-Anfrage startet sofort (spart eine Server-Runde).
    supabase.from("messages").insert({
      conversation_id: convId, role: "user", content: displayContent,
      metadata: attachments.length ? { attachments } : null,
    }).then(({ error }) => { if (error) console.warn("Nachricht nicht gespeichert", error.message); });
    setAttachments([]);

    if (goalText) setGoal({ text: goalText, step: 1, status: "läuft" });
    const history: ApiMsg[] = messages.filter(m => !(m as any).ad).map(toApi);
    history.push({ role: "user", content: userContentForAI });
      if (convId) await runAgent(convId, history, text, goalText);
    } catch (e) {
      console.error(e);
      toast.error("Verbindungsfehler");
    } finally {
      abortRef.current = null;
      sendingRef.current = false;
      setSending(false);
    }
  };

  /** Ein Modell-Aufruf mit Streaming in die letzte (leere) Assistent-Nachricht. null = fehlgeschlagen. */
  const streamOnce = async (apiMessages: ApiMsg[], convId: string, prefix = "", modelOverride?: string): Promise<StreamResult | null> => {
    const chosenModel = (profile as any)?.ai_model as string | undefined;
    const modelForCall = isPuterModel(chosenModel) ? chosenModel : undefined;
    // Bild-Wünsche laufen immer über die Chat-Funktion (dort sitzen Erkennung und Backup-Kette).
    const lastUser = [...apiMessages].reverse().find(m => m.role === "user");
    const lastUserText = typeof lastUser?.content === "string" ? lastUser.content
      : Array.isArray(lastUser?.content) ? (lastUser.content as { type?: string; text?: string }[]).find(p => p.type === "text")?.text ?? "" : "";
    const toChat = false;
    // Bild-Wunsch erkannt: Text vom Sprachmodell erst zeigen, wenn der Server das Bild übernommen hat.
    // Sonst antwortet eine alte Server-Version „nutze /image“, obwohl das Bild trotzdem kommt.
    const hasPicture = Array.isArray(lastUser?.content) && (lastUser.content as { type?: string }[]).some(p => p.type === "image_url");
    const expectImage = false && !hasPicture;
    // Agent mit Werkzeugen & Helfern: im Agent-Modus immer, im General-Modus automatisch bei Recherche
    // oder vielen/gleichartigen Aufgaben (wie Claude). Anhänge (Bilder/Videos) laufen über die Chat-Funktion.
    const hasAttachmentParts = Array.isArray(lastUser?.content) && (lastUser.content as { type?: string }[]).some(p => p.type !== "text");
    const autoAgent = mode === "general" && !hasAttachmentParts && !lastUserText.startsWith("/") && needsAgent(lastUserText);
    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${(mode === "agent" || autoAgent) && !toChat ? "agent" : "chat"}`;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const setLast = (patch: Partial<Msg>) => setMessages(prev => {
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], role: "assistant", ...patch };
      return next;
    });
    const doFetch = () => fetch(fnUrl, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({
        conversationId: convId,
        taskId: taskIdRef.current,
        userId: user?.id,
        personaId: personaId !== "none" ? personaId : undefined,
        model: modelForCall,
        mythos: modelOverride || mythosId,
        messages: apiMessages,
        mode,
      }),
    });

    let full = "", thinking = "";
    let measuredUsage: MythosUsage | undefined;
    let thinkStart = 0, thinkingMs = 0;
    let steps: string[] = [];
    let pendingImage: string | null = null;
    let serverReasons: string[] = [];
    let imageData: GeneratedImage | undefined;
    let musicData: FunkPattern | undefined;
    let agentsData: AgentStatus[] | undefined;
    let videoNotes: { name: string; text: string }[] = [];
    const t0 = Date.now();
    try {
      // Automatisch neu versuchen: 429 (zu viele Anfragen) und kurze Server-Aussetzer (5xx, Zeitlimit, Netz).
      // Passiert still im Hintergrund – der User merkt davon nichts.
      const transient = (st: number) => st === 429 || st >= 500;
      let resp: Response | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        try { resp = await doFetch(); }
        catch (e) { if ((e as Error)?.name === "AbortError") throw e; resp = null; }
        // Token-Limit erreicht ist kein Aussetzer – nicht still wiederholen.
        if (resp && (!transient(resp.status) || resp.headers.get("x-mythos-limit"))) break;
        if (attempt < 3) await new Promise(r => setTimeout(r, [800, 2000, 4000][attempt]));
      }
      if (!resp) throw new Error("Netzwerkfehler");

      if (!resp.ok || !resp.body) {
        if (resp.status === 429 && resp.headers.get("x-mythos-limit")) {
          const info = await resp.json().catch(() => null) as { error?: string } | null;
          const text = info?.error || "Dein MythosAI-Token-Limit ist erreicht. Neue Aufgaben gehen wieder, sobald das Zeitfenster frei wird.";
          setLast({ content: "⏳ " + text });
          toast.error("Limit erreicht", { description: text, action: { label: "Nutzung ansehen", onClick: () => setUsageOpen(true) } });
          return { full: "", thinking: "", aborted: true };
        } else if (resp.status === 429) {
          toast.error("Zu viele Anfragen. Warte kurz und probier's nochmal.");
        } else if (resp.status === 402) {
          // Fallback to NVIDIA OSS model when credits are exhausted
          try {
            // Über den Server – der NVIDIA-Schlüssel ist nie im Browser.
            const asText = (c: unknown) => typeof c === "string" ? c : Array.isArray(c) ? c.map((p: { text?: string }) => p.text || "").join("\n") : "";
            const content = await nvidiaChat(apiMessages.map(m => ({ role: m.role, content: asText(m.content) })));
            setLast({ content });
            return { full: content, thinking: "", aborted: false };
          } catch (e) {
            console.error("Fallback error:", e);
            toast.error(`NVIDIA fallback failed: ${(e as Error)?.message || "unknown"}`);
          }
        } else if (!prefix) {
          toast.error("Fehler beim Senden");
        }
        // Bei einer Fortsetzung die schon geschriebene Antwort nie wegwerfen.
        if (!prefix) setMessages(prev => prev.slice(0, -1));
        return null;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let sawDone = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { sawDone = true; break; }
          try {
            const p = JSON.parse(json);
            if (p.mythos_usage) { measuredUsage = p.mythos_usage; setLast({ metadata: { mythos_usage: measuredUsage } }); continue; }
            if (p.imagePending) { pendingImage = p.imagePending.prompt; setLast({ imagePending: p.imagePending }); continue; }
            if (p.imageFailed) {
              const { prompt, reasons } = p.imageFailed as { prompt: string; reasons?: string[] };
              pendingImage = null; serverReasons = reasons ?? [];
              imageData = { url: "", prompt, reasons: serverReasons.length ? serverReasons : ["Kein Anbieter hat ein Bild geliefert."] };
              setLast({ image: imageData, imagePending: undefined });
              continue;
            }
            if (p.tool) {
              // Werkzeug-Schritte erscheinen als Zeitleiste über der Antwort (wie bei Lovable).
              steps = [...steps, String(p.tool).replace(/^\p{Extended_Pictographic}\s*/u, "")];
              setLast({ steps });
              continue;
            }
            if (p.agents) { agentsData = p.agents; setLast({ agents: p.agents }); continue; }
            if (p.videoAnalysis) { videoNotes = [...videoNotes, p.videoAnalysis]; setLast({ videoNotes }); continue; }
            if (p.search) { setLast({ search: p.search }); continue; }
            if (p.image) { imageData = p.image; pendingImage = null; setLast({ image: p.image, imagePending: undefined }); continue; }
            if (p.music) { musicData = p.music; setLast({ music: p.music }); continue; }
            // Only explicit public work summaries may be displayed, never raw model reasoning.
            const d = p.choices?.[0]?.delta;
            const r = typeof p.activity === "string" ? p.activity : "";
            if (r) {
              if (!thinkStart) thinkStart = Date.now();
              thinking += r; setLast({ thinking });
            }
            const c = d?.content;
            if (c) {
              if (thinkStart && !thinkingMs) { thinkingMs = Date.now() - thinkStart; setLast({ thinkingMs }); }
              full += c;
              if (!expectImage || pendingImage || imageData) setLast({ content: prefix + stitch(prefix, full) });
            }
          } catch { /* Ignore malformed events rather than blocking every later token. */ }
        }
      }
      if (thinkStart && !thinkingMs) { thinkingMs = Date.now() - thinkStart; setLast({ thinkingMs }); }
      // Bild-Wunsch, aber der Server hat nur Text geschickt (alte Server-Version) oder die Verbindung brach ab:
      // den Text verwerfen und das Bild direkt über image-gen holen (gleiche Kette: Nano Banana, dann FLUX).
      if (expectImage && !pendingImage && !imageData) {
        full = "";
        pendingImage = lastUserText.replace(/^\/image\s+/i, "").trim();
        setLast({ content: prefix, imagePending: { prompt: pendingImage } });
      }
      if (pendingImage && !imageData) {
        const prompt = pendingImage;
        const { data, error } = await supabase.functions.invoke("image-gen", { body: { prompt } });
        let body = data as { url?: string; reasons?: string[]; error?: string } | null;
        if (!body && error) body = await (error as { context?: Response }).context?.json?.().catch(() => null) ?? null;
        imageData = body?.url
          ? { url: body.url, prompt }
          : { url: "", prompt, reasons: [...serverReasons, ...(body?.reasons ?? []), ...(body?.reasons?.length ? [] : [body?.error || error?.message || "Kein Anbieter hat ein Bild geliefert."])] };
        setLast({ image: imageData, imagePending: undefined });
      }
      // Stream endete ohne [DONE] (z. B. Zeitlimit der Server-Funktion bei langer Arbeit): als unterbrochen
      // melden – runAgent setzt dann unauffällig an derselben Stelle fort.
      const interrupted = !sawDone && !!full && !imageData && !musicData;
      return { full, image: imageData, music: musicData, agents: agentsData, thinking, thinkingMs, steps, aborted: false, usage: measuredUsage, interrupted, videoNotes: videoNotes.length ? videoNotes : undefined, workMs: Date.now() - t0 };
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        // Gestoppt: was schon da ist, bleibt stehen.
        if (!full && !imageData) { if (!prefix) setMessages(prev => prev.slice(0, -1)); return null; }
        return { full, image: imageData, music: musicData, agents: agentsData, thinking, thinkingMs, steps, aborted: true };
      }
      if (full || imageData) {
        // Verbindung mitten in der Antwort weg: Teilantwort behalten, runAgent macht automatisch weiter.
        return { full, image: imageData, music: musicData, agents: agentsData, thinking, thinkingMs, steps, aborted: false, interrupted: !!full };
      }
      if (prefix) return null; // Fortsetzung fehlgeschlagen: bisherige Antwort bleibt stehen
      setMessages(prev => prev.slice(0, -1));
      throw e;
    }
  };

  /** Welche Connectoren es gerade wirklich gibt – sonst hält sich Mythos an alte Chats oder Erinnerungen (z. B. „nur Higgsfield“). */
  const connectorsHint = () => {
    const states = connectorStates(getMcpServers());
    const line = (s: { name: string; state: string; tools: string[] }) =>
      `- ${s.name}: ${s.state}` + (s.tools.length ? ` (${s.tools.length} Werkzeuge: ${s.tools.slice(0, 15).join(", ")}${s.tools.length > 15 ? ", …" : ""})` : "");
    return "## Deine Connectoren (MCP) – aktueller Stand, nur diese Liste gilt\n" +
      (states.length ? states.map(line).join("\n") : "- Keine Connectoren eingerichtet.") +
      "\nFragt der Nutzer, womit du verbunden bist oder welche MCPs du hast, nenne genau diese Liste mit Stand. " +
      "Was in früheren Nachrichten oder Erinnerungen über Connectoren steht, kann veraltet sein – verlass dich nur hierauf. " +
      "Nicht verbundene Connectoren kannst du nicht benutzen; sag dem Nutzer, dass er sie unter Anpassungen → Connectoren anmelden oder prüfen kann.";
  };

  /** Zusätzliche Hinweise fürs Modell: eigene Anweisungen, Projekt, Werkzeuge und /goal. */
  const buildHints = (
    tools: Awaited<ReturnType<typeof collectTools>>,
    goalNow: { text: string; step: number } | null,
    convId: string,
  ) => {
    const parts: string[] = [];
    const own = getInstructions();
    if (own) parts.push(`## Anweisungen des Nutzers\n${own}`);
    const proj = projectOfChat(convId);
    if (proj?.instructions) parts.push(`## Projekt „${proj.name}"\n${proj.instructions}`);
    if (tools.length) {
      parts.push(
        "## Werkzeuge (Connectoren)\n" +
        "Du kannst diese Werkzeuge selbst benutzen, wenn sie helfen. Für einen Aufruf schreibst du genau einen Block:\n" +
        '<tool_call>{"name": "werkzeug_name", "arguments": { ... }}</tool_call>\n' +
        "und hörst danach sofort auf zu schreiben. Du bekommst dann das Ergebnis und machst weiter. Höchstens ein Aufruf pro Antwort. " +
        "Erfinde keine Ergebnisse.\n\n" +
        tools.map(t => `- ${t.key}: ${(t.tool.description || "").slice(0, 300)}\n  Parameter: ${JSON.stringify(t.tool.inputSchema ?? {}).slice(0, 600)}`).join("\n") +
        "\n\nEs gibt NUR diese Werkzeuge. Erfinde keine anderen (z. B. todo, run, write) – fehlt etwas, sag es dem Nutzer.",
      );
    }
    parts.push(connectorsHint());
    if (!tools.length) {
      parts.push("## Werkzeuge\nIn diesem Chat sind keine Werkzeuge verbunden. Schreibe nie <tool>- oder <tool_call>-Blöcke, sondern antworte direkt als normaler Text.");
    }
    parts.push(FILE_PROMPT);
    parts.push(SMART_UI_PROMPT);
    const status = checklistStatusPrompt(pinnedRef.current, convId);
    if (status) parts.push(status);
    parts.push(capabilitiesPrompt(SLASH_COMMANDS, isAdmin));
    // Modell-/Mythos-Wissen nur mitschicken, wenn es um Mythos selbst geht – hält die Anfrage klein.
    const lastAsk = lastUserTextRef.current.toLowerCase();
    if (/modell|model|mythos|wer bist du|was bist du|wie heißt du|welche ki|amber|spark|bolt|atlas|pebble|aufwand|abo|pro\b|light\b|preis|kostet|kannst du|funktion/.test(lastAsk)) parts.push(identityPrompt(mythosRef.current));
    if (goalNow) {
      parts.push(
        `## /goal-Modus – Schritt ${goalNow.step} von höchstens ${GOAL_MAX_STEPS}\n` +
        `Ziel: ${goalNow.text}\n\n` +
        "Du arbeitest selbstständig wie ein Agent, bis das Ziel vollständig erreicht ist. Regeln:\n" +
        (goalNow.step === 1 ? "- Beginne mit einem kurzen Plan als Checkliste (- [ ] …) und erledige dann direkt den ersten Punkt.\n" : "- Mach mit dem nächsten offenen Punkt deines Plans weiter. Wiederhole nichts, was schon erledigt ist.\n") +
        "- Jede Antwort ist ein echter Arbeitsschritt mit konkretem Ergebnis (Text, Code, Recherche, Werkzeug-Aufruf), nicht nur Ankündigungen.\n" +
        "- Frag nicht nach Erlaubnis und warte nicht auf den Nutzer. Triff sinnvolle Annahmen und nenne sie kurz.\n" +
        "- Ist noch etwas offen, beende die Antwort mit einer Zeile „Als Nächstes: …\".\n" +
        "- Erst wenn das Ziel komplett erreicht ist: kurze Zusammenfassung des Ergebnisses und als allerletzte Zeile genau [ZIEL ERREICHT]",
      );
    }
    return parts.join("\n\n");
  };

  /** Arbeitet so lange weiter, wie Werkzeug-Aufrufe oder ein /goal es verlangen. */
  const runAgent = async (convId: string, history: ApiMsg[], userText: string, goalText?: string) => {
    stopRef.current = false;
    lastUserTextRef.current = userText;
    taskIdRef.current = crypto.randomUUID();
    const servers = getMcpServers().filter(s => s.enabled);
    const tools = servers.length ? await collectTools(servers) : [];
    let step = 1;
    let final = "";
    let badTools = 0;
    let repairs = 0;
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const hints = buildHints(tools, goalText ? { text: goalText, step } : null, convId);
      // Hinweise als eigene System-Nachricht direkt vor der letzten Nutzer-Nachricht – so bleiben Slash-Befehle unverändert.
      const apiMessages = hints && !/^\//.test(userText)
        ? [...history.slice(0, -1), { role: "system", content: hints }, history[history.length - 1]]
        : history;
      let res = await streamOnce(apiMessages, convId);
      // Server meldet „Antwort fehlgeschlagen“ (Modell gerade überlastet o. Ä.): still nochmal versuchen –
      // erst mit demselben Modell, dann mit einem robusten Ausweichmodell derselben Art.
      const FAILED = /^\s*❌ (Antwort fehlgeschlagen|Verbindung zur KI unterbrochen)/;
      const fallbacks = [mythosId, /^code/.test(mythosId) ? "code11:high" : "v1:high"];
      for (let i = 0; res && !res.aborted && !stopRef.current && FAILED.test(res.full) && i < fallbacks.length; i++) {
        await new Promise(r => setTimeout(r, 800 * (i + 1)));
        res = await streamOnce(apiMessages, convId, "", fallbacks[i]);
      }
      if (!res) { if (goalText) setGoal(g => g && { ...g, status: "gestoppt" }); break; }
      // Abgeschnittener Code (offener ```-Block, HTML ohne </html>): automatisch an derselben Stelle weiterschreiben lassen.
      // Auch nach Verbindungsabbruch/Zeitlimit (interrupted) unauffällig weiterschreiben lassen.
      for (let more = 0; more < MAX_CONTINUE && !res.aborted && !stopRef.current && (res.interrupted || looksCut(res.full)); more++) {
        const next = await streamOnce([
          ...apiMessages,
          { role: "assistant", content: res.full },
          { role: "user", content: CONTINUE_PROMPT },
        ], convId, res.full);
        if (!next || !next.full) break;
        res.full = res.full + stitch(res.full, next.full);
        if (next.usage?.measured) res.usage = { measured: true, input_tokens: (res.usage?.input_tokens ?? 0) + (next.usage.input_tokens ?? 0), output_tokens: (res.usage?.output_tokens ?? 0) + (next.usage.output_tokens ?? 0), total_tokens: (res.usage?.total_tokens ?? 0) + (next.usage.total_tokens ?? 0) };
        res.interrupted = next.interrupted;
        if (next.aborted) { res.aborted = true; break; }
      }
      res.full = renameLegacyModels(res.full);
      if (res.full || res.image || res.music) {
        await supabase.from("messages").insert({
          conversation_id: convId, role: "assistant", content: res.full,
          metadata: { workMs: res.steps?.length ? res.workMs : undefined, videoNotes: res.videoNotes, image: res.image, music: res.music, agents: res.agents, thinking: res.thinking || undefined, thinkingMs: res.thinkingMs || undefined, steps: res.steps?.length ? res.steps : undefined, goal: goalText ? step : undefined, mythos_usage: res.usage },
        });
      }
      history.push({ role: "assistant", content: res.full });
      final = res.full;
      if (res.aborted || stopRef.current) { if (goalText) setGoal(g => g && { ...g, status: "gestoppt" }); break; }

      const call = parseToolCall(res.full);
      const entry = call ? tools.find(t => t.key === call.name) : undefined;
      // Erfundenes oder kaputtes Werkzeug: nichts anzeigen, dem Modell still sagen, was es gibt, und neu antworten lassen.
      if (call && !entry) {
        if (++badTools > MAX_BAD_TOOLS) break;
        const fix = (call.name ? `Das Werkzeug „${call.name}" gibt es hier nicht.` : "Dein Werkzeug-Block war ungültig.") +
          (tools.length ? ` Verfügbar sind nur: ${tools.map(t => t.key).join(", ")}.` : " In diesem Chat sind keine Werkzeuge verbunden.") +
          " Schreibe keinen Werkzeug-Block mehr dafür, sondern antworte direkt als Text.";
        // Bestand die Antwort nur aus dem Block, die leere Blase gleich weiterverwenden.
        const keep = forDisplay(res.full).trim() || res.image || res.music;
        setMessages(prev => keep ? [...prev, { role: "assistant", content: "" }] : [...prev.slice(0, -1), { role: "assistant", content: "" }]);
        history.push({ role: "user", content: fix });
        continue;
      }
      if (call && entry) {
        let result: string;
        try {
          result = await callTool(entry.server, entry.tool.name, call.arguments);
        } catch (e) { result = "FEHLER: " + ((e as Error)?.message || "unbekannt"); }
        result = result.slice(0, 12000) || "(leer)";
        const meta = { tool: call.name, args: call.arguments as any };
        setMessages(prev => [...prev, { role: "tool", content: result, metadata: meta }, { role: "assistant", content: "" }]);
        await supabase.from("messages").insert({ conversation_id: convId, role: "tool", content: result, metadata: meta });
        history.push({ role: "user", content: `Ergebnis von Werkzeug ${call.name}:\n${result}` });
        if (stopRef.current) { setMessages(prev => prev.slice(0, -1)); break; }
        continue;
      }

      // Selbst prüfen: Dateien testen (Würfel zählen, HTML starten) – bei Problemen EINE automatische Verbesserungsrunde.
      if (repairs < 1 && /```/.test(res.full)) {
        const problems = await checkAnswer(res.full).catch(() => [] as string[]);
        if (problems.length && !stopRef.current) {
          repairs++;
          const fix = repairPrompt(problems);
          const meta = { auto: true, selfCheck: true };
          setMessages(prev => [...prev, { role: "user", content: fix, metadata: meta }, { role: "assistant", content: "" }]);
          await supabase.from("messages").insert({ conversation_id: convId, role: "user", content: fix, metadata: meta });
          history.push({ role: "user", content: fix });
          continue;
        }
      }

      if (goalText) {
        if (GOAL_DONE.test(res.full)) { setGoal(g => g && { ...g, status: "erreicht" }); toast.success("🎯 Ziel erreicht"); break; }
        if (step >= GOAL_MAX_STEPS) { setGoal(g => g && { ...g, status: "limit" }); break; }
        step++;
        setGoal(g => g && { ...g, step });
        const cont = `Weiter mit Schritt ${step}.`;
        const meta = { auto: true, step };
        setMessages(prev => [...prev, { role: "user", content: cont, metadata: meta }, { role: "assistant", content: "" }]);
        await supabase.from("messages").insert({ conversation_id: convId, role: "user", content: cont, metadata: meta });
        history.push({ role: "user", content: cont });
        continue;
      }
      break;
    }
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
    loadConvs();
    if (!final) return;
    if (adDue(isAdmin ? "admin" : sub.tier)) { const o = window.location.origin; pickAd(o).then(ad => setMessages(prev => [...prev, { role: "assistant", content: adMarkdown(ad, o), ad: true } as any])); }
    supabase.functions.invoke("extract-memory", { body: { text: userText } }).catch(() => {});
    autoTitle(convId, userText, final).catch(() => {});
    if (goalText) return;
    suggestBodyRef.current = { messages: [...history.slice(-6).map(m => ({ role: m.role, content: typeof m.content === "string" ? m.content : userText })), { role: "assistant", content: final }] };
    loadSuggestions();
  };

  const loadSuggestions = () => {
    if (!suggestBodyRef.current) return;
    setSuggestLoading(true);
    supabase.functions.invoke("suggest", { body: suggestBodyRef.current })
      .then(({ data }) => { if (data?.items?.length) setSuggestions(data.items); })
      .catch(() => {})
      .finally(() => setSuggestLoading(false));
  };

  const stop = () => {
    stopRef.current = true;
    abortRef.current?.abort();
    // Wartende Nachrichten bleiben stehen (wie bei Claude) – sie gehen raus, sobald du sie abschickst.
    queuePausedRef.current = true;
  };
  const queuePausedRef = useRef(false);

  useEffect(() => { if (input) setSuggestions([]); }, [input]);
  useEffect(() => { setSuggestions([]); suggestBodyRef.current = null; }, [activeId]);

  const copyMessage = async (text: string) => {
    if (await copyText(text)) toast.success("Kopiert"); else toast.error("Kopieren fehlgeschlagen");
  };

  const exportChat = () => {
    if (!messages.length) { toast.error("Nichts zu exportieren"); return; }
    const conv = convs.find(c => c.id === activeId);
    const md = `# ${conv?.title || "Mythos AI Chat"}\n\n_Exportiert: ${new Date().toLocaleString("de-DE")}_\n\n---\n\n` +
      messages.map(m => `## ${m.role === "user" ? "🧑 Du" : "🤖 Mythos AI"}\n\n${m.content}${m.image ? `\n\n![${m.image.prompt}](${m.image.url})` : ""}`).join("\n\n---\n\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(conv?.title || "chat").replace(/[^a-z0-9]+/gi, "_")}.md`;
    a.click(); URL.revokeObjectURL(url);
  };

  useEffect(() => { sendRef.current = send; });

  // Checklisten im Verlauf nur als Hinweis zeigen – die aktuelle ist unten angeheftet.
  useEffect(() => { smartUIOptions.pinChecklists = true; return () => { smartUIOptions.pinChecklists = false; }; }, []);
  const pinned = useMemo(() => latestChecklist(messages), [messages]);
  const [viewAtt, setViewAtt] = useState<ViewFile | null>(null);
  const [usageOpen, setUsageOpen] = useState(false);
  const chatFiles = useMemo(() => filesOfChat(messages), [messages]);
  const [filesOpen, setFilesOpen] = useState(false);
  const openChatFile = (f: { name: string; content: string; base64: boolean }) => {
    const p = prepareFile(f.name, f.content, f.base64);
    setFilesOpen(false);
    setViewAtt({ name: f.name, content: p.content, base64: f.base64, blob: p.blob, note: p.note });
  };
  const openAttachment = (a: Attachment) => typeof a.text === "string"
    ? setViewAtt({ name: a.name + ".txt", content: a.text, base64: false, blob: new Blob([a.text], { type: "text/plain;charset=utf-8" }), note: `${a.text.split("\n").length} Zeilen` })
    : setViewAtt({ name: a.name, content: "", base64: false, blob: null, url: a.url, mime: a.mime,
    note: a.mime.startsWith("video/") ? "Video" : undefined });
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;

  // Buttons in der intelligenten Oberfläche (```mythos-ui) schicken ihren Text als neue Nachricht.
  useEffect(() => {
    const onSmart = (e: Event) => {
      const t = (e as CustomEvent<string>).detail; if (!t) return;
      // Schreibt Mythos gerade noch, geht der Klick nicht verloren: Er wird direkt danach gesendet.
      if (sendingRef.current || sendingStateRef.current) enqueueRef.current?.(t);
      else sendRef.current?.(t);
    };
    window.addEventListener(SMART_UI_SEND, onSmart);
    return () => window.removeEventListener(SMART_UI_SEND, onSmart);
  }, []);
  const enqueueRef = useRef<((t: string) => void) | null>(null);
  const sendingStateRef = useRef(false);
  sendingStateRef.current = sending;


  // /app?mode=support (Minecraft-Link) stellt den Modus für den neuen Chat ein.
  useEffect(() => {
    const m = searchParams.get("mode");
    if (!m || searchParams.get("q") || chatId || !MODES.some(x => x.value === m)) return;
    setMode(m);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, chatId]);

  // Von der Startseite: /app?q=... schickt die Nachricht direkt in einem neuen Chat ab.
  const startedFromHomeRef = useRef(false);
  useEffect(() => {
    const q = searchParams.get("q");
    if (!q || startedFromHomeRef.current || !user || sub.loading || chatId) return;
    startedFromHomeRef.current = true;
    const m = searchParams.get("mode");
    if (m && MODES.some(x => x.value === m)) setMode(m);
    setSearchParams({}, { replace: true });
    setTimeout(() => sendRef.current?.(q), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user, sub.loading, chatId]);

  useEffect(() => {
    if (!voiceMode || sending) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || !last.content) return;
    if (lastSpokenRef.current === last.content) return;
    lastSpokenRef.current = last.content;
    voice.speak(stripSmartUI(last.content));
  }, [voiceMode, sending, messages, voice]);

  useEffect(() => {
      if (voiceMode) { if (voice.supported) voice.startLive(); }
      else { voice.stopSpeaking(); voice.stopListening(); }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [voiceMode]);
  
    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
      }
    }, [input]);

  useEffect(() => {
    const q = convSearch.trim();
    if (q.length < 2 || !user) { setContentHits(new Set()); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("messages").select("conversation_id")
        .ilike("content", `%${q.replace(/[\\%_]/g, (m) => "\\" + m)}%`).limit(300);
      setContentHits(new Set((data || []).map((m: { conversation_id: string }) => m.conversation_id)));
    }, 300);
    return () => clearTimeout(t);
  }, [convSearch, user]);

  const filteredConvs = convSearch
    ? convs.filter(c => c.title.toLowerCase().includes(convSearch.toLowerCase()) || contentHits.has(c.id))
    : convs;

  const enqueue = (text: string) => { queuePausedRef.current = false; setQueue((q) => [...q, { id: Math.random().toString(36).slice(2), text, chat: activeId }]); };
  enqueueRef.current = enqueue;
  const myQueue = queue.filter((q) => q.chat === activeId);
  // Warteschlange abarbeiten, sobald die aktuelle Antwort wirklich fertig ist (inkl. Selbstprüfung).
  // Kurz warten und erst dann nehmen: so geht nichts verloren, wenn direkt danach noch etwas läuft.
  const [queueTick, setQueueTick] = useState(0);
  useEffect(() => {
    if (sending || queuePausedRef.current || loadingChat) return;
    const next = queue.find((q) => q.chat === activeId);
    if (!next) return;
    const t = setTimeout(() => {
      if (sendingRef.current) { setQueueTick((n) => n + 1); return; }
      setQueue((q) => q.filter((x) => x.id !== next.id));
      void send(next.text);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending, queue, activeId, queueTick, loadingChat]);

  const submitOrQueue = () => {
    const text = input.trim();
    if (!text) return;
    if (sending) { enqueue(text); setInput(""); return; }
    queuePausedRef.current = false;
    send();
  };

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Account";

  const activeProject = projects.find(p => p.id === projectId) || null;
  const sidebarConvs = activeProject ? filteredConvs.filter(c => activeProject.chatIds.includes(c.id)) : filteredConvs;

  const NavItem = ({ icon: Icon, label, onClick, badge, active }: { icon: typeof Plus; label: string; onClick: () => void; badge?: string; active?: boolean }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-[15px] text-left transition-colors ${active ? "bg-white/10" : "hover:bg-white/5"} text-foreground/90`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0 text-foreground/80" />
      <span className="truncate">{label}</span>
      {badge && <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] text-foreground/70">{badge}</span>}
    </button>
  );

  // Handy: die ganze Seitenleiste scrollt als ein Stück (Kopf, Menü und Chats zusammen).
  // Desktop: Kopf und Menü bleiben stehen, nur die Chat-Liste scrollt.
  const SidebarContentBlock = (
    <div className="block md:flex md:flex-col h-full min-h-0 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] md:overflow-hidden">
      {/* Kopfzeile wie bei Claude: einklappen, zurück/vor, Chat/Code */}
      <div className="flex items-center gap-0.5 pl-2 pr-10 md:pr-2 pt-2 pb-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 hidden md:inline-flex" onClick={() => setSidebarCollapsed(true)} aria-label="Seitenleiste einklappen">
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Seitenleiste einklappen</TooltipContent>
        </Tooltip>
        <Link to="/" className="md:hidden flex items-center px-1 whitespace-nowrap shrink-0" aria-label="Startseite"><LogoMark size="sm" /></Link>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => nav(-1)} aria-label="Zurück"><ArrowLeft className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => nav(1)} aria-label="Vor"><ArrowRight className="h-4 w-4 opacity-60" /></Button>
        <div className="ml-auto flex items-center rounded-xl bg-white/5 p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex h-7 w-8 items-center justify-center rounded-lg bg-white/10"><MessageSquare className="h-4 w-4" /></span>
            </TooltipTrigger>
            <TooltipContent side="bottom">Chat</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => nav("/code")} className="flex h-7 w-8 items-center justify-center rounded-lg text-foreground/60 hover:text-foreground" aria-label="Code">
                <Code2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Mythos Code</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Suchen */}
      <div className="px-2 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            ref={searchRef}
            value={convSearch}
            onChange={(e) => setConvSearch(e.target.value)}
            placeholder="Suchen (Strg+K)"
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-2 py-2 text-[15px] placeholder:text-muted-foreground focus:outline-none focus:border-white/25"
          />
        </div>
      </div>

      {/* Hauptmenü */}
      <div className="px-2 space-y-0.5">
        <button onClick={() => { setProjectId(null); newChat(); }} className="w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-[15px] text-left hover:bg-white/5">
          <span className="flex h-[22px] w-[22px] -ml-0.5 items-center justify-center rounded-full bg-white/10"><Plus className="h-3.5 w-3.5" /></span>
          <span>Neu</span>
        </button>
        <NavItem icon={FolderOpen} label="Projekte" onClick={() => setDialog("projects")} active={!!activeProject} />
        <NavItem icon={AppWindow} label="App-Builder" onClick={() => nav("/build")} badge="Neu" />
        <NavItem icon={Shapes} label="Artifacts" onClick={() => setDialog("artifacts")} />
        <NavItem icon={Clock} label="Routinen" onClick={() => nav("/agents")} />
        <NavItem icon={Briefcase} label="Anpassungen" onClick={() => setDialog("customize")} />
        <NavItem icon={Globe2} label="Welt-Modus" onClick={() => nav("/welt")} />
        <NavItem icon={Monitor} label="Cloud-PC" onClick={() => nav("/cloud-pc")} badge="Neu" />
        <NavItem icon={Clapperboard} label="Filmstudio" onClick={() => nav("/filmstudio")} badge="Neu" />
        <NavItem icon={Compass} label="Entdecken" onClick={() => nav("/entdecken")} badge="Neu" />
      </div>

      {/* Chats */}
      <div className="px-4 pt-5 pb-1 flex items-center gap-1 text-[13px] text-muted-foreground">
        {activeProject ? (
          <>
            <button onClick={() => setProjectId(null)} className="hover:text-foreground">Chats</button>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="truncate text-foreground/80">{activeProject.name}</span>
          </>
        ) : <span>Chats</span>}
      </div>
      <div className="flex-1 px-2 md:min-h-0 md:overflow-y-auto">
        <div className="space-y-0.5 pb-2">
          {!convsLoaded && Array.from({ length: 9 }).map((_, i) => <div key={i} className="mx-2.5 my-2 h-4 rounded-full bg-white/[0.06] animate-pulse" style={{ width: `${55 + ((i * 37) % 40)}%` }} />)}
          {convsLoaded && sidebarConvs.length === 0 && (
            <p className="text-xs text-muted-foreground p-3 text-center">
              {convSearch ? "Keine Treffer" : activeProject ? "Noch keine Chats in diesem Projekt – klick auf „Neu“." : "Noch keine Chats"}
            </p>
          )}
          {sidebarConvs.map(c => (
            <div
              key={c.id}
              className={`group flex items-center gap-2 rounded-lg pl-3 pr-1 py-2 text-sm cursor-pointer transition-colors ${
                activeId === c.id ? "bg-white/10 text-foreground" : "hover:bg-white/5 text-foreground/80"
              }`}
              onClick={() => renaming?.id !== c.id && openChat(c.id)}
            >
              {renaming?.id === c.id ? (
                <input
                  autoFocus
                  value={renaming.value}
                  maxLength={80}
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenaming({ id: c.id, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameChat(c.id, renaming.value);
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  onBlur={() => renameChat(c.id, renaming.value)}
                  className="flex-1 min-w-0 bg-white/10 rounded px-1.5 py-0.5 text-sm outline-none ring-1 ring-primary/50"
                  aria-label="Neuer Chatname"
                />
              ) : (
                <span className="truncate flex-1" onDoubleClick={(e) => { e.stopPropagation(); setRenaming({ id: c.id, value: c.title }); }}>{c.title}</span>
              )}
              {renaming?.id !== c.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
                      aria-label="Chat-Optionen"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onSelect={() => setTimeout(() => setRenaming({ id: c.id, value: c.title }), 0)}>
                      <Pencil className="h-4 w-4 mr-2" /> Umbenennen
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setConfirmDelete(c)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> Löschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* User footer – auf dem Handy unten angeheftet */}
      <div className="sticky bottom-0 z-10 bg-sidebar border-t border-white/5 p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2 rounded-lg hover:bg-white/5 p-2 transition-colors">
              <MinecraftAvatar username={profile?.mc_username} fallback={displayName} size={32} />
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium truncate">{profile?.mc_username || displayName}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {sub.tier === "pro" ? "✨ Pro" : sub.tier === "light" ? "· Light" : "Free"}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="glass-strong w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground truncate">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setUsageOpen(true)}><BarChart3 className="h-4 w-4 mr-2" /> Nutzung</DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav("/dashboard")}><Key className="h-4 w-4 mr-2" /> Dashboard</DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav("/dashboard?tab=profile")}><UserIcon className="h-4 w-4 mr-2" /> Profil & Skin</DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav("/memories")}><Brain className="h-4 w-4 mr-2" /> Memories</DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav("/personas")}><Drama className="h-4 w-4 mr-2" /> Personas</DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav("/twin")}><Crown className="h-4 w-4 mr-2 text-fuchsia-400" /> AI Twin <span className="ml-auto text-[9px] uppercase text-fuchsia-400">Pro</span></DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav("/games")}><Gamepad2 className="h-4 w-4 mr-2 text-fuchsia-400" /> Game Coder <span className="ml-auto text-[9px] uppercase text-fuchsia-400">Pro</span></DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav("/agents")}><Bot className="h-4 w-4 mr-2" /> Auto-Agents</DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav("/raeume")}><Users className="h-4 w-4 mr-2" /> Gemeinsame Räume</DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav("/analytics")}><BarChart3 className="h-4 w-4 mr-2" /> Analytics</DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav("/mc-servers")}><Server className="h-4 w-4 mr-2" /> Minecraft-Server</DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav("/redeem")}><Ticket className="h-4 w-4 mr-2" /> Boost Code einlösen</DropdownMenuItem>
            {isAdmin && <DropdownMenuItem onClick={() => nav("/admin")}><Shield className="h-4 w-4 mr-2" /> Admin</DropdownMenuItem>}
            <DropdownMenuSeparator />
            {sub.tier === "free" && (
              <DropdownMenuItem onClick={() => setPaywall({ open: true, reason: "Upgrade auf Pro für alle Features." })}>
                <Crown className="h-4 w-4 mr-2 text-fuchsia-400" /> Auf Pro upgraden
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={async () => { await signOut(); nav("/"); }}>
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  // Live-Vorschau: neuestes Ergebnis (HTML/SVG/bbmodel) läuft rechts neben dem Chat.
  const preview = useMemo(() => latestPreview(messages as any), [messages]);
  const [previewHidden, setPreviewHidden] = useState<string | null>(null);
  const [previewOn, setPreviewOn] = useState(true);
  const showPreview = !!preview && previewOn && previewHidden !== preview.key;
  useEffect(() => { if (preview && previewHidden && previewHidden !== preview.key) setPreviewHidden(null); }, [preview?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // Tastenkürzel: Strg+K Suche, Strg+Umschalt+O neuer Chat, Strg+. Vorschau an/aus, Esc schließt Vorschau
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setSidebarCollapsed(false); setTimeout(() => searchRef.current?.focus(), 50); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === "o") { e.preventDefault(); newChat(); }
      else if (mod && e.key === ".") { e.preventDefault(); if (preview) { if (showPreview) setPreviewHidden(preview.key); else { setPreviewHidden(null); setPreviewOn(true); } } }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-[100dvh] flex overflow-hidden bg-background">
        {/* Desktop sidebar */}
        <aside
          className={`hidden md:flex shrink-0 flex-col h-full transition-[width] duration-200 ease-out border-r border-white/5 bg-sidebar text-sidebar-foreground ${
            sidebarCollapsed ? "w-0" : "w-[260px]"
          } overflow-hidden`}
        >
          <div className="w-[260px] h-full">{SidebarContentBlock}</div>
        </aside>

        {/* Mobile sidebar */}
        <Sheet open={mobileSidebar} onOpenChange={setMobileSidebar}>
          <SheetContent
            side="left"
            className="w-[280px] p-0 bg-sidebar text-sidebar-foreground border-r border-white/5 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          >
            {SidebarContentBlock}
          </SheetContent>
        </Sheet>

        {/* Main column */}
        <main
          className="relative flex-1 min-w-0 flex flex-col h-full"
          onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
          onDrop={(e) => {
            if (!e.dataTransfer.files.length) return;
            e.preventDefault(); setDragging(false);
            uploadFiles(e.dataTransfer.files);
          }}
        >
          {dragging && (
            <div className="pointer-events-none absolute inset-2 z-50 flex items-center justify-center rounded-3xl border-2 border-dashed border-violet-400/70 bg-background/70 backdrop-blur-sm">
              <div className="glass-strong rounded-2xl px-6 py-4 text-sm">⬇ Dateien oder Bilder hier ablegen</div>
            </div>
          )}
          {/* Top bar */}
          <header className="shrink-0 flex items-center gap-1 sm:gap-2 px-2 sm:px-3 h-14 border-b border-white/5 pt-[env(safe-area-inset-top)]">
            {/* Sidebar toggle */}
            <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" onClick={() => setMobileSidebar(true)} aria-label="Sidebar öffnen">
              <Menu className="h-5 w-5" />
            </Button>
            {sidebarCollapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="hidden md:inline-flex h-9 w-9" onClick={() => setSidebarCollapsed(false)} aria-label="Sidebar öffnen">
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Sidebar öffnen</TooltipContent>
              </Tooltip>
            )}
            {sidebarCollapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="hidden md:inline-flex h-9 w-9" onClick={newChat} aria-label="Neuer Chat">
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Neuer Chat</TooltipContent>
              </Tooltip>
            )}

            {/* Model + effort in one */}
            <ModelPicker
              value={mythosId}
              tier={sub.tier}
              onChange={setMythosId}
              onLocked={(reason) => setPaywall({ open: true, reason })}
            />


            <div className="flex-1" />

            {personas.length > 0 && (
              <Select value={personaId} onValueChange={setPersonaId}>
                <SelectTrigger className="w-[130px] sm:w-[160px] h-9 text-xs border-white/10 bg-white/5">
                  <Drama className="h-3.5 w-3.5 mr-1" />
                  <SelectValue placeholder="Persona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none"><span className="text-muted-foreground">Standard</span></SelectItem>
                  {personas.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-1.5">{p.avatar_emoji || "🎭"} {p.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost" size="icon" className="h-9 w-9"
                  onClick={() => { if (sub.canUseVoice) nav(activeId ? `/voice?c=${activeId}` : "/voice"); else setPaywall({ open: true, reason: "Live-Anrufe mit Mythos sind eine Pro-Funktion." }); }}
                  aria-label="Mythos anrufen"
                >
                  <Phone className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Mythos anrufen</TooltipContent>
            </Tooltip>

            {voice.supported && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className={`h-9 w-9 ${voiceMode ? "text-foreground bg-white/10" : ""}`}
                    onClick={() => { voice.prepare(); setVoiceMode(v => !v); }}
                    aria-label="Voice-Modus umschalten"
                  >
                    {voiceMode ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{voiceMode ? "Voice-Modus aus" : "Voice-Modus an"}</TooltipContent>
              </Tooltip>
            )}

            {chatFiles.length > 0 && (
              <div className="relative">
                <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2.5" onClick={() => setFilesOpen(o => !o)} aria-label="Dateien in diesem Chat" title="Alle Dateien in diesem Chat">
                  <Paperclip className="h-4 w-4" /><span className="text-xs tabular-nums">{chatFiles.length}</span>
                </Button>
                {filesOpen && (
                  <div className="absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
                    <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">Dateien in diesem Chat</div>
                    <div className="max-h-80 overflow-y-auto p-1">
                      {chatFiles.slice().reverse().map((f) => (
                        <button key={f.name} type="button" onClick={() => openChatFile(f)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted">
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{f.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {messages.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={exportChat} aria-label="Chat exportieren">
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Als Markdown exportieren</TooltipContent>
              </Tooltip>
            )}
          </header>

          {goal && (
            <div className="shrink-0 border-b border-violet-400/15 bg-violet-500/[0.06] animate-fade-in">
              <div className="max-w-3xl mx-auto flex items-center gap-2 px-3 sm:px-6 py-2 text-sm">
                <Target className="h-4 w-4 text-violet-300 shrink-0" />
                <span className="truncate flex-1"><span className="text-muted-foreground">Ziel: </span>{goal.text}</span>
                <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1.5">
                  {goal.status === "läuft" && <><Loader2 className="h-3 w-3 animate-spin" /> Schritt {goal.step}</>}
                  {goal.status === "erreicht" && <span className="text-emerald-400">✓ Erreicht nach {goal.step} {goal.step === 1 ? "Schritt" : "Schritten"}</span>}
                  {goal.status === "gestoppt" && "Gestoppt"}
                  {goal.status === "limit" && `Pause nach ${GOAL_MAX_STEPS} Schritten`}
                </span>
                {goal.status === "läuft" ? (
                  <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs border-white/15" onClick={stop}>
                    <Square className="h-3 w-3 mr-1 fill-current" /> Stopp
                  </Button>
                ) : (
                  <>
                    {(goal.status === "gestoppt" || goal.status === "limit") && !sending && (
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs border-white/15" onClick={() => send(`/goal ${goal.text}`)}>Weitermachen</Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setGoal(null)} aria-label="Ziel ausblenden"><XIcon className="h-3.5 w-3.5" /></Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} onScroll={() => { const box = scrollRef.current; if (box) followRef.current = shouldFollowChat(box.scrollTop, box.scrollHeight, box.clientHeight); }} className="flex-1 overflow-y-auto min-h-0">
            {messages.length === 0 && (loadingChat || (chatId && activeId !== chatId)) ? (
              <ChatSkeleton />
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-4">
                <div className="mb-6"><Logo size="lg" /></div>
                <h1 className="font-display text-3xl md:text-4xl text-center mb-2 gradient-text">Womit kann ich helfen?</h1>
                <p className="text-muted-foreground text-sm text-center max-w-md mb-8">
                  Frag mich alles. Tippe <code className="font-mono bg-white/5 px-1.5 py-0.5 rounded text-[11px]">/</code> für alle Commands.
                </p>
                <StarterPrompts titles={convs.map(c => c.title)} onPick={setInput} />
              </div>
            ) : (
              <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 space-y-6">
                {messages.map((m, i) => (
                  <div key={i} className="animate-fade-in">
                    {(i === 0 || dayKey(messages[i - 1].created_at) !== dayKey(m.created_at)) && (
                      <DayDivider label={dayLabel(m.created_at)} />
                    )}
                    {m.role === "user" && m.metadata?.selfCheck ? (
                      <div className="not-prose">
                        <TimelineRow label="Ergebnis geprüft – verbessere" detail="Was die Prüfung gefunden hat">
                          <div className="whitespace-pre-wrap text-foreground/80">{m.content.replace(/^🔧 Automatische Prüfung hat Probleme gefunden:\n/, "").replace(/\n\nBitte behebe[\s\S]*$/, "")}</div>
                        </TimelineRow>
                      </div>
                    ) : m.role === "user" && m.metadata?.auto ? (
                      <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                        <div className="h-px flex-1 bg-white/10" />
                        <span className="flex items-center gap-1.5"><Target className="h-3 w-3 text-violet-300" /> Schritt {m.metadata.step}</span>
                        <div className="h-px flex-1 bg-white/10" />
                      </div>
                    ) : m.role === "tool" ? (
                      <div className="not-prose">
                        <TimelineRow label="Werkzeug benutzt" detail={m.metadata?.tool}>
                          {m.metadata?.args && <pre className="mb-2 whitespace-pre-wrap break-all text-muted-foreground">{JSON.stringify(m.metadata.args, null, 2)}</pre>}
                          <div className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words text-foreground/80">{m.content}</div>
                        </TimelineRow>
                      </div>
                    ) : m.role === "user" ? (
                      <div className="flex flex-col items-end gap-1.5">
                        {m.attachments && m.attachments.length > 0 && (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {m.attachments.map((a, j) => a.mime.startsWith("video/")
                              ? <button key={j} type="button" onClick={() => openAttachment(a)} title="Video ansehen" className="relative h-20 w-32 overflow-hidden rounded-xl border border-white/10 bg-black">
                                  <video src={a.url + "#t=0.5"} preload="metadata" muted playsInline className="h-full w-full object-cover" />
                                  <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white text-lg">▶</span>
                                  <span className="absolute bottom-1 left-1 max-w-[90%] truncate rounded bg-black/70 px-1.5 text-[10px] text-white">{a.name}</span>
                                </button>
                              : a.mime.startsWith("image/")
                              ? <button key={j} type="button" onClick={() => openAttachment(a)} title="Ansehen"><img src={a.url} alt={a.name} className="h-20 w-20 rounded-xl object-cover border border-white/10" loading="lazy" /></button>
                              : <button key={j} type="button" onClick={() => openAttachment(a)} title="Ansehen" className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"><Paperclip className="h-3 w-3" />{a.name}</button>)}
                          </div>
                        )}
                        <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-white/[0.08] text-foreground">
                          <p className="text-[15px] whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{relTime(m.created_at)}</span>
                      </div>
                    ) : (
                      <div>
                        <div className="min-w-0">
                          <div className="prose-mythos text-[15px] break-words">
                            {m.agents && m.agents.length > 0 && (
                              <div className="not-prose mb-3 rounded-xl border border-violet-400/20 bg-violet-500/5 px-3 py-2 text-xs">
                                <div className="mb-1 font-semibold text-violet-300">🧩 Multi-Agent: {m.agents.length} Agenten parallel</div>
                                {m.agents.map(a => (
                                  <div key={a.i} className="flex items-center gap-2 py-0.5">
                                    <span className="w-4 text-center">{a.status === "fertig" ? "✓" : a.status === "fehler" ? "⚠" : <Loader2 className="inline h-3 w-3 animate-spin" />}</span>
                                    <span className="flex-1 truncate text-foreground/90">Agent {a.i + 1}: {a.title}</span>
                                    {a.phase && <span className="max-w-[45%] truncate text-muted-foreground">{a.phase}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {m.thinking && (
                              <ThinkingBlock ms={m.thinkingMs} live={!m.content && sending && i === messages.length - 1} />
                            )}
                            {m.steps && m.steps.length > 0 && <StepsTimeline steps={m.steps} live={sending && i === messages.length - 1} ms={m.metadata?.workMs} />}
                            {m.videoNotes?.map((v, k) => (
                              <div key={k} className="not-prose mb-3">
                                <TimelineRow label={`Video angesehen: ${v.name}`} detail="Was Mythos gesehen hat">
                                  <div className="prose-mythos max-h-96 overflow-y-auto text-[13px]"><MarkdownMessage content={v.text} /></div>
                                </TimelineRow>
                              </div>
                            ))}
                            {m.search && m.content && (
                              <div className="not-prose mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-muted-foreground">
                                <Globe className="h-3 w-3" /> Im Internet gesucht: <span className="text-foreground/80">{m.search}</span>
                              </div>
                            )}
                            {m.content ? (
                              <>
                                <MarkdownMessage content={forDisplay(m.content)} />
                                {GOAL_DONE.test(m.content) && (
                                  <div className="not-prose mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                                    <Target className="h-3 w-3" /> Ziel erreicht
                                  </div>
                                )}
                              </>
                            ) : !m.image && !m.imagePending && !m.music && !m.song && !m.video && !m.agent && !m.ext ? (
                              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                {m.search ? (
                                  <span className="flex items-center gap-1.5">
                                    <Globe className="h-3.5 w-3.5 animate-pulse" />
                                    Suche im Internet nach <span className="text-foreground/80">„{m.search}"</span>…
                                  </span>
                                ) : (
                                  <span className="mythos-shimmer">Denkt nach…</span>
                                )}
                              </div>
                            ) : null}
                            {(m.image || m.imagePending) && <ImageGeneration image={m.image} pending={m.imagePending} />}
                            {m.music && <FunkPlayer pattern={m.music} />}
                            {m.song && <SongPlayer request={m.song} />}
                            {m.video && <VideoPlayer request={m.video} />}
                            {m.ext && <BrowserExtensionPanel initialTask={m.ext.task || undefined} />}
                            {m.agent && (
                              <AgentBrowser
                                task={m.agent.task}
                                onDone={(ans) => {
                                  if (!ans) return;
                                  supabase.from("messages").insert({
                                    conversation_id: activeId,
                                    role: "assistant",
                                    content: ans,
                                    metadata: { agentAnswer: true },
                                  });
                                }}
                              />
                            )}
                          </div>
                          {m.metadata?.mythos_usage && <div className="mt-2 text-xs text-muted-foreground">{m.metadata.mythos_usage.measured ? `${Number(m.metadata.mythos_usage.total_tokens).toLocaleString("de-DE")} MythosAI Tokens · ${Number(m.metadata.mythos_usage.input_tokens).toLocaleString("de-DE")} Eingabe · ${Number(m.metadata.mythos_usage.output_tokens).toLocaleString("de-DE")} Ausgabe` : "MythosAI Tokens: Anbieterwerte nicht verfügbar"}</div>}
                          {forDisplay(m.content) && !(sending && i === messages.length - 1) && (
                            <div className="flex items-center gap-0.5 mt-2 -ml-1.5 text-muted-foreground">
                              <span className="px-1.5 text-xs">{relTime(m.created_at)}</span>
                              <button onClick={() => copyMessage(stripSmartUI(forDisplay(m.content)))} title="Kopieren" className="p-1.5 rounded-md hover:bg-white/5">
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              {voice.supported && (
                                <button
                                  onClick={() => { if (voice.status === "speaking") voice.stopSpeaking(); else { voice.prepare(); voice.speak(stripSmartUI(m.content)); } }}
                                  title={voice.status === "speaking" ? "Stop" : "Vorlesen"}
                                  className="p-1.5 rounded-md hover:bg-white/5"
                                >
                                  {voice.status === "speaking" ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                                </button>
                              )}
                              {!(m as { ad?: boolean }).ad && (
                                <FeedbackButtons messageId={m.id} answer={stripSmartUI(forDisplay(m.content))}
                                  question={[...messages.slice(0, i)].reverse().find(x => x.role === "user")?.content || ""} />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="shrink-0 px-3 sm:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
            <div className="max-w-3xl mx-auto">
              {voiceMode && (voice.status === "listening" || voice.status === "speaking") && (
                <div className="flex items-center justify-center gap-2 mb-2 text-xs text-foreground/70 animate-fade-in">
                  <span className="relative h-12 w-12 shrink-0">
                    <LogoOrb status={voice.status} getLevel={() => (voice.status === "speaking" ? voice.speechLevel() : 0.25)} />
                  </span>
                  <span>
                    {voice.status === "speaking" ? "🔊 spricht..." : voice.interim || "👂 höre zu... (sprich einfach drauf los)"}
                  </span>
                </div>
              )}

              {myQueue.length > 0 && (
                <div className="mb-2 rounded-2xl border border-border bg-muted/30 p-2" role="status" aria-live="polite">
                  <div className="px-1.5 pb-1 text-[11px] text-muted-foreground">
                    {sending ? `Wartet – wird gesendet, sobald Mythos fertig ist` : queuePausedRef.current ? "Gestoppt – wartende Nachrichten" : "Wird gleich gesendet …"}
                  </div>
                  {myQueue.map((q) => (
                    <div key={q.id} className="group flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-white/5">
                      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground/90" title={q.text}>{q.text}</span>
                      <button onClick={() => { setQueue((prev) => prev.filter((x) => x.id !== q.id)); setInput(q.text); }} className="rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-white/10 hover:text-foreground" title="Zurück ins Eingabefeld holen">Bearbeiten</button>
                      <button onClick={() => setQueue((prev) => prev.filter((x) => x.id !== q.id))} className="rounded-md p-1 text-muted-foreground hover:bg-white/10 hover:text-destructive" aria-label="Aus Warteschlange entfernen"><XIcon className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                  {!sending && queuePausedRef.current && (
                    <button onClick={() => { queuePausedRef.current = false; setQueueTick((n) => n + 1); }} className="mt-1 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted">Jetzt abschicken</button>
                  )}
                </div>
              )}

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs">
                      <button type="button" onClick={() => openAttachment(a)} className="flex items-center gap-1.5" title="Ansehen">
                        {a.mime.startsWith("video/") ? <span className="flex h-5 w-7 items-center justify-center rounded bg-black text-[10px] text-white">▶</span>
                          : a.mime.startsWith("image/") ? <img src={a.url} alt={a.name} className="h-5 w-5 rounded object-cover" />
                          : <Paperclip className="h-3 w-3" />}
                        <span className="max-w-[120px] truncate">{a.name}</span>
                      </button>
                      <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} aria-label="Entfernen">
                        <XIcon className="h-3 w-3 hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {input.startsWith("/") && (() => {
                const q = input.slice(1).split(/\s/)[0].toLowerCase();
                const filtered = SLASH_COMMANDS.filter(c => c.cmd.slice(1).startsWith(q) && (!("admin" in c) || isAdmin));
                if (!filtered.length) return null;
                const pick = (cmd: string, args: string) => {
                  setInput(args ? `${cmd} ` : cmd + " ");
                  setSlashIndex(0);
                };
                return (
                  <div className="glass-strong rounded-2xl p-1.5 mb-2 max-h-64 overflow-y-auto animate-fade-in">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1 flex items-center justify-between">
                      <span>Commands</span>
                      <span className="text-[9px]">↑↓ Tab ↵</span>
                    </div>
                    {filtered.map((c, i) => {
                      const Icon = c.icon;
                      const active = i === Math.min(slashIndex, filtered.length - 1);
                      return (
                        <button
                          key={c.cmd}
                          onMouseEnter={() => setSlashIndex(i)}
                          onClick={() => pick(c.cmd, c.args)}
                          className={`w-full flex items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition-colors ${active ? "bg-white/10" : "hover:bg-white/5"}`}
                        >
                          <Icon className="h-3.5 w-3.5 text-foreground/80 shrink-0" />
                          <span className="font-mono font-semibold">{c.cmd}</span>
                          {c.args && <span className="text-muted-foreground font-mono">{c.args}</span>}
                          <span className="text-muted-foreground truncate ml-auto hidden sm:inline">{c.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              <input
                ref={fileInputRef} type="file" multiple hidden
                accept="image/*,video/*,.pdf,.txt,.md,.json,.csv"
                onChange={(e) => { uploadFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              />

              <SuggestionBar
                items={sending || loadingChat || (chatId && activeId !== chatId) ? [] : suggestions}
                onPick={(s) => { setSuggestions([]); send(s); }}
                onRefresh={loadSuggestions}
                refreshing={suggestLoading}
                onClose={() => setSuggestions([])}
              />

              {pinned && <PinnedChecklist list={pinned} convId={activeId} />}
              <FileViewer file={viewAtt} onClose={() => setViewAtt(null)} />
              <UsageDialog open={usageOpen} onOpenChange={setUsageOpen} />

              <div className="rounded-lg border border-input bg-card focus-within:border-ring transition-colors">
                <Textarea ref={textareaRef}
                  value={input}
                  onPaste={(e) => {
                    // Bilder/Dateien aus der Zwischenablage (Strg+V) direkt anhängen.
                    if (e.clipboardData.files.length) { e.preventDefault(); uploadFiles(e.clipboardData.files); return; }
                    // Lange Texte nicht ins Feld kippen, sondern als Anhang – Platzhalter an der Einfügestelle.
                    const t = e.clipboardData.getData("text/plain");
                    if (!t || (t.length < 1500 && t.split("\n").length < 30)) return;
                    e.preventDefault();
                    const n = attachments.filter(a => typeof a.text === "string").length + 1;
                    const name = `Eingefügt #${n}`;
                    setAttachments(prev => [...prev, { url: "", name, mime: "text/plain", text: t }]);
                    const el = e.currentTarget, a0 = el.selectionStart ?? input.length, b0 = el.selectionEnd ?? input.length;
                    const tag = `[${name}]`;
                    setInput(input.slice(0, a0) + tag + input.slice(b0));
                    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = a0 + tag.length; });
                  }}
                  onChange={(e) => { setInput(e.target.value); setSlashIndex(0); }}
                  onKeyDown={(e) => {
                    if (input.startsWith("/")) {
                      const q = input.slice(1).split(/\s/)[0].toLowerCase();
                      const filtered = SLASH_COMMANDS.filter(c => c.cmd.slice(1).startsWith(q) && (!("admin" in c) || isAdmin));
                      if (filtered.length && !input.includes(" ")) {
                        if (e.key === "ArrowDown") { e.preventDefault(); setSlashIndex(i => (i + 1) % filtered.length); return; }
                        if (e.key === "ArrowUp")   { e.preventDefault(); setSlashIndex(i => (i - 1 + filtered.length) % filtered.length); return; }
                        if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
                          e.preventDefault();
                          const c = filtered[Math.min(slashIndex, filtered.length - 1)];
                          setInput(c.args ? `${c.cmd} ` : c.cmd + " ");
                          setSlashIndex(0);
                          return;
                        }
                      }
                    }
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitOrQueue(); }
                  }}
                  placeholder={
                    sending ? "Nachricht schreiben – wartet und geht raus, sobald Mythos fertig ist" :
                    voiceMode ? "Tippe oder drücke das Mikro..." :
                    mode === "support" ? "Frage Mythos AI…" :
                    mode === "agent" ? "Was soll der Agent tun?" : "Frag mich alles…"
                  }
                  className="min-h-[52px] max-h-[200px] overflow-y-auto resize-none border-0 bg-transparent focus-visible:ring-0 text-[16px] px-5 pt-4 pb-1 shadow-none placeholder:text-muted-foreground/70"
                />
                {/* Aktionszeile wie bei Lovable: + · … · Modus links, Mikro und Senden rechts */}
                <div className="flex items-center gap-2 px-3 pb-3 pt-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading || sending}
                        aria-label="Datei anhängen"
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-40 transition-colors"
                      >
                        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Datei oder Bild anhängen</TooltipContent>
                  </Tooltip>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label="Mehr" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] transition-colors">
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className="w-60">
                      <DropdownMenuLabel>Erstellen</DropdownMenuLabel>
                      {[
                        { cmd: "/grafik ", label: "Grafik zeichnen", icon: ImageIcon },
                        { cmd: "/music ", label: "Song mit Gesang", icon: Music },
                        { cmd: "/video ", label: "Kurzes Video", icon: Film },
                        { cmd: "/goal ", label: "Ziel selbstständig erledigen", icon: Target },
                        { cmd: "/research ", label: "Im Internet recherchieren", icon: Globe },
                      ].map(({ cmd, label, icon: Icon }) => (
                        <DropdownMenuItem key={cmd} onClick={() => { setInput(cmd); setTimeout(() => textareaRef.current?.focus(), 0); }}>
                          <Icon className="h-4 w-4 mr-2" /> {label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { if (sub.canUseVoice) nav(activeId ? `/voice?c=${activeId}` : "/voice"); else setPaywall({ open: true, reason: "Live-Anrufe mit Mythos sind eine Pro-Funktion." }); }}>
                        <Phone className="h-4 w-4 mr-2" /> Mythos anrufen
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setInput("/"); setTimeout(() => textareaRef.current?.focus(), 0); }}>
                        <Code2 className="h-4 w-4 mr-2" /> Alle Befehle
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Select value={mode} onValueChange={setMode}>
                    <SelectTrigger className="h-11 w-auto gap-1.5 rounded-full border-0 bg-white/[0.06] px-4 text-[15px] hover:bg-white/[0.12] focus:ring-0">
                      <span>{MODES.find(m => m.value === mode)?.label ?? "Auto"}</span>
                    </SelectTrigger>
                    <SelectContent align="start">
                      {MODES.map(m => (
                        <SelectItem key={m.value} value={m.value}>
                          <div className="flex items-center gap-2">
                            <m.icon className="h-3.5 w-3.5" />
                            <span>{m.label}</span>
                            <span className="hidden sm:inline text-xs text-muted-foreground">— {m.desc}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex-1" />

                  {voice.supported && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => { if (voice.status === "listening") voice.stopListening(); else voice.startDictation(); }}
                          disabled={sending}
                          aria-label="Diktieren"
                          className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
                            voice.status === "listening" && !voiceMode ? "bg-foreground text-background" : "bg-white/[0.06] hover:bg-white/[0.12]"
                          }`}
                        >
                          {voice.status === "listening" ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">{voice.status === "listening" ? "Diktat stoppen" : "Diktieren"}</TooltipContent>
                    </Tooltip>
                  )}

                  {sending && !input.trim() ? (
                    <button
                      onClick={stop}
                      aria-label="Stopp"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background hover:bg-foreground/90"
                    >
                      <Square className="h-4 w-4 fill-current" />
                    </button>
                  ) : (
                    <button
                      onClick={submitOrQueue}
                      disabled={!input.trim() && !sending}
                      aria-label={sending ? "In die Warteschlange" : "Senden"}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:bg-white/10 disabled:text-muted-foreground transition-colors"
                    >
                      <ArrowUp className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Mythos AI ist eine KI und kann Fehler machen. Wichtige Infos bitte prüfen.
              </p>
              <LegalLinks className="mt-1" />
            </div>
          </div>
        </main>

        {showPreview && preview && (
          <LivePreview item={preview} prompt={[...messages].reverse().find(m => m.role === "user")?.content?.slice(0, 1000)} onClose={() => setPreviewHidden(preview.key)} />
        )}

        <ProjectsDialog
          open={dialog === "projects"}
          onOpenChange={(o) => setDialog(o ? "projects" : null)}
          onOpenProject={(id) => { setProjectId(id); newChat(); }}
        />
        <ArtifactsDialog open={dialog === "artifacts"} onOpenChange={(o) => setDialog(o ? "artifacts" : null)} onOpenChat={openChat} />
        <CustomizeDialog open={dialog === "customize"} onOpenChange={(o) => setDialog(o ? "customize" : null)} />
        <AlertDialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Chat löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                „{confirmDelete?.title}“ und alle Nachrichten darin werden endgültig gelöscht.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { if (confirmDelete) deleteChat(confirmDelete.id); setConfirmDelete(null); }}
              >
                Löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Paywall open={paywall.open} onOpenChange={(o) => setPaywall({ open: o })} reason={paywall.reason} />
      </div>
    </TooltipProvider>
  );
};

export default Chat;
