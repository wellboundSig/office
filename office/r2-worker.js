// ========================================
// Cloudflare Worker for R2 Image Uploads
// ========================================
//
// SETUP INSTRUCTIONS:
// 1. Go to Cloudflare Dashboard > Workers & Pages
// 2. Click "Create Worker"
// 3. Name it something like "wellbound-signature-upload"
// 4. Paste this code
// 5. Go to Settings > Variables > R2 Bucket Bindings
// 6. Add binding: Variable name = "BUCKET", R2 bucket = "wellbound"
// 7. Deploy the worker
// 8. Copy the worker URL (e.g., https://wellbound-signature-upload.YOUR-SUBDOMAIN.workers.dev)
// 9. Update CONFIG.uploadUrl in script.js with this URL
//
// GET ?key=signature-photos/foo.png  — CORS-friendly proxy for canvas circular masking
// POST multipart form (image + optional filename) — upload to R2
//
// ========================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // GET: proxy an R2 object with CORS so the browser can canvas-mask it
    if (request.method === "GET") {
      try {
        const url = new URL(request.url);
        let key = url.searchParams.get("key");

        // Also accept full public R2 URL and extract the key
        const src = url.searchParams.get("src");
        if (!key && src) {
          const marker = "/signature-photos/";
          const idx = src.indexOf(marker);
          if (idx !== -1) {
            key = src.substring(idx + 1); // signature-photos/...
          }
        }

        if (!key || !key.startsWith("signature-photos/")) {
          return new Response(JSON.stringify({ error: "Missing or invalid key" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          });
        }

        const object = await env.BUCKET.get(key);
        if (!object) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          });
        }

        const headers = new Headers(CORS_HEADERS);
        headers.set(
          "Content-Type",
          object.httpMetadata?.contentType || "image/png"
        );
        headers.set("Cache-Control", "public, max-age=86400");

        return new Response(object.body, { status: 200, headers });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: "Proxy failed", details: error.message }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          }
        );
      }
    }

    // Only allow POST for uploads
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    try {
      const formData = await request.formData();
      const file = formData.get("image");

      if (!file) {
        return new Response(JSON.stringify({ error: "No image provided" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      // Use custom filename if provided (from HR upload), otherwise auto-generate
      const customFilename = formData.get("filename");
      let filename;
      if (customFilename) {
        // HR upload: use the provided name (already formatted as firstname-lastname.ext)
        filename = `signature-photos/${customFilename}`;
      } else {
        // Signature generator: auto-generate unique filename (PNG for transparency)
        const timestamp = Date.now();
        const randomId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        filename = `signature-photos/${timestamp}_${randomId}.png`;
      }

      // Upload to R2
      const arrayBuffer = await file.arrayBuffer();
      await env.BUCKET.put(filename, arrayBuffer, {
        httpMetadata: {
          contentType: file.type || "image/png",
        },
      });

      // Return the public URL
      const publicUrl = `https://pub-d7fda00c74254211bfe47adcb51427b0.r2.dev/${filename}`;

      return new Response(
        JSON.stringify({
          success: true,
          url: publicUrl,
          filename: filename,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Upload failed",
          details: error.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    }
  },
};
