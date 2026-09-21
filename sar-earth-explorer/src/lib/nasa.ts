export type NasaSnapshot = {
  collectionTitle: string;
  collectionShortName: string;
  latestGranuleTitle: string | null;
  latestGranuleDate: string | null;
  latestEventTitle: string | null;
  latestEventDate: string | null;
  liveEvents: NasaEvent[];
};

export type NasaEvent = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  latitude: number;
  longitude: number;
  date: string | null;
  link: string;
};

export type NasaMediaAsset = {
  title: string;
  imageUrl: string;
  nasaId: string;
};

export type NasaBackdropAssets = {
  satellite: NasaMediaAsset | null;
  solar: NasaMediaAsset | null;
  spacecraft: NasaMediaAsset | null;
  earth: NasaMediaAsset | null;
};

export type NasaGalleryImage = NasaMediaAsset & {
  caption: string;
};

const NISAR_COLLECTION = 'NISAR_L2_GCOV_BETA_V1';

async function fetchNasaMediaAsset(
  query: string,
  signal?: AbortSignal,
): Promise<NasaMediaAsset | null> {
  const response = await fetch(
    `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=8`,
    { signal },
  );
  if (!response.ok) {
    throw new Error('NASA Image Library is temporarily unavailable.');
  }

  const payload = (await response.json()) as {
    collection?: {
      items?: Array<{
        data?: Array<{
          nasa_id?: string;
          title?: string;
        }>;
        links?: Array<{
          href?: string;
          rel?: string;
          render?: string;
        }>;
      }>;
    };
  };

  const item = payload.collection?.items?.find((candidate) => {
    const imageLink = candidate.links?.find(
      (link) => link.render === 'image' && link.href,
    );
    return Boolean(candidate.data?.[0]?.nasa_id && imageLink?.href);
  });
  const metadata = item?.data?.[0];
  const imageLink =
    item?.links?.find(
      (link) =>
        link.render === 'image' &&
        link.href &&
        (link.href.includes('~medium') || link.href.includes('~large')),
    ) ??
    item?.links?.find((link) => link.render === 'image' && link.href);

  if (!metadata?.nasa_id || !metadata.title || !imageLink?.href) {
    return null;
  }

  return {
    title: metadata.title,
    imageUrl: imageLink.href,
    nasaId: metadata.nasa_id,
  };
}

export async function fetchNasaBackdropAssets(
  signal?: AbortSignal,
): Promise<NasaBackdropAssets> {
  const [satellite, solar, spacecraft, earth] = await Promise.all([
    fetchNasaMediaAsset('satellite in orbit Earth', signal),
    fetchNasaMediaAsset('solar flare Sun', signal),
    fetchNasaMediaAsset('spacecraft deep space', signal),
    fetchNasaMediaAsset('Earth from orbit blue marble', signal),
  ]);

  return { satellite, solar, spacecraft, earth };
}

const GALLERY_QUERIES: Array<{ query: string; caption: string }> = [
  { query: 'NISAR spacecraft radar antenna', caption: 'NISAR under assembly, reflector boom folded for launch' },
  { query: 'Sentinel-1 radar satellite Earth', caption: 'A radar imaging satellite in low Earth orbit' },
  { query: 'glacier retreat satellite imagery', caption: 'Repeat passes turn ice motion into a measurable trend' },
  { query: 'flood radar imagery delta', caption: 'Standing water shows up in radar even under cloud cover' },
  { query: 'agricultural fields aerial radar', caption: 'Field boundaries and crop cycles, read by texture, not color' },
  { query: 'earthquake fault line aerial', caption: 'Ground displacement of a few centimeters, resolved from space' },
];

export async function fetchNasaGallery(
  signal?: AbortSignal,
): Promise<NasaGalleryImage[]> {
  const results = await Promise.all(
    GALLERY_QUERIES.map(async ({ query, caption }) => {
      const asset = await fetchNasaMediaAsset(query, signal);
      return asset ? { ...asset, caption } : null;
    }),
  );

  return results.filter((image): image is NasaGalleryImage => image !== null);
}

export async function fetchNasaSnapshot(
  signal?: AbortSignal,
): Promise<NasaSnapshot> {
  const [collectionsResponse, granulesResponse, eventsResponse] =
    await Promise.all([
      fetch(
        'https://cmr.earthdata.nasa.gov/search/collections.json?keyword=NISAR&page_size=10',
        { signal },
      ),
      fetch(
        `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=${NISAR_COLLECTION}&page_size=1&sort_key=-start_date`,
        { signal },
      ),
      fetch(
        'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=20',
        { signal },
      ),
    ]);

  if (!collectionsResponse.ok || !granulesResponse.ok || !eventsResponse.ok) {
    throw new Error('NASA Earthdata is temporarily unavailable.');
  }

  const [collections, granules, events] = await Promise.all([
    collectionsResponse.json() as Promise<{
      feed?: {
        entry?: Array<{
          title?: string;
          short_name?: string;
        }>;
      };
    }>,
    granulesResponse.json() as Promise<{
      feed?: {
        entry?: Array<{
          title?: string;
          time_start?: string;
        }>;
      };
    }>,
    eventsResponse.json() as Promise<{
      events?: Array<{
          id?: string;
        title?: string;
          description?: string | null;
          link?: string;
          categories?: Array<{ title?: string }>;
        geometry?: Array<{ date?: string }>;
      }>;
    }>,
  ]);

  const collection = collections.feed?.entry?.find(
    (entry) => entry.short_name === NISAR_COLLECTION,
  ) ?? collections.feed?.entry?.[0];
  const granule = granules.feed?.entry?.[0];
  const liveEvents = (events.events ?? [])
    .map((event): NasaEvent | null => {
      const geometry = event.geometry?.[0];
      const coordinates = (geometry as { coordinates?: unknown } | undefined)
        ?.coordinates;
      if (
        !event.id ||
        !event.title ||
        !Array.isArray(coordinates) ||
        typeof coordinates[0] !== 'number' ||
        typeof coordinates[1] !== 'number'
      ) {
        return null;
      }

      return {
        id: event.id,
        title: event.title,
        description: event.description ?? null,
        category: event.categories?.[0]?.title ?? 'Natural event',
        latitude: coordinates[1],
        longitude: coordinates[0],
        date: geometry?.date ?? null,
        link: event.link ?? 'https://eonet.gsfc.nasa.gov/',
      };
    })
    .filter((event): event is NasaEvent => event !== null)
    .slice(0, 8);
  const event = liveEvents[0];

  return {
    collectionTitle:
      collection?.title ?? 'NISAR Earth observation collection',
    collectionShortName: collection?.short_name ?? NISAR_COLLECTION,
    latestGranuleTitle: granule?.title ?? null,
    latestGranuleDate: granule?.time_start ?? null,
    latestEventTitle: event?.title ?? null,
    latestEventDate: event?.date ?? null,
    liveEvents,
  };
}