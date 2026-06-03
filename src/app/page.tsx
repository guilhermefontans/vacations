"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { CitySummary } from "@/lib/types";

type ApiResponse = {
  cities?: CitySummary[];
  error?: string;
};

type CityFormState = {
  citySlug: string | null;
  city: string;
  country: string;
  imageUrl: string;
  date: string;
  time: string;
  name: string;
  address: string;
};

type CityModalMode = "create" | "edit";

function todayInputValue(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createInitialCityForm(): CityFormState {
  return {
    citySlug: null,
    city: "",
    country: "",
    imageUrl: "",
    date: todayInputValue(),
    time: "",
    name: "",
    address: "",
  };
}

function createEditCityForm(city: CitySummary): CityFormState {
  return {
    citySlug: city.slug,
    city: city.city,
    country: city.country,
    imageUrl: city.cardImage,
    date: todayInputValue(),
    time: "",
    name: "",
    address: "",
  };
}

function parseListingDate(value: string): Date | null {
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
    return new Date(year, month, day);
  }

  const brDate = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})/);

  if (brDate) {
    const day = Number(brDate[1]);
    const month = Number(brDate[2]) - 1;
    const year = Number(brDate[3]);
    return new Date(year, month, day);
  }

  return null;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "--/--/----";
  }

  const normalized = value.trim();
  const date = parseListingDate(normalized);

  if (!date) {
    return normalized;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());

  return `${day}/${month}/${year}`;
}

function statusStyles(status: CitySummary["status"]): {
  card: string;
  badge: string;
  text: string;
  symbol: string;
} {
  if (status === "low") {
    return {
      card: "border-red-400",
      badge: "bg-red-500",
      text: "text-red-500",
      symbol: "!",
    };
  }

  if (status === "medium") {
    return {
      card: "border-amber-400",
      badge: "bg-amber-500",
      text: "text-amber-500",
      symbol: "-",
    };
  }

  return {
    card: "border-emerald-400",
    badge: "bg-emerald-500",
    text: "text-emerald-600",
    symbol: "✓",
  };
}

