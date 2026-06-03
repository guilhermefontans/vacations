export const CITY_DEFAULTS: Record<
  string,
  {
    country: string;
    cardImage: string;
    coverImage: string;
  }
> = {
  Paris: {
    country: "Franca",
    cardImage:
      "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80",
    coverImage:
      "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1600&q=80",
  },
  Madri: {
    country: "Espanha",
    cardImage:
      "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=1200&q=80",
    coverImage:
      "https://images.unsplash.com/photo-1543783207-ec64e4d95325?auto=format&fit=crop&w=1600&q=80",
  },
  Barcelona: {
    country: "Espanha",
    cardImage:
      "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=1200&q=80",
    coverImage:
      "https://images.unsplash.com/photo-1471623432079-b009d30b6729?auto=format&fit=crop&w=1600&q=80",
  },
  Roma: {
    country: "Italia",
    cardImage:
      "https://images.unsplash.com/photo-1529260830199-42c24126f198?auto=format&fit=crop&w=1200&q=80",
    coverImage:
      "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1600&q=80",
  },
};

export const FALLBACK_CITY_DEFAULTS = {
  country: "Destino",
  cardImage: "https://placehold.co/1200x800/png?text=Destino",
  coverImage: "https://placehold.co/1600x900/png?text=Destino",
} as const;

export const API_ERROR_PREFIX = "Google Sheets integration error:";
