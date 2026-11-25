"""SIEG website: Python 3.10+, no extra packages. python app.py or --build."""
import argparse
import base64
import html
from hashlib import sha256
import json
import re
import shutil
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
SERVICES = [
 ('land-evaluation','SIEG Fields','Understand the potential of a place.','Soil, terrain, climate and crop analysis.',['Soils','Crop suitability','Climate'],'suitability_url','Open SIEG Fields'),
 ('irrigation','SIEG Irrigate','Design water around your land.','Locate land, compare systems and calculate a preliminary irrigation BOQ.',['Soil and terrain assessment','Water and hydraulic calculations','Materials and labour'],'irrigation_url','Open SIEG Irrigate'),
 ('hydrology','SIEG Hydrology','Understand your water landscape.','Catchments, rainfall and water intelligence.',['Water availability','Flood scenarios','Assessments'],'hydrology_url','Open SIEG Hydrology'),
 ('environmental-monitoring','SIEG Eco','See environmental change.','Explore environmental change worldwide.',['Land condition','Biodiversity','Environmental pressures'],'environment_url','Open SIEG Eco'),
 ('property-selection','SIEG Estate','Explore properties.','Map-based property discovery.',['Properties','Area insights','Accessibility'],'property_url','Open SIEG Estate'),
 ('eswatini-geocoding','SIEG Address','Give every homestead a place on the map.','GPS entrance capture and provisional address cards.',['Entrance GPS','Address cards','Navigation links'],'geocoding_url','Open SIEG Address'),
 ('transit','SIEG Transit','Your bus. Your stop. A clearer journey.','Live buses, routes, stops and estimated arrivals using smartphones.',['Live buses','Bus stops','Arrival estimates'],'transit_url','Open SIEG Transit'),
 ('education','SIEG Learn','Teach creatively. Learn together.','Topic photos, engaging lesson plans, AI study support and subject study groups.',['Teacher studio','Student support','Study groups'],'education_url','Open SIEG Learn'),
 ('talent-pool','SIEG Experts','Connect with practical expertise.','Find the skills for your project.',['Surveying','Building trades','Home services'],'talent_url','Open SIEG Experts'),
 ('business-directory','SIEG Business','Put your business on the world map.','An international directory connected to SIEG Address.',['Company profiles','Global business map','Annual directory subscriptions'],'business_url','Open SIEG Business')
]

SOCIAL_ICONS = {
 'facebook': '<path d="M14 22v-9h3l.5-4H14V7c0-1 .4-2 2-2h2V1.5C17 1.2 16 1 15 1c-3 0-5 2-5 5v3H7v4h3v9z"/>',
 'whatsapp': '<path fill="none" stroke="currentColor" stroke-width="1.8" d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.4-4.7A8.5 8.5 0 1 1 20.5 11.6Z"/><path d="M8 6.7c-.6-.2-1.3.2-1.5.9-.5 1.8 1 4.5 3 6.3 2 1.8 4.7 3 6.1 2.2.7-.4 1-1.3.8-1.7l-2.5-1.2-.9 1c-1.6-.5-3.3-2-4-3.5l.8-.9Z"/>',
 'linkedin': '<path d="M4 8H1v14h3zM2.5 1a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM8 8v14h4v-8c0-3 4-3 4 0v8h4v-9c0-6-6-6-8-3V8Z"/>',
 'instagram': '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.2"/>'
}

def social_footer(config):
    from urllib.parse import urlparse
    links=config.get('social_links',{})
    items=[]
    for key,icon in SOCIAL_ICONS.items():
        label={'facebook':'Facebook','whatsapp':'WhatsApp','linkedin':'LinkedIn','instagram':'Instagram'}[key]
        url=links.get(key,'')
        svg=f'<svg viewBox="0 0 24 24" aria-hidden="true">{icon}</svg>'
        if url and urlparse(url).scheme=='https' and urlparse(url).netloc:
            control=f'<a class="social-icon" href="{html.escape(url,quote=True)}" target="_blank" rel="noopener noreferrer" aria-label="SIEG on {label} (opens in a new tab)">{svg}</a>'
        else:
            control=f'<button class="social-icon" type="button" disabled aria-label="{label} — profile link not configured" title="{label} profile link not configured">{svg}</button>'
        items.append(f'<div class="social-item">{control}<span class="social-label">{label}</span></div>')
    return '<div class="footer-social" aria-label="Social media"><div class="social-row">'+''.join(items)+'</div></div>'

