import asyncio,json,os
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True)
  for w,h in [(1280,1800),(390,844)]:
   c=await b.new_context(viewport={"width":w,"height":h});pg=await c.new_page()
   if os.environ.get('LOVABLE_BROWSER_AUTH_STATUS')=='injected':
    await pg.goto('http://localhost:8080',wait_until='domcontentloaded')
    await pg.evaluate('([k,v])=>localStorage.setItem(k,v)',[os.environ['LOVABLE_BROWSER_SUPABASE_STORAGE_KEY'],os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON']])
   await pg.goto('http://localhost:8080/expenses',wait_until='domcontentloaded')
   await pg.locator('span[title="Synced"]').wait_for(timeout=45000)
   await pg.wait_for_timeout(1500)
   txt=await pg.locator('main').inner_text() if await pg.locator('main').count() else await pg.inner_text('body')
   print(w,'October' in txt or 'Oct' in txt, txt[:400].replace('\n',' | '))
   await pg.screenshot(path=f'exp{w}.png')
  await b.close()
asyncio.run(main())
