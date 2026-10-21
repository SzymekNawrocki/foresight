import { Region, ThreadId, Topic } from "@foresight/shared";
import {
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
  type RouterHistory,
} from "@tanstack/react-router";
import { AuthCallbackPage } from "./auth-ui.js";
import { BriefingPage, NotFoundPage, RegionPage, TopicPage } from "./pages.js";
import { Shell } from "./Shell.js";
import { ThreadPage } from "./threads.js";

const rootRoute = createRootRoute({ component: Shell, notFoundComponent: NotFoundPage });

const briefingRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: BriefingPage });

// Parametry z adresu też są wejściem z zewnątrz: tylko znane Regiony i Tematy, reszta → 404.
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
  component: function RegionRoute() {
    return <RegionPage region={regionRoute.useParams().region} />;
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
  component: function TopicRoute() {
    return <TopicPage topic={topicRoute.useParams().topic} />;
  },
});

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

const callbackRoute = createRoute({ getParentRoute: () => rootRoute, path: "/auth/callback", component: AuthCallbackPage });

const routeTree = rootRoute.addChildren([briefingRoute, regionRoute, topicRoute, threadRoute, callbackRoute]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, ...(history && { history }) });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
