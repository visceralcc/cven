export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/fal') {
      return handleFalProxy(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleFalProxy(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, {
      status: 405, headers: corsHeaders,
    });
  }

  const FAL_KEY = env.FAL_KEY;
  if (!FAL_KEY) {
    return Response.json({ error: 'FAL_KEY not configured' }, {
      status: 500, headers: corsHeaders,
    });
  }

  try {
    const body = await request.json();
    const { action, model, prompt, image_size, num_inference_steps,
            guidance_scale, request_id, image_url, image_urls } = body;

    if (action === 'submit') {
      const falBody = { prompt };

      // Image-to-image models (Kontext, Flux 2 Edit)
      if (image_url) {
        falBody.image_url = image_url;
      }
      if (image_urls && image_urls.length > 0) {
        falBody.image_urls = image_urls;
      }

      // Text-to-image params
      if (!image_url && !image_urls) {
        falBody.image_size = image_size || 'square_hd';
        falBody.num_images = 1;
        falBody.output_format = 'png';
      }

      falBody.enable_safety_checker = false;
      if (num_inference_steps) falBody.num_inference_steps = num_inference_steps;
      if (guidance_scale) falBody.guidance_scale = guidance_scale;

      const res = await fetch(`https://queue.fal.run/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(falBody),
      });

      const data = await res.json();
      if (!res.ok) {
        return Response.json({ error: data }, { status: res.status, headers: corsHeaders });
      }
      return Response.json({ request_id: data.request_id }, { headers: corsHeaders });

    } else if (action === 'status') {
      const res = await fetch(`https://queue.fal.run/${model}/requests/${request_id}/status`, {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
      });
      const data = await res.json();
      return Response.json(data, { headers: corsHeaders });

    } else if (action === 'result') {
      const res = await fetch(`https://queue.fal.run/${model}/requests/${request_id}`, {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
      });
      const data = await res.json();
      return Response.json(data, { headers: corsHeaders });

    } else {
      return Response.json({ error: 'Invalid action' }, { status: 400, headers: corsHeaders });
    }
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
