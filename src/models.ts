import { WebSocket } from "ws";

export interface AudioHookWebSocket extends WebSocket {
  sessionId: string;
  orgId: string;
  conversationId: string | undefined;
  media: MediaParameter;
  seq: number;                          // my sequence number (I'm the server)
  clientSeq: number;                    // sequence number from client
  samples: Buffer;                      // raw audio data from client
}

type Uuid = string;             // UUID as defined by RFC#4122
type SequenceNumber = number;   // Non-negative integer
type JsonArray = JsonValue[];
type Duration = `PT${number}S`; // ISO8601 duration in seconds, where 'number' in non-negative decimal representation

export type JsonObject = {
  [key: string]: JsonValue
}

type EmptyObject = {
  [K in any]: never
}

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type MediaType = 'audio';
type MediaFormat = 'PCMU' | 'L16';
type MediaRate = 8000;
type MediaChannel = 'external' | 'internal';
type MediaChannels = MediaChannel[];
type MediaParameters = MediaParameter[];
type ContinuedSessions = ContinuedSession[];
export type DisconnectReason = 'completed' | 'unauthorized' | 'error';
type CloseReason = 'end' | 'error' | 'disconnect' | 'reconnect';

type ErrorCode = 400 | 405 | 408 | 409 | 413 | 415 | 429 | 500 | 503;

type CloseParameters = {
  reason: CloseReason;
};

type ClosedParameters = EmptyObject;

type Participant = {
  id: Uuid;
  ani: string;
  aniName: string;
  dnis: string;
}

export type MediaParameter = {
  type: MediaType;
  format: MediaFormat;
  channels: MediaChannels;
  rate: MediaRate;
}

type ContinuedSession = {
  id: Uuid;
  serverseq: SequenceNumber;
  clientseq: SequenceNumber;
}

export type OpenParameters = {
  organizationId: Uuid;
  conversationId: Uuid;
  participant: Participant;
  media: MediaParameters;
  continuedSessions?: ContinuedSessions;
  customConfig?: JsonObject;
};

type OpenedParameters = {
  media: MediaParameters;
  discardTo?: Duration;
  startPaused?: boolean;
}

export type DiscardedParameters = {
  start: Duration;
  discarded: Duration;
}

export type DisconnectParameters = {
  reason: DisconnectReason;
  info?: string;
};

type PauseParameters = EmptyObject;

type PausedParameters = EmptyObject;

type PingParameters = {
  rtt?: Duration;
};

type PongParameters = EmptyObject;

export type ErrorParameters = {
  code: ErrorCode;
  message: string;
  retryAfter?: Duration;          // Used by client rate limiter (429)
}

interface MessageBase<Type extends string, Parameters extends JsonObject> {
  version: '2';
  id: Uuid;
  type: Type;
  seq: SequenceNumber;
  parameters: Parameters;
}

export interface ClientMessageBase<T extends string, P extends JsonObject> extends MessageBase<T, P> {
  serverseq: SequenceNumber;
  position: Duration;
}

export type CloseMessage = ClientMessageBase<'close', CloseParameters>;
export type DiscardedMessage = ClientMessageBase<'discarded', DiscardedParameters>;
export type ErrorMessage = ClientMessageBase<'error', ErrorParameters>;
export type OpenMessage = ClientMessageBase<"open", OpenParameters>;
export type PausedMessage = ClientMessageBase<'paused', PausedParameters>;
export type PingMessage = ClientMessageBase<'ping', PingParameters>;

interface ServerMessageBase<T extends string, P extends JsonObject> extends MessageBase<T, P> {
  clientseq: SequenceNumber;
}

export type ClosedMessage = ServerMessageBase<'closed', ClosedParameters>;
export type DisconnectMessage = ServerMessageBase<"disconnect", DisconnectParameters>;
export type OpenedMessage = ServerMessageBase<"opened", OpenedParameters>;
export type PauseMessage = ServerMessageBase<'pause', PauseParameters>;
export type PongMessage = ServerMessageBase<'pong', PongParameters>;

/** Types of messages a client can send */
export type ClientMessage = CloseMessage | DiscardedMessage | ErrorMessage | OpenMessage | PausedMessage | PingMessage;

/** Types of messages a server can send */
export type ServerMessage = ClosedMessage | DisconnectMessage | OpenedMessage | PauseMessage | PongMessage;

type Message = ClientMessage | ServerMessage;

/**
 * Conditional type to check if M is an object that contains property "type" with a value of T.
 */
type SelectMessageForType<T extends string, M> = M extends { type: T } ? M : never;

/**
 * Define an object with properties that match value of Message.type. Value of the property will be a function that accepts that message.
 * Example:
 * 
 *  {
 *    open: (message: OpenMessage) => {},
 *    disconnect: (message: DisconnectMessage) => {}
 *  }
 * 
 * Object can then be used to easily call the correct function to handle the message type:
 * 
 *  let dispatcher: MessageDispatcher<OpenMessage> = {...}
 *  dispatcher.open(...)
 */
export type MessageDispatcher<M extends Message, W extends AudioHookWebSocket, R = void> = {
  readonly [T in M["type"]]: (message: SelectMessageForType<T, M>, ws: W) => R;
}