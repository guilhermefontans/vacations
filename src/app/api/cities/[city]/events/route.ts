import { NextResponse } from "next/server";
import {
  EventStorageConfigurationError,
  EventStorageNotFoundError,
  UnsupportedEventMutationError,
} from "@/lib/event-storage";
import { createEvent } from "@/lib/sheets";

type Params = {
  params: Promise<{ city: string }>;
};

type CreateBody = Partial<{
  date: string;
  time: string;
  name: string;
  address: string;
  checked: boolean | string;
}>;

function normalizeBody(payload: CreateBody) {
  if (typeof payload.date !== "string" || !payload.date.trim()) {
    throw new Error("Data invalida.");
  }

  if (typeof payload.time !== "string" || !payload.time.trim()) {
    throw new Error("Hora invalida.");
  }

  if (typeof payload.name !== "string" || !payload.name.trim()) {
    throw new Error("Nome do evento e obrigatorio.");
  }

  let checked = false;

  if (typeof payload.checked === "boolean") {
    checked = payload.checked;
  } else if (typeof payload.checked === "string") {
    checked = payload.checked.trim().toLowerCase() === "true";
  }

  return {
    date: payload.date.trim(),
    time: payload.time.trim(),
    name: payload.name.trim(),
    address: typeof payload.address === "string" ? payload.address.trim() : "",
    checked,
  };
}

export async function POST(request: Request, { params }: Params) {
  try {
    const resolvedParams = await params;
    const payload = (await request.json()) as CreateBody;
    const city = await createEvent(resolvedParams.city, normalizeBody(payload));

    if (!city) {
      return NextResponse.json({ error: "Cidade nao encontrada." }, { status: 404 });
    }

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