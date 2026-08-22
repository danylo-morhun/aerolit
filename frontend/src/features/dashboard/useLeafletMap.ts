import L from 'leaflet';
import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';

/** Berlin, framed so the whole sensor network fits at the default zoom. */
export const BERLIN_CENTER: L.LatLngExpression = [52.5155, 13.3777];
export const DEFAULT_ZOOM = 10;

const TILE_TEMPLATE = 'https://{s}.basemaps.cartocdn.com/{style}/{z}/{x}/{y}{r}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * Owns the Leaflet instance for one container.
 *
 * Leaflet is imperative and long-lived; Vue is declarative and re-renders.
 * Keeping the map object, its tile layer and its teardown inside a composable
 * means the component stays a template plus a data watcher, and there is
 * exactly one place responsible for destroying the instance — the leak this
 * kind of integration usually ships with.
 *
 * The basemap swaps with the theme rather than staying light, because the
 * brief requires the theme to cover map tiles too: a bright rectangle in the
 * middle of a dark dashboard is the one thing that gives away a half-done
 * dark mode.
 */
export function useLeafletMap(container: Ref<HTMLElement | null>, isDark: Ref<boolean>) {
  const map = ref<L.Map | null>(null);
  let tileLayer: L.TileLayer | null = null;

  function tileUrl(dark: boolean): string {
    return TILE_TEMPLATE.replace('{style}', dark ? 'dark_all' : 'light_all');
  }

  let resizeObserver: ResizeObserver | null = null;

  onMounted(() => {
    if (!container.value) return;

    const instance = L.map(container.value, {
      center: BERLIN_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: true,
      // Scroll-zoom would hijack the page scroll on the way past the map;
      // the explicit +/- control and pinch-zoom cover both input types.
      scrollWheelZoom: false,
      doubleClickZoom: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(instance);

    tileLayer = L.tileLayer(tileUrl(isDark.value), {
      attribution: ATTRIBUTION,
      maxZoom: 19,
      detectRetina: true,
    }).addTo(instance);

    map.value = instance;

    // Leaflet measures its container once, at construction. Here the container
    // is a grid child that settles *after* mount — and it also changes height
    // when the layout switches to the stacked tablet arrangement. Without this
    // the map renders against a stale size and leaves a band of empty tiles.
    resizeObserver = new ResizeObserver(() => instance.invalidateSize({ animate: false }));
    resizeObserver.observe(container.value);
  });

  /** Frames the given points, with a floor on zoom so one station isn't a street map. */
  function fitTo(points: readonly L.LatLngExpression[]): void {
    const instance = map.value;
    if (!instance || points.length === 0) return;
    instance.fitBounds(L.latLngBounds([...points]).pad(0.12), { maxZoom: 13, animate: false });
  }

  watch(isDark, (dark) => {
    tileLayer?.setUrl(tileUrl(dark));
  });

  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    map.value?.remove();
    map.value = null;
    tileLayer = null;
  });

  return { map, fitTo };
}
