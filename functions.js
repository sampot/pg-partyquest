export default {
  async fetch(request) {
    return Response.json({
      ok: true,
      name: "pg-partyquest",
      path: new URL(request.url).pathname,
    });
  },
};
