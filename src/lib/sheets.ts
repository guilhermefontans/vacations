import { CITY_DEFAULTS, FALLBACK_CITY_DEFAULTS } from "@/lib/constants";
import {
  EventStorageNotFoundError,
  createEventRow,
  deleteEventRow,
  readEventRows,
  updateEventRow,
  writeEventRows,
} from "@/lib/event-storage";
import type { CityDetail, CityStatus, CitySummary, RawSheetEvent, TravelEvent } from "@/lib/types";

type CreateEventInput = {
  date: string;
  time: string;
  name: string;
  address: string;
  checked?: boolean;
};

type CreateCityListingInput = {
  city: string;
  country: string;
  imageUrl: string;
  date: string;
  time: string;
  name: string;
  address: string;
};

type UpdateCityInput = {
  city: string;
  country: string;
  imageUrl: string;
};

function toSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim();
}

function isChecked(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ["true", "1", "sim", "yes", "x", "ok"].includes(normalized);
}

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function calcStatus(completionRate: number): CityStatus {
  if (completionRate < 60) {
    return "low";
  }

  if (completionRate <= 85) {
    return "medium";
  }

  return "high";
}

function toDateMs(dateTime: string): number {
  const value = Date.parse(dateTime);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function buildEventDateTime(date: string, time: string): string {
  const normalizedDate = normalizeText(date);
  const normalizedTime = normalizeText(time);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    throw new Error("Data invalida.");
  }

  if (!/^\d{2}:\d{2}$/.test(normalizedTime)) {
    throw new Error("Hora invalida.");
  }

  const [hours, minutes] = normalizedTime.split(":").map(Number);

  if (hours > 23 || minutes > 59) {
    throw new Error("Hora invalida.");
  }

  const dateTime = `${normalizedDate}T${normalizedTime}:00`;

  if (!Number.isFinite(Date.parse(dateTime))) {
    throw new Error("Data e hora invalidas.");
  }

  return dateTime;
}

function generatedEventId(cityName: string): string {
  return `${toSlug(cityName)}-${Date.now()}`;
}