PROCEDURE_STEPS = {
 'fields': ['Upload your AOI, or search & draw it', 'Choose services and map layers', 'Choose the analysis year', 'Review price & pay', 'Run your analysis', 'View results or request a report'],
 'eco': ['Upload your AOI, or search & draw it', 'Choose services and map layers', 'Choose years and settings', 'Review price & pay', 'Run your analysis', 'View results or request a report'],
 'hydrology': ['Upload your AOI or locate a catchment', 'Choose water services and layers', 'Review analysis settings', 'Review price & pay', 'Run your analysis', 'View results or request a report / mapping files'],
 'irrigate': ['Upload your field, or search & draw it', 'Place the pump inside or outside the field', 'Choose system and design inputs', 'Review price & pay', 'Calculate and review layout / costs', 'Request your irrigation report'],
 'estate': ['Choose an area or search the map', 'Filter and browse properties', 'Select a property', 'Review details and nearby amenities', 'Request a property report'],
 'address': ['Sign in and stand at your entrance', 'Capture GPS at 10 m accuracy or better', 'Confirm the address and entrance details', 'Save your address and create the card', 'Print, save PDF or share directions'],
 'experts': ['Choose the trade you need', 'Browse specialist profiles', 'Send your project brief', 'Review scope and the SIEG service fee', 'Review specialist options', 'Agree the work and payment with your specialist'],
 'learn': ['Choose a teaching or study tool', 'Select a plan when required', 'Create or upload your materials', 'Study, teach or collaborate', 'Download or share your work']
}

def service_procedure(key):
    # The map drawers and interactive tour now explain each workflow.
    return ''

