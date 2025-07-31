type DynamicRoutes = {
	"/projects/[projectId]": { projectId: string };
	"/projects/[projectId]/backup": { projectId: string }
};

type Layouts = {
	"/(app)": undefined;
	"/": { projectId?: string };
	"/auth": undefined;
	"/auth/callback": undefined;
	"/(app)/backup": undefined;
	"/projects": { projectId?: string };
	"/projects/[projectId]": { projectId: string };
	"/projects/[projectId]/backup": { projectId: string }
};

export type RouteId = "/(app)" | "/" | "/auth" | "/auth/callback" | "/(app)/backup" | "/projects" | "/projects/[projectId]" | "/projects/[projectId]/backup";

export type RouteParams<T extends RouteId> = T extends keyof DynamicRoutes ? DynamicRoutes[T] : Record<string, never>;

export type LayoutParams<T extends RouteId> = Layouts[T] | Record<string, never>;

export type Pathname = "/" | "/auth" | "/auth/callback" | "/backup" | "/projects" | `/projects/${string}` & {} | `/projects/${string}/backup` & {};

export type ResolvedPathname = `${"" | `/${string}`}${Pathname}`;

export type Asset = "/favicon.svg";