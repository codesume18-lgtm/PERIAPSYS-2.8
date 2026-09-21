import { useEffect, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import EarthGlobe3D from '@/components/EarthGlobe3D';
import {
  fetchNasaBackdropAssets,
  fetchNasaGallery,
  fetchNasaSnapshot,
  type NasaEvent,
  type NasaGalleryImage,
  type NasaSnapshot,
} from '@/lib/nasa';
import {
  ArrowDownRight, ArrowLeft, ArrowRight, CalendarDays, Check,
  CircleHelp, Compass, Database, Eye, EyeOff,
  ExternalLink, MapPin, Menu, MousePointer2, Orbit, Play, Radio, Radar,
  RefreshCw, RotateCcw, Satellite, ScanLine, Target, Waves, X,
} from 'lucide-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

type Story = {
  id: string;
  kicker: string;
  title: string;
  short: string;
  body: string;
  accent: string;
  location: string;
  coordinates: string;
  date: string;
  metric: string;
  metricLabel: string;
  signal: string;
  observation: string;
};

const stories: Story[] = [
  {
    id: 'floods',
    kicker: '01 / WATER IN MOTION',
    title: 'Flood pulse',
    short: 'See a river delta redraw itself overnight.',
    body: 'When the clouds arrive, optical satellites go quiet. SAR keeps listening. Compare the radar texture before and after a flood to reveal the shape of water beneath the weather.',
    accent: '#d8f934',
    location: 'Mekong Delta, Vietnam',
    coordinates: '10.04° N  ·  105.77° E',
    date: '06 Oct 2024',
    metric: '4.8 km²',
    metricLabel: 'new water surface',
    signal: '−6.2 dB',
    observation: 'Sentinel-1 descending pass',
  },
  {
    id: 'ice',
    kicker: '02 / ICE IN RETREAT',
    title: 'Glacier drift',
    short: 'Follow a glacier as it inches toward the sea.',
    body: 'Ice moves slowly, but its radar signature leaves a precise trail. Stack repeat observations to turn a single image into a story of momentum, melt, and retreat.',
    accent: '#61d8e5',
    location: 'Jakobshavn Glacier, Greenland',
    coordinates: '69.17° N  ·  49.83° W',
    date: '22 Aug 2024',
    metric: '19.4 m/day',
    metricLabel: 'mean ice velocity',
    signal: '+2.1 dB',
    observation: 'Sentinel-1 ascending pass',
  },
  {
    id: 'fields',
    kicker: '03 / GROWING SIGNAL',
    title: 'Field rhythm',
    short: 'Read the season in a patchwork of farms.',
    body: 'A field can look unchanged to the eye while its structure shifts in radar. Track planting, irrigation, and harvest cycles with a sensor that sees texture, not just color.',
    accent: '#b898ff',
    location: 'Po Valley, Italy',
    coordinates: '45.05° N  ·  10.21° E',
    date: '14 May 2025',
    metric: '31%',
    metricLabel: 'backscatter change',
    signal: '−1.7 dB',
    observation: 'Sentinel-1 dual-pol',
  },
];

const markers = [
  { id: 'floods', latitude: 10.04, longitude: 105.77, label: 'Mekong Delta' },
  { id: 'ice', latitude: 69.17, longitude: -49.83, label: 'Jakobshavn Glacier' },
  { id: 'fields', latitude: 45.05, longitude: 10.21, label: 'Po Valley' },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3" data-testid="brand-logo">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[#d8f934]">
        <span className="absolute h-4 w-4 rounded-full border border-[#61d8e5]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#d8f934]" />
      </div>
      {!compact && <div className="leading-none"><div className="font-display text-[13px] font-bold tracking-[.06em] text-[#f0f3eb]">SAR / EARTH</div><div className="mt-1 font-mono text-[8px] tracking-[.18em] text-[#8191ad]">EXPLORER  ·  2026</div></div>}
    </div>
  );
}

function ResponsiveLogo() {
  return (
    <>
      <span className="hidden md:inline-flex">
        <Logo />
      </span>
      <span className="inline-flex md:hidden">
        <Logo compact />
      </span>
    </>
  );
}

function TeamWordmark() {
  return (
    <div className="team-wordmark" aria-label="Team PERIAPSYS">
      <div className="team-wordmark-name">PERIAPSYS</div>
      <div className="team-wordmark-subtitle">NASA · ISRO · NISAR EARTH OBSERVATORY</div>
    </div>
  );
}

