import logger from "./log";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { AudioHookWebSocket, ClientMessage, ClosedMessage, CloseMessage, DiscardedMessage, DisconnectMessage, DisconnectReason, ErrorMessage, MessageDispatcher, OpenedMessage, OpenMessage, PingMessage, PongMessage, ServerMessage } from "./models";
import { PcmuToWav } from "./pcmu-to-wav";
import path from "path";
import * as fsPromises from "fs/promises";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const wss = new WebSocketServer({ port: PORT });
const ORG_ID = "2fe77629-79b8-4065-ba92-0e08ff865b17";    // genesysscosea1
const API_KEY = "SzeMinAPIKey";                           // configured at GC Admn > Integrations page

/** Object to store and dispatch function references */
let clientMessageDispatcher: MessageDispatcher<ClientMessage, AudioHookWebSocket> = {
  close: receiveCloseMessage,
  discarded: receiveDiscardedMessage,
  error: receiveErrorMessage,
  open: receiveOpenMessage,
  ping: receivePingMessage
};

// hook up "connection" event
wss.on("connection", (ws: AudioHookWebSocket, req: IncomingMessage) => {

  ws.on("message", onWebSocketMessage);   // handle incoming data from AudioHook client
  ws.on("close", onWebSocketClosed);      // handle websocket close

  // initialize variables
  ws.seq = 0;
  ws.clientSeq = 0;
  ws.samples = Buffer.from([]);

  // save headers sent by AudioHook client
  let sessionId = req.headers["audiohook-session-id"];
  let organizationId = req.headers["audiohook-organization-id"];
  let key = req.headers["x-api-key"];

  // verify headers
  if (!sessionId) {
    logger.error("audiohook-session-id is missing from request headers.");
    return;
  }
  ws.sessionId = sessionId as string;

  if (!organizationId || (organizationId as string) !== ORG_ID) {
    logger.error({ sessionId: ws.sessionId, orgId: organizationId }, "audiohook-organization-id not accepted.");
    sendDisconnect("unauthorized", "Organization id not accepted.", ws);
    return;
  }
  ws.orgId = organizationId as string;

  if (!key || key != API_KEY) {
    logger.error({ sessionId: ws.sessionId }, "Unauthorized connection. Invalid x-api-key.");
    sendDisconnect("unauthorized", "Invalid key.", ws);
    return;
  }

  // all verified ok
  logger.info(`New websocket session.`);
  logger.debug({ sessionId: ws.sessionId }, "New websocket session.");
});

// clean up old WAV files
cleanUpFiles().then(() => {
  logger.info(`Listening on port ${PORT}.`);
});




/************************************************************
  Supporting functions below.
 ************************************************************/

/** Delete old WAV files in application directory. */
async function cleanUpFiles() {
  try {
    let files = await (await fsPromises.readdir(__dirname)).filter(f => f.endsWith(".wav"));
    files.forEach(async (f) => {
      await fsPromises.unlink(path.join(__dirname, f));
    });
    logger.info("Cleaned up old WAV files.");
  } catch (err) {
    logger.error(err, "Deleting old WAV files.");
  }
}

/** Handle "message" events from websocket. */
function onWebSocketMessage(this: WebSocket, buf: Buffer, isBinary: boolean): void {
  let ws = this as AudioHookWebSocket;

  // if data is binary, it would be audio samples from client. Save audio samples into memory.
  if (isBinary) {
    ws.samples = Buffer.concat([ws.samples, buf]);
    logger.info(`PCMU samples received: ${ws.samples.length}, position: ${ws.samples.length / ws.media.rate}s`);
  }

  // if data is text, check type of message sent by client.
  else {

    let clientMessage: any;

    try {
      let data = buf.toString();
      clientMessage = JSON.parse(data);

      // check client's sequence number
      let expectedClientSeqNo = ws.clientSeq + 1;
      if ((clientMessage as ClientMessage).seq != expectedClientSeqNo) {
        logger.error({
          sessionId: ws.sessionId,
          expectedClientSeqNo: expectedClientSeqNo,
          clientSeqNo: clientMessage.seq,
          message: clientMessage
        },
          "Incorrect expected client sequence number.");
        sendDisconnect("error", "Incorrect client sequence number.", ws);
        return;
      }

      // correct client sequence number, save it
      ws.clientSeq = clientMessage.seq;

      // dispatch message to correct function
      clientMessageDispatcher[(clientMessage as ClientMessage).type](clientMessage, ws);

    } catch (err: any) {
      if (err instanceof TypeError)
        logger.error({ sessionId: ws.sessionId, message: clientMessage }, `Unknown message type "%s" from client.`, clientMessage.type);
      else
        logger.error({ sessionId: ws.sessionId, error: err });
    }
  }
}

/** Handler for "close" websocket event. Received audio samples will be written to a WAV file. */
function onWebSocketClosed(this: WebSocket, code: number, reason: Buffer): void {
  let ws = this as AudioHookWebSocket;

  logger.info("Websocket closed.");
  logger.debug({ sessionId: ws.sessionId, code: code, reason: reason.toString() });

  // if audio samples received and there is a valid conversation id (a valid conversation id means it wasn't a test call from the client),
  // then save the samples into a WAV file
  if (ws.samples.length > 0 && ws.conversationId) {
    let wavFile = path.join(__dirname, `${ws.conversationId}.wav`);
    logger.info(`Writing PCMU to ${wavFile}`);
    PcmuToWav(ws.samples, 8, 2, 8000, wavFile);
  }
}

