import CityDetailsClient from "@/app/cidades/[city]/CityDetailsClient";

type PageProps = {
  params: Promise<{ city: string }>;
};

export default async function CityPage({ params }: PageProps) {
  const resolved = await params;
  return <CityDetailsClient citySlug={resolved.city} />;
}
