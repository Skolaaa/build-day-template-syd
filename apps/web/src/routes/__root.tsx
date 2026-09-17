import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TooltipProvider } from "#/components/ui/tooltip";
import Footer from "../components/footer";
import Header from "../components/header";
import SearchPalette from "../components/journal/search-palette";
import ThemedToaster from "../components/themed-toaster";

import ClerkProvider from "../integrations/clerk/provider";

import appCss from "../styles.css?url";

// Two things before first paint: apply the saved theme so night mode never
// flashes paper, and record the browser's timezone in a cookie so the server
// can work out what "today" means for this reader (see readerToday()).
const INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}try{var tz=Intl.DateTimeFormat().resolvedOptions().timeZone;if(tz){document.cookie='tz='+encodeURIComponent(tz)+'; path=/; max-age=31536000; samesite=lax'}}catch(e){}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Life on a Shelf",
      },
      {
        name: "description",
        content: "A private journal that fills a bookshelf as you write.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html className="light" lang="en" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static init script, no user input */}
        <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="paper-grain flex min-h-dvh flex-col font-sans antialiased [overflow-wrap:anywhere] selection:bg-accent/25">
        <ClerkProvider>
          <TooltipProvider>
            <Header />
            {/* flex-1 pushes the footer to the bottom on short pages. */}
            <div className="flex-1 pb-20">{children}</div>
            <Footer />
            <SearchPalette />
            <ThemedToaster />
            <TanStackDevtools
              config={{
                position: "bottom-right",
              }}
              plugins={[
                {
                  name: "Tanstack Router",
                  render: <TanStackRouterDevtoolsPanel />,
                },
              ]}
            />
          </TooltipProvider>
        </ClerkProvider>
        <Scripts />
      </body>
    </html>
  );
}
