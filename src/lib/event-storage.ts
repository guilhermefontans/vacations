import Papa from "papaparse";
import fileEventsData from "@/data/events.json";
import { API_ERROR_PREFIX } from "@/lib/constants";
import type { RawSheetEvent } from "@/lib/types";

const CSV_URL_ENV = "GOOGLE_SHEETS_CSV_URL";
const DATA_SOURCE_ENV = "DATA_SOURCE";
const APP_ENVIRONMENT_ENV = "APP_ENVIRONMENT";
const GITHUB_TOKEN_ENV = "GITHUB_TOKEN";
const GIST_ID_ENV = "GIST_ID";
const GIST_FILENAME_ENV = "GIST_FILENAME";
const GITHUB_API_BASE_URL = "https://api.github.com";

export type DataSource = "file" | "google" | "gist";

type GistConfig = {
  token: string;
  gistId: string;
  filename: string;
};

type GistFileResponse = {
  filename?: string;
  content?: string;
  raw_url?: string;
  truncated?: boolean;
};

type GistResponse = {
  files?: Record<string, GistFileResponse>;
};

type GistWriteResponse = {
  content?: string;
  files?: Record<string, GistFileResponse>;
};

export class UnsupportedEventMutationError extends Error {}

export class EventStorageConfigurationError extends Error {}

export class EventStorageNotFoundError extends Error {}

let fileRowsCache: RawSheetEvent[] | null = null;
let googleRowsCache: RawSheetEvent[] | null = null;
let gistRowsCache: RawSheetEvent[] | null = null;

function envValue(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

function appEnvironment(): string {
  return (envValue(APP_ENVIRONMENT_ENV) ?? "local").trim().toLowerCase();
}

export function dataSource(): DataSource {
  const configuredSource = (envValue(DATA_SOURCE_ENV) ?? "").trim().toLowerCase();

  if (configuredSource === "file" || configuredSource === "google" || configuredSource === "gist") {
    return configuredSource;
  }

  if (configuredSource === "github") {
    return "gist";
  }

  return appEnvironment() === "production" ? "google" : "file";
}

function csvUrl(): string {
  const value = envValue(CSV_URL_ENV);

  if (!value) {
    throw new EventStorageConfigurationError(`${CSV_URL_ENV} is not configured.`);
  }

  return value;
}

function csvRequestUrl(forceRefresh: boolean): string {
  const baseUrl = csvUrl();

  if (!forceRefresh) {
    return baseUrl;
  }

  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}_ts=${Date.now()}`;
}

function localRows(): RawSheetEvent[] {
  if (!fileRowsCache) {
    fileRowsCache = fileEventsData as RawSheetEvent[];
  }

  return fileRowsCache;
}

async function googleRows(forceRefresh: boolean): Promise<RawSheetEvent[]> {
  if (!forceRefresh && googleRowsCache) {
    return googleRowsCache;
  }

  const response = await fetch(csvRequestUrl(forceRefresh), { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`${API_ERROR_PREFIX} unable to fetch public CSV.`);
  }

  const csvText = await response.text();
  const parsed = Papa.parse<RawSheetEvent>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(`${API_ERROR_PREFIX} invalid CSV structure.`);
  }

  googleRowsCache = parsed.data;
  return googleRowsCache;
}

function gistConfig(): GistConfig {
  const token = (envValue(GITHUB_TOKEN_ENV) ?? "").trim();
  const gistId = (envValue(GIST_ID_ENV) ?? "").trim();
  const filename = (envValue(GIST_FILENAME_ENV) ?? "events.json").trim();

  if (!token || !gistId) {
    throw new EventStorageConfigurationError("Gist storage is not configured. Set GITHUB_TOKEN and GIST_ID.");
  }

  if (!filename) {
    throw new EventStorageConfigurationError("GIST_FILENAME cannot be empty.");
  }

  return {
    token,
    gistId,
    filename,
  };
}

function githubApiHeaders(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function findGistFile(payload: GistResponse, filename: string): GistFileResponse | null {
  const directMatch = payload.files?.[filename];

  if (directMatch) {
    return directMatch;
  }

  return Object.values(payload.files ?? {}).find((file) => file.filename === filename) ?? null;
}

async function readGistContent(file: GistFileResponse): Promise<string> {
  if (!file.truncated && typeof file.content === "string") {
    return file.content;
  }

  if (!file.raw_url) {
    throw new Error("Gist storage error: missing raw URL for JSON file.");
  }

  const response = await fetch(file.raw_url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Gist storage error: unable to fetch raw JSON file.");
  }

  return response.text();
}

async function fetchGistRows(forceRefresh: boolean): Promise<RawSheetEvent[]> {
  if (!forceRefresh && gistRowsCache) {
    return gistRowsCache;
  }

  const config = gistConfig();
  const requestUrl = `${GITHUB_API_BASE_URL}/gists/${config.gistId}`;

  const response = await fetch(requestUrl, {
    headers: githubApiHeaders(config.token),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Gist storage error: unable to fetch JSON file.");
  }

  const payload = (await response.json()) as GistResponse;
  const gistFile = findGistFile(payload, config.filename);

  if (!gistFile) {
    throw new Error(`Gist storage error: file \"${config.filename}\" was not found.`);
  }

  const parsed = JSON.parse(await readGistContent(gistFile)) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Gist storage error: invalid JSON structure.");
  }

  gistRowsCache = parsed as RawSheetEvent[];
  return gistRowsCache;
}

