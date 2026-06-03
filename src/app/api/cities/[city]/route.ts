import { NextResponse } from "next/server";
import {
  EventStorageConfigurationError,
  EventStorageNotFoundError,
  UnsupportedEventMutationError,
} from "@/lib/event-storage";
import { deleteCity, getCityDetail, updateCity } from "@/lib/sheets";

type Params = {
  params: Promise<{ city: string }>;
};

type UpdateBody = Partial<{
  city: string;
  country: string;
  imageUrl: string;
}>;

function normalizeUpdateBody(payload: UpdateBody) {
  if (typeof payload.city !== "string" || !payload.city.trim()) {
    throw new Error("Nome da cidade e obrigatorio.");
  }

  if (typeof payload.country !== "string" || !payload.country.trim()) {
    throw new Error("Pais e obrigatorio.");
  }

  if (typeof payload.imageUrl !== "string" || !payload.imageUrl.trim()) {
    throw new Error("URL da imagem e obrigatoria.");
  }

  return {
    city: payload.city.trim(),
    country: payload.country.trim(),
    imageUrl: payload.imageUrl.trim(),
  };
}

export async function GET(_: Request, { params }: Params) {
  try {
    const { searchParams } = new URL(_.url);
    const refresh = searchParams.get("refresh") === "1";
    const resolvedParams = await params;
    const city = await getCityDetail(resolvedParams.city, refresh);

    if (!city) {
      return NextResponse.json({ error: "Cidade nao encontrada." }, { status: 404 });
    }

    return NextResponse.json(city);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const resolvedParams = await params;
    const payload = (await request.json()) as UpdateBody;
    const cities = await updateCity(resolvedParams.city, normalizeUpdateBody(payload));

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

export async function DELETE(_: Request, { params }: Params) {
  try {
    const resolvedParams = await params;
    const cities = await deleteCity(resolvedParams.city);

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
