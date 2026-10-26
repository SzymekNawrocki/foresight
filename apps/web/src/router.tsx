import { Region, ThreadId, Topic } from "@foresight/shared";
import {
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";
import { AuthCallbackPage } from "./auth-ui.js";
import { type StreamSearch, topicsOf } from "./filters.js";
import { NotFoundPage } from "./pages.js";
import { RadarPage } from "./radar.js";
import { Shell } from "./Shell.js";
import { StreamPage } from "./stream.js";
import { InboxPage, ThreadPage, ThreadsPage } from "./threads.js";

const rootRoute = createRootRoute({ component: Shell, notFoundComponent: NotFoundPage });

const briefingRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: RadarPage });

// Filtry z adresu też są wejściem z zewnątrz: nieznany Region, Temat czy Waga zamienia się w brak filtra.
// Klucze zostają jawnie (undefined), bo bez tego przebiłaby się surowa wartość z adresu.
const streamRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stream",
  validateSearch: (search: Record<string, unknown>): StreamSearch => {
    const region = Region.safeParse(search.region);
    const topics = topicsOf(search.topic);
    return {
      region: region.success ? region.data : undefined,
      topic: topics.length ? topics.join(",") : undefined,
      weight: search.weight === 2 || search.weight === 3 ? search.weight : undefined,
    };
  },
  component: function StreamRoute() {
    return <StreamPage filter={streamRoute.useSearch()} />;
  },
});

// Strony Regionów i Tematów stały się filtrami Strumienia (#71); stare adresy dalej działają.
const regionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/region/$region",
  params: {
    parse: ({ region }) => {
      const parsed = Region.safeParse(region);
      if (!parsed.success) throw notFound();
      return { region: parsed.data };
    },
    stringify: ({ region }) => ({ region }),
  },
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/stream", search: { region: params.region }, replace: true });
  },
});

const topicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/topic/$topic",
  params: {
    parse: ({ topic }) => {
      const parsed = Topic.safeParse(topic);
      if (!parsed.success) throw notFound();
      return { topic: parsed.data };
    },
    stringify: ({ topic }) => ({ topic }),
  },
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/stream", search: { topic: params.topic }, replace: true });
  },
});

const threadsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/threads", component: ThreadsPage });

const threadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/thread/$id",
  params: {
    parse: ({ id }) => {
      const parsed = ThreadId.safeParse(id);
      if (!parsed.success) throw notFound();
      return { id: parsed.data };
    },
    stringify: ({ id }) => ({ id }),
  },
  component: function ThreadRoute() {
    return <ThreadPage id={threadRoute.useParams().id} />;
  },
});

const inboxRoute = createRoute({ getParentRoute: () => rootRoute, path: "/inbox", component: InboxPage });

const callbackRoute = createRoute({ getParentRoute: () => rootRoute, path: "/auth/callback", component: AuthCallbackPage });

const routeTree = rootRoute.addChildren([
  briefingRoute,
  streamRoute,
  regionRoute,
  topicRoute,
  threadsRoute,
  threadRoute,
  inboxRoute,
  callbackRoute,
]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, ...(history && { history }) });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
