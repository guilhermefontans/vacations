"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { CityDetail, CityStatus, TravelEvent } from "@/lib/types";

type ApiResponse = CityDetail & { error?: string };
type EventMutationResponse = { city?: CityDetail | null; error?: string };

type Props = {
  citySlug: string;
};

type GroupedEvents = {
  label: string;
  sortKey: number;
  events: CityDetail["events"];
};

type EventFormState = {
  eventId: string | null;
  date: string;
  time: string;
  name: string;
  address: string;
  checked: boolean;
};

type EventModalMode = "create" | "edit";

function calcStatusFromRate(completionRate: number): CityStatus {
  if (completionRate < 60) {
    return "low";
  }

  if (completionRate <= 85) {
    return "medium";
  }

  return "high";
}

function toggleEventInDetail(detail: CityDetail, eventId: string, checked: boolean): CityDetail {
  const events = detail.events.map((event) => {
    if (event.id !== eventId) {
      return event;
    }

    return {
      ...event,
      checked,
    };
  });

  const totalEvents = events.length;
  const completedEvents = events.filter((event) => event.checked).length;
  const completionRate = totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 0;

  return {
    summary: {
      ...detail.summary,
      completedEvents,
      completionRate,
      status: calcStatusFromRate(completionRate),
    },
    events,
  };
}

function parseEventDate(value: string): Date | null {
  const normalized = value.trim();
  const direct = new Date(normalized);

  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const isoLike = normalized.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?(?::\d{2})?)?$/,
  );

  if (isoLike) {
    const year = Number(isoLike[1]);
    const month = Number(isoLike[2]) - 1;
    const day = Number(isoLike[3]);
    const hours = Number(isoLike[4] ?? "0");
    const minutes = Number(isoLike[5] ?? "0");
    const seconds = Number(isoLike[6] ?? "0");

    return new Date(year, month, day, hours, minutes, seconds);
  }

  const brDateTime = normalized.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?::\d{2})?)?$/,
  );

  if (!brDateTime) {
    return null;
  }

  const day = Number(brDateTime[1]);
  const month = Number(brDateTime[2]) - 1;
  const year = Number(brDateTime[3]);
  const hours = Number(brDateTime[4] ?? "0");
  const minutes = Number(brDateTime[5] ?? "0");
  const seconds = Number(brDateTime[6] ?? "0");

  return new Date(year, month, day, hours, minutes, seconds);
}

function formatDayLabel(value: string): string {
  const date = parseEventDate(value);

  if (!date) {
    const dayOnly = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (dayOnly) {
      return `${dayOnly[1]}/${dayOnly[2]}/${dayOnly[3]}`;
    }
    return value;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const weekDay = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
  }).format(date);

  return `${weekDay}, ${day}/${month}/${year}`;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) {
    return "Sem periodo";
  }

  const startDate = parseEventDate(start);
  const endDate = parseEventDate(end);

  if (!startDate || !endDate) {
    return `${start} - ${end}`;
  }

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

