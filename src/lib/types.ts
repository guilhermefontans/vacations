export type CityStatus = "low" | "medium" | "high";

export type RawSheetEvent = {
  id: string;
  pais: string;
  cidade: string;
  evento: string;
  datetime: string;
  checked: string;
  endereco: string;
  imagem_card?: string;
  imagem_detalhe?: string;
};

export type TravelEvent = {
  id: string;
  country: string;
  city: string;
  citySlug: string;
  name: string;
  dateTime: string;
  checked: boolean;
  address: string;
  cardImage: string;
  coverImage: string;
  mapsUrl: string | null;
};

export type CitySummary = {
  country: string;
  city: string;
  slug: string;
  startDate: string | null;
  endDate: string | null;
  totalEvents: number;
  completedEvents: number;
  completionRate: number;
  status: CityStatus;
  cardImage: string;
  coverImage: string;
};

export type CityDetail = {
  summary: CitySummary;
  events: TravelEvent[];
};
