import { onRequest } from '../functions/api/[[path]].js';

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    return onRequest({ request, env, params: { path }, ctx });
  }
};