function formatEventTime(value: string): string {
  const parsed = parseEventDate(value);

  if (!parsed) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function toTimeInputValue(value: string): string {
  const parsed = parseEventDate(value);

  if (!parsed) {
    return "";
  }

  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function toDateInputValue(value: string | null): string {
  const parsed = value ? parseEventDate(value) : null;
  const date = parsed ?? new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createInitialEventForm(defaultDate: string): EventFormState {
  return {
    eventId: null,
    date: defaultDate,
    time: "",
    name: "",
    address: "",
    checked: false,
  };
}

function createEditEventForm(event: TravelEvent): EventFormState {
  return {
    eventId: event.id,
    date: toDateInputValue(event.dateTime),
    time: toTimeInputValue(event.dateTime),
    name: event.name,
    address: event.address,
    checked: event.checked,
  };
}

export default function CityDetailsClient({ citySlug }: Props) {
  const router = useRouter();
  const [data, setData] = useState<CityDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState<boolean>(false);
  const [eventModalMode, setEventModalMode] = useState<EventModalMode>("create");
  const [isSubmittingEvent, setIsSubmittingEvent] = useState<boolean>(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState<boolean>(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [eventFormError, setEventFormError] = useState<string>("");
  const [eventForm, setEventForm] = useState<EventFormState>(() =>
    createInitialEventForm(toDateInputValue(null)),
  );

  const isBusy = Boolean(savingEventId) || isSubmittingEvent || isDeletingEvent;

  async function fetchCityDetail(refresh = false): Promise<CityDetail> {
    const endpoint = refresh ? `/api/cities/${citySlug}?refresh=1` : `/api/cities/${citySlug}`;
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = (await response.json()) as ApiResponse;

    if (!response.ok) {
      throw new Error(payload.error ?? "Falha ao carregar a cidade.");
    }

    return {
      summary: payload.summary,
      events: payload.events,
    };
  }

  async function handleToggleEvent(eventId: string, checked: boolean) {
    if (!data || savingEventId || isSubmittingEvent || isDeletingEvent) {
      return;
    }

    const previousData = data;
    setSavingEventId(eventId);
    setError("");
    setData(toggleEventInDetail(previousData, eventId, checked));

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ checked }),
      });
      const payload = (await response.json()) as EventMutationResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Falha ao atualizar evento.");
      }

      if (payload.city) {
        setData(payload.city);
      }
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : "Erro inesperado ao atualizar evento.";

      setData(previousData);
      setError(message);
    } finally {
      setSavingEventId(null);
    }
  }

  function openCreateEventModal() {
    if (!data) {
      return;
    }

    const defaultDate = toDateInputValue(data.summary.startDate ?? data.summary.endDate);
    setEventModalMode("create");
    setEventForm(createInitialEventForm(defaultDate));
    setEventFormError("");
    setIsDeleteConfirmOpen(false);
    setIsEventModalOpen(true);
  }

  function openEditEventModal(event: TravelEvent) {
    setEventModalMode("edit");
    setEventForm(createEditEventForm(event));
    setEventFormError("");
    setIsDeleteConfirmOpen(false);
    setIsEventModalOpen(true);
  }

  function closeEventModal() {
    if (isSubmittingEvent || isDeletingEvent) {
      return;
    }

    setEventFormError("");
    setIsDeleteConfirmOpen(false);
    setIsEventModalOpen(false);
  }

  async function handleEventSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();

    if (!data || isSubmittingEvent) {
      return;
    }

    setIsSubmittingEvent(true);
    setEventFormError("");
    setError("");

    try {
      const response = await fetch(
        eventModalMode === "create" ? `/api/cities/${citySlug}/events` : `/api/events/${eventForm.eventId}`,
        {
          method: eventModalMode === "create" ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            eventModalMode === "create"
              ? {
                  date: eventForm.date,
                  time: eventForm.time,
                  name: eventForm.name,
                  address: eventForm.address,
                  checked: eventForm.checked,
                }
              : {
                  evento: eventForm.name,
                  endereco: eventForm.address,
                  datetime: `${eventForm.date}T${eventForm.time}:00`,
                  checked: eventForm.checked,
                },
          ),
        },
      );
      const payload = (await response.json()) as EventMutationResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? (eventModalMode === "create" ? "Falha ao adicionar evento." : "Falha ao editar evento."));
      }

      if (payload.city) {
        setData(payload.city);
      }

      setEventFormError("");
      setIsDeleteConfirmOpen(false);
      setIsEventModalOpen(false);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : eventModalMode === "create"
            ? "Erro inesperado ao adicionar evento."
            : "Erro inesperado ao editar evento.";
      setEventFormError(message);
    } finally {
      setIsSubmittingEvent(false);
    }
  }

  async function handleDeleteEvent() {
    if (eventModalMode !== "edit" || !eventForm.eventId || isDeletingEvent) {
      return;
    }

    setIsDeletingEvent(true);
    setEventFormError("");
    setError("");

    try {
      const response = await fetch(`/api/events/${eventForm.eventId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as EventMutationResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Falha ao excluir evento.");
      }

      if (payload.city) {
        setData(payload.city);
      } else {
        setData(null);
        router.push("/");
      }

      setIsDeleteConfirmOpen(false);
      setIsEventModalOpen(false);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Erro inesperado ao excluir evento.";
      setEventFormError(message);
    } finally {
      setIsDeletingEvent(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadDetail() {
      try {
        const detail = await fetchCityDetail();

        if (!isMounted) {
          return;
        }

        setData(detail);
        setError("");
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        const message =
          loadError instanceof Error ? loadError.message : "Erro inesperado ao carregar cidade.";
        setError(message);
        setData(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      isMounted = false;
    };
  }, [citySlug]);

  const progressText = useMemo(() => {
    if (!data) {
      return "";
    }

    return `${data.summary.completionRate}% das atracoes visitadas`;
  }, [data]);

  const groupedEvents = useMemo((): GroupedEvents[] => {
    if (!data) {
      return [];
    }

    const groupedMap = new Map<string, GroupedEvents>();

    for (const event of data.events) {
      const label = formatDayLabel(event.dateTime);
      const parsed = parseEventDate(event.dateTime);
      const sortKey = parsed
        ? new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime()
        : Number.MAX_SAFE_INTEGER;

      if (!groupedMap.has(label)) {
        groupedMap.set(label, {
          label,
          sortKey,
          events: [],
        });
      }

      groupedMap.get(label)?.events.push(event);
    }

    return [...groupedMap.values()].sort((a, b) => a.sortKey - b.sortKey);
  }, [data]);

  return (
    <main className="min-h-screen bg-[#f2f1f8] p-3 md:p-6">
      <section className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border-[3px] border-zinc-900 bg-white shadow-[0_24px_50px_rgba(19,22,37,0.18)]">
        <div className="relative h-52 w-full md:h-72">
          {data?.summary.coverImage && (
            <Image
              src={data.summary.coverImage}
              alt={`Plano de fundo de ${data.summary.city}`}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/55" />

          <Link
            href="/"
            className="absolute left-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-black/35 text-xl text-white backdrop-blur"
            aria-label="Voltar para listagem"
          >
            ←
          </Link>

          <div className="absolute bottom-4 left-4 right-4 md:bottom-6 md:left-8">
            <h1 className="font-display text-5xl leading-none text-white drop-shadow md:text-6xl">
              {data?.summary.city ?? "Cidade"}
            </h1>
            <p className="mt-2 text-sm font-semibold text-white md:text-base">
              📅 {formatDateRange(data?.summary.startDate ?? null, data?.summary.endDate ?? null)}
            </p>
            <p className="mt-3 inline-flex rounded-full bg-emerald-100 px-4 py-1 text-sm font-bold text-emerald-700 md:text-base">
              {progressText}
            </p>
          </div>
        </div>

        <div className="p-3 md:p-6">
          {isLoading && <p className="mb-3 text-sm text-zinc-700">Carregando eventos...</p>}
          {savingEventId && !error && <p className="mb-3 text-sm text-zinc-700">Salvando alteracao...</p>}
          {isSubmittingEvent && !error && !eventFormError && (
            <p className="mb-3 text-sm text-zinc-700">
              {eventModalMode === "create" ? "Adicionando evento..." : "Salvando evento..."}
            </p>
          )}
          {isDeletingEvent && !error && !eventFormError && <p className="mb-3 text-sm text-zinc-700">Excluindo evento...</p>}
          {error && <p className="mb-3 rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</p>}

          {!isLoading && !error && data && data.events.length === 0 && (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              Nenhum evento cadastrado para esta cidade.
            </p>
          )}

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <h2 className="text-xl font-bold text-[#4a3da6]">Eventos programados</h2>

              <button
                type="button"
                onClick={openCreateEventModal}
                disabled={!data || isSubmittingEvent || isDeletingEvent}
                className="inline-flex items-center gap-2 rounded-full border border-[#c8c3ef] bg-[#f5f2ff] px-3 py-2 text-xs font-bold text-[#4a3da6] transition hover:bg-[#ede7ff] disabled:cursor-not-allowed disabled:opacity-60 md:px-4 md:text-sm"
              >
                <span className="text-base leading-none md:text-lg">+</span>
                <span>Adicionar evento</span>
              </button>
            </div>

            <ul>
              {groupedEvents.map((group) => (
                <li key={group.label} className="border-b border-zinc-100 last:border-b-0">
                  <div className="bg-zinc-50 px-3 py-2 text-xs font-bold capitalize tracking-wide text-[#5a47b8] md:px-4 md:text-sm">
                    {group.label}
                  </div>

                  <ul>
                    {group.events.map((event) => (
                      <li key={event.id} className="border-t border-zinc-100 px-3 py-2 md:px-4 md:py-3">
                        <div className="grid grid-cols-[auto_64px_1fr_auto] items-center gap-2 md:grid-cols-[auto_84px_1fr_auto] md:gap-4">
                          <input
                            id={event.id}
                            type="checkbox"
                            checked={event.checked}
                            disabled={isBusy}
                            onChange={(inputEvent) => {
                              void handleToggleEvent(event.id, inputEvent.currentTarget.checked);
                            }}
                            className="h-5 w-5 cursor-pointer rounded border-zinc-300 accent-[#5a47b8] disabled:cursor-wait disabled:opacity-60"
                          />

                          <span className="text-sm font-bold text-[#5a47b8] md:text-xl">
                            {formatEventTime(event.dateTime)}
                          </span>

                          <div className="min-w-0">
                            <label htmlFor={event.id} className="line-clamp-1 block text-sm font-bold text-zinc-900 md:text-2xl">
                              {event.name}
                            </label>
                            <p className="line-clamp-1 text-xs text-zinc-500 md:text-base">
                              {event.address || "Sem endereco informado"}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 md:gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                openEditEventModal(event);
                              }}
                              disabled={isBusy}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d5d0ef] bg-white text-sm text-[#4a3da6] transition hover:bg-[#f5f2ff] disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Editar ${event.name}`}
                              title="Editar evento"
                            >
                              ✎
                            </button>

                            {event.mapsUrl ? (
                              <a
                                href={event.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xl"
                                aria-label={`Abrir endereco de ${event.name} no Google Maps`}
                                title="Abrir no Google Maps"
                              >
                                📍
                              </a>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full text-xl opacity-35"
                                aria-label={`Endereco indisponivel para ${event.name}`}
                                title="Sem endereco"
                              >
                                📍
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {isEventModalOpen && data && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 md:items-center md:p-6">
          <div className="w-full max-w-xl overflow-hidden rounded-[2rem] border-[3px] border-zinc-900 bg-[#f8f8fc] shadow-[0_24px_50px_rgba(19,22,37,0.26)]">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-4 py-4 md:px-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#7a6ad6]">{data.summary.city}</p>
                <h2 className="mt-1 text-2xl font-bold text-[#4a3da6] md:text-3xl">
                  {eventModalMode === "create" ? "Adicionar evento" : "Editar evento"}
                </h2>
                <p className="mt-2 text-sm text-zinc-600">
                  {eventModalMode === "create"
                    ? "Cidade e pais sao preenchidos automaticamente. Informe apenas os dados do novo evento."
                    : "Atualize os dados do evento ou exclua esta parada do roteiro."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeEventModal}
                disabled={isSubmittingEvent || isDeletingEvent}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d5d0ef] bg-white text-lg text-[#4a3da6] disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Fechar modal de evento"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEventSubmit} className="space-y-4 p-4 md:p-6">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-zinc-800">Data</span>
                  <input
                    type="date"
                    value={eventForm.date}
                    onChange={(inputEvent) => {
                      const value = inputEvent.currentTarget.value;

                      setEventForm((current) => ({
                        ...current,
                        date: value,
                      }));
                    }}
                    required
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[#7a6ad6] focus:ring-2 focus:ring-[#dcd3ff]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-zinc-800">Hora</span>
                  <input
                    type="time"
                    value={eventForm.time}
                    onChange={(inputEvent) => {
                      const value = inputEvent.currentTarget.value;

                      setEventForm((current) => ({
                        ...current,
                        time: value,
                      }));
                    }}
                    required
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[#7a6ad6] focus:ring-2 focus:ring-[#dcd3ff]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-zinc-800">Nome do evento</span>
                <input
                  type="text"
                  value={eventForm.name}
                  onChange={(inputEvent) => {
                    const value = inputEvent.currentTarget.value;

                    setEventForm((current) => ({
                      ...current,
                      name: value,
                    }));
                  }}
                  required
                  placeholder="Ex.: Passeio no bairro gotico"
                  className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[#7a6ad6] focus:ring-2 focus:ring-[#dcd3ff]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-zinc-800">Endereco (opcional)</span>
                <textarea
                  value={eventForm.address}
                  onChange={(inputEvent) => {
                    const value = inputEvent.currentTarget.value;

                    setEventForm((current) => ({
                      ...current,
                      address: value,
                    }));
                  }}
                  rows={3}
                  placeholder="Ex.: Rua, numero ou ponto de encontro"
                  className="w-full resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[#7a6ad6] focus:ring-2 focus:ring-[#dcd3ff]"
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={eventForm.checked}
                  onChange={(inputEvent) => {
                    const checked = inputEvent.currentTarget.checked;

                    setEventForm((current) => ({
                      ...current,
                      checked,
                    }));
                  }}
                  className="h-5 w-5 rounded border-zinc-300 accent-[#5a47b8]"
                />
                <span className="text-sm font-bold text-zinc-800">Marcar como realizado</span>
              </label>

              {eventModalMode === "edit" && isDeleteConfirmOpen && (
                <div className="rounded-2xl border border-red-300 bg-red-50 p-4">
                  <p className="text-sm font-bold text-red-700">Confirmar exclusao deste evento?</p>
                  <p className="mt-1 text-sm text-red-600">Esta acao remove o evento do roteiro e atualiza a cidade imediatamente. Fechar o modal cancela a exclusao.</p>
                </div>
              )}

              {eventFormError && (
                <p className="rounded-2xl border border-red-300 bg-red-100 p-3 text-sm text-red-700">{eventFormError}</p>
              )}

              <div className="flex flex-col-reverse gap-2 pt-1 md:flex-row md:justify-end">
                {eventModalMode === "create" ? (
                  <button
                    type="button"
                    onClick={closeEventModal}
                    disabled={isSubmittingEvent || isDeletingEvent}
                    className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-3 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (isDeleteConfirmOpen) {
                        void handleDeleteEvent();
                        return;
                      }

                      setIsDeleteConfirmOpen(true);
                      setEventFormError("");
                    }}
                    disabled={isSubmittingEvent || isDeletingEvent}
                    className={`inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isDeleteConfirmOpen
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "border border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                    }`}
                  >
                    {isDeletingEvent ? "Excluindo..." : isDeleteConfirmOpen ? "Confirmar exclusao" : "Excluir evento"}
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingEvent || isDeletingEvent}
                  className="inline-flex items-center justify-center rounded-full bg-[#4a3da6] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#3f338e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingEvent
                    ? eventModalMode === "create"
                      ? "Salvando evento..."
                      : "Atualizando evento..."
                    : eventModalMode === "create"
                      ? "Salvar evento"
                      : "Salvar alteracoes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