def build():
    config=json.loads((ROOT/'site_config.json').read_text())
    template=(ROOT/'home.html').read_text()
    footer=(ROOT/'footer.html').read_text().replace('__SOCIAL_LINKS__',social_footer(config))
    footer += '<div class="sieg-data-attribution" style="font:11px/1.6 Arial;padding:12px 4%;color:#536f77;background:#f5f7f2"><p class="sieg-data-credit">Administrative boundaries: <a href="https://www.geoboundaries.org/">geoBoundaries gbOpen / CGAZ</a> · William &amp; Mary geoLab and contributors (Runfola et al., 2020) · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Filtered/simplified for location context where applicable.</p></div><script src="assets/data-attribution.js?v=20261117"></script>'
    page=template.replace('__SHARED_FOOTER__',footer).replace('__SITE_CONFIG__',json.dumps(config).replace('<','\\u003c'))
    out=ROOT/'dist';out.mkdir(exist_ok=True)
    shutil.copytree(ROOT/'assets',out/'assets',dirs_exist_ok=True)
    shutil.copyfile(ROOT/'site_config.json',out/'site_config.json')
    shutil.copyfile(ROOT/'report-payment.html',out/'report-payment.html')
    nav_script='''<script>const serviceMenu=document.getElementById('servicesMenu');document.addEventListener('click',e=>{if(serviceMenu&&!serviceMenu.contains(e.target))serviceMenu.open=false});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&serviceMenu&&serviceMenu.open){serviceMenu.open=false;serviceMenu.querySelector('summary').focus()}});</script>'''
    page=page.replace('</body>',nav_script+'</body>')
    (out/'index.html').write_text(page)
    head=page[:page.index('<main id="main">')]
    head=head.replace('href="#" aria-label="SIEG home"','href="index.html" aria-label="SIEG home"')
    head=re.sub(r'href="#(about|products|approach|experts|contact)"',r'href="index.html#\1"',head)
    head=head.replace('</head>','<script src="assets/fit-map.js?v=20261123-completion-fit"></script><script src="assets/auto-map-fit.js?v=20261121-canvas-fit"></script><script src="assets/hover-inspector.js?v=20261119"></script><link rel="stylesheet" href="assets/service-summary.css?v=20261119"><script defer src="assets/service-summary.js?v=20261119"></script><link rel="stylesheet" href="assets/service-guide.css?v=20261122-report-bar"><script defer src="assets/service-guide.js?v=20261122-report-bar"></script><link rel="stylesheet" href="assets/service-steps.css?v=20261119"><link rel="stylesheet" href="assets/workspace-refresh.css?v=20261122-report-bar"><script defer src="assets/workspace-refresh.js?v=20261122-report-bar"></script><script defer src="assets/legend-position.js?v=20261120-boundary-clearance"></script>'+'<link rel="stylesheet" href="assets/service-typography.css?v=20261112-readable"><link rel="stylesheet" href="assets/service-procedure.css?v=20261111-estate-flow"><link rel="stylesheet" href="assets/service-panels.css?v=20261114-report-footer"></head>')
    script="""<script>const $=id=>document.getElementById(id);$('year').textContent=new Date().getFullYear();$('menu').onclick=()=>{const open=$('navigation').classList.toggle('menu-open');$('menu').setAttribute('aria-expanded',String(open))};$('privacy').onclick=()=>{const modal=$('servicePrivacy');modal.showModal()};$('privacyClose').onclick=()=>$('servicePrivacy').close();</script>"""
    for slug,title,headline,description,topics,key,label in SERVICES:
        href=config.get(key,'')
        cta=f'<a class="btn" href="{html.escape(href,quote=True)}">{html.escape(label)} ↗</a>' if href else '<p><strong>In development:</strong> this service platform is not connected yet.</p>'
        body=f'''<main class="service-main" id="main"><div class="service-breadcrumb"><a href="index.html">Home</a> / <a href="index.html#products">Services</a> / {title}</div><div class="kicker" style="margin-top:40px">SIEG SERVICES</div><h1>{title}</h1><p class="lead">{headline}</p><div class="service-detail"><p>{description}</p><ul>{''.join('<li>'+x+'</li>' for x in topics)}</ul></div>{cta}<a class="btn" href="mailto:support@sieg.ltd?subject={slug}">Enquire about this service ↗</a><p><a class="inline-link" href="index.html#products">View all ten services →</a></p></main>'''
        privacy='<dialog id="servicePrivacy"><button class="close" id="privacyClose" aria-label="Close">✕</button><h2>Privacy & data</h2><p>SIEG uses signed-in accounts to store property listings, expert applications, project briefs and enquiries. Profiles, listings and testimonials are reviewed before publication. Testimonial submissions store your name, private email, rating, service, feedback, optional photo and publication consent. Contact details remain private to SIEG staff. Report orders store your contact details and analysed files for fulfilment. Favourites and shortlists stay in your browser. SIEG Address stores entrance coordinates, device-reported GPS accuracy, resident-supplied locality and access directions in your private address register. Printed cards and navigation links reveal the entrance location when shared. SIEG Business publishes a company’s consented contact details and entrance location during its one-time 7-day trial or active annual subscription. Expired listings are hidden; private addresses and profile drafts remain saved. Contact support@sieg.ltd to request corrections or deletion.</p></dialog>'
        service_head=head.replace('<title>SIEG | Beyond the Vision</title>',f'<title>{title} | SIEG</title>')
        (out/(slug+'.html')).write_text(service_head+body+footer+privacy+script+nav_script+'</body></html>')
    def illustrated_service(body, head, service):
        start = body.index('<p class="kicker"' if service == 'irrigate' else '<div class="kicker"')
        end = body.index('<section class="service-procedure"' if service == 'irrigate' else '</section>', start)
        intros = {
            'address': ('06 / SIEG ADDRESS', 'Every place matters.', 'Make yours easy to find.', 'Create a provisional digital address for your home, business or facility. Capture its entrance, then share a card, QR code or directions link.', 'entranceForm', 'Create your address', 'A residential entrance with a visible SIEG address sign on the gate pillar'),
            'learn': ('08 / SIEG LEARN', 'Teach with purpose.', 'Learn with confidence.', 'Bring books, lesson planning and study groups together. Create engaging teaching materials and help learners build understanding, one topic at a time.', 'learn-workspace', 'Explore learning tools', 'A teacher supporting students with books and a laptop in a bright classroom'),
            'fields': ('01 / SIEG FIELDS', 'Understand your land.', 'Grow its potential.', 'Explore soil, terrain, climate and crop health worldwide. Turn your field boundary into practical insights for your next growing decision.', 'agriFrame', 'Explore your field', 'Green crop rows across rolling farmland in southern Africa'),
            'irrigate': ('02 / SIEG IRRIGATE', 'Every drop matters.', 'Design it around your land.', 'Plan water demand, compare irrigation systems and review preliminary layouts and costs, all around the boundary of your field.', 'irMap', 'Plan your irrigation', 'A sprinkler watering green crop rows in morning sunlight'),
            'hydrology': ('03 / SIEG HYDROLOGY', 'Follow the water.', 'Understand the landscape.', 'Explore catchments, rainfall, surface water and groundwater screening. See how water connects your area to the wider landscape.', 'hydroFrame', 'Explore water insights', 'A winding freshwater river through a green valley'),
            'eco': ('04 / SIEG ECO', 'See the change.', 'Plan a healthier future.', 'Explore land cover, biodiversity and environmental pressures worldwide. Understand what is changing and where to look more closely.', 'enviroFrame', 'Explore your environment', 'Indigenous woodland and a natural stream in a lush green landscape'),
            'estate': ('05 / SIEG ESTATE', 'Find your place.', 'See the possibilities.', 'Discover homes and land worldwide. Explore property locations, nearby amenities and area insights before choosing your next move.', 'propertyFrame', 'Explore properties', 'A contemporary family home with a landscaped garden in southern Africa')
        }
        kicker, first, second, description, target, action, alt = intros[service]
        secondary = '<a class="service-intro-secondary" data-view="teacher-plans" href="#learn-workspace">Explore teacher plans</a>' if service == 'learn' else ''
        if service == 'address':
            secondary = '<a class="service-intro-secondary" href="#addressOffersTitle">Explore address services</a>'
        if service in ['fields','irrigate','hydrology','eco','estate']:
            sample_service = {'hydrology': 'Hydrology', 'irrigate': 'Irrigate', 'eco': 'Eco'}.get(service, 'Fields')
            sample_name = 'SIEG_'+sample_service+'_Sample_Report.pdf'
            secondary = '<a class="service-intro-secondary service-intro-sample" href="assets/sample-reports/'+sample_name+'" target="_blank" rel="noopener noreferrer" type="application/pdf" aria-label="View sample report: SIEG '+sample_service+' PDF (opens in a new tab)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h8"/></svg><span>View sample report</span></a>'

        copy = '<p class="kicker">'+kicker+'</p><h1>'+first+'<br><em>'+second+'</em></h1><p class="lead">'+description+'</p><div class="service-intro-actions"><a class="btn" href="#'+target+'">'+action+' ↘</a>'+secondary+'</div>'
        art = '<figure class="service-intro-image"><img class="service-illustration-art" src="assets/service-photos/'+service+'-v1.webp" alt="'+alt+'" width="1536" height="1024" fetchpriority="high" decoding="async"></figure>'
        hero = '<div class="service-illustration service-photo-intro"><div class="service-illustration-copy">'+copy+'</div>'+art+'</div>'
        css = '<link rel="stylesheet" href="assets/service-illustration.css?v=20261121-sample-report">'
        if service in ['fields','eco','hydrology','irrigate']:
            css += '<link rel="stylesheet" href="assets/analysis-layout.css?v=20261114-aoi-match">'
        return body[:start]+hero+body[end:], head.replace('</head>', css+'</head>', 1)

    # Bundle the existing Earth Engine workspace under the same website origin.
    shutil.copytree(ROOT/'enviro',out/'enviro',dirs_exist_ok=True)
    env_head=head.replace('<title>SIEG | Beyond the Vision</title>','<title>SIEG Eco | SIEG</title>')
    env_body="""<main id="main"><section class="service-main" style="min-height:0;padding-bottom:28px"><div class="service-breadcrumb"><a href="index.html">Home</a> / SIEG Eco</div><div class="kicker" style="margin-top:30px">SIEG / ENVIRONMENT</div><h1>SIEG Eco</h1><p class="lead">Environmental monitoring worldwide: land cover, biodiversity and environmental pressures.</p></section><iframe id="enviroFrame" title="SIEG Eco SIEG Eco dashboard" src="enviro/index.html" style="width:100%;height:1600px;border:0;display:block" allow="fullscreen"></iframe></main>"""
    env_body, env_head = illustrated_service(env_body, env_head, 'eco')
    env_body=env_body.replace('</section>',service_procedure('eco')+'</section>',1)
    integration_script="""<script>const envFrame=document.getElementById('enviroFrame');window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===envFrame.contentWindow&&e.data?.type==='siege-enviro-height'&&Number.isFinite(e.data.height)){envFrame.style.height=Math.min(25000,Math.max(900,e.data.height))+'px'}});</script>"""
    env_page=env_head+env_body+footer+privacy+script+nav_script+integration_script+'</body></html>'
    (out/'enviro-intelligence.html').write_text(env_page)
    # Retain old environmental service URL as an entry point to the integrated dashboard.
    (out/'environmental-monitoring.html').write_text(env_page)
    shutil.copytree(ROOT/'agri',out/'agri',dirs_exist_ok=True)
    agri_head=head.replace('<title>SIEG | Beyond the Vision</title>','<title>SIEG Fields | SIEG</title>')
    agri_body="""<main id="main"><section class="service-main" style="min-height:0;padding-bottom:28px"><div class="service-breadcrumb"><a href="index.html">Home</a> / SIEG Fields</div><div class="kicker" style="margin-top:30px">SIEG / LAND & AGRICULTURE</div><h1>SIEG Fields</h1><p class="lead">Agricultural insights worldwide: soil, land suitability, climate and crop health.</p></section><iframe id="agriFrame" title="SIEG Fields Earth Engine workspace" src="agri/index.html" style="width:100%;height:1150px;border:0;display:block"></iframe></main>"""
    agri_body, agri_head = illustrated_service(agri_body, agri_head, 'fields')
    agri_body=agri_body.replace('</section>',service_procedure('fields')+'</section>',1)
    agri_script="""<script>const agriFrame=document.getElementById('agriFrame');window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===agriFrame.contentWindow&&e.data?.type==='siege-agri-height'&&Number.isFinite(e.data.height)){agriFrame.style.height=Math.min(20000,Math.max(1000,e.data.height))+'px'}});</script>"""
    agri_page=agri_head+agri_body+footer+privacy+script+nav_script+agri_script+'</body></html>'
    (out/'agri-intelligence.html').write_text(agri_page)
    (out/'land-evaluation.html').write_text(agri_page)
    shutil.copytree(ROOT/'hydrology',out/'hydrology',dirs_exist_ok=True)
    hydro_head=head.replace('<title>SIEG | Beyond the Vision</title>','<title>SIEG Hydrology | SIEG</title>')
    hydro_body='<main id="main"><section class="service-main" style="min-height:0;padding-bottom:28px"><div class="service-breadcrumb"><a href="index.html">Home</a> / SIEG Hydrology</div><div class="kicker" style="margin-top:30px">SIEG / WATER</div><h1>SIEG Hydrology</h1><p class="lead">Water intelligence worldwide: catchments, reservoirs and groundwater.</p></section><iframe id="hydroFrame" title="SIEG Hydrology Earth Engine workspace" src="hydrology/index.html" style="width:100%;height:1400px;border:0;border-radius:24px;display:block"></iframe></main>'
    hydro_body, hydro_head = illustrated_service(hydro_body, hydro_head, 'hydrology')
    hydro_body=hydro_body.replace('</section>',service_procedure('hydrology')+'</section>',1)
    hydro_script="<script>const hf=document.getElementById('hydroFrame');window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===hf.contentWindow&&e.data?.type==='siege-hydrology-height'&&Number.isFinite(e.data.height))hf.style.height=Math.min(25000,Math.max(matchMedia('(max-width:800px)').matches?420:1000,e.data.height))+'px'})</script>"
    (out/'hydrology.html').write_text(hydro_head+hydro_body+footer+privacy+script+nav_script+hydro_script+'</body></html>')
    shutil.copytree(ROOT/'property',out/'property',dirs_exist_ok=True)
    property_head=head.replace('<title>SIEG | Beyond the Vision</title>','<title>SIEG Estate | SIEG</title>').replace('</head>','<link rel="stylesheet" href="assets/estate-mobile.css?v=20261115-alignment"></head>')
    property_body="""<main id="main"><section class="service-main" style="min-height:0;padding-bottom:25px"><div class="service-breadcrumb"><a href="index.html">Home</a> / SIEG Estate</div><div class="kicker" style="margin-top:25px">SIEG / PROPERTY</div><h1>SIEG Estate</h1><p class="lead">Explore houses, land and local amenities worldwide.</p></section><iframe id="propertyFrame" title="SIEG Estate worldwide property explorer" src="property/index.html?v=20261119-aligned-height" allow="geolocation" style="width:100%;height:1300px;border:0;display:block"></iframe></main>"""
    property_body, property_head = illustrated_service(property_body, property_head, 'estate')
    property_body=property_body.replace('</section>',service_procedure('estate')+'</section>',1)
    property_body=property_body.replace('</iframe></main>','</iframe></main>')
    property_script="""<style>.estate-account-section{display:grid;grid-template-columns:minmax(0,1fr) max-content;align-items:center;gap:24px}.estate-account-actions{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;justify-self:end;gap:10px}.estate-account-section .estate-account-actions :is(#estateAccountOpen,#estateAssistedOpen,#estateReportOpen){box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;margin:0;padding:15px 20px;border:1px solid #218b8c;border-radius:10px;background:#218b8c;color:#fff;font-size:14px;line-height:1.2;text-align:center;cursor:pointer}.estate-account-section .estate-account-actions #estateAssistedOpen{background:#fff;color:#176f73}@media(max-width:980px){.estate-account-section{grid-template-columns:minmax(0,1fr);gap:14px}}@media(max-width:520px){.estate-account-actions{width:100%;grid-auto-flow:row;grid-auto-columns:auto}}</style><script>const propertyFrame=document.getElementById('propertyFrame');function openEstateAction(type){propertyFrame.scrollIntoView({behavior:'smooth',block:'start'});propertyFrame.contentWindow.postMessage({type},location.origin)}const estateReportOpen=document.getElementById('estateReportOpen');if(estateReportOpen)estateReportOpen.onclick=()=>openEstateAction('sieg-estate-open-report');window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===propertyFrame.contentWindow&&e.data?.type==='siege-property-height'&&Number.isFinite(e.data.height)){propertyFrame.style.height=Math.min(25000,Math.max(matchMedia('(max-width:800px)').matches?420:1000,e.data.height))+'px'}});</script>"""
    property_script+='''<script>const estateGuide=document.querySelector('.estate-guide');if(estateGuide)estateGuide.open=!matchMedia('(max-width:700px)').matches;</script>'''
    property_page=property_head+property_body+footer+privacy+script+nav_script+property_script+'</body></html>'
    (out/'property-explorer.html').write_text(property_page)
    (out/'property-selection.html').write_text(property_page)
    shutil.copytree(ROOT/'talent',out/'talent',dirs_exist_ok=True)
    talent_head=head.replace('<title>SIEG | Beyond the Vision</title>','<title>SIEG Experts | SIEG</title>').replace('</head>','<link rel="stylesheet" href="talent/style.css?v=wrap-trade-cards"></head>')
    talent_body=(ROOT/'talent/content.html').read_text()
    talent_body += '<script type="application/json" id="expertTradeCatalogue">' + (ROOT/'assets/expert-trades.json').read_text().replace("<", r"\u003c") + '</script>'
    (out/'talent-pool.html').write_text(talent_head+talent_body+footer+privacy+script+nav_script+'<script src="assets/portrait-background.js"></script><script src="talent/app.js?v=live-trade-search"></script><script src="talent/graduate-map.js?v=2"></script><script src="talent/graduates.js?v=4"></script></body></html>')
    shutil.copytree(ROOT/'geocoding',out/'geocoding',dirs_exist_ok=True)
    geo_head=head.replace('<title>SIEG | Beyond the Vision</title>','<title>SIEG Address | SIEG</title>').replace('</head>','<link rel="stylesheet" href="agri/assets/leaflet.css"><link rel="stylesheet" href="geocoding/style.css?v=20261115-map-controls"><link rel="stylesheet" href="assets/map-workspace.css?v=20261118-search-fit"><link rel="stylesheet" href="assets/map-frame.css"><link rel="stylesheet" href="assets/service-actions.css"></head>')
    geo_body=(ROOT/'geocoding/content.html').read_text().replace('<div class="geo-tabs"',service_procedure('address')+'<div class="geo-tabs"',1)
    geo_body, geo_head = illustrated_service(geo_body, geo_head, 'address')
    geo_body=geo_body.replace('__SIEG_SAMPLE_LOGO__','data:image/png;base64,'+base64.b64encode((ROOT/'assets/sieg-logo-leaf-globe.png').read_bytes()).decode()).replace('__SIEG_SAMPLE_QR__',(ROOT/'geocoding/sample-address-qr.svg').read_text())
    geo_body=geo_body.replace('__SIEG_SIGN_IMAGE__','data:image/png;base64,'+base64.b64encode((ROOT/'geocoding/demo-physical-sign-v2.png').read_bytes()).decode())
    geo_scripts='<script src="assets/shared-analysis.js?v=20261114-below-map"></script><script src="assets/report-delivery.js?v=20261121-direct-download"></script><script src="agri/assets/leaflet.js"></script><script src="geocoding/engine.js?v=20261016-fees"></script><script src="geocoding/gps.js?v=20261105-10m"></script><script src="geocoding/model.js?v=20261107-short-entrance"></script><script src="geocoding/vendor/qrcode.js"></script><script src="education/vendor/jspdf.umd.min.js"></script><script src="education/fonts.js"></script><script src="geocoding/access.js?v=20261111-bundles"></script><script src="geocoding/print-templates.js?v=20261116-approved-designs"></script><script src="geocoding/map-controls.js?v=20261120-guide-request-layers"></script><script src="geocoding/app.js?v=20261121-canvas-fit-20261115-map-controls"></script><script src="geocoding/services.js?v=20261116-prices"></script>'
    (out/'eswatini-geocoding.html').write_text(geo_head+geo_body+footer+privacy+script+nav_script+geo_scripts+'</body></html>')
    (out/'geocoding.html').write_text((out/'eswatini-geocoding.html').read_text())
    shutil.copytree(ROOT/'business',out/'business',dirs_exist_ok=True)
    business_head=head.replace('<title>SIEG | Beyond the Vision</title>','<title>SIEG Business | Global business directory</title>').replace('</head>','<link rel="stylesheet" href="agri/assets/leaflet.css"><link rel="stylesheet" href="assets/map-workspace.css?v=20261118-search-fit"><link rel="stylesheet" href="business/style.css?v=20261115"></head>')
    business_scripts='<script src="agri/assets/leaflet.js"></script><script src="assets/world-map-layout.js?v=20261118-standard-height"></script><script src="geocoding/map-controls.js?v=20261120-guide-request-layers"></script><script src="geocoding/vendor/qrcode.js"></script><script src="business/demo.js"></script><script src="business/pricing.js"></script><script src="business/app.js"></script>'
    (out/'business-directory.html').write_text(business_head+(ROOT/'business/content.html').read_text()+footer+privacy+script+nav_script+business_scripts+'</body></html>')
    shutil.copytree(ROOT/'transit',out/'transit',dirs_exist_ok=True)
    transit_head=head.replace('<title>SIEG | Beyond the Vision</title>','<title>SIEG Transit | Buses, stops & arrivals</title>').replace('</head>','<link rel="stylesheet" href="agri/assets/leaflet.css"><link rel="stylesheet" href="assets/service-illustration.css?v=20261118"><link rel="stylesheet" href="transit/style.css?v=20261119-aligned"></head>')
    (out/'transit.html').write_text(transit_head+(ROOT/'transit/content.html').read_text()+footer+privacy+script+nav_script+'<script src="agri/assets/leaflet.js"></script><script src="transit/journey.js?v=20261118-traveller"></script><script src="transit/tracking.js?v=20261118-traveller"></script><script src="transit/controls.js?v=20261119-layers-only"></script><script src="transit/location.js?v=20261119-capture"></script><script src="transit/accounts.js?v=20261119-account-references"></script><script src="transit/app.js?v=20261121-canvas-fit-20261119-hover"></script></body></html>')
    shutil.copytree(ROOT/'resources',out/'resources',dirs_exist_ok=True)
    resources_head=head.replace('<title>SIEG | Beyond the Vision</title>','<title>Resources | SIEG</title>').replace('</head>','<link rel="stylesheet" href="agri/assets/leaflet.css"><link rel="stylesheet" href="assets/map-workspace.css?v=20261118-search-fit"><link rel="stylesheet" href="resources/style.css?v=20261116-admin-summary"></head>')
    resources_body=(ROOT/'resources/content.html').read_text()
    resources_scripts='<script defer src="assets/report-admin.js?v=20261122-report-references"></script><script defer src="agri/assets/leaflet.js"></script><script defer src="assets/boundary-data.js"></script><script defer src="resources/shapefile.js?v=20261118-capture-fields"></script><script defer src="assets/world-map-layout.js?v=20261118-standard-height"></script><script defer src="assets/fit-map.js?v=20261123-completion-fit"></script><script defer src="geocoding/map-controls.js?v=20261120-guide-request-layers"></script><script defer src="assets/polygon-tools.js?v=20261123-close-before-limit"></script><script defer src="resources/field-form.js?v=20261118-clean-examples"></script><script defer src="resources/capture-fields.js?v=20261118"></script><script defer src="resources/field-panels.js?v=20261118-edge-tab"></script><script defer src="resources/app.js?v=20261120-ui-fit"></script><script type="module" src="resources/cadastre.js?v=7000"></script><script type="module" src="resources/spatial-tools.js?v=line-shapefile"></script><script type="module" src="resources/coordinate-tools.js"></script><script type="module" src="resources/raster-join.js"></script><script defer src="assets/usage-admin.js?v=20261116-delete"></script><script defer src="resources/admin-panel.js?v=20261124-admin-inbox"></script>'
    resources_head=resources_head.replace('</head>','<link rel="stylesheet" href="resources/toolbox-launcher.css?v=20261118"><link rel="stylesheet" href="resources/measure-drawer.css?v=20261118"><link rel="stylesheet" href="resources/capture-workspace.css?v=20261118-edge-tab"></head>')
    resources_scripts+='<script defer src="resources/measure-drawer.js?v=20261118"></script><script defer src="resources/toolbox-launcher.js?v=20261119-admin-tools"></script>'
    (out/'resources.html').write_text(resources_head+resources_body+footer+privacy+script+nav_script+resources_scripts+'</body></html>')
    # New services share navigation, branding, footer and accessibility controls.
    for folder,title in [('irrigation','SIEG Irrigate'),('education','SIEG Learn')]:
        shutil.copytree(ROOT/folder,out/folder,dirs_exist_ok=True)
        custom_head=head.replace('<title>SIEG | Beyond the Vision</title>',f'<title>{title} | SIEG</title>').replace('</head>',f'<link rel="stylesheet" href="{folder}/style.css?v=20261030-slope"></head>')
        if folder=='irrigation':custom_head=custom_head.replace('irrigation/style.css?v=20261030-slope','irrigation/style.css?v=20261115-refined-controls').replace('</head>','<link rel="stylesheet" href="assets/header-navigation.css?v=20261118-consistent"><link rel="stylesheet" href="irrigation/layout-fixes.css?v=20261118"></head>')
        if folder=='education':custom_head=custom_head.replace('education/style.css?v=20261030-slope','education/style.css?v=20261119-aligned')
        body=(ROOT/folder/'content.html').read_text()
        if folder=='irrigation':
            body, custom_head = illustrated_service(body, custom_head, 'irrigate')
            body=re.sub(r'<section class="service-procedure".*?</section>','',body,count=1,flags=re.S)
        if folder=='education':
            body, custom_head = illustrated_service(body, custom_head, 'learn')
        if folder=='education':body=body.replace('__SIEG_CALL_LOGO__','data:image/png;base64,'+base64.b64encode((ROOT/'assets/sieg-logo-leaf-globe.png').read_bytes()).decode())
        scripts=(ROOT/folder/'scripts.html').read_text()
        (out/(folder+'.html')).write_text(custom_head+body+footer+privacy+script+nav_script+scripts+'</body></html>')
    top_button='<button class="back-to-top" id="backToTop" type="button" aria-label="Back to top of page" hidden><span aria-hidden="true">↑</span> Back to top</button>'
    top_script="""<script>(()=>{const b=document.getElementById('backToTop');const update=()=>b.hidden=window.scrollY<350;window.addEventListener('scroll',update,{passive:true});update();b.onclick=()=>{document.querySelector('.brand')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}})();</script>"""
    for target in out.glob('*.html'):
        if target.name=='index.html':continue
        content=target.read_text()
        content=content.replace('</body>',top_button+top_script+'</body>')
        target.write_text(content)
    # Share phone controls across full pages, embedded dashboards and late-created forms.
    for target in out.rglob('*.html'):
        content=target.read_text()
        phone_assets='<link rel="stylesheet" href="/assets/phone-input.css"><script defer src="/assets/phone-input.js"></script><link rel="stylesheet" href="/assets/mobile-layout.css">'
        if '</head>' in content:
            target.write_text(content.replace('</head>',phone_assets+'</head>',1))
    # Keep the HTML and its local scripts/styles on the same release, including embedded dashboards.
    # Asset versions use their contents so a cached prior stylesheet cannot hide a renamed map frame.
    asset_versions={}
    for target in out.rglob('*.html'):
        original=source=target.read_text()
        # Install the shared single-world policy before service scripts create Leaflet maps.
        if 'world-map-layout.js' not in source:
            source=re.sub(r'(<script\b[^>]*src="[^"]*/leaflet\.js(?:\?[^"]*)?"[^>]*></script>)',
                          r'\1<script src="/assets/world-map-layout.js"></script>',source,count=1)
        def version_asset(match):
            prefix,url,suffix=match.groups()
            path=url.split('?',1)[0]
            if path.startswith(('http:', 'https:', '//')) or ':' in path:
                return match[0]
            asset=(out/path.lstrip('/') if path.startswith('/') else target.parent/path).resolve()
            if not asset.is_relative_to(out.resolve()) or not asset.is_file():
                return match[0]
            if asset not in asset_versions:
                asset_versions[asset]=sha256(asset.read_bytes()).hexdigest()[:12]
            return prefix+path+'?v='+asset_versions[asset]+suffix
        updated=re.sub(r'((?:src|href)=")([^"]+\.(?:js|css|pdf)(?:\?[^"]*)?)(")',version_asset,source)
        if updated!=original:
            target.write_text(updated)
    return out

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build',action='store_true');parser.add_argument('--port',type=int,default=8000)
    args=parser.parse_args();out=build()
    if args.build:print(f'Built homepage and ten service pages in {out}')
    else:
        server=ThreadingHTTPServer(('127.0.0.1',args.port),partial(SimpleHTTPRequestHandler,directory=str(out)))
        print(f'Open http://127.0.0.1:{args.port}')
        try:server.serve_forever()
        except KeyboardInterrupt:server.server_close()