export default function HomePage() {
  const [cities, setCities] = useState<CitySummary[]>([]);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCityModalOpen, setIsCityModalOpen] = useState<boolean>(false);
  const [cityModalMode, setCityModalMode] = useState<CityModalMode>("create");
  const [isSubmittingCity, setIsSubmittingCity] = useState<boolean>(false);
  const [isDeletingCity, setIsDeletingCity] = useState<boolean>(false);
  const [isDeleteCityConfirmOpen, setIsDeleteCityConfirmOpen] = useState<boolean>(false);
  const [cityFormError, setCityFormError] = useState<string>("");
  const [cityForm, setCityForm] = useState<CityFormState>(() => createInitialCityForm());

  useEffect(() => {
    async function loadCities(refresh = false) {
      try {
        const endpoint = refresh ? "/api/cities?refresh=1" : "/api/cities";
        const response = await fetch(endpoint, { cache: "no-store" });
        const data = (await response.json()) as ApiResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Falha ao carregar cidades.");
        }

        setCities(data.cities ?? []);
        setError("");
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : "Erro inesperado ao carregar cidades.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadCities();
  }, []);

  async function refreshCities() {
    setIsLoading(true);

    try {
      const response = await fetch("/api/cities?refresh=1", { cache: "no-store" });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Falha ao atualizar cidades.");
      }

      setCities(data.cities ?? []);
      setError("");
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Erro inesperado ao atualizar cidades.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function openCreateCityModal() {
    setCityModalMode("create");
    setCityForm(createInitialCityForm());
    setCityFormError("");
    setIsDeleteCityConfirmOpen(false);
    setIsCityModalOpen(true);
  }

  function openEditCityModal(city: CitySummary) {
    setCityModalMode("edit");
    setCityForm(createEditCityForm(city));
    setCityFormError("");
    setIsDeleteCityConfirmOpen(false);
    setIsCityModalOpen(true);
  }

  function closeCityModal() {
    if (isSubmittingCity || isDeletingCity) {
      return;
    }

    setCityFormError("");
    setIsDeleteCityConfirmOpen(false);
    setIsCityModalOpen(false);
  }

  async function handleCitySubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();

    if (isSubmittingCity) {
      return;
    }

    setIsSubmittingCity(true);
    setCityFormError("");
    setError("");

    try {
      const response = await fetch(cityModalMode === "create" ? "/api/cities" : `/api/cities/${cityForm.citySlug}`, {
        method: cityModalMode === "create" ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          cityModalMode === "create"
            ? {
                city: cityForm.city,
                country: cityForm.country,
                imageUrl: cityForm.imageUrl,
                date: cityForm.date,
                time: cityForm.time,
                name: cityForm.name,
                address: cityForm.address,
              }
            : {
                city: cityForm.city,
                country: cityForm.country,
                imageUrl: cityForm.imageUrl,
              },
        ),
      });
      const payload = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? (cityModalMode === "create" ? "Falha ao criar cidade." : "Falha ao atualizar cidade."));
      }

      setCities(payload.cities ?? []);
      setIsDeleteCityConfirmOpen(false);
      setIsCityModalOpen(false);
    } catch (cityError) {
      const message =
        cityError instanceof Error
          ? cityError.message
          : cityModalMode === "create"
            ? "Erro inesperado ao criar cidade."
            : "Erro inesperado ao atualizar cidade.";
      setCityFormError(message);
    } finally {
      setIsSubmittingCity(false);
    }
  }

  async function handleDeleteCity() {
    if (cityModalMode !== "edit" || !cityForm.citySlug || isDeletingCity) {
      return;
    }

    setIsDeletingCity(true);
    setCityFormError("");
    setError("");

    try {
      const response = await fetch(`/api/cities/${cityForm.citySlug}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Falha ao excluir cidade.");
      }

      setCities(payload.cities ?? []);
      setIsDeleteCityConfirmOpen(false);
      setIsCityModalOpen(false);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Erro inesperado ao excluir cidade.";
      setCityFormError(message);
    } finally {
      setIsDeletingCity(false);
    }
  }

  const hasCities = useMemo(() => cities.length > 0, [cities.length]);

  return (
    <main className="min-h-screen bg-[#f2f1f8] p-3 md:p-6">
      <section className="mx-auto max-w-5xl rounded-[2rem] border-[3px] border-zinc-900 bg-[#f8f8fc] p-3 shadow-[0_24px_50px_rgba(19,22,37,0.18)] md:p-5">
        <header className="mb-3 px-1 py-2 md:mb-5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#c8c3ef] bg-white text-[#5c50b8]"
              aria-label="Atualizar listagens"
              title="Atualizar"
              onClick={() => {
                void refreshCities();
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-[18px] w-[18px]"
                aria-hidden="true"
              >
                <path
                  d="M20 5V9H16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4 19V15H8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6.8 10C7.6 7.7 9.6 6 12 6C13.8 6 15.5 7 16.5 8.5L20 9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M17.2 14C16.4 16.3 14.4 18 12 18C10.2 18 8.5 17 7.5 15.5L4 15"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <h1 className="text-base font-bold text-[#4a3da6] md:text-lg">Roteiro Ferias</h1>

            <button
              type="button"
              onClick={openCreateCityModal}
              disabled={isSubmittingCity}
              className="inline-flex items-center gap-1 rounded-full border border-[#c8c3ef] bg-[#f5f2ff] px-3 py-2 text-[11px] font-bold text-[#4a3da6] transition hover:bg-[#ede7ff] disabled:cursor-not-allowed disabled:opacity-60 md:text-xs"
            >
              <span className="text-base leading-none">+</span>
              <span>Nova cidade</span>
            </button>
          </div>
        </header>

        {isLoading && <p className="px-2 text-sm text-zinc-700">Carregando cidades...</p>}
        {(isSubmittingCity || isDeletingCity) && !cityFormError && (
          <p className="px-2 text-sm text-zinc-700">
            {isDeletingCity
              ? "Excluindo cidade..."
              : cityModalMode === "create"
                ? "Criando cidade..."
                : "Salvando cidade..."}
          </p>
        )}

        {error && <div className="mx-2 rounded-2xl border border-red-300 bg-red-100 p-3 text-sm text-red-700">{error}</div>}

        {!isLoading && !error && !hasCities && (
          <div className="mx-2 rounded-2xl border border-zinc-300 bg-white p-3 text-sm text-zinc-700">
            Nenhuma cidade encontrada.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          {cities.map((city) => {
            const styles = statusStyles(city.status);

            return (
              <article key={city.slug} className="flex flex-col gap-1">
                <Link
                  href={`/cidades/${city.slug}`}
                  className={`overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${styles.card}`}
                >
                  <div className="flex gap-3 p-2 md:block md:p-0">
                    <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl md:h-44 md:w-full md:rounded-none">
                      <Image
                        src={city.cardImage}
                        alt={`Foto de ${city.city}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 767px) 112px, 50vw"
                      />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-between py-1 pr-2 md:px-3 md:pb-3 md:pt-2">
                      <h2 className="font-display text-[1.95rem] leading-none text-zinc-900 md:text-[2.15rem]">{city.city}</h2>

                      <p className="mt-1 text-[11px] font-medium text-zinc-500 md:mt-2">
                        📅 {formatDate(city.startDate)} - {formatDate(city.endDate)}
                      </p>

                      <div className="mt-2 flex items-end justify-between md:mt-3">
                        <p className={`text-xs font-semibold md:text-sm ${styles.text}`}>
                          {city.completionRate}% das atracoes visitadas
                        </p>
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${styles.badge}`}
                        >
                          {styles.symbol}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>

                {city.status === "high" && (
                  <p className="px-2 text-xs font-semibold text-emerald-600">✓ Roteiro concluido nesta cidade</p>
                )}

                <div className="flex items-center justify-end px-2">
                  <button
                    type="button"
                    onClick={() => {
                      openEditCityModal(city);
                    }}
                    disabled={isSubmittingCity}
                    className="inline-flex items-center gap-2 rounded-full border border-[#d5d0ef] bg-white px-3 py-2 text-xs font-bold text-[#4a3da6] transition hover:bg-[#f5f2ff] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span aria-hidden="true">✎</span>
                    <span>Editar cidade</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {isCityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 md:items-center md:p-6">
          <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border-[3px] border-zinc-900 bg-[#f8f8fc] shadow-[0_24px_50px_rgba(19,22,37,0.26)]">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-4 py-4 md:px-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#7a6ad6]">
                  {cityModalMode === "create" ? "Nova cidade" : "Editar cidade"}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-[#4a3da6] md:text-3xl">
                  {cityModalMode === "create" ? "Adicionar cidade" : "Editar cidade"}
                </h2>
                <p className="mt-2 text-sm text-zinc-600">
                  {cityModalMode === "create"
                    ? "Crie uma nova cidade com a imagem do card e o primeiro evento do roteiro."
                    : "Atualize o nome da cidade, o pais e a imagem usada no card e no detalhe."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeCityModal}
                disabled={isSubmittingCity}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d5d0ef] bg-white text-lg text-[#4a3da6] disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Fechar modal de cidade"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCitySubmit} className="space-y-4 p-4 md:p-6">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-zinc-800">Cidade</span>
                  <input
                    type="text"
                    value={cityForm.city}
                    onChange={(inputEvent) => {
                      const value = inputEvent.currentTarget.value;

                      setCityForm((current) => ({
                        ...current,
                        city: value,
                      }));
                    }}
                    required
                    placeholder="Ex.: Lisboa"
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[#7a6ad6] focus:ring-2 focus:ring-[#dcd3ff]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-zinc-800">Pais</span>
                  <input
                    type="text"
                    value={cityForm.country}
                    onChange={(inputEvent) => {
                      const value = inputEvent.currentTarget.value;

                      setCityForm((current) => ({
                        ...current,
                        country: value,
                      }));
                    }}
                    required
                    placeholder="Ex.: Portugal"
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[#7a6ad6] focus:ring-2 focus:ring-[#dcd3ff]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-zinc-800">URL da imagem</span>
                <input
                  type="url"
                  value={cityForm.imageUrl}
                  onChange={(inputEvent) => {
                    const value = inputEvent.currentTarget.value;

                    setCityForm((current) => ({
                      ...current,
                      imageUrl: value,
                    }));
                  }}
                  required
                  placeholder="https://exemplo.com/imagem.jpg"
                  className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[#7a6ad6] focus:ring-2 focus:ring-[#dcd3ff]"
                />
              </label>

              {cityModalMode === "create" && (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-zinc-800">Data do primeiro evento</span>
                      <input
                        type="date"
                        value={cityForm.date}
                        onChange={(inputEvent) => {
                          const value = inputEvent.currentTarget.value;

                          setCityForm((current) => ({
                            ...current,
                            date: value,
                          }));
                        }}
                        required
                        className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[#7a6ad6] focus:ring-2 focus:ring-[#dcd3ff]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-zinc-800">Hora do primeiro evento</span>
                      <input
                        type="time"
                        value={cityForm.time}
                        onChange={(inputEvent) => {
                          const value = inputEvent.currentTarget.value;

                          setCityForm((current) => ({
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
                    <span className="mb-2 block text-sm font-bold text-zinc-800">Primeiro evento</span>
                    <input
                      type="text"
                      value={cityForm.name}
                      onChange={(inputEvent) => {
                        const value = inputEvent.currentTarget.value;

                        setCityForm((current) => ({
                          ...current,
                          name: value,
                        }));
                      }}
                      required
                      placeholder="Ex.: Passeio pelo centro historico"
                      className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[#7a6ad6] focus:ring-2 focus:ring-[#dcd3ff]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-zinc-800">Endereco do primeiro evento (opcional)</span>
                    <textarea
                      value={cityForm.address}
                      onChange={(inputEvent) => {
                        const value = inputEvent.currentTarget.value;

                        setCityForm((current) => ({
                          ...current,
                          address: value,
                        }));
                      }}
                      rows={3}
                      placeholder="Ex.: Rua, numero ou ponto de encontro"
                      className="w-full resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[#7a6ad6] focus:ring-2 focus:ring-[#dcd3ff]"
                    />
                  </label>
                </>
              )}

              {cityModalMode === "edit" && isDeleteCityConfirmOpen && (
                <div className="rounded-2xl border border-red-300 bg-red-50 p-4">
                  <p className="text-sm font-bold text-red-700">Confirmar exclusao desta cidade?</p>
                  <p className="mt-1 text-sm text-red-600">Todos os eventos desta cidade serao removidos. Fechar o modal cancela a exclusao.</p>
                </div>
              )}

              {cityFormError && (
                <p className="rounded-2xl border border-red-300 bg-red-100 p-3 text-sm text-red-700">{cityFormError}</p>
              )}

              <div className="flex flex-col-reverse gap-2 pt-1 md:flex-row md:justify-end">
                {cityModalMode === "create" ? (
                  <button
                    type="button"
                    onClick={closeCityModal}
                    disabled={isSubmittingCity || isDeletingCity}
                    className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-3 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (isDeleteCityConfirmOpen) {
                        void handleDeleteCity();
                        return;
                      }

                      setIsDeleteCityConfirmOpen(true);
                      setCityFormError("");
                    }}
                    disabled={isSubmittingCity || isDeletingCity}
                    className={`inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isDeleteCityConfirmOpen
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "border border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                    }`}
                  >
                    {isDeletingCity ? "Excluindo..." : isDeleteCityConfirmOpen ? "Confirmar exclusao" : "Excluir cidade"}
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingCity || isDeletingCity}
                  className="inline-flex items-center justify-center rounded-full bg-[#4a3da6] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#3f338e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingCity
                    ? cityModalMode === "create"
                      ? "Salvando cidade..."
                      : "Atualizando cidade..."
                    : cityModalMode === "create"
                      ? "Salvar cidade"
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