function Reveal({
  children,
  className = '',
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'li';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -64px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Component = Tag as 'div';
  return (
    <Component
      ref={ref}
      className={`reveal-on-scroll ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Component>
  );
}

function NasaBackdrop() {
  const [assets, setAssets] = useState<{
    satellite: string | null;
    solar: string | null;
    spacecraft: string | null;
    earth: string | null;
  }>({ satellite: null, solar: null, spacecraft: null, earth: null });

  useEffect(() => {
    const controller = new AbortController();
    fetchNasaBackdropAssets(controller.signal)
      .then((nextAssets) => {
        setAssets({
          satellite: nextAssets.satellite?.imageUrl ?? null,
          solar: nextAssets.solar?.imageUrl ?? null,
          spacecraft: nextAssets.spacecraft?.imageUrl ?? null,
          earth: nextAssets.earth?.imageUrl ?? null,
        });
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="nasa-backdrop" aria-hidden="true">
      {assets.solar && (
        <div
          className="nasa-backdrop-image nasa-backdrop-solar"
          style={{ backgroundImage: `url("${assets.solar}")` }}
        />
      )}
      {assets.earth && (
        <div
          className="nasa-backdrop-image nasa-backdrop-earth"
          style={{ backgroundImage: `url("${assets.earth}")` }}
        />
      )}
      {assets.satellite && (
        <div
          className="nasa-backdrop-image nasa-backdrop-satellite"
          style={{ backgroundImage: `url("${assets.satellite}")` }}
        />
      )}
      {assets.spacecraft && (
        <div
          className="nasa-backdrop-image nasa-backdrop-spacecraft"
          style={{ backgroundImage: `url("${assets.spacecraft}")` }}
        />
      )}
      <div className="nasa-backdrop-grid" />
      <div className="nasa-backdrop-scan" />
    </div>
  );
}

function StatusBadge({ children }: { children: string }) {
  return <span className="mini-capsule inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.13em]"><span className="status-dot" />{children}</span>;
}

function Landing() {
  const [, setLocation] = useLocation();
  return (
    <main className="noise starfield min-h-screen overflow-hidden">
      <NasaBackdrop />
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12 md:py-7">
        <ResponsiveLogo />
        <TeamWordmark />
        <div className="hidden items-center gap-8 md:flex">
          <a href="#brief" className="font-mono text-[10px] uppercase tracking-[.14em] text-[#a4b3cb] transition hover:text-[#d8f934]" data-testid="link-brief">The brief</a>
          <a href="#signals" className="font-mono text-[10px] uppercase tracking-[.14em] text-[#a4b3cb] transition hover:text-[#d8f934]" data-testid="link-signals">Why SAR</a>
          <button onClick={() => setLocation('/explore')} className="button-lime rounded-full px-5 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[.11em]" data-testid="button-nav-explore">Open explorer <ArrowRight className="ml-2 inline h-3.5 w-3.5" /></button>
        </div>
        <button className="rounded-full border border-white/15 p-2 text-[#c1cde1] md:hidden" aria-label="Open navigation" data-testid="button-mobile-menu"><Menu className="h-5 w-5" /></button>
      </nav>

      <section className="landing-grid relative z-[1] mx-auto max-w-[1500px] items-center px-6 pb-16 pt-10 md:px-12 md:pt-14">
        <div className="max-w-[600px]">
          <div className="reveal mb-7 flex items-center gap-3"><StatusBadge>Mission window open</StatusBadge><span className="font-mono text-[10px] text-[#7789a8]">NASA SPACE APPS · 2026</span></div>
          <p className="reveal reveal-delay-1 eyebrow mb-5 text-[#61d8e5]">A field guide to the invisible</p>
          <h1 className="reveal reveal-delay-1 font-display text-[clamp(3.65rem,8vw,7.7rem)] font-extrabold leading-[.87] tracking-[-.075em] text-[#f4f1e7]">Dancing<br /><span className="text-[#d8f934]">with</span> the<br />SARs<span className="text-[#61d8e5]">.</span></h1>
          <p className="reveal reveal-delay-2 mt-8 max-w-[470px] text-[17px] leading-[1.55] text-[#aebbd0]">Radar sees through clouds and works in the dark, so it catches change that optical satellites miss. NISAR launched in July 2025 and reads the ground with two radar bands at once — a first for any single spacecraft.</p>
          <div className="reveal reveal-delay-3 mt-9 flex flex-wrap gap-3">
            <button onClick={() => setLocation('/explore')} className="button-lime group rounded-full px-6 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[.12em]" data-testid="button-start-exploring">Start exploring <ArrowRight className="ml-2 inline h-4 w-4 transition group-hover:translate-x-1" /></button>
            <a href="#brief" className="button-ghost rounded-full px-6 py-3.5 font-mono text-[11px] uppercase tracking-[.12em]" data-testid="link-read-brief">Read the brief <ArrowDownRight className="ml-2 inline h-4 w-4" /></a>
          </div>
          <div className="reveal reveal-delay-4 mt-14 grid max-w-[490px] grid-cols-3 gap-5 border-t border-white/15 pt-5">
            <div><div className="font-mono text-[9px] uppercase tracking-[.15em] text-[#7586a3]">Mission</div><div className="mt-2 text-sm text-[#e2e6ed]">Dancing with the SARs</div></div>
            <div><div className="font-mono text-[9px] uppercase tracking-[.15em] text-[#7586a3]">Sensor</div><div className="mt-2 text-sm text-[#e2e6ed]">NISAR radar</div></div>
            <div><div className="font-mono text-[9px] uppercase tracking-[.15em] text-[#7586a3]">For</div><div className="mt-2 text-sm text-[#e2e6ed]">Curious humans</div></div>
          </div>
        </div>
        <div className="relative flex min-h-[420px] items-center justify-center md:min-h-[700px]">
          <div className="absolute right-[12%] top-[17%] hidden items-center gap-2 md:flex"><span className="h-px w-16 bg-[#61d8e5]/60" /><span className="font-mono text-[9px] uppercase tracking-[.14em] text-[#8ca8be]">synthetic aperture radar</span></div>
          <div className="hero-globe">
            <svg viewBox="0 0 600 600" aria-label="Stylized radar view of Earth" role="img">
              <defs><radialGradient id="earthGlow" cx="34%" cy="25%"><stop offset="0" stopColor="#376d74" /><stop offset=".62" stopColor="#183c4a" /><stop offset="1" stopColor="#0e1827" /></radialGradient><clipPath id="heroClip"><circle cx="300" cy="300" r="240" /></clipPath></defs>
              <circle cx="300" cy="300" r="240" fill="url(#earthGlow)" />
              <g clipPath="url(#heroClip)" opacity=".25" fill="none" stroke="#8fd9cb" strokeWidth="1"><ellipse cx="300" cy="300" rx="235" ry="72" /><ellipse cx="300" cy="300" rx="235" ry="144" /><ellipse cx="300" cy="300" rx="72" ry="235" /><ellipse cx="300" cy="300" rx="144" ry="235" /><path d="M60 245 Q300 310 540 245M60 363 Q300 290 540 363" /></g>
              <g clipPath="url(#heroClip)" fill="#528b7b" stroke="#a3d4ba" strokeWidth="1" opacity=".8"><path d="M165 163l35-28 50 8 25 27-17 35-39 12-20 34-34-18-12-37z" /><path d="M288 245l35-17 37 16 25 50-12 37-26 15-12 62-28 59-25-23 8-80-25-52z" /><path d="M406 174l67 14 43 40-20 23-46-13-32-30z" /><path d="M410 312l53-8 49 37-22 30-50 7-38-27z" /></g>
              <g fill="#d8f934"><circle cx="206" cy="223" r="5" /><circle cx="408" cy="349" r="5" /><circle cx="374" cy="246" r="4" /></g>
              <circle cx="300" cy="300" r="240" fill="none" stroke="#81d8db" strokeOpacity=".55" />
              <path d="M70 305 H530" stroke="#d8f934" strokeOpacity=".28" strokeDasharray="4 10" />
            </svg>
          </div>
          <div className="absolute bottom-[14%] left-[8%] max-w-[225px] border-l border-[#d8f934] pl-4 md:left-[3%]"><div className="font-mono text-[9px] uppercase tracking-[.13em] text-[#d8f934]">Orbit note  /  001</div><p className="mt-2 text-[13px] leading-snug text-[#aebbd0]">Radar does not need sunlight. It brings its own.</p></div>
          <div className="absolute right-[4%] top-[45%] hidden w-24 border border-[#61d8e5]/30 bg-[#123240]/30 p-3 text-center md:block"><div className="font-mono text-[8px] tracking-[.12em] text-[#61d8e5]">LIVE PASS</div><div className="mt-1 text-xl text-[#e8f4ef]">12:47</div><div className="font-mono text-[8px] text-[#90a4b8]">LOCAL TIME</div></div>
        </div>
      </section>

      <section id="brief" className="relative z-[1] border-t border-white/10 bg-[#101528]/80 px-6 py-24 md:px-16 md:py-32">
        <Reveal className="mx-auto grid max-w-[1280px] gap-14 md:grid-cols-[.8fr_1.2fr] md:gap-24">
          <div><p className="eyebrow text-[#61d8e5]">The challenge / 2026</p><h2 className="mt-5 font-display text-4xl font-bold leading-[.98] tracking-[-.05em] text-[#f3f0e8] md:text-6xl">The surface is<br /><span className="text-[#d8f934]">never still.</span></h2></div>
          <div><p className="max-w-[650px] text-[20px] leading-[1.42] text-[#d2dae6]">A field can look identical from one week to the next and still be moving underneath. Radar catches that — the centimeters a fault slips, the meters a glacier front retreats, the acres a delta gains or loses to a flood.</p><p className="mt-6 max-w-[650px] text-[15px] leading-[1.65] text-[#8f9eb5]">Most of that motion never reaches anyone outside a research paper. NASA Space Apps 2026 asked teams to close that gap using data from NISAR, the joint NASA–ISRO radar mission: take a real surface-change story and make it legible to someone who has never heard of backscatter. That's what we built here — this explorer, and a companion tool for scoring where new development sites would do the least ecological harm.</p><button onClick={() => setLocation('/explore')} className="mt-9 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.14em] text-[#d8f934] hover:text-white" data-testid="button-brief-explore">Enter the field <ArrowRight className="h-4 w-4" /></button></div>
        </Reveal>
      </section>

      <section aria-label="Mission specifications" className="relative z-[1] border-t border-white/10 px-6 py-16 md:px-16">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-4">
            {[
              { label: 'Launched', value: 'Jul 30, 2025', sub: 'GSLV-F16, Sriharikota' },
              { label: 'Radar bands', value: 'L-band + S-band', sub: '24 cm & 10 cm wavelength' },
              { label: 'Repeat cycle', value: '12 days', sub: 'full pole-to-pole coverage' },
              { label: 'Data policy', value: 'Free & open', sub: 'via NASA Earthdata / ASF' },
            ].map((stat, index) => (
              <Reveal key={stat.label} delay={index * 90} className="bg-[#0c0f1c] p-6 md:p-8">
                <div className="font-mono text-[9px] uppercase tracking-[.13em] text-[#7b8da9]">{stat.label}</div>
                <div className="mt-3 font-display text-xl font-bold tracking-[-.02em] text-[#eef1e8] md:text-2xl">{stat.value}</div>
                <div className="mt-1 text-[11px] text-[#7f90aa]">{stat.sub}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="signals" className="relative z-[1] px-6 py-24 md:px-16 md:py-32">
        <Reveal className="mx-auto max-w-[1280px]">
          <div className="flex flex-wrap items-end justify-between gap-6"><div><p className="eyebrow text-[#61d8e5]">The instrument / why SAR</p><h2 className="mt-5 font-display text-4xl font-bold tracking-[-.05em] text-[#f3f0e8] md:text-5xl">A different way of seeing.</h2></div><p className="max-w-[300px] font-mono text-[10px] uppercase leading-[1.65] tracking-[.1em] text-[#7e90ae]">Three properties make radar a useful witness.</p></div>
          <div className="mt-14 grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-3">
            {[
              { icon: Radio, no: '01', title: 'All weather', text: 'The Mekong flood story on this site was recorded under cloud cover that would have blanked out an ordinary camera. Radar wavelengths pass straight through.' },
              { icon: Orbit, no: '02', title: 'Day or night', text: "NISAR carries its own illumination, so a 6 AM pass and a 6 PM pass return equally usable data. No waiting on the sun." },
              { icon: Waves, no: '03', title: 'Texture over color', text: 'Two fields can look the same shade of green and still return very different radar signals, because SAR reads roughness and moisture, not light reflected off the surface.' },
            ].map(({ icon: Icon, no, title, text }, index) => <Reveal key={no} delay={index * 90} className="bg-[#11162a] p-8 transition hover:bg-[#172039] md:p-10"><div className="flex items-start justify-between"><Icon className="h-7 w-7 text-[#d8f934]" strokeWidth={1.3} /><span className="font-mono text-[10px] text-[#697995]">{no}</span></div><h3 className="mt-14 font-display text-2xl font-bold tracking-[-.04em] text-[#eef0e8]">{title}</h3><p className="mt-3 text-[14px] leading-[1.6] text-[#8f9eb5]">{text}</p></Reveal>)}
          </div>
        </Reveal>
      </section>

      <NasaGallery />

      <footer className="relative z-[1] flex flex-col justify-between gap-6 border-t border-white/10 px-6 py-9 md:flex-row md:items-center md:px-16"><div className="font-mono text-[9px] uppercase tracking-[.13em] text-[#6e7e9b]">Built by team PERIAPSYS for the 2026 NASA Space Apps Challenge</div><button onClick={() => setLocation('/explore')} className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.13em] text-[#d8f934]" data-testid="button-footer-explore">Go to explorer <ArrowRight className="h-4 w-4" /></button></footer>
    </main>
  );
}

function NasaGallery() {
  const [images, setImages] = useState<NasaGalleryImage[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchNasaGallery(controller.signal)
      .then(setImages)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
      });
    return () => controller.abort();
  }, []);

  if (images.length === 0) return null;

  return (
    <section aria-label="Mission image references" className="relative z-[1] border-t border-white/10 px-6 py-24 md:px-16 md:py-32">
      <div className="mx-auto max-w-[1280px]">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow text-[#61d8e5]">From the archive</p>
            <h2 className="mt-5 font-display text-4xl font-bold tracking-[-.05em] text-[#f3f0e8] md:text-5xl">What the record already shows.</h2>
          </div>
          <p className="max-w-[320px] font-mono text-[10px] uppercase leading-[1.65] tracking-[.1em] text-[#7e90ae]">Live results from the NASA Image and Video Library, pulled fresh on every visit.</p>
        </Reveal>
        <div className="gallery-grid mt-14">
          {images.map((image, index) => (
            <Reveal key={image.nasaId} delay={(index % 3) * 90} className="gallery-item">
              <img src={image.imageUrl} alt={image.title} loading="lazy" />
              <div className="gallery-caption">
                <span className="font-mono text-[9px] uppercase tracking-[.1em] text-[#61d8e5]">{String(index + 1).padStart(2, '0')}</span>
                <p>{image.caption}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorldMap({ activeLayer, longitude }: { activeLayer: string; longitude: number }) {
  return (
    <svg viewBox="0 0 600 500" role="img" aria-label="Radar map of Earth surface changes">
      <defs><clipPath id="mapClip"><circle cx="300" cy="250" r="224" /></clipPath><radialGradient id="mapEarth" cx="34%" cy="28%"><stop offset="0" stopColor="#315d63" /><stop offset=".7" stopColor="#1a3346" /><stop offset="1" stopColor="#101827" /></radialGradient></defs>
      <circle cx="300" cy="250" r="224" fill="url(#mapEarth)" />
      <g clipPath="url(#mapClip)" transform={`translate(${longitude * 0.55} 0)`}>
        <g fill="none" stroke="#7ab4b5" strokeOpacity=".28" strokeWidth=".8"><ellipse cx="300" cy="250" rx="222" ry="55" /><ellipse cx="300" cy="250" rx="222" ry="110" /><ellipse cx="300" cy="250" rx="222" ry="170" /><ellipse cx="300" cy="250" rx="70" ry="222" /><ellipse cx="300" cy="250" rx="140" ry="222" /><path d="M75 208 Q300 160 525 208M75 298 Q300 342 525 298" /></g>
        <g><path className="map-path" d="M106 135l33-27 45 3 25 24 38-7 25 20-16 24-39 4-32 26-39-10-15 24-25-12 10-28z" /><path className="map-path-alt" d="M203 218l25 6 23 35-10 43 15 33-20 55-26 28-19-46 8-44-20-43 12-38z" /><path className="map-path" d="M342 137l32-18 49 11 38 33 40 19 32 34-32 17-33-16-34 1-35-31-32 7-16-30z" /><path className="map-path-alt" d="M403 269l34-14 52 14 36 42-21 25-56-2-25-25-42-5z" /><path className="map-path" d="M455 379l30 2 24 17-15 13-45-6z" /><path className="map-path-alt" d="M287 112l20-19 14 18-12 20z" /></g>
        {activeLayer === 'radar' && <g opacity=".75" fill="none" stroke="#d8f934" strokeWidth="2" strokeDasharray="1 8"><path d="M64 235 Q180 160 280 220T540 215" /><path d="M70 324 Q200 268 330 330T550 300" /><path d="M120 150 Q300 240 480 155" /></g>}
        {activeLayer === 'change' && <g fill="#b898ff" opacity=".75"><circle cx="182" cy="195" r="12" /><circle cx="410" cy="292" r="18" /><circle cx="338" cy="359" r="9" /></g>}
        <path d="M300 20V480M75 250H525" stroke="#a7d7cf" strokeOpacity=".22" strokeDasharray="3 9" />
      </g>
      <circle cx="300" cy="250" r="224" fill="none" stroke="#85cfd5" strokeOpacity=".54" />
      <circle cx="300" cy="250" r="235" fill="none" stroke="#d8f934" strokeOpacity=".2" strokeDasharray="2 11" />
    </svg>
  );
}

function LiveNasaData({
  onSnapshot,
  onSelectEvent,
}: {
  onSnapshot: (snapshot: NasaSnapshot) => void;
  onSelectEvent: (event: NasaEvent) => void;
}) {
  const [snapshot, setSnapshot] = useState<NasaSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetchNasaSnapshot(controller.signal)
      .then((nextSnapshot) => {
        setSnapshot(nextSnapshot);
        onSnapshot(nextSnapshot);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  };

  useEffect(() => load(), []);

  return (
    <div className="live-nasa-panel border-t border-white/10 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="eyebrow text-[#899ab5]">Live NASA data</div>
        <button
          onClick={load}
          className="rounded-full p-1.5 text-[#8497b2] transition hover:bg-white/10 hover:text-white"
          aria-label="Refresh NASA data"
          data-testid="button-refresh-nasa-data"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {loading && (
        <p className="font-mono text-[10px] uppercase tracking-[.08em] text-[#8495b0]">
          Querying Earthdata CMR…
        </p>
      )}
      {!loading && error && (
        <div className="space-y-3">
          <p className="text-[12px] leading-[1.5] text-[#b7c3d5]">
            NASA Earthdata could not be reached from this browser session.
          </p>
          <a
            href="https://cmr.earthdata.nasa.gov/search/collections.json?keyword=NISAR"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.1em] text-white hover:underline"
          >
            Open NASA CMR <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
      {!loading && !error && snapshot && (
        <div className="space-y-3">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[.1em] text-[#8495b0]">
              NISAR collection
            </div>
            <div className="mt-1 text-[12px] leading-[1.4] text-[#e4e8e8]">
              {snapshot.collectionTitle}
            </div>
          </div>
          <div className="data-row flex items-start justify-between gap-3 py-2">
            <span className="text-[11px] text-[#8495b0]">Latest granule</span>
            <span className="max-w-[150px] text-right font-mono text-[9px] leading-[1.4] text-[#e4e8e8]">
              {snapshot.latestGranuleDate
                ? new Date(snapshot.latestGranuleDate).toLocaleDateString()
                : 'No recent granule'}
            </span>
          </div>
          <div className="data-row flex items-start justify-between gap-3 py-2">
            <span className="text-[11px] text-[#8495b0]">EONET event</span>
            <span className="max-w-[150px] text-right text-[10px] leading-[1.4] text-[#e4e8e8]">
              {snapshot.latestEventTitle ?? 'No open event'}
            </span>
          </div>
          <div className="pt-1 text-[10px] leading-[1.5] text-[#8495b0]">
            Source: NASA Earthdata CMR + Earth Observatory Natural Event Tracker.
          </div>
           {snapshot.liveEvents.length > 0 && (
             <div className="border-t border-white/10 pt-3">
               <div className="mb-2 font-mono text-[9px] uppercase tracking-[.1em] text-[#8495b0]">
                 Live observation locations
               </div>
               <div className="space-y-1.5">
                 {snapshot.liveEvents.slice(0, 4).map((event) => (
                   <button
                     key={event.id}
                     onClick={() => onSelectEvent(event)}
                     className="live-event-row flex w-full items-center justify-between gap-3 rounded px-2 py-2 text-left transition hover:bg-white/10"
                   >
                     <span className="min-w-0">
                       <span className="block truncate text-[10px] text-[#e4e8e8]">{event.title}</span>
                       <span className="mt-0.5 block font-mono text-[8px] uppercase tracking-[.08em] text-[#8495b0]">
                         {event.category}
                       </span>
                     </span>
                     <span className="shrink-0 font-mono text-[8px] text-[#b7c3d5]">
                       {event.latitude.toFixed(1)}° / {event.longitude.toFixed(1)}°
                     </span>
                   </button>
                 ))}
               </div>
             </div>
           )}
        </div>
      )}
      <div className="mt-5 grid gap-2 border-t border-white/10 pt-4">
        <a
          href="https://www.isro.gov.in/NISAR.html"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[.1em] text-[#b7c3d5] hover:text-white"
        >
          ISRO / NISAR mission page <ExternalLink className="h-3 w-3" />
        </a>
        <a
          href="https://www.drdo.gov.in/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[.1em] text-[#b7c3d5] hover:text-white"
        >
          DRDO official portal <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

function Explorer() {
  const [, setLocation] = useLocation();
  const [storyId, setStoryId] = useState('floods');
  const [date, setDate] = useState(68);
  const [layers, setLayers] = useState({ radar: true, optical: false, change: true, orbit: true });
  const [longitude, setLongitude] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [liveEvents, setLiveEvents] = useState<NasaEvent[]>([]);
  const liveEvent = liveEvents.find((event) => `event-${event.id}` === storyId);
  const baseStory = stories.find((item) => item.id === storyId) ?? stories[0];
  const story: Story = liveEvent
    ? {
        id: storyId,
        kicker: 'LIVE / NASA EONET',
        title: liveEvent.title,
        short: `${liveEvent.category} reported at a current NASA event location.`,
        body: `${liveEvent.description ?? 'NASA EONET has reported a live natural event at this location.'} Use this point to identify a NISAR observation window and compare surface conditions over time.`,
        accent: '#ffffff',
        location: liveEvent.title,
        coordinates: `${liveEvent.latitude.toFixed(2)}° N · ${liveEvent.longitude.toFixed(2)}° E`,
        date: liveEvent.date
          ? new Date(liveEvent.date).toLocaleDateString()
          : 'Current event',
        metric: 'LIVE',
        metricLabel: liveEvent.category,
        signal: 'NASA EONET',
        observation: 'Live event point',
      }
    : baseStory;
  const liveMarkers = liveEvents.map((event) => ({
    id: `event-${event.id}`,
    latitude: event.latitude,
    longitude: event.longitude,
    label: event.title,
  }));
  const globeMarkers = [...markers, ...liveMarkers];
  const month = date < 36 ? 'APR 2024' : date < 70 ? 'OCT 2024' : date < 90 ? 'MAY 2025' : 'AUG 2025';

  const toggleLayer = (key: keyof typeof layers) => setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <main className="explorer-shell noise">
       <header className="relative z-20 flex h-16 items-center justify-between border-b border-white/10 bg-[#101528]/95 px-4 md:px-6">
         <div className="flex items-center gap-4"><button onClick={() => setLocation('/')} aria-label="Back to challenge" className="rounded-full p-2 text-[#92a2ba] transition hover:bg-white/10 hover:text-white" data-testid="button-back-home"><ArrowLeft className="h-4 w-4" /></button><ResponsiveLogo /><span className="hidden h-5 w-px bg-white/15 md:block" /><span className="hidden font-mono text-[9px] uppercase tracking-[.15em] text-[#7b8da9] md:block">Mission control / Earth changes</span></div>
         <TeamWordmark />
        <div className="flex items-center gap-3"><div className="hidden items-center gap-2 font-mono text-[9px] uppercase tracking-[.12em] text-[#7f90aa] md:flex"><span className="status-dot" /> Data stream nominal</div><button onClick={() => setMenuOpen(!menuOpen)} className="rounded-full border border-white/15 p-2 text-[#b4c4d9] md:hidden" aria-label="Toggle explorer controls" data-testid="button-toggle-controls">{menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button><button className="hidden rounded-full border border-white/15 p-2 text-[#9bacbf] transition hover:border-[#d8f934]/60 hover:text-[#d8f934] md:block" aria-label="Explorer help" data-testid="button-explorer-help"><CircleHelp className="h-4 w-4" /></button></div>
      </header>
      <div className="explorer-layout">
        <aside className={`sidebar ${menuOpen ? 'block' : 'hidden md:block'}`} aria-label="Story controls">
          <div className="border-b border-white/10 p-5"><div className="eyebrow text-[#61d8e5]">Field notebook</div><h1 className="mt-2 font-display text-xl font-bold tracking-[-.03em]">Choose a surface story</h1><p className="mt-2 text-[12px] leading-[1.5] text-[#8999b4]">Every mark on the globe is a question waiting for a better signal.</p></div>
          <div className="space-y-2 p-4">
            {stories.map((item) => <button key={item.id} onClick={() => setStoryId(item.id)} className={`story-card block w-full rounded-lg border p-4 text-left ${item.id === storyId ? 'active' : 'border-white/10 bg-transparent'}`} style={item.id === storyId ? { borderColor: item.accent } : undefined} data-testid={`button-story-${item.id}`}><div className="flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-[.12em]" style={{ color: item.accent }}>{item.kicker}</span>{item.id === storyId && <Check className="h-3.5 w-3.5" style={{ color: item.accent }} />}</div><div className="mt-2 font-display text-[17px] font-bold text-[#edf0e8]">{item.title}</div><div className="mt-1 text-[11px] leading-[1.4] text-[#8899b4]">{item.short}</div></button>)}
          </div>
           {liveEvents.length > 0 && (
             <div className="border-t border-white/10 p-4">
               <div className="mb-3 flex items-center justify-between">
                 <div className="eyebrow text-[#899ab5]">NASA live points</div>
                 <span className="font-mono text-[9px] text-[#b7c3d5]">{liveEvents.length} tracked</span>
               </div>
               <div className="space-y-1.5">
                 {liveEvents.slice(0, 4).map((event) => (
                   <button
                     key={event.id}
                     onClick={() => setStoryId(`event-${event.id}`)}
                     className={`live-event-row flex w-full items-center gap-2 rounded px-2 py-2 text-left transition hover:bg-white/10 ${storyId === `event-${event.id}` ? 'active' : ''}`}
                   >
                     <span className="status-dot h-1.5 w-1.5 shrink-0" />
                     <span className="min-w-0 truncate text-[10px] text-[#d8dfe8]">{event.title}</span>
                   </button>
                 ))}
               </div>
             </div>
           )}
          <div className="border-t border-white/10 p-5"><div className="mb-4 flex items-center justify-between"><div className="eyebrow text-[#899ab5]">Visible layers</div><button onClick={() => setLayers({ radar: true, optical: false, change: true, orbit: true })} className="font-mono text-[9px] uppercase tracking-[.1em] text-[#6f829f] hover:text-[#d8f934]" data-testid="button-reset-layers"><RotateCcw className="mr-1 inline h-3 w-3" /> reset</button></div><div className="space-y-1.5">{([{ key: 'radar', label: 'SAR backscatter', icon: Radar }, { key: 'optical', label: 'Optical reference', icon: Eye }, { key: 'change', label: 'Change detection', icon: ScanLine }, { key: 'orbit', label: 'Orbit geometry', icon: Orbit }] as const).map(({ key, label, icon: Icon }) => <button key={key} onClick={() => toggleLayer(key)} className={`layer-toggle flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[11px] ${layers[key] ? 'active' : 'text-[#71839f]'}`} data-testid={`button-layer-${key}`}><span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" />{label}</span>{layers[key] ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}</button>)}</div></div>
          <div className="p-5"><div className="flex items-start gap-3 rounded-md border border-[#61d8e5]/20 bg-[#61d8e5]/[.04] p-3"><MousePointer2 className="mt-0.5 h-4 w-4 shrink-0 text-[#61d8e5]" /><p className="font-mono text-[9px] leading-[1.6] text-[#8da7b8]">DRAG THE GLOBE<br /><span className="text-[#d4e3e4]">to rotate the view</span></p></div></div>
        </aside>
        <section className="globe-stage" aria-label="Interactive Earth view">
          <div className="explorer-overlay absolute left-5 top-5 z-10 md:left-8 md:top-7"><div className="eyebrow text-[#61d8e5]">Live observation / {story.id.toUpperCase()}</div><h2 className="mt-2 font-display text-3xl font-bold tracking-[-.05em] text-[#eef1e8] md:text-5xl">{story.title}</h2></div>
          <div className="explorer-overlay absolute right-5 top-5 z-10 text-right md:right-8 md:top-7"><div className="font-mono text-[9px] uppercase tracking-[.12em] text-[#8496b2]">View longitude</div><div className="mt-1 font-mono text-sm text-[#d8f934]">{longitude > 0 ? '+' : ''}{longitude.toFixed(1)}°</div></div>
          <div className="globe-wrap" data-testid="interactive-globe">
            <div className="globe-halo" />
             <EarthGlobe3D
              activeStory={storyId}
               markers={globeMarkers}
              showOrbit={layers.orbit}
              showRadar={layers.radar}
              showChange={layers.change}
              onSelectStory={setStoryId}
              onRotate={setLongitude}
            />
          </div>
          <div className="explorer-overlay absolute bottom-5 left-5 right-5 z-10 md:bottom-7 md:left-8 md:right-8"><div className="mx-auto max-w-[700px]"><div className="mb-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-[.12em] text-[#8999b3]"><span>Apr 2024</span><span className="text-[#d8f934]">{month} · observation date</span><span>Aug 2025</span></div><input type="range" min="0" max="100" value={date} onChange={(event) => setDate(Number(event.target.value))} className="timeline-track h-1 w-full cursor-pointer appearance-none rounded-full" style={{ '--progress': `${date}%` } as React.CSSProperties} aria-label="Scrub observation date" data-testid="input-timeline" /><div className="mt-3 flex items-center justify-between"><div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.1em] text-[#8191aa]"><CalendarDays className="h-3.5 w-3.5 text-[#d8f934]" /> 16 repeat passes indexed</div><button className="flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.1em] text-[#bac6d8] transition hover:border-[#d8f934]/60 hover:text-[#d8f934]" data-testid="button-play-timeline"><Play className="h-3 w-3 fill-current" /> play sequence</button></div></div></div>
           <div className="explorer-overlay absolute bottom-28 left-5 z-10 hidden items-center gap-2 md:flex"><span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-[#10172a]/70"><Compass className="h-3.5 w-3.5 text-[#61d8e5]" /></span><span className="font-mono text-[9px] uppercase tracking-[.1em] text-[#8192ab]">north / radar view</span></div>
        </section>
        <aside className="panel-right hidden md:block" aria-label="Observation details">
          <div className="border-b border-white/10 p-5"><div className="flex items-center justify-between"><div className="eyebrow text-[#61d8e5]">Selected location</div><MapPin className="h-4 w-4 text-[#d8f934]" /></div><h2 className="mt-3 font-display text-2xl font-bold leading-[1.05] tracking-[-.04em] text-[#eef1e8]">{story.location}</h2><p className="mt-2 font-mono text-[10px] tracking-[.06em] text-[#8495b0]">{story.coordinates}</p><div className="mt-4 flex flex-wrap gap-2"><span className="tag rounded-full px-2 py-1 font-mono text-[9px]">NISAR</span><span className="tag rounded-full px-2 py-1 font-mono text-[9px]">L-BAND</span><span className="tag rounded-full px-2 py-1 font-mono text-[9px]">S-BAND</span></div></div>
          <div className="border-b border-white/10 p-5"><div className="eyebrow text-[#899ab5]">What the radar sees</div><p className="mt-3 text-[13px] leading-[1.62] text-[#b7c3d5]">{story.body}</p><button className="mt-4 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.12em] text-[#d8f934]" data-testid="button-read-context">Read context <ArrowRight className="h-3.5 w-3.5" /></button></div>
          <div className="border-b border-white/10 p-5"><div className="mb-4 flex items-center justify-between"><div className="eyebrow text-[#899ab5]">Observation data</div><Database className="h-4 w-4 text-[#8497b2]" /></div><div className="data-row flex items-center justify-between py-3"><span className="text-[11px] text-[#8495b0]">Observed</span><span className="font-mono text-[10px] text-[#e4e8e8]">{story.date}</span></div><div className="data-row flex items-center justify-between py-3"><span className="text-[11px] text-[#8495b0]">{story.metricLabel}</span><span className="font-mono text-[10px] text-[#d8f934]">{story.metric}</span></div><div className="data-row flex items-center justify-between py-3"><span className="text-[11px] text-[#8495b0]">Signal delta</span><span className="font-mono text-[10px] text-[#61d8e5]">{story.signal}</span></div><div className="flex items-center justify-between py-3"><span className="text-[11px] text-[#8495b0]">Acquisition</span><span className="font-mono text-[10px] text-[#e4e8e8]">{story.observation}</span></div></div>
          <div className="m-5 rounded-lg border border-[#d8f934]/20 bg-[#d8f934]/[.05] p-4"><div className="flex gap-3"><Target className="mt-0.5 h-4 w-4 shrink-0 text-[#d8f934]" /><div><div className="font-mono text-[9px] uppercase tracking-[.13em] text-[#d8f934]">Challenge prompt</div><p className="mt-2 text-[12px] leading-[1.5] text-[#bdc9d5]">How would you help someone notice this change without needing to be a radar scientist?</p></div></div></div>
          <div className="px-5 pb-6"><div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.1em] text-[#71829d]"><Satellite className="h-3.5 w-3.5 text-[#61d8e5]" /> Sentinel-1 / NISAR data lineage</div></div>
            <LiveNasaData
              onSnapshot={(snapshot) => setLiveEvents(snapshot.liveEvents)}
              onSelectEvent={(event) => setStoryId(`event-${event.id}`)}
            />
        </aside>
      </div>
    </main>
  );
}

function Router() {
  return <ErrorBoundary resetKey={window.location.pathname}><Switch><Route path="/" component={Landing} /><Route path="/explore" component={Explorer} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;