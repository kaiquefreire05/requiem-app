import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────
//  useMIDIConnector — Web MIDI API Hook
// ─────────────────────────────────────────────────────────
//
//  Responsável por:
//  1. Enumerar e conectar a dispositivos MIDI via navigator.requestMIDIAccess
//  2. Capturar eventos MIDI (note-on, note-off) com tipagem estrita
//  3. Traduzir números MIDI para notação padrão (ex: 60 → 'C4')
//  4. Gerenciar hot-swap de dispositivos (plug/unplug)
//  5. Cleanup rigoroso de listeners para evitar memory leaks
// ─────────────────────────────────────────────────────────

// ── Tipos ────────────────────────────────────────────────

export type MIDINoteAction = "note-on" | "note-off";

export interface MIDIEvent {
  /** Nota em notação padrão (ex: 'C4', 'F#5') */
  note: string;
  /** Número MIDI (0–127) */
  midiNumber: number;
  /** Ação: note-on ou note-off */
  action: MIDINoteAction;
  /** Velocidade / Força (0–127) */
  velocity: number;
  /** Timestamp do evento em ms (performance.now()) */
  timestamp: number;
}

export interface MIDIDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export interface UseMIDIConnectorReturn {
  /** Lista de dispositivos MIDI de entrada disponíveis */
  devices: MIDIDeviceInfo[];
  /** Dispositivo atualmente conectado (recebendo eventos) */
  activeDevice: MIDIDeviceInfo | null;
  /** true quando o MIDI Access foi obtido com sucesso */
  isReady: boolean;
  /** Mensagem de erro (navegador sem suporte ou permissão negada) */
  error: string | null;
  /** Conectar a um dispositivo específico pelo ID */
  connect: (deviceId: string) => void;
  /** Desconectar do dispositivo atual */
  disconnect: () => void;
  /** Último evento MIDI recebido (para feedback visual) */
  lastEvent: MIDIEvent | null;
  /** Ref de callback — registre aqui para receber eventos MIDI sem causar re-renders */
  onMIDIEvent: React.MutableRefObject<((event: MIDIEvent) => void) | null>;
}

// ── Constantes ───────────────────────────────────────────

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

// Status bytes MIDI (canal 0)
const MIDI_NOTE_ON  = 0x90;
const MIDI_NOTE_OFF = 0x80;

// ── Utilidades ───────────────────────────────────────────

/**
 * Converte número MIDI para notação padrão.
 * Ex: 60 → 'C4', 69 → 'A4', 61 → 'C#4'
 */
function midiToNoteName(midiNumber: number): string {
  const noteName = NOTE_NAMES[midiNumber % 12];
  const octave = Math.floor(midiNumber / 12) - 1;
  return `${noteName}${octave}`;
}

/**
 * Extrai informações de um MIDIInput.
 */
function inputToDeviceInfo(input: WebMidi.MIDIInput): MIDIDeviceInfo {
  return {
    id: input.id,
    name: input.name || "Dispositivo MIDI Desconhecido",
    manufacturer: input.manufacturer || "Desconhecido",
  };
}

// ─────────────────────────────────────────────────────────
//  Hook
// ─────────────────────────────────────────────────────────

