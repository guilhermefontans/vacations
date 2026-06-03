import { NextResponse } from "next/server";
import {
  EventStorageConfigurationError,
  EventStorageNotFoundError,
  UnsupportedEventMutationError,
} from "@/lib/event-storage";
import { deleteEvent, getCityDetail, updateEvent } from "@/lib/sheets";
import type { RawSheetEvent } from "@/lib/types";

type Params = {
  params: Promise<{ eventId: string }>;
};

type UpdateBody = Partial<{
  pais: string;
  cidade: string;
  evento: string;
  datetime: string;
  checked: boolean | string;
  endereco: string;
  imagem_card: string;
  imagem_detalhe: string;
}>;

function normalizeBody(payload: UpdateBody): Partial<RawSheetEvent> {
  const next: Partial<RawSheetEvent> = {};
  const stringFields: Array<keyof Omit<RawSheetEvent, "checked">> = [
    "id",
    "pais",
    "cidade",
    "evento",
    "datetime",
    "endereco",
    "imagem_card",
    "imagem_detalhe",
  ];

  for (const field of stringFields) {
    if (!(field in payload)) {
      continue;
    }

    const value = payload[field as keyof UpdateBody];

    if (typeof value !== "string") {
      throw new Error(`Campo invalido: ${field}.`);
    }

    next[field] = value.trim();
  }

  if ("checked" in payload) {
    const value = payload.checked;

    if (typeof value !== "boolean" && typeof value !== "string") {
      throw new Error("Campo invalido: checked.");
    }

    next.checked = typeof value === "boolean" ? String(value) : value.trim();
  }

  if (Object.keys(next).length === 0) {
    throw new Error("Nenhum campo valido para atualizar.");
  }

  return next;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const resolvedParams = await params;
    const payload = (await request.json()) as UpdateBody;
    const updated = await updateEvent(resolvedParams.eventId, normalizeBody(payload));

    if (!updated) {
      return NextResponse.json({ error: "Evento nao encontrado." }, { status: 404 });
    }

    const city = await getCityDetail(updated.citySlug);
    return NextResponse.json({ event: updated, city });
  } catch (error) {
    if (error instanceof UnsupportedEventMutationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof EventStorageNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof EventStorageConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const resolvedParams = await params;
    const city = await deleteEvent(resolvedParams.eventId);

    return NextResponse.json({ city });
  } catch (error) {
    if (error instanceof UnsupportedEventMutationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof EventStorageNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof EventStorageConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}