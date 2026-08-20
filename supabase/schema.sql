-- Schema para GmailToTheMoon (Adaptado de FlowNext)

-- 1. Tabla de Leads
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(255),
    ig_handle VARCHAR(100),
    follower_count INTEGER,
    niche VARCHAR(100),
    source VARCHAR(50) DEFAULT 'apify_ig',
    ai_summary TEXT,
    cold_email_subject VARCHAR(255),
    status VARCHAR(50) DEFAULT 'new', -- new, contacted, interested, meeting_booked, not_interested
    instantly_status VARCHAR(50) DEFAULT 'pending', -- pending, pushed, error
    campaign_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Tabla de Interacciones del AI Setter
CREATE TABLE IF NOT EXISTS public.ai_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    intent_type VARCHAR(50), -- interesado, objecion, no_interesado, pregunta
    user_reply TEXT NOT NULL,
    ai_response TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, replied, manual_intervention
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Tabla de Tareas de Búsqueda (Autopilot)
CREATE TABLE IF NOT EXISTS public.search_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(50) DEFAULT 'instagram',
    query VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'running', -- running, completed, failed
    apify_run_id VARCHAR(100),
    leads_found INTEGER DEFAULT 0,
    leads_pushed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS básico
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_tasks ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura/escritura abiertas para uso interno del server
CREATE POLICY "Enable all access for anon" ON public.leads FOR ALL USING (true);
CREATE POLICY "Enable all access for anon" ON public.ai_interactions FOR ALL USING (true);
CREATE POLICY "Enable all access for anon" ON public.search_tasks FOR ALL USING (true);
