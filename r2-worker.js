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
// ========================================

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Only allow POST requests
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    try {
      const formData = await request.formData();
      const file = formData.get("image");

      if (!file) {
        return new Response(JSON.stringify({ error: "No image provided" }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // Use custom filename if provided (from HR upload), otherwise auto-generate
      const customFilename = formData.get("filename");
      let filename;
      if (customFilename) {
        // HR upload: use the provided name (already formatted as firstname-lastname.ext)
        filename = `signature-photos/${customFilename}`;
      } else {
        // Signature generator: auto-generate unique filename
        const timestamp = Date.now();
        const randomId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        filename = `signature-photos/${timestamp}_${randomId}.jpg`;
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
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
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
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  },
};
