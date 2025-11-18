import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScoredSuggestion {
  title: string;
  link: string;
  snippet: string;
  score: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    // Input validation
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (query.trim().length === 0) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (query.length > 500) {
      return new Response(JSON.stringify({ error: 'Query too long' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Basic sanitization for URL encoding
    const sanitizedQuery = query.trim();

    const apiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const searchEngineId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');

    if (!apiKey || !searchEngineId) {
      console.error('Missing API credentials', { hasApiKey: !!apiKey, hasSearchEngineId: !!searchEngineId });
      return new Response(JSON.stringify({ 
        error: 'Missing API credentials',
        details: 'Please ensure both GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID are configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Using Search Engine ID:', searchEngineId.substring(0, 5) + '...');

    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(sanitizedQuery)}&num=5`;

    console.log('Fetching search suggestions for:', sanitizedQuery);

    const response = await fetch(searchUrl);
    const data = await response.json();

    if (!response.ok) {
      console.error('Google Search API error:', data);
      return new Response(JSON.stringify({ error: 'Search API error', details: data }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map and score results for prioritization
    const scoredSuggestions = (data.items || []).map((item: any) => {
      const link = item.link.toLowerCase();
      const title = item.title.toLowerCase();
      let score = 0;
      
      // Prioritize official education domains
      if (link.includes('.edu')) score += 50;
      if (link.includes('.gov')) score += 40;
      if (link.includes('.k12.')) score += 40;
      if (link.includes('.org')) score += 20;
      
      // Boost official-looking titles and content
      if (title.includes('official') || title.includes('homepage')) score += 30;
      if (title.includes('university') || title.includes('college') || title.includes('school')) score += 20;
      if (title.includes('academic calendar') || title.includes('registrar')) score += 25;
      
      // Penalize non-official sources
      if (link.includes('wikipedia')) score -= 30;
      if (link.includes('reddit') || link.includes('facebook') || link.includes('twitter')) score -= 40;
      if (title.includes('review') || title.includes('forum')) score -= 20;
      
      return {
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        score
      };
    });
    
    // Sort by score (highest first) and take top 5
    const suggestions = scoredSuggestions
      .sort((a: ScoredSuggestion, b: ScoredSuggestion) => b.score - a.score)
      .slice(0, 5)
      .map(({ title, link, snippet }: ScoredSuggestion) => ({ title, link, snippet }));

    console.log('Found suggestions:', suggestions.length, '(prioritized official sources)');

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in search-suggestions function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
