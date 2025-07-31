export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.svg"]),
	mimeTypes: {".svg":"image/svg+xml"},
	_: {
		client: {start:"_app/immutable/entry/start.BY6JYkMU.js",app:"_app/immutable/entry/app.C-sM7StX.js",imports:["_app/immutable/entry/start.BY6JYkMU.js","_app/immutable/chunks/DXZnKqI-.js","_app/immutable/chunks/C96VhvSi.js","_app/immutable/chunks/BAKKtip-.js","_app/immutable/chunks/C9sUR3Xw.js","_app/immutable/entry/app.C-sM7StX.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/BAKKtip-.js","_app/immutable/chunks/C9sUR3Xw.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/C96VhvSi.js","_app/immutable/chunks/B8FQCOyo.js","_app/immutable/chunks/Cv3ihBae.js","_app/immutable/chunks/Bi-hDZpV.js","_app/immutable/chunks/DrU4zZF5.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('../output/server/nodes/0.js')),
			__memo(() => import('../output/server/nodes/1.js')),
			__memo(() => import('../output/server/nodes/2.js')),
			__memo(() => import('../output/server/nodes/3.js')),
			__memo(() => import('../output/server/nodes/4.js')),
			__memo(() => import('../output/server/nodes/5.js')),
			__memo(() => import('../output/server/nodes/6.js')),
			__memo(() => import('../output/server/nodes/7.js')),
			__memo(() => import('../output/server/nodes/8.js'))
		],
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/auth/callback",
				pattern: /^\/auth\/callback\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/(app)/backup",
				pattern: /^\/backup\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/projects",
				pattern: /^\/projects\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/projects/[projectId]",
				pattern: /^\/projects\/([^/]+?)\/?$/,
				params: [{"name":"projectId","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 8 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
