# Abre el Historial como gerencia en iPhone (WebKit, como Safari) y en Chromium; imprime solo conteos y errores.
from playwright.sync_api import sync_playwright
token = open('/tmp/diag-token').read().strip()
with sync_playwright() as p:
    for name, browser in [('webkit-iphone', p.webkit), ('chromium', p.chromium)]:
        b = browser.launch()
        ctx = b.new_context(**(p.devices['iPhone 13'] if name.startswith('webkit') else {'viewport': {'width': 390, 'height': 844}}))
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))
        pg.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
        pg.goto('http://localhost:8080/')
        pg.evaluate("t=>{localStorage.setItem('ch-token',JSON.stringify(t));localStorage.setItem('ch-passkey-skip','true')}", token)
        pg.goto('http://localhost:8080/#/global'); pg.reload(); pg.wait_for_timeout(2500)
        tabs = pg.locator('.tabbar a, nav a').all_inner_texts()
        pg.goto('http://localhost:8080/#/historial'); pg.wait_for_timeout(3000)
        n = pg.locator('[data-hist]').count()
        who = pg.locator('[data-hist] small b').count()
        err_box = pg.locator('.error, .err-box, .errbox').all_inner_texts()
        det = ''
        if n:
            pg.locator('[data-hist]').first.click(); pg.wait_for_timeout(1500)
            det = 'detalle abierto' if pg.locator('.sheet h3').count() else 'detalle NO abrió'
        print(f'{name}: pestañas={[t.strip() for t in tabs]} · reservas en pantalla={n} · con quién registró={who} · {det} · caja de error={err_box[:1]}')
        for e in errs[:8]: print('   ', e)
        b.close()
