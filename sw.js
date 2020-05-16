self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    if (url.origin == location.origin && url.pathname == "/test.txt")
        event.respondWith(new Response(null, { status: 418 }));
});
