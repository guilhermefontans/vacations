import { NextResponse } from "next/server";
import {
  EventStorageConfigurationError,
  EventStorageNotFoundError,
  UnsupportedEventMutationError,
} from "@/lib/event-storage";
import { createCityListing, getCitySummaries } from "@/lib/sheets";

type CreateBody = Partial<{
  city: string;
  country: string;
  imageUrl: string;
  date: string;
  time: string;
  name: string;
  address: string;
}>;

function normalizeBody(payload: CreateBody) {
  if (typeof payload.city !== "string" || !payload.city.trim()) {
    throw new Error("Nome da cidade e obrigatorio.");
  }

  if (typeof payload.country !== "string" || !payload.country.trim()) {
    throw new Error("Pais e obrigatorio.");
  }

  if (typeof payload.imageUrl !== "string" || !payload.imageUrl.trim()) {
    throw new Error("URL da imagem e obrigatoria.");
  }

  if (typeof payload.date !== "string" || !payload.date.trim()) {
    throw new Error("Data invalida.");
  }

  if (typeof payload.time !== "string" || !payload.time.trim()) {
    throw new Error("Hora invalida.");
  }

  if (typeof payload.name !== "string" || !payload.name.trim()) {
    throw new Error("Nome do primeiro evento e obrigatorio.");
  }

  return {
    city: payload.city.trim(),
    country: payload.country.trim(),
    imageUrl: payload.imageUrl.trim(),
    date: payload.date.trim(),
    time: payload.time.trim(),
    name: payload.name.trim(),
    address: typeof payload.address === "string" ? payload.address.trim() : "",
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "1";

    const cities = await getCitySummaries(refresh);
    return NextResponse.json({ cities });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateBody;
    const cities = await createCityListing(normalizeBody(payload));

    return NextResponse.json({ cities });
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
