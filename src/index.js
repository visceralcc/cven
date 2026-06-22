export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/fal') {
      return handleFalProxy(request, env);
    }

    if (url.pathname === '/api/contact') {
      return handleContact(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ─── Contact Form Handler ────────────────────────────────────────────

async function handleContact(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
  }

  try {
    const { name, email, message } = await request.json();

    if (!name || !email || !message) {
      return Response.json({ error: 'All fields are required' }, { status: 400, headers: CORS });
    }

    // Send email via Cloudflare Email Service
    await env.EMAIL.send({
      from: 'noreply@cven.cc',
      to: 'info@cven.cc',
      subject: `Contact Form: ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      html: `<h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <hr>
        <p>${message.replace(/\n/g, '<br>')}</p>`,
    });

    return Response.json({ ok: true }, { headers: CORS });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: CORS });
  }
}

// ─── fal.ai Proxy (Avatar Forge) ─────────────────────────────────────

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
    const { model, prompt, image_size, num_inference_steps,
            guidance_scale, image_url, image_urls } = body;

    const falBody = { prompt };

    if (image_url) {
      falBody.image_url = image_url;
    }
    if (image_urls && image_urls.length > 0) {
      falBody.image_urls = image_urls;
    }

    if (!image_url && !image_urls) {
      falBody.image_size = image_size || 'square_hd';
      falBody.num_images = 1;
      falBody.output_format = 'png';
    }

    falBody.enable_safety_checker = false;
    if (num_inference_steps) falBody.num_inference_steps = num_inference_steps;
    if (guidance_scale) falBody.guidance_scale = guidance_scale;

    const res = await fetch(`https://fal.run/${model}`, {
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

    return Response.json(data, { headers: corsHeaders });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