function getCityDefaults(cityName: string, country?: string) {
  const defaults = CITY_DEFAULTS[cityName] ?? FALLBACK_CITY_DEFAULTS;

  return {
    country: normalizeText(country) || defaults.country,
    cardImage: defaults.cardImage,
    coverImage: defaults.coverImage,
  };
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function listCityNames(events: TravelEvent[]): string[] {
  return [...new Set(events.map((event) => event.city))];
}

function findCityNameBySlug(events: TravelEvent[], citySlug: string): string | null {
  const normalizedSlug = toSlug(citySlug);
  return listCityNames(events).find((city) => toSlug(city) === normalizedSlug) ?? null;
}

function parseRawEvents(rawRows: RawSheetEvent[]): TravelEvent[] {
  const events = rawRows
    .map((row): TravelEvent | null => {
      const cityName = normalizeText(row.cidade);

      if (!cityName) {
        return null;
      }

      const defaults = getCityDefaults(cityName, row.pais);
      const address = normalizeText(row.endereco);

      return {
        id: normalizeText(row.id),
        country: normalizeText(row.pais) || defaults.country,
        city: cityName,
        citySlug: toSlug(cityName),
        name: normalizeText(row.evento),
        dateTime: normalizeText(row.datetime),
        checked: isChecked(normalizeText(row.checked)),
        address,
        cardImage: normalizeText(row.imagem_card) || defaults.cardImage,
        coverImage: normalizeText(row.imagem_detalhe) || defaults.coverImage,
        mapsUrl: address ? mapsUrl(address) : null,
      };
    })
    .filter((event): event is TravelEvent => {
      return event !== null && event.id.length > 0 && event.name.length > 0 && event.dateTime.length > 0;
    })
    .sort((a, b) => toDateMs(a.dateTime) - toDateMs(b.dateTime));

  return events;
}

async function readEvents(forceRefresh: boolean): Promise<TravelEvent[]> {
  const rawRows = await readEventRows(forceRefresh);
  return parseRawEvents(rawRows);
}

function buildCitySummary(city: string, events: TravelEvent[]): CitySummary {
  const cityEvents = events.filter((event) => event.city === city);

  if (cityEvents.length === 0) {
    throw new Error("Cidade sem eventos nao pode ser resumida.");
  }

  const defaults = getCityDefaults(city, cityEvents[0]?.country);

  const totalEvents = cityEvents.length;
  const completedEvents = cityEvents.filter((event) => event.checked).length;
  const completionRate = totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 0;

  const startDate = totalEvents > 0 ? cityEvents[0].dateTime : null;
  const endDate = totalEvents > 0 ? cityEvents[cityEvents.length - 1].dateTime : null;

  return {
    country: cityEvents[0]?.country ?? defaults.country,
    city,
    slug: toSlug(city),
    startDate,
    endDate,
    totalEvents,
    completedEvents,
    completionRate,
    status: calcStatus(completionRate),
    cardImage: cityEvents[0]?.cardImage ?? defaults.cardImage,
    coverImage: cityEvents[0]?.coverImage ?? defaults.coverImage,
  };
}

export async function getCitySummaries(forceRefresh = false): Promise<CitySummary[]> {
  const events = await readEvents(forceRefresh);
  return listCityNames(events).map((city) => buildCitySummary(city, events));
}

export async function getCityDetail(citySlug: string, forceRefresh = false): Promise<CityDetail | null> {
  const events = await readEvents(forceRefresh);
  const cityName = findCityNameBySlug(events, citySlug);

  if (!cityName) {
    return null;
  }

  const cityEvents = events.filter((event) => event.city === cityName);

  return {
    summary: buildCitySummary(cityName, events),
    events: cityEvents,
  };
}

export async function updateEvent(eventId: string, changes: Partial<RawSheetEvent>): Promise<TravelEvent | null> {
  await updateEventRow(eventId, changes);

  const events = await readEvents(false);
  return events.find((event) => event.id === normalizeText(eventId)) ?? null;
}

export async function createEvent(citySlug: string, input: CreateEventInput): Promise<CityDetail | null> {
  const events = await readEvents(false);
  const cityName = findCityNameBySlug(events, citySlug);

  if (!cityName) {
    return null;
  }

  const name = normalizeText(input.name);
  const address = normalizeText(input.address);

  if (!name) {
    throw new Error("Nome do evento e obrigatorio.");
  }

  const cityVisuals = events.find((event) => event.city === cityName);

  const rawEvent: RawSheetEvent = {
    id: generatedEventId(cityName),
    pais: events.find((event) => event.city === cityName)?.country ?? getCityDefaults(cityName).country,
    cidade: cityName,
    evento: name,
    datetime: buildEventDateTime(input.date, input.time),
    checked: input.checked ? "true" : "false",
    endereco: address,
    imagem_card: cityVisuals?.cardImage,
    imagem_detalhe: cityVisuals?.coverImage,
  };

  await createEventRow(rawEvent);
  return getCityDetail(citySlug);
}

export async function deleteEvent(eventId: string): Promise<CityDetail | null> {
  const events = await readEvents(false);
  const targetEvent = events.find((event) => event.id === normalizeText(eventId));

  if (!targetEvent) {
    return null;
  }

  await deleteEventRow(eventId);
  return getCityDetail(targetEvent.citySlug);
}

export async function createCityListing(input: CreateCityListingInput): Promise<CitySummary[]> {
  const city = normalizeText(input.city);
  const country = normalizeText(input.country);
  const name = normalizeText(input.name);
  const address = normalizeText(input.address);
  const imageUrl = normalizeText(input.imageUrl);

  if (!city) {
    throw new Error("Nome da cidade e obrigatorio.");
  }

  if (!country) {
    throw new Error("Pais e obrigatorio.");
  }

  if (!name) {
    throw new Error("Nome do primeiro evento e obrigatorio.");
  }

  if (!isValidHttpUrl(imageUrl)) {
    throw new Error("URL da imagem invalida.");
  }

  const events = await readEvents(false);
  const existingCity = listCityNames(events).find((existingCityName) => toSlug(existingCityName) === toSlug(city));

  if (existingCity) {
    throw new Error("Ja existe uma listagem para esta cidade.");
  }

  await createEventRow({
    id: generatedEventId(city),
    pais: country,
    cidade: city,
    evento: name,
    datetime: buildEventDateTime(input.date, input.time),
    checked: "false",
    endereco: address,
    imagem_card: imageUrl,
    imagem_detalhe: imageUrl,
  });

  return getCitySummaries(false);
}

export async function updateCity(citySlug: string, input: UpdateCityInput): Promise<CitySummary[]> {
  const normalizedCitySlug = toSlug(citySlug);
  const city = normalizeText(input.city);
  const country = normalizeText(input.country);
  const imageUrl = normalizeText(input.imageUrl);

  if (!city) {
    throw new Error("Nome da cidade e obrigatorio.");
  }

  if (!country) {
    throw new Error("Pais e obrigatorio.");
  }

  if (!isValidHttpUrl(imageUrl)) {
    throw new Error("URL da imagem invalida.");
  }

  const rows = await readEventRows(true);
  const hasTargetCity = rows.some((row) => toSlug(normalizeText(row.cidade)) === normalizedCitySlug);

  if (!hasTargetCity) {
    throw new Error("Cidade nao encontrada.");
  }

  const nextCitySlug = toSlug(city);
  const cityConflict = rows.some((row) => {
    const rowSlug = toSlug(normalizeText(row.cidade));
    return rowSlug !== normalizedCitySlug && rowSlug === nextCitySlug;
  });

  if (cityConflict) {
    throw new Error("Ja existe uma cidade com este nome.");
  }

  const nextRows = rows.map((row) => {
    if (toSlug(normalizeText(row.cidade)) !== normalizedCitySlug) {
      return row;
    }

    return {
      ...row,
      cidade: city,
      pais: country,
      imagem_card: imageUrl,
      imagem_detalhe: imageUrl,
    };
  });

  await writeEventRows(nextRows, `Update city ${normalizedCitySlug}`);

  return getCitySummaries(false);
}

export async function deleteCity(citySlug: string): Promise<CitySummary[]> {
  const normalizedCitySlug = toSlug(citySlug);
  const rows = await readEventRows(true);
  const nextRows = rows.filter((row) => toSlug(normalizeText(row.cidade)) !== normalizedCitySlug);

  if (nextRows.length === rows.length) {
    throw new EventStorageNotFoundError("Cidade nao encontrada.");
  }

  await writeEventRows(nextRows, `Delete city ${normalizedCitySlug}`);

  return getCitySummaries(false);
}