async function saveGistRows(rows: RawSheetEvent[], message: string): Promise<void> {
  const config = gistConfig();
  const requestUrl = `${GITHUB_API_BASE_URL}/gists/${config.gistId}`;
  const content = `${JSON.stringify(rows, null, 2)}\n`;

  const response = await fetch(requestUrl, {
    method: "PATCH",
    headers: githubApiHeaders(config.token),
    body: JSON.stringify({
      description: message,
      files: {
        [config.filename]: {
          content,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error("Gist storage error: unable to persist JSON file.");
  }

  await response.json().catch(() => null as GistWriteResponse | null);
  gistRowsCache = rows;
}

export async function readEventRows(forceRefresh = false): Promise<RawSheetEvent[]> {
  const source = dataSource();

  if (source === "file") {
    return localRows();
  }

  if (source === "gist") {
    return fetchGistRows(forceRefresh);
  }

  return googleRows(forceRefresh);
}

export async function updateEventRow(eventId: string, changes: Partial<RawSheetEvent>): Promise<RawSheetEvent> {
  if (dataSource() !== "gist") {
    throw new UnsupportedEventMutationError("UI updates require DATA_SOURCE=gist.");
  }

  const normalizedEventId = eventId.trim();
  const rows = await fetchGistRows(true);
  const eventIndex = rows.findIndex((row) => (row.id ?? "").trim() === normalizedEventId);

  if (eventIndex < 0) {
    throw new EventStorageNotFoundError("Evento nao encontrado.");
  }

  const updatedRow = {
    ...rows[eventIndex],
    ...changes,
  };

  const nextRows = rows.map((row, index) => {
    if (index !== eventIndex) {
      return row;
    }

    return updatedRow;
  });

  await saveGistRows(nextRows, `Update ${normalizedEventId}`);
  return updatedRow;
}

export async function createEventRow(event: RawSheetEvent): Promise<RawSheetEvent> {
  if (dataSource() !== "gist") {
    throw new UnsupportedEventMutationError("UI updates require DATA_SOURCE=gist.");
  }

  const rows = await fetchGistRows(true);
  const normalizedEventId = (event.id ?? "").trim();

  if (rows.some((row) => (row.id ?? "").trim() === normalizedEventId)) {
    throw new Error("Ja existe um evento com este identificador.");
  }

  const nextRows = [...rows, event];
  await saveGistRows(nextRows, `Create ${normalizedEventId}`);

  return event;
}

export async function deleteEventRow(eventId: string): Promise<void> {
  if (dataSource() !== "gist") {
    throw new UnsupportedEventMutationError("UI updates require DATA_SOURCE=gist.");
  }

  const normalizedEventId = eventId.trim();
  const rows = await fetchGistRows(true);
  const nextRows = rows.filter((row) => (row.id ?? "").trim() !== normalizedEventId);

  if (nextRows.length === rows.length) {
    throw new EventStorageNotFoundError("Evento nao encontrado.");
  }

  await saveGistRows(nextRows, `Delete ${normalizedEventId}`);
}

export async function writeEventRows(rows: RawSheetEvent[], message: string): Promise<void> {
  if (dataSource() !== "gist") {
    throw new UnsupportedEventMutationError("UI updates require DATA_SOURCE=gist.");
  }

  await saveGistRows(rows, message);
}