/**
 * Handle "close" message from AudioHook client.
 * @param message "close" message from client.
 * @param ws Websocket session.
 */
function receiveCloseMessage(message: CloseMessage, ws: AudioHookWebSocket): void {
  logger.debug({ sessionId: ws.sessionId, message: message }, `Received "close" message from AudioHook client.`);
  sendClosed(ws);
}

/**
 * Handle "discarded" message from AudioHook client.
 * @param message "discarded" message from client.
 * @param ws Websocket session.
 */
function receiveDiscardedMessage(message: DiscardedMessage, ws: AudioHookWebSocket): void {
  logger.warn(`Ignoring "discarded" message from AudioHook client.`);
  logger.debug({ sessionId: ws.sessionId, message: message });
}

/**
 * Handle "error" message from AudioHook client.
 * @param message "error" message from client.
 * @param ws Websocket session.
 */
function receiveErrorMessage(message: ErrorMessage, ws: AudioHookWebSocket): void {
  logger.error({ sessionId: ws.sessionId, message: message }, `Received "error" message from client.`);
}

/**
 * Handle "open" message from AudioHook client.
 * @param message "open" message from client.
 * @param ws Websocket session.
 */
function receiveOpenMessage(message: OpenMessage, ws: AudioHookWebSocket): void {
  logger.info(`Incoming audio stream for ${message.parameters.conversationId}, DNIS=${message.parameters.participant.dnis}, ANI=${message.parameters.participant.ani}`);
  logger.debug({ sessionId: ws.sessionId, message: message }, `Received "open" message from AudioHook client.`);

  // valid open message?
  if (!message.parameters.media) {
    logger.error({ sessionId: ws.sessionId, message: message }, "Media parameters missing from message.")
    sendDisconnect("error", "Media parameters missing.", ws);
  }

  // is AudioHook client offering what we support?
  let mediaParameter = message.parameters.media.find((a) => {
    return a.channels.includes("external") &&
      a.channels.includes("internal") &&
      a.format == "PCMU" &&
      a.rate == 8000 &&
      a.type == "audio"
  });

  if (!mediaParameter) {
    logger.error({ sessionId: ws.sessionId, message: message }, "Unsupported media parameter.")
    sendDisconnect("error", "Unsupported media paramter.", ws);
    return;
  }

  ws.conversationId = message.parameters.conversationId;
  ws.media = mediaParameter;
  sendOpened(ws);
}

/**
 * Handle "ping" message from AudioHook client.
 * @param message "ping" message from client.
 * @param ws Websocket session.
 */
function receivePingMessage(message: PingMessage, ws: AudioHookWebSocket): void {
  sendPong(ws);
}

/**
 * Send "closed" message to AudioHook client.
 * @param ws Websocket session.
 */
function sendClosed(ws: AudioHookWebSocket): void {
  let message: ClosedMessage = {
    version: "2",
    id: ws.sessionId,
    type: "closed",
    parameters: {},
    seq: ws.seq + 1,
    clientseq: ws.clientSeq
  };
  sendMessage(message, ws);
}

/**
 * Send "disconnect" message to AudioHook client.
 * @param reason Reason for disconnecting. 
 * @param info Additional info to send over.
 * @param ws Websocket session.
 */
function sendDisconnect(reason: DisconnectReason, info: string, ws: AudioHookWebSocket): void {
  let message: DisconnectMessage = {
    version: "2",
    id: ws.sessionId,
    type: "disconnect",
    parameters: {
      reason: reason,
      info: info
    },
    seq: ws.seq + 1,
    clientseq: ws.clientSeq
  };
  sendMessage(message, ws);
}

/**
 * Send message to AudioHook client.
 * @param message Message to send.
 * @param ws Websocket session.
 */
function sendMessage(message: ServerMessage, ws: AudioHookWebSocket): void {
  ws.seq = message.seq;
  logger.debug({ sessionId: ws.sessionId, message: message }, `Sending "${message.type}" to client.`)
  ws.send(JSON.stringify(message));
}

/**
 * Send "opened" message to AudioHook client.
 * @param ws Websocket session.
 */
function sendOpened(ws: AudioHookWebSocket): void {
  let message: OpenedMessage = {
    version: "2",
    id: ws.sessionId,
    type: "opened",
    parameters: {
      media: [{
        type: "audio",
        format: "PCMU",
        channels: ["external", "internal"],
        rate: 8000
      }]
    },
    seq: ws.seq + 1,
    clientseq: ws.clientSeq
  };
  sendMessage(message, ws);
}

/**
 * Send "pong" message to AudioHook client.
 * @param ws Websocket session.
 */
function sendPong(ws: AudioHookWebSocket): void {
  let message: PongMessage = {
    version: "2",
    id: ws.sessionId,
    type: "pong",
    parameters: {},
    seq: ws.seq + 1,
    clientseq: ws.clientSeq
  };
  sendMessage(message, ws);
}