/**
 * Common utilities for DAP test helpers
 */
import { Socket } from "net";

export interface DAPMessage {
  seq?: number;
  type: "request" | "response" | "event";
  request_seq?: number;
  success?: boolean;
  command?: string;
  event?: string;
  body?: any;
  message?: string;
}

/**
 * Create a standard DAP response
 */
export function createResponse(
  sequenceNumber: number,
  request: any,
  success: boolean,
  body?: any,
  message?: string
): DAPMessage {
  const response: DAPMessage = {
    seq: sequenceNumber,
    type: "response",
    request_seq: request.seq,
    success,
    command: request.command,
  };

  if (body) {
    response.body = body;
  }

  if (message) {
    response.message = message;
  }

  return response;
}

/**
 * Create a standard DAP event
 */
export function createEvent(
  sequenceNumber: number,
  event: string,
  body?: any
): DAPMessage {
  return {
    seq: sequenceNumber,
    type: "event",
    event,
    body: body || {},
  };
}

/**
 * Send a message over the DAP protocol
 */
export function sendDAPMessage(message: DAPMessage, socket: Socket): void {
  const messageStr = JSON.stringify(message);
  const contentLength = Buffer.byteLength(messageStr, "utf8");
  socket.write(`Content-Length: ${contentLength}\r\n\r\n${messageStr}`);
}

/**
 * Send a successful response
 */
export function sendSuccessResponse(
  sequenceNumber: number,
  request: any,
  socket: Socket,
  body?: any
): number {
  const response = createResponse(sequenceNumber, request, true, body);
  sendDAPMessage(response, socket);
  return sequenceNumber + 1;
}

/**
 * Send an error response
 */
export function sendErrorResponse(
  sequenceNumber: number,
  request: any,
  socket: Socket,
  message: string
): number {
  const response = createResponse(sequenceNumber, request, false, undefined, message);
  sendDAPMessage(response, socket);
  return sequenceNumber + 1;
}

/**
 * Send an event with optional delay
 */
export function sendEventWithDelay(
  sequenceNumber: number,
  eventName: string,
  body: any,
  socket: Socket,
  delay: number = 0
): void {
  const event = createEvent(sequenceNumber, eventName, body);
  
  if (delay > 0) {
    setTimeout(() => {
      sendDAPMessage(event, socket);
    }, delay);
  } else {
    sendDAPMessage(event, socket);
  }
}