export function useMIDIConnector(): UseMIDIConnectorReturn {
  const [devices, setDevices] = useState<MIDIDeviceInfo[]>([]);
  const [activeDevice, setActiveDevice] = useState<MIDIDeviceInfo | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<MIDIEvent | null>(null);

  // Ref para o MIDIAccess (para cleanup)
  const midiAccessRef = useRef<WebMidi.MIDIAccess | null>(null);
  // Ref para o input ativo (para remover listener)
  const activeInputRef = useRef<WebMidi.MIDIInput | null>(null);
  // Ref para o handler de mensagens (para referência estável no remove)
  const messageHandlerRef = useRef<((e: WebMidi.MIDIMessageEvent) => void) | null>(null);
  // Ref callback público — o consumidor registra aqui
  const onMIDIEvent = useRef<((event: MIDIEvent) => void) | null>(null);

  // ── Enumeração de dispositivos ──────────────────────────
  const enumerateDevices = useCallback((access: WebMidi.MIDIAccess) => {
    const inputs: MIDIDeviceInfo[] = [];
    access.inputs.forEach((input) => {
      inputs.push(inputToDeviceInfo(input));
    });
    setDevices(inputs);

    // Auto-connect: se há exatamente 1 dispositivo e nenhum ativo, conectar automaticamente
    if (inputs.length === 1 && !activeInputRef.current) {
      connectToDevice(access, inputs[0].id);
    }

    // Se o dispositivo ativo foi desplugado, desconectar
    if (activeInputRef.current) {
      const stillExists = access.inputs.has(activeInputRef.current.id);
      if (!stillExists) {
        disconnectDevice();
      }
    }
  }, []);

  // ── Handler de mensagens MIDI ───────────────────────────
  const createMessageHandler = useCallback(() => {
    return (e: WebMidi.MIDIMessageEvent) => {
      const data = e.data;
      if (!data || data.length < 3) return;

      const statusByte = data[0] & 0xf0; // Ignora canal (4 bits inferiores)
      const midiNumber = data[1];
      const velocity = data[2];

      let action: MIDINoteAction | null = null;

      if (statusByte === MIDI_NOTE_ON && velocity > 0) {
        action = "note-on";
      } else if (statusByte === MIDI_NOTE_OFF || (statusByte === MIDI_NOTE_ON && velocity === 0)) {
        // note-on com velocity 0 é equivalente a note-off (convenção MIDI)
        action = "note-off";
      }

      if (action === null) return; // Ignorar CC, pitchbend, etc.

      const event: MIDIEvent = {
        note: midiToNoteName(midiNumber),
        midiNumber,
        action,
        velocity,
        timestamp: performance.now(),
      };

      // Atualizar estado visual (último evento)
      setLastEvent(event);

      // Disparar callback ref (sem causar re-render)
      if (onMIDIEvent.current) {
        onMIDIEvent.current(event);
      }
    };
  }, []);

  // ── Conectar a um dispositivo ───────────────────────────
  const connectToDevice = useCallback((access: WebMidi.MIDIAccess, deviceId: string) => {
    // Desconectar anterior
    if (activeInputRef.current && messageHandlerRef.current) {
      activeInputRef.current.removeEventListener("midimessage", messageHandlerRef.current as EventListener);
      activeInputRef.current = null;
      messageHandlerRef.current = null;
    }

    const input = access.inputs.get(deviceId);
    if (!input) {
      console.warn(`[MIDI] Dispositivo ${deviceId} não encontrado`);
      return;
    }

    const handler = createMessageHandler();
    input.addEventListener("midimessage", handler as EventListener);

    activeInputRef.current = input;
    messageHandlerRef.current = handler;
    setActiveDevice(inputToDeviceInfo(input));

    console.log(`[MIDI] Conectado a: ${input.name} (${input.manufacturer})`);
  }, [createMessageHandler]);

  // ── Desconectar ─────────────────────────────────────────
  const disconnectDevice = useCallback(() => {
    if (activeInputRef.current && messageHandlerRef.current) {
      activeInputRef.current.removeEventListener("midimessage", messageHandlerRef.current as EventListener);
      console.log(`[MIDI] Desconectado de: ${activeInputRef.current.name}`);
    }
    activeInputRef.current = null;
    messageHandlerRef.current = null;
    setActiveDevice(null);
    setLastEvent(null);
  }, []);

  // ── Métodos públicos ────────────────────────────────────
  const connect = useCallback((deviceId: string) => {
    if (!midiAccessRef.current) {
      console.warn("[MIDI] MIDIAccess não disponível");
      return;
    }
    connectToDevice(midiAccessRef.current, deviceId);
  }, [connectToDevice]);

  const disconnect = useCallback(() => {
    disconnectDevice();
  }, [disconnectDevice]);

  // ── Inicialização do MIDI Access ────────────────────────
  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      setError("Web MIDI API não suportada neste navegador. Use Chrome, Edge ou Opera.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const access = await navigator.requestMIDIAccess({ sysex: false });

        if (cancelled) return;

        midiAccessRef.current = access;
        setIsReady(true);
        setError(null);

        // Enumerar dispositivos iniciais
        enumerateDevices(access);

        // Hot-swap: detectar dispositivos plugados/desplugados
        access.onstatechange = () => {
          if (!cancelled) {
            enumerateDevices(access);
          }
        };

        console.log("[MIDI] Web MIDI API inicializada com sucesso");
      } catch (err) {
        if (cancelled) return;
        
        const message = err instanceof DOMException && err.name === "SecurityError"
          ? "Permissão MIDI negada pelo usuário."
          : "Erro ao acessar dispositivos MIDI.";
        
        setError(message);
        console.error("[MIDI] Erro na inicialização:", err);
      }
    })();

    // ── Cleanup ───────────────────────────────────────────
    return () => {
      cancelled = true;

      // Remover listener do input ativo
      if (activeInputRef.current && messageHandlerRef.current) {
        activeInputRef.current.removeEventListener("midimessage", messageHandlerRef.current as EventListener);
        activeInputRef.current = null;
        messageHandlerRef.current = null;
      }

      // Limpar statechange
      if (midiAccessRef.current) {
        midiAccessRef.current.onstatechange = null;
        midiAccessRef.current = null;
      }

      console.log("[MIDI] Cleanup completo");
    };
  }, [enumerateDevices]);

  return {
    devices,
    activeDevice,
    isReady,
    error,
    connect,
    disconnect,
    lastEvent,
    onMIDIEvent,
  };
}
